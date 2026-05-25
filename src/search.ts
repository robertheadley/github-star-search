import type { StarredRepo } from "./types.js"

export type MetadataSearchOptions = {
  query: string
  language?: string
  topic?: string
  includeArchived?: boolean
  limit?: number
}

function includesText(value: string | null | undefined, query: string): boolean {
  return (value ?? "").toLowerCase().includes(query.toLowerCase())
}

export function searchStarredRepos(repos: StarredRepo[], options: MetadataSearchOptions): StarredRepo[] {
  const query = options.query.trim().toLowerCase()
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

    if (!query) {
      return true
    }

    return (
      includesText(repo.fullName, query) ||
      includesText(repo.description, query) ||
      includesText(repo.language, query) ||
      repo.topics.some((topic) => includesText(topic, query))
    )
  })

  return results.slice(0, limit)
}
