# Roadmap

## Phase 1: Working CLI

- [x] Sync starred repositories into local JSON.
- [x] Search cached repository metadata.
- [x] Search code remotely through GitHub Search API.
- [x] Avoid cloning repositories.
- [x] Keep tokens out of git.

## Phase 2: Better local index

- [ ] Store starred repository metadata in SQLite.
- [ ] Add incremental sync using ETags or timestamps where practical.
- [ ] Add advanced filters for owner, fork status, archived status, pushed date, and star count.
- [ ] Add duplicate/relevance ranking.
- [ ] Add export formats: JSON, CSV, TSV.

## Phase 3: Content discovery without cloning

- [ ] Add optional README fetching through GitHub Contents API.
- [ ] Add optional package manifest fetching for package.json, pyproject.toml, Cargo.toml, go.mod, and README.md.
- [ ] Add resumable remote code search queue.
- [ ] Add rate-limit-aware scheduling.
- [ ] Add failure cache to avoid retry loops.

## Phase 4: GitHub Pages search portal

- [x] Add a static GitHub Pages app under `docs/`.
- [x] Load public starred repositories by username.
- [x] Add optional token support for higher GitHub API limits.
- [x] Add instant in-browser metadata search.
- [x] Add filters for language, topic, archived repos, and forks.
- [x] Add browser cache, JSON export, and JSON import.
- [x] Move large repository cache to IndexedDB.
- [x] Add debounced search, precomputed fields, and batched rendering for large star lists.
- [x] Add an on-demand topic cloud.
- [ ] Add OAuth/device-flow design for non-technical users and private-star access.
- [ ] Document GitHub API limits in the app UI.
- [ ] Add privacy-first architecture notes.

## Phase 5: Local web UI

- [ ] Add a local-only web interface.
- [ ] Add instant metadata search.
- [ ] Add saved searches.
- [ ] Add repo detail drawer.
- [ ] Add code search job history.

## Phase 6: Advanced hosted search

A public GitHub Pages app can search a user's stars only after the user authenticates with GitHub. It should not require users to enter many API keys.

- [ ] Add OAuth/device-flow design.
- [ ] Keep tokens client-side only or use a minimal backend proxy.
- [ ] Document GitHub API limits clearly.
- [ ] Add privacy-first architecture notes.
