import { createHash } from "crypto";
import { readFile } from "fs/promises";

export async function hashFile(filePath: string): Promise<string> {
  const content = await readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

export function hashString(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}
