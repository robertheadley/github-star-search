import assert from "node:assert/strict"
import test from "node:test"

import { calculateStarRank, createRepoExport, parseQuery, scoreRepoForQuery, validateRepoImport } from "../src/core.js"

const typescriptMcp = {
  id: 1,
  fullName: "modelcontextprotocol/servers",
  owner: "modelcontextprotocol",
  name: "servers",
  description: "MCP server examples for agents",
  htmlUrl: "https://github.com/modelcontextprotocol/servers",
  language: "TypeScript",
  topics: ["mcp", "agents"],
  license: "MIT",
  archived: false,
  disabled: false,
  private: false,
  fork: false,
  createdAt: "2024-01-01T00:00:00Z",
  stars: 100,
  forks: 10,
}

test("parses and applies field qualifiers", () => {
  const parsed = parseQuery("topic:mcp language:TypeScript owner:modelcontextprotocol license:MIT")
  assert.equal(parsed.error, null)
  assert.ok(scoreRepoForQuery(typescriptMcp, parsed) >= 0)
  assert.equal(scoreRepoForQuery({ ...typescriptMcp, language: "Go" }, parsed), -1)
})

test("supports quoted phrases, exclusions, flags, and OR", () => {
  assert.ok(scoreRepoForQuery(typescriptMcp, parseQuery('"server examples" -archived')) >= 0)
  assert.equal(scoreRepoForQuery({ ...typescriptMcp, archived: true }, parseQuery("-archived")), -1)
  assert.ok(scoreRepoForQuery(typescriptMcp, parseQuery("language:Go OR topic:mcp")) >= 0)
  assert.equal(scoreRepoForQuery(typescriptMcp, parseQuery("-topic:mcp")), -1)
})

test("returns actionable invalid-query errors", () => {
  assert.match(parseQuery('"unterminated').error ?? "", /Close the quoted phrase/)
  assert.match(parseQuery("stars:100").error ?? "", /Unsupported filter/)
  assert.match(parseQuery("topic:mcp OR").error ?? "", /OR must appear/)
})

test("keeps StarRank deterministic", () => {
  assert.deepEqual(calculateStarRank(typescriptMcp, new Date("2026-01-01T00:00:00Z")), calculateStarRank(typescriptMcp, new Date("2026-01-01T00:00:00Z")))
})

test("creates versioned exports and migrates legacy arrays", () => {
  const exported = createRepoExport([typescriptMcp], "results", new Date("2026-08-04T00:00:00Z"))
  assert.equal(exported.schemaVersion, 1)
  assert.deepEqual(validateRepoImport(exported), { repos: [typescriptMcp], migratedLegacy: false })
  assert.deepEqual(validateRepoImport([typescriptMcp]), { repos: [typescriptMcp], migratedLegacy: true })
})

test("rejects malformed and incompatible imports", () => {
  assert.throws(() => validateRepoImport({ schemaVersion: 99, repos: [] }), /Unsupported export schema/)
  assert.throws(() => validateRepoImport({ schemaVersion: 1, repos: [{ id: 1 }] }), /missing required field/)
})
