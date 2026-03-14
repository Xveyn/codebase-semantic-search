import type { EmbeddingProvider } from "../embedding/provider.js";
import { VectorDB } from "../db/connection.js";
import { searchChunks, searchFiles as searchFilesOp } from "../db/operations.js";
import type { ChunkRecord, FileRecord } from "../db/schema.js";
import { bm25Score, isIdentifierQuery } from "./bm25.js";
import { escapeSqlString, sanitizeLanguage, sanitizeFilePattern, sanitizeSymbolType } from "../utils/sanitize.js";
import { logger } from "../utils/logger.js";

/** Minimum score to include in results. Filters out noise. */
const MIN_SCORE_THRESHOLD = 0.05;

/** How many extra candidates to fetch for re-ranking */
const RERANK_MULTIPLIER = 3;

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

    const conditions: string[] = [];
    if (language) {
      const safeLang = sanitizeLanguage(language);
      if (safeLang) {
        conditions.push(`language = '${safeLang}'`);
      }
    }
    if (filePattern) {
      conditions.push(`"filePath" LIKE '${sanitizeFilePattern(filePattern)}'`);
    }
    conditions.push(`id != '__placeholder__'`);
    const filter = conditions.join(" AND ");

    // Fetch more candidates than needed for hybrid re-ranking
    const fetchLimit = limit * RERANK_MULTIPLIER;
    const results = await searchChunks(table, queryVector, fetchLimit, filter);

    // Hybrid re-rank: combine vector similarity with BM25 keyword score
    const candidates = results.map((r) => {
      const chunk = r.record as ChunkRecord;
      return {
        filePath: chunk.filePath,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        content: chunk.content,
        symbolName: chunk.symbolName,
        symbolType: chunk.symbolType,
        language: chunk.language,
        vectorScore: 1 - (r.distance || 0),
        // Searchable text: content + symbol name + file path
        searchText: `${chunk.content} ${chunk.symbolName} ${chunk.filePath}`,
      };
    });

    const ranked = this.hybridRank(query, candidates, limit);

    return ranked.map((c) => ({
      filePath: c.filePath,
      startLine: c.startLine,
      endLine: c.endLine,
      content: c.content,
      symbolName: c.symbolName,
      symbolType: c.symbolType,
      language: c.language,
      score: c.score,
    }));
  }

  async searchFilesByQuery(query: string, limit: number): Promise<FileSearchResult[]> {
    const queryVector = await this.embedder.embed(query);
    const table = await this.db.getOrCreateFilesTable();

    const results = await searchFilesOp(table, queryVector, limit * RERANK_MULTIPLIER);

    const candidates = results
      .filter((r) => (r.record as FileRecord).filePath !== "__placeholder__")
      .map((r) => {
        const file = r.record as FileRecord;
        return {
          filePath: file.filePath,
          language: file.language,
          chunkCount: file.chunkCount,
          symbolCount: file.symbolCount,
          vectorScore: 1 - (r.distance || 0),
          searchText: file.filePath,
        };
      });

    // BM25 on file paths
    const bm25Scores = bm25Score(
      query,
      candidates.map((c) => c.searchText)
    );

    const isIdent = isIdentifierQuery(query);
    const vectorWeight = isIdent ? 0.3 : 0.7;
    const bm25Weight = isIdent ? 0.7 : 0.3;

    // Normalize BM25 scores
    const maxBm25 = Math.max(...bm25Scores, 0.001);

    const scored = candidates.map((c, i) => ({
      ...c,
      score: vectorWeight * c.vectorScore + bm25Weight * (bm25Scores[i] / maxBm25),
    }));

    return scored
      .sort((a, b) => b.score - a.score)
      .filter((r) => r.score >= MIN_SCORE_THRESHOLD)
      .slice(0, limit)
      .map((c) => ({
        filePath: c.filePath,
        language: c.language,
        chunkCount: c.chunkCount,
        symbolCount: c.symbolCount,
        score: c.score,
      }));
  }

  async searchSymbols(
    query: string,
    limit: number,
    symbolTypes?: string[]
  ): Promise<SymbolSearchResult[]> {
    const queryVector = await this.embedder.embed(query);
    const table = await this.db.getOrCreateChunksTable();

    const conditions: string[] = [`"symbolName" != ''`, `id != '__placeholder__'`];
    if (symbolTypes && symbolTypes.length > 0) {
      const safeTypes = symbolTypes
        .map((t) => sanitizeSymbolType(t))
        .filter((t): t is string => t !== null);
      if (safeTypes.length > 0) {
        const typeList = safeTypes.map((t) => `'${t}'`).join(", ");
        conditions.push(`"symbolType" IN (${typeList})`);
      }
    }
    const filter = conditions.join(" AND ");

    const fetchLimit = limit * RERANK_MULTIPLIER;
    const results = await searchChunks(table, queryVector, fetchLimit, filter);

    const candidates = results.map((r) => {
      const chunk = r.record as ChunkRecord;
      return {
        filePath: chunk.filePath,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        symbolName: chunk.symbolName,
        symbolType: chunk.symbolType,
        content: chunk.content,
        language: chunk.language,
        vectorScore: 1 - (r.distance || 0),
        // For symbols, the symbol name is the most important searchable text
        searchText: `${chunk.symbolName} ${chunk.symbolType} ${chunk.content}`,
      };
    });

    const ranked = this.hybridRank(query, candidates, limit);

    return ranked.map((c) => ({
      filePath: c.filePath,
      startLine: c.startLine,
      endLine: c.endLine,
      symbolName: c.symbolName,
      symbolType: c.symbolType,
      content: c.content,
      language: c.language,
      score: c.score,
    }));
  }

  /**
   * Hybrid ranking: combine vector similarity with BM25 keyword matching.
   * For identifier-like queries (e.g. "authenticateUser"), BM25 is weighted more.
   * For natural language queries, vector similarity is weighted more.
   */
  private hybridRank<T extends { vectorScore: number; searchText: string }>(
    query: string,
    candidates: T[],
    limit: number
  ): (T & { score: number })[] {
    if (candidates.length === 0) return [];

    // Compute BM25 scores
    const bm25Scores = bm25Score(
      query,
      candidates.map((c) => c.searchText)
    );

    // Normalize BM25 to [0, 1]
    const maxBm25 = Math.max(...bm25Scores, 0.001);
    const normalizedBm25 = bm25Scores.map((s) => s / maxBm25);

    // Choose weights based on query type
    const isIdent = isIdentifierQuery(query);
    const vectorWeight = isIdent ? 0.3 : 0.7;
    const bm25Weight = isIdent ? 0.7 : 0.3;

    logger.debug("Hybrid search weights", {
      isIdentifier: isIdent,
      vectorWeight,
      bm25Weight,
      candidates: candidates.length,
    });

    // Combine scores
    const scored = candidates.map((c, i) => ({
      ...c,
      score: vectorWeight * c.vectorScore + bm25Weight * normalizedBm25[i],
    }));

    // Sort by combined score, filter low-quality, take top N
    return scored
      .sort((a, b) => b.score - a.score)
      .filter((r) => r.score >= MIN_SCORE_THRESHOLD)
      .slice(0, limit);
  }
}
