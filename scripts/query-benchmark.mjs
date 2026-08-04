import { performance } from "node:perf_hooks"
import { parseQuery, scoreRepoForQuery } from "../docs/core.js"

const repos = Array.from({ length: 8_000 }, (_, index) => ({
  fullName: `owner-${index % 200}/repo-${index}`,
  owner: `owner-${index % 200}`,
  name: `repo-${index}`,
  description: `MCP agent repository ${index}`,
  language: index % 2 ? "TypeScript" : "Python",
  topics: ["mcp", "agents", `topic-${index % 300}`],
  archived: index % 50 === 0,
  license: index % 3 ? "MIT" : "Apache-2.0",
}))
const prepared = repos.map((repo) => ({ ...repo, _search: [repo.fullName, repo.owner, repo.name, repo.description, repo.language, ...repo.topics].join(" ").toLowerCase() }))
const iterations = 100

function measure(run) {
  const times = []
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const start = performance.now()
    run()
    times.push(performance.now() - start)
  }
  times.sort((a, b) => a - b)
  return { averageMs: times.reduce((sum, value) => sum + value, 0) / times.length, p95Ms: times[Math.floor(times.length * 0.95)] }
}

const legacy = measure(() => prepared.filter((repo) => ["mcp", "typescript"].every((token) => repo._search.includes(token))))
const parsed = parseQuery("topic:mcp language:TypeScript -archived")
const current = measure(() => prepared.filter((repo) => scoreRepoForQuery(repo, parsed) >= 0))
console.log(JSON.stringify({ repositories: repos.length, iterations, legacy, current }, null, 2))
