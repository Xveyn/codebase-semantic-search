import { hashFile } from "../utils/hash.js";
import { join } from "path";
import { logger } from "../utils/logger.js";

export interface FileChange {
  filePath: string;
  status: "added" | "modified" | "deleted";
}

export async function detectChanges(
  projectPath: string,
  currentFiles: string[],
  existingHashes: Map<string, string>
): Promise<FileChange[]> {
  const changes: FileChange[] = [];
  const currentSet = new Set(currentFiles);

  // Check for new and modified files
  for (const filePath of currentFiles) {
    const fullPath = join(projectPath, filePath);
    try {
      const currentHash = await hashFile(fullPath);
      const existingHash = existingHashes.get(filePath);

      if (!existingHash) {
        changes.push({ filePath, status: "added" });
      } else if (currentHash !== existingHash) {
        changes.push({ filePath, status: "modified" });
      }
    } catch {
      logger.debug(`Could not hash file: ${filePath}`);
    }
  }

  // Check for deleted files
  for (const [filePath] of existingHashes) {
    if (!currentSet.has(filePath)) {
      changes.push({ filePath, status: "deleted" });
    }
  }

  logger.info(`Detected ${changes.length} changes`, {
    added: changes.filter((c) => c.status === "added").length,
    modified: changes.filter((c) => c.status === "modified").length,
    deleted: changes.filter((c) => c.status === "deleted").length,
  });

  return changes;
}
