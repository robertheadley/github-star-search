# Benchmarks

## github-pages-performance-cache-topic-cloud-20260525

- timestamp: 2026-05-25T13:48:00-05:00
- scenario: Search and render preparation for a large starred-repository list.
- method: Synthetic browser-data benchmark with 8,000 generated repositories and 12 topics per repository, comparing the previous per-search string rebuild/filter path to the new precomputed searchable-field path. Static rendering verification is run separately against `docs/`.
- environment: Windows, Node.js via PowerShell, local repository checkout.
- startup time: Not applicable; static app has no server startup in production.
- latency: Previous search path averaged 12.40 ms with 15.62 ms p95. Optimized search path averaged 5.89 ms with 7.86 ms p95 on the same 8,000-repository synthetic dataset.
- job duration: One-time precompute for 8,000 repositories took 14.09 ms. On-demand topic-count build for 500 unique topics took 5.26 ms.
- memory: Browser-managed IndexedDB cache replaces large synchronous `localStorage` repository payload parsing.
- CPU: Search CPU work dropped by about 52.5% in the synthetic benchmark because searchable strings and lowercase topic/language fields are prepared once after load/import/cache restore.
- event-loop lag: Search input is debounced by 140 ms and result rendering is capped at 100 cards initially with 100-card manual batches.
- validation: Synthetic benchmark completed with 1,961 matching repositories in both baseline and optimized paths, confirming equivalent result count for the benchmark query.
- risks: Synthetic results approximate browser search work but do not replace full visual profiling in the deployed browser.

## github-pages-shaped-weighted-topic-cloud-20260525

- timestamp: 2026-05-25T14:12:00-05:00
- scenario: On-demand topic cloud rendering after repositories are already loaded.
- method: Canvas renderer caps the cloud at 500 topics, scales font size by logarithmic topic frequency, and places words inside a 1440x960 silhouette mask using sampled mask collision checks and rectangular word hitboxes.
- environment: Windows, static GitHub Pages app.
- startup time: Not affected; cloud is hidden and uncomputed by default.
- latency: Static syntax/build and HTTP validation passed; interactive public Pages validation is run after deployment.
- job duration: Bounded by 500 topic render cap and 5,200 placement attempts per topic.
- memory: Stores only drawn word hitboxes for click handling.
- CPU: Cloud work occurs only after the user clicks `Build topic cloud`.
- event-loop lag: Placement is bounded by topic cap and per-word placement attempts.
- validation: `pnpm pages:check`, `pnpm check`, `pnpm build`, local static HTTP verification, public Pages HTTP verification, and deployed canvas click verification passed.

## github-pages-larger-topic-cloud-20260525

- timestamp: 2026-05-25T14:36:00-05:00
- scenario: Larger on-demand shaped topic cloud for dense topic sets.
- method: Increased canvas from 960x620 to 2200x1500, reduced logarithmic font range from 13-55 px to 5-30 px, added user-selectable top-topic limits from 500 to 5,000, relaxed mask sampling to require 76 percent of sampled points inside the shape, and tightened collision gap to 1 px.
- environment: Windows, static GitHub Pages app.
- startup time: Not affected; cloud remains hidden until requested.
- latency: Static syntax/build and local HTTP validation passed.
- job duration: Placement remains bounded by the selected cloud-size cap and 12,000 attempts per topic.
- memory: Stores drawn word hitboxes only for click handling.
- CPU: Cloud work still occurs only after the user clicks `Build topic cloud`.
- event-loop lag: More topics can draw than the prior version, with user-visible placed/total status.
- validation: `pnpm pages:check`, `pnpm check`, `pnpm build`, local static HTTP verification, public Pages HTTP verification, and deployed browser verification passed. Built-in sample data now includes 720 generated repositories and 360 generated topics for repeatable public Pages cloud testing. With top 2,000 selected, deployed sample verification placed 358 of 368 topics.
- risks: Browser canvas rendering may still skip words that cannot fit, but it now uses a larger surface and smaller text.

## github-pages-correlations-20260525

- timestamp: 2026-05-25T15:12:00-05:00
- scenario: On-demand metadata correlation analysis after repositories are loaded.
- method: Scan cached repositories for similar repos, topic co-occurrence pairs, language/topic clusters, owner/topic concentrations, and popular topic searches.
- environment: Windows, static GitHub Pages app.
- startup time: Not affected; correlations are off until requested.
- latency: Local validation and deployed interaction validation passed.
- job duration: Bounded by loaded repository count and per-repository topic cap of 30 for pair generation.
- memory: Uses temporary maps for counts and renders a small set of top suggestions.
- CPU: Correlation work occurs only after the user clicks `Find correlations`.
- event-loop lag: Correlations are rendered as small summary lists instead of large canvases or thousands of DOM nodes.
- validation: `pnpm pages:check`, `pnpm check`, `pnpm build`, local HTTP verification, public Pages HTTP verification, and deployed browser interaction verification passed.
- risks: Correlation ranking is metadata-only and does not inspect repository code contents.
- risks: Very low-frequency topics can be omitted when they do not fit in the bounded silhouette.

## github-pages-starrank-20260529

- timestamp: 2026-05-29T11:29:00-05:00
- scenario: StarRank calculation and descending sort for a large starred-repository list.
- method: Inline Node benchmark generated 8,000 repository records with varied creation dates, stars, forks, topics, descriptions, README flags, and license flags; each run calculated StarRank scores and sorted them descending.
- environment: Windows, Node.js via PowerShell, local repository checkout.
- startup time: Not affected; StarRank is computed after repository load/import/cache restore.
- latency: Average score+sort time was 5.39 ms across 25 runs; p95 was 6.54 ms.
- job duration: One benchmark process completed in about 600 ms including data generation and 25 repeated runs.
- memory: Stores one prepared StarRank object and numeric `_starRankScore` per loaded repository in the browser.
- CPU: StarRank uses bounded arithmetic and no network or DOM work during sorting.
- event-loop lag: Calculation is one-time per load/import/cache restore, while sorting reuses `_starRankScore`.
- validation: `pnpm pages:check`, `pnpm check`, `pnpm build`, formula execution check, local HTTP verification, and browser StarRank sort smoke test passed.
- risks: README bonus remains unavailable for GitHub API list results until optional README probing is implemented.
