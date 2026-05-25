# Agent Change Journal

## github-pages-star-search-20260525

- timestamp: 2026-05-25T13:16:19.0816496-05:00
- what: Added a static GitHub Pages search app for starred repositories under `docs/`.
- why: The project was CLI-only, while the requested product is a github.io search surface for users to search their GitHub stars.
- components: `docs/index.html`, `docs/styles.css`, `docs/app.js`, `docs/.nojekyll`, `README.md`, `docs/ROADMAP.md`
- type: feature
- validation: Pending automated build/static checks and browser verification.
- performance: Client search is local after paginated GitHub API fetch; no benchmark-sensitive server path changed.
- risks: GitHub API rate limits apply for unauthenticated public-star loading; private stars require a token entered client-side.
- follow_up: Consider a GitHub OAuth device flow or backend proxy if the project needs non-token private-star access.

## github-pages-performance-cache-topic-cloud-20260525

- timestamp: 2026-05-25T13:44:00-05:00
- what: Added IndexedDB caching, precomputed searchable fields, debounced filtering, batched result rendering, and an on-demand topic cloud.
- why: Large starred-repository lists around 8,000 entries caused visible lag when searching and rendering too much work at once.
- components: `docs/app.js`, `docs/index.html`, `docs/styles.css`, `README.md`, `docs/ROADMAP.md`, `docs/BENCHMARKS.md`
- type: performance, feature
- validation: `pnpm pages:check`, `pnpm check`, `pnpm build`, static HTTP check, and synthetic 8,000-repository benchmark passed.
- performance: Synthetic average search time improved from 12.40 ms to 5.89 ms; initial result rendering is capped at 100 cards and topic cloud computation is manual.
- risks: IndexedDB is browser-managed storage; users can still clear it through browser site data controls.
- follow_up: Add an explicit refresh age warning and GitHub rate-limit display in the UI.
