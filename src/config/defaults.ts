import type { ProjectConfig } from "./schema.js";

export const DEFAULT_CONFIG: ProjectConfig = {
  embedding: {
    provider: "auto",
    model: "nomic-embed-text",
    batchSize: 100,
    ollamaUrl: "http://localhost:11434",
  },
  files: {
    include: ["**/*"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.git/**",
      "**/vendor/**",
      "**/__pycache__/**",
      "**/target/**",
      "**/.next/**",
      "**/coverage/**",
      "**/*.min.js",
      "**/*.min.css",
      "**/package-lock.json",
      "**/yarn.lock",
      "**/pnpm-lock.yaml",
    ],
    maxFileSize: 1_000_000,
    gitOnly: true,
  },
  chunking: {
    maxChunkLines: 100,
    overlapLines: 10,
  },
  search: {
    defaultLimit: 10,
  },
};
