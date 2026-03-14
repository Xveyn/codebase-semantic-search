import type { SearchFilesInput } from "./schemas.js";
import { getProjectContext } from "../context.js";
import { formatFileResults } from "../search/formatter.js";
import { normalizeProjectPath } from "../utils/paths.js";
import { logger } from "../utils/logger.js";

export async function handleSearchFiles(input: SearchFilesInput): Promise<string> {
  const projectPath = normalizeProjectPath(input.projectPath);

  try {
    const ctx = await getProjectContext(projectPath);
    const limit = input.limit || ctx.config.search.defaultLimit;
    const results = await ctx.engine.searchFilesByQuery(input.query, limit);
    return formatFileResults(results);
  } catch (error) {
    logger.error("search_files failed", { error: String(error) });
    return `Error searching files: ${error}`;
  }
}
