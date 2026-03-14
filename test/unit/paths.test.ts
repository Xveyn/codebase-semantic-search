import { describe, it, expect } from "vitest";
import { normalizeProjectPath, projectHash } from "../../src/utils/paths.js";

describe("Paths", () => {
  it("should normalize paths to forward slashes", () => {
    const normalized = normalizeProjectPath("D:\\Projects\\myapp");
    expect(normalized).not.toContain("\\");
    expect(normalized).toContain("/");
  });

  it("should generate consistent hashes", () => {
    const hash1 = projectHash("/home/user/project");
    const hash2 = projectHash("/home/user/project");
    expect(hash1).toBe(hash2);
  });

  it("should generate different hashes for different paths", () => {
    const hash1 = projectHash("/project-a");
    const hash2 = projectHash("/project-b");
    expect(hash1).not.toBe(hash2);
  });
});
