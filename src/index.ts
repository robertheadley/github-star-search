#!/usr/bin/env node
import yargs from "yargs"
import { hideBin } from "yargs/helpers"

import { loadConfig } from "./config.js"
import { codeResultsPath, dlcExportPath, ensureRuntimeDirs, metadataResultsPath, readJsonFile, starredReposPath, writeJsonFile, writeTextFile } from "./fs.js"
import { GitHubClient } from "./github.js"
import { searchStarredRepos } from "./search.js"
import type { CodeSearchResult, StarredRepo } from "./types.js"

function printRepoTable(repos: StarredRepo[]): void {
  for (const repo of repos) {
    const language = repo.language ? ` [${repo.language}]` : ""
    const topics = repo.topics.length > 0 ? ` topics=${repo.topics.join(",")}` : ""
    console.log(`${repo.fullName}${language} ★${repo.stars}${topics}`)
    if (repo.description) {
      console.log(`  ${repo.description}`)
    }
    console.log(`  ${repo.htmlUrl}`)
  }
}

function printCodeResults(results: CodeSearchResult[]): void {
  for (const result of results) {
    console.log(`${result.repo} :: ${result.path}`)
    console.log(`  ${result.htmlUrl}`)
  }
}

async function loadCachedStars(): Promise<StarredRepo[]> {
  try {
    return await readJsonFile<StarredRepo[]>(starredReposPath)
  } catch {
    throw new Error(`No star cache found at ${starredReposPath}. Run: pnpm stars:sync`)
  }
}

await yargs(hideBin(process.argv))
  .scriptName("github-star-search")
  .command(
    "sync",
    "Sync starred repositories into the local cache.",
    (command) => command,
    async () => {
      await ensureRuntimeDirs()
      const client = new GitHubClient(loadConfig())
      const repos = await client.listStarredRepos()
      await writeJsonFile(starredReposPath, repos)
      console.log(`Synced ${repos.length} starred repositories to ${starredReposPath}`)
    },
  )
  .command(
    "search <query>",
    "Search cached starred repository metadata.",
    (command) =>
      command
        .positional("query", { type: "string", demandOption: true })
        .option("language", { type: "string", describe: "Filter by primary language" })
        .option("topic", { type: "string", describe: "Filter by exact topic" })
        .option("include-archived", { type: "boolean", default: false, describe: "Include archived repositories" })
        .option("limit", { type: "number", default: 100, describe: "Maximum results to show" }),
    async (args) => {
      await ensureRuntimeDirs()
      const repos = await loadCachedStars()
      const results = searchStarredRepos(repos, {
        query: String(args.query),
        language: args.language,
        topic: args.topic,
        includeArchived: args.includeArchived,
        limit: args.limit,
      })
      await writeJsonFile(metadataResultsPath, results)
      printRepoTable(results)
      console.log(`\nSaved ${results.length} results to ${metadataResultsPath}`)
    },
  )
  .command(
    "code <query>",
    "Search code remotely inside starred repositories through the GitHub Search API.",
    (command) =>
      command
        .positional("query", { type: "string", demandOption: true })
        .option("language", { type: "string", describe: "GitHub code search language qualifier" })
        .option("repo-filter", { type: "string", describe: "Only search repos whose full name or description contains this text" })
        .option("limit-repos", { type: "number", default: 25, describe: "Maximum starred repositories to search" }),
    async (args) => {
      await ensureRuntimeDirs()
      const repos = await loadCachedStars()
      const client = new GitHubClient(loadConfig())
      const repoFilter = args.repoFilter?.toLowerCase()
      const reposToSearch = repos
        .filter((repo) => {
          if (!repoFilter) {
            return true
          }
          return repo.fullName.toLowerCase().includes(repoFilter) || (repo.description ?? "").toLowerCase().includes(repoFilter)
        })
        .slice(0, args.limitRepos)

      const allResults: CodeSearchResult[] = []
      for (const [index, repo] of reposToSearch.entries()) {
        console.error(`[${index + 1}/${reposToSearch.length}] Searching ${repo.fullName}`)
        try {
          const results = await client.searchCodeInRepo(repo.fullName, String(args.query), args.language)
          allResults.push(...results)
        } catch (error) {
          console.error(`  skipped: ${error instanceof Error ? error.message : String(error)}`)
        }
      }

      await writeJsonFile(codeResultsPath, allResults)
      printCodeResults(allResults)
      console.log(`\nSaved ${allResults.length} code results to ${codeResultsPath}`)
    },
  )
  .command(
    "export-dlc",
    "Export a plain-text .dlc file containing download URLs for all READMEs.",
    (command) => command,
    async () => {
      await ensureRuntimeDirs()
      const repos = await loadCachedStars()
      const urls = repos.map((repo) => `https://raw.githubusercontent.com/${repo.owner}/${repo.name}/${repo.defaultBranch}/README.md`)
      const content = urls.join("\n") + "\n"
      await writeTextFile(dlcExportPath, content)
      console.log(`Saved ${urls.length} README URLs to ${dlcExportPath}`)
    },
  )
  .demandCommand(1)
  .strict()
  .help()
  .parseAsync()
