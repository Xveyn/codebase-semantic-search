import type { CodeSearchResult, FileSearchResult, SymbolSearchResult } from "./engine.js";

export function formatCodeResults(results: CodeSearchResult[]): string {
  if (results.length === 0) {
    return "No matching code found.";
  }

  const lines: string[] = [`Found ${results.length} result(s):\n`];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    lines.push(`--- Result ${i + 1} (score: ${r.score.toFixed(3)}) ---`);
    lines.push(`File: ${r.filePath}:${r.startLine}-${r.endLine}`);
    if (r.symbolName) {
      lines.push(`Symbol: ${r.symbolType} ${r.symbolName}`);
    }
    lines.push(`Language: ${r.language}`);
    lines.push("```" + r.language);
    lines.push(r.content);
    lines.push("```");
    lines.push("");
  }

  return lines.join("\n");
}

export function formatFileResults(results: FileSearchResult[]): string {
  if (results.length === 0) {
    return "No matching files found.";
  }

  const lines: string[] = [`Found ${results.length} file(s):\n`];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    lines.push(
      `${i + 1}. **${r.filePath}** (score: ${r.score.toFixed(3)})`
    );
    lines.push(
      `   Language: ${r.language} | Chunks: ${r.chunkCount} | Symbols: ${r.symbolCount}`
    );
  }

  return lines.join("\n");
}

export function formatSymbolResults(results: SymbolSearchResult[]): string {
  if (results.length === 0) {
    return "No matching symbols found.";
  }

  const lines: string[] = [`Found ${results.length} symbol(s):\n`];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    lines.push(`--- ${r.symbolType} "${r.symbolName}" (score: ${r.score.toFixed(3)}) ---`);
    lines.push(`File: ${r.filePath}:${r.startLine}-${r.endLine}`);
    lines.push(`Language: ${r.language}`);

    // Show just the signature/first few lines
    const preview = r.content.split("\n").slice(0, 5).join("\n");
    lines.push("```" + r.language);
    lines.push(preview);
    if (r.content.split("\n").length > 5) {
      lines.push("  // ...");
    }
    lines.push("```");
    lines.push("");
  }

  return lines.join("\n");
}
