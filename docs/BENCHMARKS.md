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
