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

## github-pages-shaped-weighted-topic-cloud-20260525

- timestamp: 2026-05-25T14:11:00-05:00
- what: Replaced the button-style topic cloud with a weighted canvas word cloud constrained to a silhouette mask.
- why: The prior topic cloud did not match the requested word-cloud behavior where higher-frequency topics are larger and arranged inside the provided shape.
- components: `docs/app.js`, `docs/index.html`, `docs/styles.css`, `README.md`, `docs/ROADMAP.md`
- type: feature
- validation: `pnpm pages:check`, `pnpm check`, `pnpm build`, static HTTP verification, public Pages HTTP verification, and deployed sample-data click verification passed.
- performance: The cloud still computes only on demand and is capped at 220 rendered topics.
- risks: Canvas placement is deterministic but may skip low-frequency topics if they cannot fit inside the mask at the current cap.
- follow_up: Add a dedicated visual regression test if the project adopts browser testing infrastructure.

## github-pages-larger-topic-cloud-20260525

- timestamp: 2026-05-25T14:32:00-05:00
- what: Enlarged the weighted topic cloud canvas, reduced word sizes, added selectable cloud size, and relaxed mask placement.
- why: The deployed cloud only placed a few words for a large topic set because the prior canvas and collision rules were too restrictive.
- components: `docs/app.js`, `docs/index.html`, `docs/styles.css`, `README.md`, `docs/BENCHMARKS.md`
- type: feature, performance tuning
- validation: `pnpm pages:check`, `pnpm check`, `pnpm build`, static HTTP verification, public Pages HTTP verification, and deployed browser verification passed.
- performance: Cloud remains on-demand; placement is bounded by the selected top-topic cap and a fixed attempt limit. The sample dataset now includes enough generated topics to test dense cloud placement.
- risks: Very dense topic sets can still omit words that cannot fit, but the status pill now reports placed topics versus total topics.
- follow_up: Add viewport controls or an exportable cloud image if users want to inspect every low-frequency topic.

## github-pages-correlations-20260525

- timestamp: 2026-05-25T15:12:00-05:00
- what: Removed the topic cloud and added an on-demand correlations panel.
- why: The shaped word cloud did not provide a useful experience for very large topic sets.
- components: `docs/app.js`, `docs/index.html`, `docs/styles.css`, `README.md`, `docs/ROADMAP.md`
- type: feature replacement
- validation: `pnpm pages:check`, `pnpm check`, `pnpm build`, local HTTP verification, public Pages HTTP verification, and deployed browser interaction verification passed.
- performance: Correlations are computed only when requested and summarize top signals instead of rendering thousands of topics.
- risks: Correlations are metadata-based and should be treated as suggestions, not semantic code/content understanding.
- follow_up: Add persisted saved correlation reports if users want to compare snapshots over time.

## github-pages-starrank-20260529

- timestamp: 2026-05-29T11:20:00-05:00
- what: Added StarRank age-adjusted repository momentum scoring to the CLI data model and the static GitHub Pages app.
- why: Raw star counts over-rank old repositories, while the requested rating should prioritize current relevance through age-adjusted stars, forks, fork surprise, and bounded metadata bonuses.
- components: `src/starrank.ts`, `src/types.ts`, `src/github.ts`, `src/index.ts`, `docs/app.js`, `docs/index.html`, `README.md`, `docs/ROADMAP.md`
- type: feature
- validation: `pnpm pages:check`, `pnpm check`, `pnpm build`, formula execution check, local static HTTP verification, and in-app browser StarRank sort smoke test passed.
- performance: StarRank is calculated once per repository during prepare/load and reused for sorting/rendering.
- risks: README presence is not proven by the current starred-repository list response, so the README bonus is applied only when imported data explicitly includes `hasReadme: true`.
- follow_up: Add optional README probing or manifest indexing if exact README metadata becomes important.
