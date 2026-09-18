import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, readFile, rm, writeFile, utimes, access } from "fs/promises";
import { spawn } from "child_process";
import { tmpdir } from "os";
import { join } from "path";
import { withIndexFileLock, IndexLockedError } from "../../src/utils/index-lock.js";

const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false
  );

/** PID of a process that has already exited. */
async function deadPid(): Promise<number> {
  const child = spawn(process.execPath, ["-e", ""]);
  await new Promise((resolve) => child.on("exit", resolve));
  return child.pid!;
}

describe("withIndexFileLock", () => {
  let dir: string;
  let lockPath: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "vectordb-lock-"));
    lockPath = join(dir, "index.lock");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("holds a lock file with its own PID while the write runs", async () => {
    const seen = await withIndexFileLock(lockPath, async () => JSON.parse(await readFile(lockPath, "utf-8")));

    expect(seen.pid).toBe(process.pid);
  });

  it("removes the lock file after the write", async () => {
    await withIndexFileLock(lockPath, async () => "done");

    expect(await exists(lockPath)).toBe(false);
  });

  it("removes the lock file when the write throws", async () => {
    await expect(
      withIndexFileLock(lockPath, async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");

    expect(await exists(lockPath)).toBe(false);
  });

  it("creates the directory of the lock file", async () => {
    const nested = join(dir, "not", "there", "index.lock");

    await expect(withIndexFileLock(nested, async () => "ok")).resolves.toBe("ok");
  });

  it("fails fast while another running process holds the lock", async () => {
    // The parent process (vitest's runner) is alive and is not us
    const holder = { pid: process.ppid, startedAt: "2026-09-18T10:00:00.000Z" };
    await writeFile(lockPath, JSON.stringify(holder));
    let ran = false;

    const attempt = withIndexFileLock(lockPath, async () => {
      ran = true;
    });

    await expect(attempt).rejects.toBeInstanceOf(IndexLockedError);
    await expect(attempt).rejects.toThrow(String(process.ppid));
    expect(ran).toBe(false);
    expect(JSON.parse(await readFile(lockPath, "utf-8"))).toEqual(holder);
  });

  it("takes over a lock left behind by a process that no longer runs", async () => {
    await writeFile(lockPath, JSON.stringify({ pid: await deadPid(), startedAt: "2026-09-18T10:00:00.000Z" }));

    await expect(withIndexFileLock(lockPath, async () => "ran")).resolves.toBe("ran");
    expect(await exists(lockPath)).toBe(false);
  });

  it("treats a fresh unreadable lock file as held, since its owner may still be writing it", async () => {
    await writeFile(lockPath, "");

    await expect(withIndexFileLock(lockPath, async () => "ran")).rejects.toBeInstanceOf(IndexLockedError);
    expect(await exists(lockPath)).toBe(true);
  });

  it("takes over an unreadable lock file that has been left alone for a while", async () => {
    await writeFile(lockPath, "");
    const aMinuteAgo = new Date(Date.now() - 60_000);
    await utimes(lockPath, aMinuteAgo, aMinuteAgo);

    await expect(withIndexFileLock(lockPath, async () => "ran")).resolves.toBe("ran");
  });
});
