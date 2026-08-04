import type { StarredRepo } from "./types.js"
import { parseQuery, scoreRepoForQuery } from "./core.js"

export type MetadataSearchOptions = {
  query: string
  language?: string
  topic?: string
  includeArchived?: boolean
  limit?: number
}

export function searchStarredRepos(repos: StarredRepo[], options: MetadataSearchOptions): StarredRepo[] {
  const parsed = parseQuery(options.query)
  if (parsed.error) throw new Error(parsed.error)
  const limit = options.limit ?? 100

  const results = repos.filter((repo) => {
    if (!options.includeArchived && repo.archived) {
      return false
    }

    if (options.language && repo.language?.toLowerCase() !== options.language.toLowerCase()) {
      return false
    }

    if (options.topic && !repo.topics.some((topic) => topic.toLowerCase() === options.topic?.toLowerCase())) {
      return false
    }

    return scoreRepoForQuery(repo, parsed) >= 0
  })

  return results.slice(0, limit)
}
