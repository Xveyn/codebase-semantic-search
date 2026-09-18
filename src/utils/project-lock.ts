import { getIndexLockPath, normalizeProjectPath } from "./paths.js";
import { withIndexFileLock } from "./index-lock.js";

/**
 * Per-project queue for index writes (init, reindex, index_update).
 *
 * Parallel subagents share one MCP server process, so these tools can run at the
 * same time: concurrent appends duplicate rows, concurrent deletes fail with
 * LanceDB commit conflicts. The queue orders calls within this process; each write
 * then takes the index lock file, which makes other server processes fail fast (#46).
 */
const pendingWrites = new Map<string, Promise<void>>();

/**
 * Runs `write` after all writes already queued for the project have finished.
 * Throws IndexLockedError if another server process is writing the index.
 */
export async function withProjectWriteLock<T>(projectPath: string, write: () => Promise<T>): Promise<T> {
  const key = normalizeProjectPath(projectPath);
  const previous = pendingWrites.get(key) ?? Promise.resolve();

  let release!: () => void;
  const done = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => done);
  pendingWrites.set(key, tail);

  await previous;
  try {
    return await withIndexFileLock(getIndexLockPath(key), write);
  } finally {
    release();
    if (pendingWrites.get(key) === tail) {
      pendingWrites.delete(key);
    }
  }
}

/** Resolves once every write queued for the project so far has finished, successfully or not. */
export async function waitForProjectWrites(projectPath: string): Promise<void> {
  await pendingWrites.get(normalizeProjectPath(projectPath));
}
