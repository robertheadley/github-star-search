import type {
  CodeSearchResult,
  GitHubSearchCodeItem,
  GitHubStarredRepoResponse,
  StarredRepo,
} from "./types.js"
import type { AppConfig } from "./config.js"

function parseNextLink(linkHeader: string | null): string | null {
  if (!linkHeader) {
    return null
  }

  const parts = linkHeader.split(",")
  for (const part of parts) {
    const match = part.match(/<([^>]+)>;\s*rel="next"/)
    if (match?.[1]) {
      return match[1]
    }
  }

  return null
}

export class GitHubClient {
  constructor(private readonly config: AppConfig) {}

  private async request<T>(url: string): Promise<{ data: T; nextUrl: string | null }> {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "github-star-search",
      },
    })

    if (!response.ok) {
      const body = await response.text().catch(() => "")
      throw new Error(`GitHub API error ${response.status} ${response.statusText}: ${body.slice(0, 500)}`)
    }

    const data = (await response.json()) as T
    return { data, nextUrl: parseNextLink(response.headers.get("link")) }
  }

  async listStarredRepos(): Promise<StarredRepo[]> {
    const repos: StarredRepo[] = []
    let nextUrl: string | null = `${this.config.apiBaseUrl}/user/starred?per_page=100&sort=updated&direction=desc`

    while (nextUrl) {
      const response: { data: GitHubStarredRepoResponse[]; nextUrl: string | null } =
        await this.request<GitHubStarredRepoResponse[]>(nextUrl)
      const data = response.data
      const next: string | null = response.nextUrl
      for (const repo of data) {
        repos.push({
          id: repo.id,
          fullName: repo.full_name,
          owner: repo.owner.login,
          name: repo.name,
          description: repo.description,
          htmlUrl: repo.html_url,
          cloneUrl: repo.clone_url,
          defaultBranch: repo.default_branch,
          language: repo.language,
          topics: repo.topics ?? [],
          stars: repo.stargazers_count,
          forks: repo.forks_count,
          archived: repo.archived,
          disabled: repo.disabled,
          private: repo.private,
          fork: repo.fork,
          createdAt: repo.created_at,
          pushedAt: repo.pushed_at,
          updatedAt: repo.updated_at,
          starredAt: null,
          hasReadme: false,
          hasLicense: Boolean(repo.license),
        })
      }
      nextUrl = next
    }

    return repos
  }

  async searchCodeInRepo(repoFullName: string, query: string, language?: string): Promise<CodeSearchResult[]> {
    const qualifiers = [`repo:${repoFullName}`]
    if (language) {
      qualifiers.push(`language:${language}`)
    }

    const q = encodeURIComponent(`${query} ${qualifiers.join(" ")}`)
    const url = `${this.config.apiBaseUrl}/search/code?q=${q}&per_page=20`
    const { data } = await this.request<{ items?: GitHubSearchCodeItem[] }>(url)

    return (data.items ?? []).map((item) => ({
      repo: item.repository.full_name,
      path: item.path,
      htmlUrl: item.html_url,
      score: item.score,
    }))
  }
}
