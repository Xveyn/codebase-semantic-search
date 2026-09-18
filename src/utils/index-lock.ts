import { readFile, rm, writeFile } from "fs/promises";
import { statSync } from "fs";
import { dirname } from "path";
import { ensureDir } from "./paths.js";
import { logger } from "./logger.js";

/**
 * Lock file around index writes, shared by all server processes on this machine.
 *
 * Every Claude Code session starts its own server, and they all write the same index
 * directory. Unlike withProjectWriteLock this coordinates across processes (#46).
 * A second writer fails fast instead of waiting: a full index can take minutes.
 */

/** An unreadable lock file younger than this may still be being written by its owner. */
const UNREADABLE_LOCK_GRACE_MS = 10_000;

interface LockHolder {
  pid: number;
  startedAt: string;
}

export class IndexLockedError extends Error {
  constructor(lockPath: string, holder: LockHolder | null) {
    const who = holder ? `process ${holder.pid} (since ${holder.startedAt})` : "another process";
    super(
      `The index is being written by ${who}, e.g. another Claude Code session. ` +
        `Run this tool again once it has finished. If no such process is running, delete ${lockPath}.`
    );
    this.name = "IndexLockedError";
  }
}

/** Runs `write` while holding the lock file at `lockPath`; throws IndexLockedError if another process holds it. */
export async function withIndexFileLock<T>(lockPath: string, write: () => Promise<T>): Promise<T> {
  await acquire(lockPath);
  try {
    return await write();
  } finally {
    await release(lockPath);
  }
}

async function acquire(lockPath: string): Promise<void> {
  await ensureDir(dirname(lockPath));

  // Two attempts: the second one follows the removal of a stale lock
  for (let attempt = 0; attempt < 2; attempt++) {
    if (await tryCreate(lockPath)) return;

    const holder = await readHolder(lockPath);
    if (attempt > 0 || !isStale(lockPath, holder)) {
      throw new IndexLockedError(lockPath, holder);
    }
    // Not atomic: two processes that find the same stale lock at the same moment can
    // both take it over. Only happens after a crash, and then within milliseconds.
    await rm(lockPath, { force: true });
  }
}

/**
 * Creates the lock file exclusively; false if it already exists. If writing fails after
 * the file was created, the unreadable file counts as stale once the grace period is over.
 */
async function tryCreate(lockPath: string): Promise<boolean> {
  const holder: LockHolder = { pid: process.pid, startedAt: new Date().toISOString() };
  try {
    await writeFile(lockPath, JSON.stringify(holder), { flag: "wx" });
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
    throw error;
  }
}

async function release(lockPath: string): Promise<void> {
  try {
    await rm(lockPath, { force: true });
  } catch (error) {
    // Not fatal: once this process exits, the lock counts as stale
    logger.warn("Could not remove the index lock", { lockPath, error: String(error) });
  }
}

async function readHolder(lockPath: string): Promise<LockHolder | null> {
  try {
    const holder = JSON.parse(await readFile(lockPath, "utf-8"));
    return typeof holder?.pid === "number" ? holder : null;
  } catch {
    return null;
  }
}

function isStale(lockPath: string, holder: LockHolder | null): boolean {
  if (holder) return !isRunning(holder.pid);
  const stats = statSync(lockPath, { throwIfNoEntry: false });
  // No file: released in the meantime
  return !stats || Date.now() - stats.mtimeMs > UNREADABLE_LOCK_GRACE_MS;
}

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0); // Signal 0 only checks that the process exists
    return true;
  } catch (error) {
    // EPERM: the process exists but belongs to another user
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}
