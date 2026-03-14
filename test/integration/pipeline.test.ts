import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { join } from "path";
import { rm } from "fs/promises";
import { MockEmbeddingProvider } from "../helpers/mock-embedding.js";
import { LineChunker } from "../../src/chunking/line-chunker.js";
import { VectorDB } from "../../src/db/connection.js";
import { processFile } from "../../src/indexing/pipeline.js";
import { addChunks, addFiles, searchChunks, searchFiles, countRows } from "../../src/db/operations.js";
import { getLanceDbPath, getProjectDbPath } from "../../src/utils/paths.js";

const FIXTURES_PATH = join(process.cwd(), "test/fixtures/sample-project");
const MOCK_DIMENSIONS = 64;

describe("Integration: Pipeline + DB", () => {
  let db: VectorDB;
  let embedder: MockEmbeddingProvider;
  let chunker: LineChunker;

  beforeAll(async () => {
    embedder = new MockEmbeddingProvider(MOCK_DIMENSIONS);
    await embedder.initialize();
    chunker = new LineChunker(50, 5);
    db = new VectorDB(FIXTURES_PATH, MOCK_DIMENSIONS);
    await db.connect();
    await db.dropAllTables();
  });

  afterAll(async () => {
    await db.close();
    // Clean up test DB
    try {
      await rm(getProjectDbPath(FIXTURES_PATH), { recursive: true, force: true });
    } catch {}
  });

  it("should process a file through the pipeline", async () => {
    const result = await processFile(FIXTURES_PATH, "src/auth.ts", chunker, embedder);

    expect(result).not.toBeNull();
    expect(result!.chunks.length).toBeGreaterThan(0);
    expect(result!.fileRecord.filePath).toBe("src/auth.ts");
    expect(result!.fileRecord.language).toBe("typescript");
    expect(result!.fileRecord.vector).toHaveLength(MOCK_DIMENSIONS);
  });

  it("should store and search chunks", async () => {
    // Process test file
    const result = await processFile(FIXTURES_PATH, "src/auth.ts", chunker, embedder);
    expect(result).not.toBeNull();

    // Store in DB
    const chunksTable = await db.getOrCreateChunksTable(result!.chunks);
    const filesTable = await db.getOrCreateFilesTable([result!.fileRecord]);

    // Verify count
    const chunkCount = await countRows(chunksTable);
    expect(chunkCount).toBeGreaterThan(0);

    // Search
    const queryVector = await embedder.embed("authentication login function");
    const results = await searchChunks(chunksTable, queryVector, 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].record.filePath).toBe("src/auth.ts");
  });

  it("should store and search files", async () => {
    // Process multiple files
    const files = ["src/auth.ts", "src/database.ts", "src/utils.ts"];
    const allFileRecords = [];

    for (const file of files) {
      const result = await processFile(FIXTURES_PATH, file, chunker, embedder);
      if (result) {
        allFileRecords.push(result.fileRecord);
      }
    }

    // Reset and store fresh
    await db.dropAllTables();
    const filesTable = await db.getOrCreateFilesTable(allFileRecords);

    // Search
    const queryVector = await embedder.embed("database connection pool");
    const results = await searchFiles(filesTable, queryVector, 3);
    expect(results.length).toBeGreaterThan(0);
  });
});
