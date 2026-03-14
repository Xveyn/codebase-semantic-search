import type { SearchSymbolsInput } from "./schemas.js";
import { loadProjectConfig } from "../config/loader.js";
import { createEmbeddingProvider } from "../embedding/factory.js";
import { VectorDB } from "../db/connection.js";
import { SearchEngine } from "../search/engine.js";
import { formatSymbolResults } from "../search/formatter.js";
import { normalizeProjectPath } from "../utils/paths.js";
import { logger } from "../utils/logger.js";

export async function handleSearchSymbols(input: SearchSymbolsInput): Promise<string> {
  const projectPath = normalizeProjectPath(input.projectPath);

  try {
    const config = await loadProjectConfig(projectPath);
    const db = new VectorDB(projectPath, 0);
    await db.connect();

    const metadata = await db.loadMetadata();
    if (!metadata) {
      await db.close();
      return "No index found. Run 'init' first to create the vector index.";
    }

    config.embedding.provider = metadata.embeddingProvider as any;
    config.embedding.model = metadata.embeddingModel;
    const embedder = await createEmbeddingProvider(config.embedding);

    const dbWithDims = new VectorDB(projectPath, embedder.dimensions);
    await dbWithDims.connect();

    const engine = new SearchEngine(dbWithDims, embedder);
    const limit = input.limit || config.search.defaultLimit;
    const results = await engine.searchSymbols(input.query, limit, input.symbolTypes);

    await dbWithDims.close();

    return formatSymbolResults(results);
  } catch (error) {
    logger.error("search_symbols failed", { error: String(error) });
    return `Error searching symbols: ${error}`;
  }
}
