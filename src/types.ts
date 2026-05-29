export type StarredRepo = {
  id: number
  fullName: string
  owner: string
  name: string
  description: string | null
  htmlUrl: string
  cloneUrl: string
  defaultBranch: string
  language: string | null
  topics: string[]
  stars: number
  forks: number
  archived: boolean
  disabled: boolean
  private: boolean
  fork: boolean
  createdAt: string | null
  pushedAt: string | null
  updatedAt: string | null
  starredAt: string | null
  hasReadme?: boolean
  hasLicense?: boolean
}

export type StarRankLabel =
  | "Exceptional Momentum"
  | "High Momentum"
  | "Moderate Momentum"
  | "Low Momentum"
  | "Minimal Momentum"

export type StarRank = {
  score: number
  rankLabel: StarRankLabel
  components: {
    stars: number
    forks: number
    ageDays: number
    ageYears: number
    starsPerYear: number
    forksPerYear: number
    expectedForks: number
    forkSurprise: number
    starMomentumScore: number
    forkMomentumScore: number
    forkSurpriseScore: number
    rawPopularityScore: number
    rawForkScore: number
    metadataBonus: number
  }
}

export type CodeSearchResult = {
  repo: string
  path: string
  htmlUrl: string
  score?: number
}

export type GitHubSearchCodeItem = {
  name: string
  path: string
  html_url: string
  score?: number
  repository: {
    full_name: string
  }
}

export type GitHubStarredRepoResponse = {
  id: number
  full_name: string
  name: string
  description: string | null
  html_url: string
  clone_url: string
  default_branch: string
  language: string | null
  topics?: string[]
  stargazers_count: number
  forks_count: number
  archived: boolean
  disabled: boolean
  private: boolean
  fork: boolean
  created_at: string | null
  pushed_at: string | null
  updated_at: string | null
  license?: unknown
  owner: {
    login: string
  }
}
