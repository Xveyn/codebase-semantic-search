import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

vi.mock("../../src/embedding/factory.js", async () => {
  const { MockEmbeddingProvider } = await import("../helpers/mock-embedding.js");
  return { createEmbeddingProvider: async () => new MockEmbeddingProvider(16) };
});

import { handleInit } from "../../src/tools/init.js";
import { handleReindex } from "../../src/tools/reindex.js";
import { handleIndexUpdate } from "../../src/tools/index-update.js";
import { handleIndexStatus } from "../../src/tools/index-status.js";
import { invalidateProjectContext } from "../../src/context.js";
import { getIndexLockPath, getProjectDbPath, normalizeProjectPath } from "../../src/utils/paths.js";

// Every Claude Code session runs its own server process on the same index directory (#46)
describe("Integration: index writes from another server process", () => {
  let projectPath: string;

  /** Simulates another server process in the middle of a write. */
  async function lockByOtherProcess() {
    // The parent process (vitest's runner) is alive and is not us
    await writeFile(
      getIndexLockPath(projectPath),
      JSON.stringify({ pid: process.ppid, startedAt: "2026-09-18T10:00:00.000Z" })
    );
  }

  beforeEach(async () => {
    projectPath = normalizeProjectPath(await mkdtemp(join(tmpdir(), "vectordb-cross-process-")));
    await mkdir(join(projectPath, "src"));
    await writeFile(join(projectPath, "src/a.ts"), "export function alpha() { return 1; }\n");
    await writeFile(join(projectPath, ".vectordb.json"), JSON.stringify({ files: { gitOnly: false } }));
    await handleInit({ projectPath });
    await writeFile(join(projectPath, "src/b.ts"), "export function beta() { return 2; }\n");
  });

  afterEach(async () => {
    await invalidateProjectContext(projectPath);
    await rm(getProjectDbPath(projectPath), { recursive: true, force: true });
    await rm(projectPath, { recursive: true, force: true });
  });

  it.each([
    ["init", () => handleInit({ projectPath })],
    ["reindex", () => handleReindex({ projectPath })],
    ["index_update", () => handleIndexUpdate({ projectPath })],
  ])("%s refuses to write and leaves the index alone", async (_tool, run) => {
    await lockByOtherProcess();

    await expect(run()).rejects.toThrow(`process ${process.ppid}`);
    expect(await handleIndexStatus({ projectPath })).toMatch(/Files indexed:\s+1\n/);
  });

  it("writes again once the other process has released the lock", async () => {
    await lockByOtherProcess();
    await expect(handleIndexUpdate({ projectPath })).rejects.toThrow();
    await rm(getIndexLockPath(projectPath));

    await handleIndexUpdate({ projectPath });

    expect(await handleIndexStatus({ projectPath })).toMatch(/Files indexed:\s+2\n/);
  });
});
