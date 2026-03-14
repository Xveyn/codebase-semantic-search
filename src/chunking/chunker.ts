export interface CodeChunk {
  /** Unique identifier (hash of filePath + startLine + endLine) */
  id: string;
  /** Relative file path */
  filePath: string;
  /** Start line (1-based) */
  startLine: number;
  /** End line (1-based, inclusive) */
  endLine: number;
  /** Raw code content */
  content: string;
  /** Symbol name (function/class name) if this chunk represents one */
  symbolName?: string;
  /** Symbol type */
  symbolType?: SymbolType;
  /** Parent symbol name */
  parentSymbol?: string;
  /** Programming language */
  language: string;
  /** Summary text used for generating embedding (may include context) */
  summary: string;
}

export type SymbolType =
  | "function"
  | "class"
  | "method"
  | "interface"
  | "type"
  | "variable"
  | "import"
  | "module"
  | "enum"
  | "other";

export interface Chunker {
  /** Parse a file's content into semantic chunks */
  chunk(filePath: string, content: string, language: string): Promise<CodeChunk[]>;
}
