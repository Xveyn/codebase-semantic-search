import { createHash } from "crypto";
import { homedir } from "os";
import { join, resolve, normalize } from "path";
import { mkdir } from "fs/promises";

const VECTORDB_ROOT = join(homedir(), ".vectordb", "projects");

export function normalizeProjectPath(projectPath: string): string {
  return normalize(resolve(projectPath)).replace(/\\/g, "/");
}

export function projectHash(projectPath: string): string {
  const normalized = normalizeProjectPath(projectPath);
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

export function getProjectDbPath(projectPath: string): string {
  const hash = projectHash(projectPath);
  return join(VECTORDB_ROOT, hash);
}

export function getLanceDbPath(projectPath: string): string {
  return join(getProjectDbPath(projectPath), "lancedb");
}

export function getMetadataPath(projectPath: string): string {
  return join(getProjectDbPath(projectPath), "metadata.json");
}

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}
