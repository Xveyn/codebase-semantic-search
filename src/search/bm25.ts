/**
 * Lightweight BM25 scorer for hybrid search.
 * Operates on pre-fetched results — no separate index needed.
 */

const k1 = 1.2;
const b = 0.75;

/** Tokenize text into lowercase terms, splitting on non-alphanumeric */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((t) => t.length > 1);
}

/** Compute term frequencies for a document */
function termFrequencies(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }
  return tf;
}

/**
 * Score documents against a query using BM25.
 * @param query - The search query
 * @param documents - Array of document texts to score
 * @returns Array of BM25 scores (same order as documents)
 */
export function bm25Score(query: string, documents: string[]): number[] {
  if (documents.length === 0) return [];

  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return documents.map(() => 0);

  // Precompute document stats
  const docTokens = documents.map((d) => tokenize(d));
  const docLengths = docTokens.map((t) => t.length);
  const avgDl = docLengths.reduce((a, b) => a + b, 0) / docLengths.length;
  const N = documents.length;

  // Document frequency for each query term
  const df = new Map<string, number>();
  for (const term of queryTerms) {
    let count = 0;
    for (const tokens of docTokens) {
      if (tokens.includes(term)) count++;
    }
    df.set(term, count);
  }

  // Score each document
  return docTokens.map((tokens, i) => {
    const tf = termFrequencies(tokens);
    const dl = docLengths[i];
    let score = 0;

    for (const term of queryTerms) {
      const termDf = df.get(term) || 0;
      const termTf = tf.get(term) || 0;

      if (termTf === 0) continue;

      // IDF component
      const idf = Math.log((N - termDf + 0.5) / (termDf + 0.5) + 1);

      // TF component with length normalization
      const tfNorm = (termTf * (k1 + 1)) / (termTf + k1 * (1 - b + b * (dl / avgDl)));

      score += idf * tfNorm;
    }

    return score;
  });
}

/**
 * Check if query looks like an exact identifier/symbol name.
 * Used to decide whether BM25 should be weighted more heavily.
 */
export function isIdentifierQuery(query: string): boolean {
  const trimmed = query.trim();
  // camelCase, snake_case, PascalCase, or single word without spaces
  return /^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(trimmed) && !trimmed.includes(" ");
}
