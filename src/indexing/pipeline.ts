import { readFile } from "fs/promises";
import { join } from "path";
import type { EmbeddingProvider } from "../embedding/provider.js";
import type { Chunker, CodeChunk } from "../chunking/chunker.js";
import type { ChunkRecord, FileRecord } from "../db/schema.js";
import { getLanguageForFile } from "../chunking/languages.js";
import { hashFile } from "../utils/hash.js";
import { logger } from "../utils/logger.js";

export interface PipelineResult {
  chunks: ChunkRecord[];
  fileRecord: FileRecord;
}

export async function processFile(
  projectPath: string,
  filePath: string,
  chunker: Chunker,
  embedder: EmbeddingProvider
): Promise<PipelineResult | null> {
  const fullPath = join(projectPath, filePath);

  try {
    const content = await readFile(fullPath, "utf-8");
    const langInfo = getLanguageForFile(filePath);
    const language = langInfo?.id || "unknown";

    // Chunk the file
    const codeChunks = await chunker.chunk(filePath, content, language);
    if (codeChunks.length === 0) return null;

    // Generate embeddings for all chunks in batch
    const summaries = codeChunks.map((c) => c.summary);
    const vectors = await embedder.embedBatch(summaries);

    // Get file hash
    const fileHash = await hashFile(fullPath);
    const now = new Date().toISOString();

    // Build chunk records
    const chunks: ChunkRecord[] = codeChunks.map((chunk, i) => ({
      id: chunk.id,
      vector: vectors[i],
      filePath: chunk.filePath,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      content: chunk.content,
      symbolName: chunk.symbolName || "",
      symbolType: chunk.symbolType || "",
      language: chunk.language,
      parentSymbol: chunk.parentSymbol || "",
      summary: chunk.summary,
      fileHash,
      indexedAt: now,
    }));

    // Build file record with averaged vector
    const avgVector = averageVectors(vectors);
    const symbolCount = codeChunks.filter((c) => c.symbolName).length;

    const fileRecord: FileRecord = {
      filePath,
      vector: avgVector,
      language,
      fileHash,
      chunkCount: chunks.length,
      symbolCount,
      indexedAt: now,
    };

    return { chunks, fileRecord };
  } catch (error) {
    logger.warn(`Failed to process file: ${filePath}`, { error: String(error) });
    return null;
  }
}

function averageVectors(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const dims = vectors[0].length;
  const avg = new Array(dims).fill(0);

  for (const vec of vectors) {
    for (let i = 0; i < dims; i++) {
      avg[i] += vec[i];
    }
  }

  for (let i = 0; i < dims; i++) {
    avg[i] /= vectors.length;
  }

  return avg;
}
