# GitHub Star Search

A Windows-friendly TypeScript CLI for searching your GitHub starred repositories without cloning thousands of repos.

## What it does

- Syncs your starred repositories from GitHub into a local cache.
- Searches cached star metadata locally: name, owner, description, language, topics, URL.
- Searches code remotely through GitHub's API, one starred repo at a time, so repositories do not need to be cloned.
- Saves machine-readable JSON results for later filtering or import into other tools.

## Why this exists

GitHub lets you search stars by repository metadata in the UI, but it does not give you a simple local index of all starred repository contents. Cloning thousands of starred repositories is slow, wasteful, and hard to maintain. This tool starts with a safer API-first approach.

## Requirements

- Windows 11 or any system with Node.js 20+
- pnpm
- A GitHub token in `GH_TOKEN`

The token should be kept in your local environment only. Do not commit it.

## Quick start

```powershell
pnpm install
copy .env.example .env
notepad .env
pnpm build
pnpm stars:sync
pnpm stars:search "mcp"
pnpm stars:code "createServer" -- --limit-repos 25
```

## Commands

### Sync starred repositories

```powershell
pnpm stars:sync
```

Writes:

```text
data/starred-repos.json
```

### Search cached metadata

```powershell
pnpm stars:search "agent"
pnpm stars:search "typescript" -- --language TypeScript
pnpm stars:search "mcp" -- --topic mcp
```

### Search code remotely

```powershell
pnpm stars:code "createServer" -- --limit-repos 50
pnpm stars:code "GM_registerMenuCommand" -- --repo-filter userscript
pnpm stars:code "vector" -- --language TypeScript --limit-repos 100
```

Remote code search intentionally defaults to a limited number of repositories because GitHub search is rate-limited.

## Output files

```text
data/starred-repos.json
out/metadata-search-results.json
out/code-search-results.json
```

## Safety rules

- No repository cloning.
- No token logging.
- No destructive GitHub writes.
- Local cache and output files are ignored by git.

## Current status

Starter CLI scaffold. The next useful features are SQLite indexing, resumable code search, rate-limit-aware queueing, and optional README/file-content sampling through GitHub Contents API.
