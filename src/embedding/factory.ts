import type { EmbeddingProvider } from "./provider.js";
import type { EmbeddingConfig } from "../config/schema.js";
import { OllamaEmbeddingProvider } from "./ollama.js";
import { TransformersEmbeddingProvider } from "./transformers.js";
import { OpenAIEmbeddingProvider } from "./openai.js";
import { CachedEmbeddingProvider } from "./cache.js";
import { logger } from "../utils/logger.js";

export async function createEmbeddingProvider(config: EmbeddingConfig): Promise<EmbeddingProvider> {
  if (config.provider === "ollama") {
    return initProvider(new OllamaEmbeddingProvider(config.ollamaUrl, config.model));
  }

  if (config.provider === "transformers") {
    return initProvider(new TransformersEmbeddingProvider(config.model));
  }

  if (config.provider === "openai") {
    if (!config.openaiApiKey) {
      throw new Error("OpenAI API key required for openai provider");
    }
    return initProvider(new OpenAIEmbeddingProvider(config.openaiApiKey, config.model));
  }

  // Auto-detect: try Ollama first, then transformers.js
  logger.info("Auto-detecting embedding provider...");

  const ollama = new OllamaEmbeddingProvider(config.ollamaUrl, config.model);
  if (await ollama.isAvailable()) {
    logger.info("Ollama detected and available");
    return initProvider(ollama);
  }

  logger.info("Ollama not available, falling back to transformers.js");
  const transformers = new TransformersEmbeddingProvider();
  if (await transformers.isAvailable()) {
    return initProvider(transformers);
  }

  throw new Error(
    "No embedding provider available. Install Ollama with nomic-embed-text, or ensure @huggingface/transformers is installed."
  );
}

async function initProvider(provider: EmbeddingProvider): Promise<EmbeddingProvider> {
  await provider.initialize();
  logger.info(`Embedding provider ready: ${provider.name} (${provider.dimensions}d)`);
  // Wrap in cache for query embedding reuse
  return new CachedEmbeddingProvider(provider);
}
