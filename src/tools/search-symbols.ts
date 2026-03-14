import type { SearchSymbolsInput } from "./schemas.js";
import { getProjectContext } from "../context.js";
import { formatSymbolResults } from "../search/formatter.js";
import { normalizeProjectPath } from "../utils/paths.js";
import { logger } from "../utils/logger.js";

export async function handleSearchSymbols(input: SearchSymbolsInput): Promise<string> {
  const projectPath = normalizeProjectPath(input.projectPath);

  try {
    const ctx = await getProjectContext(projectPath);
    const limit = input.limit || ctx.config.search.defaultLimit;
    const results = await ctx.engine.searchSymbols(input.query, limit, input.symbolTypes);
    return formatSymbolResults(results);
  } catch (error) {
    logger.error("search_symbols failed", { error: String(error) });
    return `Error searching symbols: ${error}`;
  }
}
