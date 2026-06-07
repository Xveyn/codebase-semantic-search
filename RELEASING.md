# Releasing

This package is published privately to **GitHub Packages** as
`@xveyn/codebase-semantic-search`. Publishing is automated by
`.github/workflows/release.yml`.

## Cutting a release (maintainer)

1. Bump `version` in `package.json`.
2. Move the relevant `CHANGELOG.md` entries from `Unreleased` into a new
   versioned section.
3. Open a PR with those changes and merge it (master is protected; use
   `gh pr merge <n> --squash --admin` when working solo).
4. Create a GitHub Release with tag `vX.Y.Z` (matching the new version).
   Publishing the release triggers the `Release` workflow, which builds, tests,
   and runs `npm publish` to GitHub Packages using the built-in `GITHUB_TOKEN`.

You can also trigger the workflow manually from the Actions tab
(`workflow_dispatch`); it publishes whatever version is in `package.json` on the
default branch.

## Installing the private package (consumer)

GitHub Packages requires authentication even for reading. In the consuming
project (or your home directory for global installs), add an `.npmrc`:

```
@xveyn:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Set `GITHUB_TOKEN` to a GitHub Personal Access Token with the `read:packages`
scope. Then install:

```bash
npm install -g @xveyn/codebase-semantic-search
```

Register it with Claude Code (the bin is named `codebase-semantic-search`):

```bash
claude mcp add codebase-search -- codebase-semantic-search
```

## Transitioning to a public npmjs release (later)

When ready to publish publicly:

1. Make the GitHub repository public.
2. Rename the package to the unscoped `codebase-semantic-search` in
   `package.json`.
3. Change `publishConfig` to npmjs and public access:
   ```json
   "publishConfig": { "access": "public" }
   ```
   (Remove the GitHub Packages `registry` line so it defaults to npmjs.)
4. Configure npm **Trusted Publishing** (OIDC) for this repo + the release
   workflow on npmjs.com, so no long-lived `NPM_TOKEN` is needed.
5. In `release.yml`: switch `registry-url` to `https://registry.npmjs.org`, drop
   the `scope`, add `id-token: write` to `permissions`, and publish with
   provenance:
   ```yaml
   - run: npm publish --provenance --access public
   ```
