import type { Chunker, CodeChunk, SymbolType } from "./chunker.js";
import { hashString } from "../utils/hash.js";
import { LineChunker } from "./line-chunker.js";
import { getLanguageForFile } from "./languages.js";
import { logger } from "../utils/logger.js";

// Tree-sitter node types that represent top-level symbols
const SYMBOL_NODE_TYPES: Record<string, SymbolType> = {
  // TypeScript / JavaScript
  function_declaration: "function",
  arrow_function: "function",
  method_definition: "method",
  class_declaration: "class",
  interface_declaration: "interface",
  type_alias_declaration: "type",
  enum_declaration: "enum",
  lexical_declaration: "variable",
  variable_declaration: "variable",
  export_statement: "other",
  import_statement: "import",
  // Python
  function_definition: "function",
  class_definition: "class",
  // Rust
  function_item: "function",
  impl_item: "class",
  struct_item: "type",
  enum_item: "enum",
  trait_item: "interface",
  mod_item: "module",
  // Go
  function_declaration_go: "function",
  method_declaration: "method",
  type_declaration: "type",
  // Java / C#
  method_declaration_java: "method",
  constructor_declaration: "method",
};

let Parser: any = null;
const loadedLanguages = new Map<string, any>();

async function initTreeSitter(): Promise<boolean> {
  if (Parser) return true;

  try {
    const TreeSitter = await import("web-tree-sitter");
    await TreeSitter.default.init();
    Parser = TreeSitter.default;
    return true;
  } catch (error) {
    logger.warn("Failed to initialize tree-sitter, will use line-based chunking", {
      error: String(error),
    });
    return false;
  }
}

async function loadLanguage(grammarName: string): Promise<any | null> {
  if (loadedLanguages.has(grammarName)) {
    return loadedLanguages.get(grammarName);
  }

  try {
    // Try to load from node_modules tree-sitter grammars
    // In production, WASM files would be bundled or downloaded
    const lang = await Parser.Language.load(
      `node_modules/tree-sitter-${grammarName}/tree-sitter-${grammarName}.wasm`
    );
    loadedLanguages.set(grammarName, lang);
    return lang;
  } catch {
    logger.debug(`Tree-sitter grammar not available for ${grammarName}`);
    loadedLanguages.set(grammarName, null);
    return null;
  }
}

export class ASTChunker implements Chunker {
  private lineChunker: LineChunker;
  private maxChunkLines: number;

  constructor(maxChunkLines = 100, overlapLines = 10) {
    this.maxChunkLines = maxChunkLines;
    this.lineChunker = new LineChunker(maxChunkLines, overlapLines);
  }

  async chunk(filePath: string, content: string, language: string): Promise<CodeChunk[]> {
    const langInfo = getLanguageForFile(filePath);
    if (!langInfo?.treeSitterGrammar) {
      return this.lineChunker.chunk(filePath, content, language);
    }

    const tsReady = await initTreeSitter();
    if (!tsReady) {
      return this.lineChunker.chunk(filePath, content, language);
    }

    const lang = await loadLanguage(langInfo.treeSitterGrammar);
    if (!lang) {
      return this.lineChunker.chunk(filePath, content, language);
    }

    try {
      const parser = new Parser();
      parser.setLanguage(lang);
      const tree = parser.parse(content);

      const chunks = await this.extractChunks(tree.rootNode, filePath, content, language);
      parser.delete();
      tree.delete();

      if (chunks.length === 0) {
        return this.lineChunker.chunk(filePath, content, language);
      }
      return chunks;
    } catch (error) {
      logger.debug("AST parsing failed, falling back to line chunker", {
        file: filePath,
        error: String(error),
      });
      return this.lineChunker.chunk(filePath, content, language);
    }
  }

  private async extractChunks(
    rootNode: any,
    filePath: string,
    fullContent: string,
    language: string
  ): Promise<CodeChunk[]> {
    const chunks: CodeChunk[] = [];
    const lines = fullContent.split("\n");

    for (let i = 0; i < rootNode.childCount; i++) {
      const node = rootNode.child(i);
      if (!node) continue;

      const symbolType = this.getSymbolType(node);
      if (!symbolType) continue;

      const startLine = node.startPosition.row + 1;
      const endLine = node.endPosition.row + 1;
      const nodeLines = lines.slice(startLine - 1, endLine);
      const content = nodeLines.join("\n");

      // If node is too large, split it
      if (endLine - startLine + 1 > this.maxChunkLines) {
        // Still create a header chunk for the symbol
        const headerEnd = Math.min(startLine + 5, endLine);
        const headerContent = lines.slice(startLine - 1, headerEnd).join("\n");
        const symbolName = this.getSymbolName(node);

        chunks.push({
          id: hashString(`${filePath}:${startLine}:${headerEnd}`),
          filePath,
          startLine,
          endLine: headerEnd,
          content: headerContent,
          symbolName,
          symbolType,
          language,
          summary: this.buildSummary(filePath, symbolName, symbolType, headerContent, language, startLine, headerEnd),
        });

        // Split the rest with the line chunker
        const subChunker = new LineChunker(this.maxChunkLines, 10);
        const remainingContent = lines.slice(headerEnd, endLine).join("\n");
        const subChunks = await subChunker.chunk(filePath, remainingContent, language);

        // Adjust line numbers for sub-chunks
        for (const sub of subChunks) {
          sub.startLine += headerEnd;
          sub.endLine += headerEnd;
          sub.parentSymbol = symbolName;
          sub.id = hashString(`${filePath}:${sub.startLine}:${sub.endLine}`);
          chunks.push(sub);
        }
      } else {
        const symbolName = this.getSymbolName(node);
        chunks.push({
          id: hashString(`${filePath}:${startLine}:${endLine}`),
          filePath,
          startLine,
          endLine,
          content,
          symbolName,
          symbolType,
          language,
          summary: this.buildSummary(filePath, symbolName, symbolType, content, language, startLine, endLine),
        });
      }
    }

    return chunks;
  }

  private getSymbolType(node: any): SymbolType | null {
    // Direct match
    if (SYMBOL_NODE_TYPES[node.type]) {
      return SYMBOL_NODE_TYPES[node.type];
    }

    // Handle export statements that wrap declarations
    if (node.type === "export_statement" || node.type === "export_default_declaration") {
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child && SYMBOL_NODE_TYPES[child.type]) {
          return SYMBOL_NODE_TYPES[child.type];
        }
      }
      return "other";
    }

    return null;
  }

  private getSymbolName(node: any): string | undefined {
    // Try to find the name child
    const nameNode =
      node.childForFieldName?.("name") ||
      node.childForFieldName?.("declarator");

    if (nameNode) {
      return nameNode.text;
    }

    // For export statements, look into the declaration
    if (node.type === "export_statement") {
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) {
          const childName = child.childForFieldName?.("name");
          if (childName) return childName.text;
        }
      }
    }

    return undefined;
  }

  private buildSummary(
    filePath: string,
    symbolName: string | undefined,
    symbolType: SymbolType,
    content: string,
    language: string,
    startLine: number,
    endLine: number
  ): string {
    const parts = [`${language} ${symbolType}`];
    if (symbolName) parts.push(`"${symbolName}"`);
    parts.push(`in ${filePath} (lines ${startLine}-${endLine})`);

    // Add first meaningful line of content
    const firstLine = content
      .split("\n")
      .find((l) => l.trim().length > 0)
      ?.trim()
      .slice(0, 150);
    if (firstLine) parts.push(`- ${firstLine}`);

    return parts.join(" ");
  }
}
