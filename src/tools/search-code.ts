import type { SearchCodeInput } from "./schemas.js";
import { getProjectContext } from "../context.js";
import { formatCodeResults } from "../search/formatter.js";
import { normalizeProjectPath } from "../utils/paths.js";
import { logger } from "../utils/logger.js";

export async function handleSearchCode(input: SearchCodeInput): Promise<string> {
  const projectPath = normalizeProjectPath(input.projectPath);

  try {
    const ctx = await getProjectContext(projectPath);
    const limit = input.limit || ctx.config.search.defaultLimit;
    const results = await ctx.engine.searchCode(input.query, limit, input.language, input.filePattern);
    return formatCodeResults(results);
  } catch (error) {
    logger.error("search_code failed", { error: String(error) });
    return `Error searching code: ${error}`;
  }
}
