import { z } from "zod";

export const InitInputSchema = z.object({
  projectPath: z.string().describe("Absolute path to the project root directory"),
  embeddingProvider: z
    .enum(["auto", "ollama", "transformers", "openai"])
    .optional()
    .describe("Embedding provider to use (default: auto-detect)"),
  embeddingModel: z.string().optional().describe("Embedding model name"),
  includePatterns: z
    .array(z.string())
    .optional()
    .describe("Glob patterns for files to include"),
  excludePatterns: z
    .array(z.string())
    .optional()
    .describe("Glob patterns for files to exclude"),
});

export const SearchCodeInputSchema = z.object({
  query: z.string().describe("Natural language search query"),
  projectPath: z.string().describe("Absolute path to the project root directory"),
  limit: z.number().min(1).max(50).optional().describe("Maximum number of results (default: 10)"),
  language: z.string().optional().describe("Filter by programming language"),
  filePattern: z.string().optional().describe("Glob pattern to filter files"),
});

export const SearchFilesInputSchema = z.object({
  query: z.string().describe("Natural language query to find relevant files"),
  projectPath: z.string().describe("Absolute path to the project root directory"),
  limit: z.number().min(1).max(50).optional().describe("Maximum number of results (default: 10)"),
});

export const SearchSymbolsInputSchema = z.object({
  query: z.string().describe("Symbol name or description to search for"),
  projectPath: z.string().describe("Absolute path to the project root directory"),
  symbolTypes: z
    .array(z.enum(["function", "class", "method", "interface", "type", "variable", "import"]))
    .optional()
    .describe("Filter by symbol type"),
  limit: z.number().min(1).max(50).optional().describe("Maximum number of results (default: 10)"),
});

export const IndexStatusInputSchema = z.object({
  projectPath: z.string().describe("Absolute path to the project root directory"),
});

export const ReindexInputSchema = z.object({
  projectPath: z.string().describe("Absolute path to the project root directory"),
});

export const IndexUpdateInputSchema = z.object({
  projectPath: z.string().describe("Absolute path to the project root directory"),
});

export type InitInput = z.infer<typeof InitInputSchema>;
export type SearchCodeInput = z.infer<typeof SearchCodeInputSchema>;
export type SearchFilesInput = z.infer<typeof SearchFilesInputSchema>;
export type SearchSymbolsInput = z.infer<typeof SearchSymbolsInputSchema>;
export type IndexStatusInput = z.infer<typeof IndexStatusInputSchema>;
export type ReindexInput = z.infer<typeof ReindexInputSchema>;
export type IndexUpdateInput = z.infer<typeof IndexUpdateInputSchema>;
