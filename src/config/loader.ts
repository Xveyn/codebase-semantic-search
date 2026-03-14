import { readFile } from "fs/promises";
import { join } from "path";
import { ProjectConfigSchema, type ProjectConfig } from "./schema.js";
import { DEFAULT_CONFIG } from "./defaults.js";
import { logger } from "../utils/logger.js";

const CONFIG_FILENAME = ".vectordb.json";

export async function loadProjectConfig(projectPath: string): Promise<ProjectConfig> {
  const configPath = join(projectPath, CONFIG_FILENAME);

  try {
    const raw = await readFile(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    const config = ProjectConfigSchema.parse(parsed);
    logger.info("Loaded project config", { path: configPath });
    return config;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      logger.debug("No .vectordb.json found, using defaults");
      return DEFAULT_CONFIG;
    }
    logger.warn("Failed to parse .vectordb.json, using defaults", {
      error: String(error),
    });
    return DEFAULT_CONFIG;
  }
}
