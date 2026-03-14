/**
 * Sanitize user input for use in LanceDB SQL-like WHERE clauses.
 * LanceDB uses DataFusion SQL syntax — no parameterized queries available,
 * so we must escape values before interpolation.
 */

/**
 * Escape a string value for safe use inside single-quoted SQL literals.
 * Handles: single quotes, backslashes, null bytes, and other control characters.
 */
export function escapeSqlString(value: string): string {
  return value
    .replace(/\\/g, "\\\\")   // backslashes first
    .replace(/'/g, "''")      // single quotes (SQL standard doubling)
    .replace(/\0/g, "")       // strip null bytes
    .replace(/[\x01-\x1f]/g, ""); // strip other control characters
}

/**
 * Validate and sanitize a language filter value.
 * Only allows alphanumeric, hyphens, and plus signs (e.g. "c++", "objective-c").
 */
export function sanitizeLanguage(lang: string): string | null {
  const cleaned = lang.trim().toLowerCase();
  if (/^[a-z0-9+#_-]+$/.test(cleaned)) {
    return cleaned;
  }
  return null;
}

/**
 * Validate and sanitize symbol type values.
 * Only allows known symbol type identifiers.
 */
export function sanitizeSymbolType(type: string): string | null {
  const cleaned = type.trim().toLowerCase();
  if (/^[a-z_]+$/.test(cleaned)) {
    return cleaned;
  }
  return null;
}

/**
 * Sanitize a file glob pattern for use in SQL LIKE clauses.
 * Converts glob * to SQL %, escapes dangerous characters.
 */
export function sanitizeFilePattern(pattern: string): string {
  return pattern
    .replace(/\\/g, "/")       // normalize path separators
    .replace(/'/g, "''")       // escape quotes
    .replace(/\0/g, "")        // strip null bytes
    .replace(/[\x01-\x1f]/g, "") // strip control chars
    .replace(/\*/g, "%");      // glob * -> SQL %
}
