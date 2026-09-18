import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import * as lancedb from "@lancedb/lancedb";

vi.mock("../../src/embedding/factory.js", async () => {
  const { MockEmbeddingProvider } = await import("../helpers/mock-embedding.js");
  return { createEmbeddingProvider: async () => new MockEmbeddingProvider(16) };
});

import { handleInit } from "../../src/tools/init.js";
import { handleSearchCode } from "../../src/tools/search-code.js";
import { handleSearchFiles } from "../../src/tools/search-files.js";
import { handleSearchSymbols } from "../../src/tools/search-symbols.js";
import { invalidateProjectContext } from "../../src/context.js";
import { getLanceDbPath, getProjectDbPath, normalizeProjectPath } from "../../src/utils/paths.js";

// Searches used to create empty placeholder tables when a table was missing. Created from a
// read path while another process was indexing, they made that index silently empty (#46).
describe("Integration: searching an index whose tables are missing", () => {
  let projectPath: string;

  beforeEach(async () => {
    projectPath = normalizeProjectPath(await mkdtemp(join(tmpdir(), "vectordb-missing-tables-")));
    await mkdir(join(projectPath, "src"));
    await writeFile(join(projectPath, "src/a.ts"), "export function alpha() { return 1; }\n");
    await writeFile(join(projectPath, ".vectordb.json"), JSON.stringify({ files: { gitOnly: false } }));
    await handleInit({ projectPath });
    // metadata.json stays, the tables are gone
    await rm(getLanceDbPath(projectPath), { recursive: true, force: true });
  });

  afterEach(async () => {
    await invalidateProjectContext(projectPath);
    await rm(getProjectDbPath(projectPath), { recursive: true, force: true });
    await rm(projectPath, { recursive: true, force: true });
  });

  it.each([
    ["search_code", () => handleSearchCode({ projectPath, query: "alpha" })],
    ["search_files", () => handleSearchFiles({ projectPath, query: "alpha" })],
    ["search_symbols", () => handleSearchSymbols({ projectPath, query: "alpha" })],
  ])("%s asks for a reindex and creates no tables", async (_tool, search) => {
    await expect(search()).rejects.toThrow(/reindex/);

    const db = await lancedb.connect(getLanceDbPath(projectPath));
    expect(await db.tableNames()).toEqual([]);
  });
});
