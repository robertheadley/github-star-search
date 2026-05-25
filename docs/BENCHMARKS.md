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
- method: Canvas renderer caps the cloud at 220 topics, scales font size by logarithmic topic frequency, and places words inside a 960x620 silhouette mask using sampled mask collision checks and rectangular word hitboxes.
- environment: Windows, static GitHub Pages app.
- startup time: Not affected; cloud is hidden and uncomputed by default.
- latency: Static syntax/build and HTTP validation passed; interactive public Pages validation is run after deployment.
- job duration: Bounded by 220 topic render cap and 1,400 placement attempts per topic.
- memory: Stores only drawn word hitboxes for click handling.
- CPU: Cloud work occurs only after the user clicks `Build topic cloud`.
- event-loop lag: Placement is bounded by topic cap and per-word placement attempts.
- validation: `pnpm pages:check`, `pnpm check`, `pnpm build`, local static HTTP verification, public Pages HTTP verification, and deployed canvas click verification passed.
- risks: Very low-frequency topics can be omitted when they do not fit in the bounded silhouette.
