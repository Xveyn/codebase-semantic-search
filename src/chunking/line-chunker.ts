import type { Chunker, CodeChunk } from "./chunker.js";
import { hashString } from "../utils/hash.js";

export class LineChunker implements Chunker {
  private maxChunkLines: number;
  private overlapLines: number;

  constructor(maxChunkLines = 100, overlapLines = 10) {
    this.maxChunkLines = maxChunkLines;
    this.overlapLines = overlapLines;
  }

  async chunk(filePath: string, content: string, language: string): Promise<CodeChunk[]> {
    const lines = content.split("\n");
    const chunks: CodeChunk[] = [];

    // Small files: single chunk
    if (lines.length <= this.maxChunkLines) {
      chunks.push(this.createChunk(filePath, lines, 1, lines.length, language));
      return chunks;
    }

    // Sliding window with overlap
    let start = 0;
    while (start < lines.length) {
      const end = Math.min(start + this.maxChunkLines, lines.length);
      const chunkLines = lines.slice(start, end);

      chunks.push(this.createChunk(filePath, chunkLines, start + 1, end, language));

      if (end >= lines.length) break;
      start = end - this.overlapLines;
    }

    return chunks;
  }

  private createChunk(
    filePath: string,
    lines: string[],
    startLine: number,
    endLine: number,
    language: string
  ): CodeChunk {
    const content = lines.join("\n");
    const id = hashString(`${filePath}:${startLine}:${endLine}`);

    // Create a summary from first meaningful lines
    const meaningfulLines = lines
      .filter((l) => l.trim().length > 0)
      .slice(0, 5)
      .join(" ")
      .slice(0, 200);

    return {
      id,
      filePath,
      startLine,
      endLine,
      content,
      language,
      summary: `${language} code in ${filePath} (lines ${startLine}-${endLine}): ${meaningfulLines}`,
    };
  }
}
