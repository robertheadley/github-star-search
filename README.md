# GitHub Star Search

A GitHub Pages app and Windows-friendly TypeScript CLI for searching starred
repositories without cloning thousands of repos.

## What it does

- Runs as a static `github.io` search app from the `docs/` folder.
- Fetches starred repositories directly from GitHub in the browser.
- Searches star metadata locally after loading: name, owner, description,
  language, topics, dates, and URL.
- Calculates StarRank, an age-adjusted repository momentum rating based on
  stars/year, forks/year, fork surprise, raw popularity, topics, description,
  and license metadata.
- Supports IndexedDB browser cache, JSON export, and JSON import.
- Keeps large star lists responsive with debounced search, precomputed search
  fields, batched rendering, and on-demand correlation analysis.
- Syncs your starred repositories from GitHub into a local cache.
- Searches code remotely through GitHub's API, one starred repo at a time, so repositories do not need to be cloned.
- Saves machine-readable JSON results for later filtering or import into other tools.
- Prints StarRank beside CLI metadata search results when cached repository
  records include `createdAt`.

## Why this exists

GitHub lets you view starred repositories, but it does not provide a focused
public search app for quickly filtering all of a user's stars by repository
metadata. Cloning thousands of starred repositories is slow, wasteful, and hard
to maintain. This project uses GitHub's API first, then searches locally in the
browser or CLI.

## GitHub Pages app

The static app lives in `docs/`:

```text
docs/index.html
docs/styles.css
docs/app.js
```

To publish it on GitHub Pages:

1. Open the repository settings on GitHub.
2. Go to **Pages**.
3. Set **Source** to **Deploy from a branch**.
4. Set **Branch** to `main` and folder to `/docs`.
5. Save. GitHub will publish the app at the repository's Pages URL.

### Browser privacy model

- Star metadata is fetched from `https://api.github.com`.
- Search runs locally in the browser after loading stars.
- Star metadata is cached in browser IndexedDB so repeat visits do not need to
  refetch thousands of repositories.
- The optional token is used only for GitHub API requests in the current page
  and is intended for higher API limits.
- Fully private-star access needs a future OAuth/device-flow implementation.
- A small cache summary is stored in browser `localStorage`.
- Tokens are not written to the repository, exported JSON, or local cache.

### Correlations

The Correlations panel is computed only when requested. It looks for patterns in
your starred repositories and suggests useful searches:

- similar repositories based on shared topics, language, and owner
- topic pairs that often appear together
- language/topic clusters
- owner/topic concentrations
- popular topic searches

Correlation suggestions stay local in the browser and their **Search** buttons
load the matching query or topic filter.

### StarRank

StarRank is an age-adjusted repository momentum score. It favors repositories
with current attention and developer reuse instead of only old accumulated star
counts. The app shows the score and label on each result card and adds a
StarRank sort option.

The current GitHub starred-repository API response provides creation date,
stars, forks, topics, description, and license metadata. README presence is not
proven by that list response, so the README bonus is applied only when imported
data explicitly includes `hasReadme: true`; optional README fetching is tracked
as future work.

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
pnpm pages:check
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

Static GitHub Pages app plus starter CLI scaffold. The next useful features are
OAuth/device-flow sign-in, SQLite indexing for the CLI, resumable code search,
rate-limit-aware queueing, and optional README/file-content sampling through
GitHub Contents API.
