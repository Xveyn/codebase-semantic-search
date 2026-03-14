export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

let currentLevel = LogLevel.INFO;

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

function formatMessage(level: string, message: string, data?: Record<string, unknown>): string {
  const timestamp = new Date().toISOString();
  const base = `[${timestamp}] [${level}] ${message}`;
  if (data) {
    return `${base} ${JSON.stringify(data)}`;
  }
  return base;
}

// All logging goes to stderr to keep stdout clean for MCP stdio transport
export const logger = {
  debug(message: string, data?: Record<string, unknown>): void {
    if (currentLevel <= LogLevel.DEBUG) {
      process.stderr.write(formatMessage("DEBUG", message, data) + "\n");
    }
  },
  info(message: string, data?: Record<string, unknown>): void {
    if (currentLevel <= LogLevel.INFO) {
      process.stderr.write(formatMessage("INFO", message, data) + "\n");
    }
  },
  warn(message: string, data?: Record<string, unknown>): void {
    if (currentLevel <= LogLevel.WARN) {
      process.stderr.write(formatMessage("WARN", message, data) + "\n");
    }
  },
  error(message: string, data?: Record<string, unknown>): void {
    if (currentLevel <= LogLevel.ERROR) {
      process.stderr.write(formatMessage("ERROR", message, data) + "\n");
    }
  },
};
