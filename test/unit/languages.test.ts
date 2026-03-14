import { describe, it, expect } from "vitest";
import { getLanguageForFile, isSupportedFile } from "../../src/chunking/languages.js";

describe("Languages", () => {
  it("should detect TypeScript files", () => {
    const lang = getLanguageForFile("src/index.ts");
    expect(lang?.id).toBe("typescript");
  });

  it("should detect TSX files", () => {
    const lang = getLanguageForFile("components/Button.tsx");
    expect(lang?.id).toBe("tsx");
  });

  it("should detect Python files", () => {
    const lang = getLanguageForFile("main.py");
    expect(lang?.id).toBe("python");
  });

  it("should detect Rust files", () => {
    const lang = getLanguageForFile("src/lib.rs");
    expect(lang?.id).toBe("rust");
  });

  it("should return null for unknown extensions", () => {
    const lang = getLanguageForFile("data.xyz");
    expect(lang).toBeNull();
  });

  it("should handle Dockerfile", () => {
    const lang = getLanguageForFile("Dockerfile");
    expect(lang?.id).toBe("dockerfile");
  });

  it("should check supported files correctly", () => {
    expect(isSupportedFile("index.ts")).toBe(true);
    expect(isSupportedFile("readme.txt")).toBe(false);
    expect(isSupportedFile("main.py")).toBe(true);
  });
});
