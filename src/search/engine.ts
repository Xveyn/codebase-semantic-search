import type { EmbeddingProvider } from "../embedding/provider.js";
import { VectorDB } from "../db/connection.js";
import { searchChunks, searchFiles as searchFilesOp } from "../db/operations.js";
import type { SearchResult } from "../db/operations.js";
import type { ChunkRecord, FileRecord } from "../db/schema.js";
import { logger } from "../utils/logger.js";

export interface CodeSearchResult {
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  symbolName: string;
  symbolType: string;
  language: string;
  score: number;
}

export interface FileSearchResult {
  filePath: string;
  language: string;
  chunkCount: number;
  symbolCount: number;
  score: number;
}

export interface SymbolSearchResult {
  filePath: string;
  startLine: number;
  endLine: number;
  symbolName: string;
  symbolType: string;
  content: string;
  language: string;
  score: number;
}

export class SearchEngine {
  private db: VectorDB;
  private embedder: EmbeddingProvider;

  constructor(db: VectorDB, embedder: EmbeddingProvider) {
    this.db = db;
    this.embedder = embedder;
  }

  async searchCode(
    query: string,
    limit: number,
    language?: string,
    filePattern?: string
  ): Promise<CodeSearchResult[]> {
    const queryVector = await this.embedder.embed(query);
    const table = await this.db.getOrCreateChunksTable();

    // Build filter
    let filter: string | undefined;
    const conditions: string[] = [];
    if (language) {
      conditions.push(`language = '${language}'`);
    }
    if (filePattern) {
      conditions.push(`filePath LIKE '${filePattern.replace(/\*/g, "%")}'`);
    }
    // Always exclude placeholder
    conditions.push(`id != '__placeholder__'`);
    filter = conditions.join(" AND ");

    const results = await searchChunks(table, queryVector, limit, filter);

    return results.map((r) => {
      const chunk = r.record as ChunkRecord;
      return {
        filePath: chunk.filePath,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        content: chunk.content,
        symbolName: chunk.symbolName,
        symbolType: chunk.symbolType,
        language: chunk.language,
        score: 1 - (r.distance || 0), // Convert distance to similarity
      };
    });
  }

  async searchFilesByQuery(query: string, limit: number): Promise<FileSearchResult[]> {
    const queryVector = await this.embedder.embed(query);
    const table = await this.db.getOrCreateFilesTable();

    const results = await searchFilesOp(table, queryVector, limit);

    return results
      .filter((r) => (r.record as FileRecord).filePath !== "__placeholder__")
      .map((r) => {
        const file = r.record as FileRecord;
        return {
          filePath: file.filePath,
          language: file.language,
          chunkCount: file.chunkCount,
          symbolCount: file.symbolCount,
          score: 1 - (r.distance || 0),
        };
      });
  }

  async searchSymbols(
    query: string,
    limit: number,
    symbolTypes?: string[]
  ): Promise<SymbolSearchResult[]> {
    const queryVector = await this.embedder.embed(query);
    const table = await this.db.getOrCreateChunksTable();

    // Filter for records that have symbol names
    const conditions: string[] = [`symbolName != ''`, `id != '__placeholder__'`];
    if (symbolTypes && symbolTypes.length > 0) {
      const typeList = symbolTypes.map((t) => `'${t}'`).join(", ");
      conditions.push(`symbolType IN (${typeList})`);
    }
    const filter = conditions.join(" AND ");

    const results = await searchChunks(table, queryVector, limit, filter);

    return results.map((r) => {
      const chunk = r.record as ChunkRecord;
      return {
        filePath: chunk.filePath,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        symbolName: chunk.symbolName,
        symbolType: chunk.symbolType,
        content: chunk.content,
        language: chunk.language,
        score: 1 - (r.distance || 0),
      };
    });
  }
}
