# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Community health files: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`,
  issue/PR templates.
- GitHub Actions CI (build + test on Node 18/20/22).
- Dependabot configuration for npm and GitHub Actions.

### Changed
- Bumped dependencies to resolve security advisories (`npm audit fix`).
- Upgraded `vitest` to v4.

## [0.1.0] - 2026-03

### Added
- Initial release: MCP server for semantic code search.
- Semantic code, file, and symbol search via natural language.
- Hybrid search (BM25 + vector fusion).
- Incremental updates with chunk-level hashing.
- Ollama / transformers.js / OpenAI embedding providers.
- Tree-sitter AST chunking with line-based fallback.
- SQL-injection protection and retry logic for embedding APIs.

[Unreleased]: https://github.com/Xveyn/codebase-semantic-search/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Xveyn/codebase-semantic-search/releases/tag/v0.1.0
