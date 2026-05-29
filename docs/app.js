const cacheKey = "github-star-search:repos:v3"
const legacyCacheKey = "github-star-search:repos:v1"
const previousCacheKeys = ["github-star-search:repos:v2", legacyCacheKey]
const databaseName = "github-star-search"
const repoStoreName = "repo-cache"
const initialRenderLimit = 100
const renderBatchSize = 100

const sampleRepos = [
  {
    id: 1,
    fullName: "modelcontextprotocol/servers",
    owner: "modelcontextprotocol",
    name: "servers",
    description: "Example MCP servers and integrations",
    htmlUrl: "https://github.com/modelcontextprotocol/servers",
    language: "TypeScript",
    topics: ["mcp", "agents", "typescript"],
    stars: 62000,
    forks: 5100,
    archived: false,
    disabled: false,
    private: false,
    fork: false,
    createdAt: "2024-11-25T00:00:00Z",
    pushedAt: "2026-05-20T12:30:00Z",
    updatedAt: "2026-05-22T09:15:00Z",
    starredAt: "2026-05-24T15:00:00Z",
    hasReadme: true,
    hasLicense: true,
  },
  {
    id: 2,
    fullName: "github/docs",
    owner: "github",
    name: "docs",
    description: "The open-source repo for docs.github.com",
    htmlUrl: "https://github.com/github/docs",
    language: "JavaScript",
    topics: ["documentation", "github", "docs"],
    stars: 17400,
    forks: 64000,
    archived: false,
    disabled: false,
    private: false,
    fork: false,
    createdAt: "2016-10-04T00:00:00Z",
    pushedAt: "2026-05-21T17:20:00Z",
    updatedAt: "2026-05-24T08:05:00Z",
    starredAt: "2026-05-23T18:30:00Z",
    hasReadme: true,
    hasLicense: true,
  },
  {
    id: 3,
    fullName: "cli/cli",
    owner: "cli",
    name: "cli",
    description: "GitHub's official command line tool",
    htmlUrl: "https://github.com/cli/cli",
    language: "Go",
    topics: ["github", "cli", "terminal"],
    stars: 40000,
    forks: 5800,
    archived: false,
    disabled: false,
    private: false,
    fork: false,
    createdAt: "2019-01-07T00:00:00Z",
    pushedAt: "2026-05-18T12:00:00Z",
    updatedAt: "2026-05-18T12:00:00Z",
    starredAt: "2026-05-22T14:00:00Z",
    hasReadme: true,
    hasLicense: true,
  },
]

const sampleTopicPool = Array.from({ length: 360 }, (_, index) => `topic-${index}`)
const sampleLanguages = ["TypeScript", "JavaScript", "Go", "Python", "Rust"]
for (let index = 0; index < 720; index += 1) {
  sampleRepos.push({
    id: 1000 + index,
    fullName: `sample-owner-${index % 90}/sample-repo-${index}`,
    owner: `sample-owner-${index % 90}`,
    name: `sample-repo-${index}`,
    description: `Sample repository ${index} for correlation verification`,
    htmlUrl: `https://github.com/sample-owner/sample-repo-${index}`,
    language: sampleLanguages[index % sampleLanguages.length],
    topics: Array.from({ length: 8 }, (_, offset) => sampleTopicPool[(index + offset * 23) % sampleTopicPool.length]),
    stars: (index * 41) % 100000,
    forks: (index * 13) % 4000,
    archived: false,
    disabled: false,
    private: false,
    fork: index % 11 === 0,
    createdAt: new Date(Date.UTC(2020 + (index % 6), index % 12, (index % 27) + 1)).toISOString(),
    pushedAt: "2026-05-01T00:00:00Z",
    updatedAt: "2026-05-20T00:00:00Z",
    starredAt: "2026-05-21T00:00:00Z",
    hasReadme: true,
    hasLicense: index % 5 !== 0,
  })
}

const state = {
  repos: [],
  filtered: [],
  loading: false,
  renderLimit: initialRenderLimit,
  cacheMeta: null,
  searchTimer: null,
  insightsBuilt: false,
  sortDirection: "desc",
  activeTableFilterColumn: null,
  tableFilters: {
    name: "",
    stars: "",
    starrank: "",
    language: "",
    updated: "",
    age: "",
  },
}

const elements = {
  form: document.querySelector("#load-form"),
  username: document.querySelector("#username"),
  token: document.querySelector("#token"),
  loadButton: document.querySelector("#load-button"),
  sampleButton: document.querySelector("#sample-button"),
  progress: document.querySelector("#progress"),
  status: document.querySelector("#connection-status"),
  cacheSummary: document.querySelector("#cache-summary"),
  query: document.querySelector("#query"),
  language: document.querySelector("#language"),
  languageList: document.querySelector("#language-list"),
  topic: document.querySelector("#topic"),
  topicList: document.querySelector("#topic-list"),
  sort: document.querySelector("#sort"),
  includeArchived: document.querySelector("#include-archived"),
  forksOnly: document.querySelector("#forks-only"),
  hideForks: document.querySelector("#hide-forks"),
  exportButton: document.querySelector("#export-button"),
  exportDlcButton: document.querySelector("#export-dlc-button"),
  clearTableFiltersButton: document.querySelector("#clear-table-filters-button"),
  importInput: document.querySelector("#import-input"),
  clearButton: document.querySelector("#clear-button"),
  correlationRepo: document.querySelector("#correlation-repo"),
  correlationButton: document.querySelector("#correlation-button"),
  correlations: document.querySelector("#correlations"),
  insightsStatus: document.querySelector("#insights-status"),
  resultCount: document.querySelector("#result-count"),
  results: document.querySelector("#results"),
  showMoreButton: document.querySelector("#show-more-button"),
  template: document.querySelector("#repo-template"),
}

function openCacheDatabase() {
  if (!("indexedDB" in window)) {
    return Promise.reject(new Error("IndexedDB is not available in this browser."))
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(repoStoreName, { keyPath: "key" })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function readIndexedCache() {
  const db = await openCacheDatabase()
  try {
    for (const key of [cacheKey, ...previousCacheKeys]) {
      const record = await new Promise((resolve, reject) => {
        const transaction = db.transaction(repoStoreName, "readonly")
        const store = transaction.objectStore(repoStoreName)
        const request = store.get(key)
        request.onsuccess = () => resolve(request.result ?? null)
        request.onerror = () => reject(request.error)
      })
      if (record) {
        return { ...record, cacheKey: key }
      }
    }
    return null
  } finally {
    db.close()
  }
}

async function writeIndexedCache(record) {
  const db = await openCacheDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(repoStoreName, "readwrite")
    transaction.objectStore(repoStoreName).put({ key: cacheKey, ...record })
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  }).finally(() => db.close())
}

async function clearIndexedCache() {
  const db = await openCacheDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(repoStoreName, "readwrite")
    transaction.objectStore(repoStoreName).delete(cacheKey)
    for (const key of previousCacheKeys) {
      transaction.objectStore(repoStoreName).delete(key)
    }
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  }).finally(() => db.close())
}

function normalizeGitHubRepo(repo) {
  return {
    id: repo.id,
    fullName: repo.full_name,
    owner: repo.owner?.login ?? "",
    name: repo.name,
    description: repo.description,
    htmlUrl: repo.html_url,
    defaultBranch: repo.default_branch || "main",
    language: repo.language,
    topics: Array.isArray(repo.topics) ? repo.topics : [],
    stars: repo.stargazers_count ?? 0,
    forks: repo.forks_count ?? 0,
    archived: Boolean(repo.archived),
    disabled: Boolean(repo.disabled),
    private: Boolean(repo.private),
    fork: Boolean(repo.fork),
    createdAt: repo.created_at ?? null,
    pushedAt: repo.pushed_at,
    updatedAt: repo.updated_at,
    starredAt: repo.starred_at ?? null,
    hasReadme: false,
    hasLicense: Boolean(repo.license),
  }
}

function prepareRepo(repo) {
  const topics = Array.isArray(repo.topics) ? repo.topics : []
  const language = repo.language || null
  const description = repo.description || ""
  const fullName = repo.fullName || ""
  const owner = repo.owner || ""
  const name = repo.name || ""
  const topicText = topics.join(" ")
  const starRank = calculateStarRank({ ...repo, topics, language, description })

  return {
    ...repo,
    topics,
    language,
    createdAt: repo.createdAt || null,
    hasReadme: Boolean(repo.hasReadme),
    hasLicense: Boolean(repo.hasLicense),
    starRank,
    _search: [fullName, owner, name, description, language, topicText].join(" ").toLowerCase(),
    _nameSearch: fullName.toLowerCase(),
    _descriptionSearch: description.toLowerCase(),
    _topicsLower: topics.map((topic) => topic.toLowerCase()),
    _languageLower: (language || "").toLowerCase(),
    _updatedTime: Date.parse(repo.updatedAt || "") || 0,
    _starredTime: Date.parse(repo.starredAt || "") || 0,
    _starRankScore: starRank?.score ?? -1,
    _ageDays: starRank?.components.ageDays ?? null,
    _ageYears: starRank?.components.ageYears ?? null,
  }
}

function calculateStarRank(repo, now = new Date()) {
  if (!repo.createdAt) {
    return null
  }

  const createdAt = new Date(repo.createdAt)
  if (Number.isNaN(createdAt.getTime())) {
    return null
  }

  const ageDays = Math.max(daysBetween(createdAt, now), 1)
  const ageYears = Math.max(ageDays / 365.25, 0.25)
  const starsPerYear = repo.stars / ageYears
  const forksPerYear = repo.forks / ageYears
  const starMomentumScore = Math.log10(starsPerYear + 1) * 50
  const forkMomentumScore = Math.log10(forksPerYear + 1) * 25
  const expectedForkRatio = expectedForkRatioForAge(ageDays)
  const expectedForks = Math.max(repo.stars * expectedForkRatio, 1)
  const forkSurprise = repo.forks / expectedForks
  const cappedForkSurprise = Math.min(forkSurprise, 10)
  const forkSurpriseScore = Math.log10(cappedForkSurprise + 1) * 20
  const rawPopularityScore = Math.log10(repo.stars + 1) * 5
  const rawForkScore = Math.log10(repo.forks + 1) * 3
  const topicBonus = Math.min(repo.topics.length, 5) * 2
  const descriptionBonus = repo.description?.trim() ? 3 : 0
  const readmeBonus = repo.hasReadme ? 4 : 0
  const licenseBonus = repo.hasLicense ? 3 : 0
  const metadataBonus = Math.min(topicBonus + descriptionBonus + readmeBonus + licenseBonus, 20)
  const baseScore =
    starMomentumScore +
    forkMomentumScore +
    forkSurpriseScore +
    rawPopularityScore +
    rawForkScore
  const finalScore = baseScore + metadataBonus
  const score = Math.round(finalScore * 100) / 100

  return {
    score,
    rankLabel: getStarRankLabel(score),
    components: {
      stars: repo.stars,
      forks: repo.forks,
      ageDays,
      ageYears,
      starsPerYear,
      forksPerYear,
      expectedForks,
      forkSurprise,
      starMomentumScore,
      forkMomentumScore,
      forkSurpriseScore,
      rawPopularityScore,
      rawForkScore,
      metadataBonus,
    },
  }
}

function getStarRankLabel(score) {
  if (score >= 100) return "Exceptional Momentum"
  if (score >= 75) return "High Momentum"
  if (score >= 50) return "Moderate Momentum"
  if (score >= 25) return "Low Momentum"
  return "Minimal Momentum"
}

function expectedForkRatioForAge(ageDays) {
  if (ageDays < 90) return 0.01
  if (ageDays < 365) return 0.03
  if (ageDays < 1095) return 0.06
  return 0.1
}

function daysBetween(start, end) {
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.floor((end.getTime() - start.getTime()) / msPerDay)
}

function setRepos(repos, meta) {
  state.repos = repos.map(prepareRepo)
  state.filtered = []
  state.renderLimit = initialRenderLimit
  state.cacheMeta = meta
  state.insightsBuilt = false
  elements.insightsStatus.textContent = "Off"
  elements.correlations.className = "insights-grid empty-state"
  elements.correlations.textContent = "Run correlations to analyze relationships in your starred repositories."
  updateControls()
  updateCacheSummary()
  applySearchNow()
}

function countReposMissingCreatedAt(repos) {
  return repos.filter((repo) => !repo.createdAt).length
}

function isRefreshableCacheSource(source) {
  return source && source !== "sample" && source !== "legacy" && source !== "import"
}

function parseNextLink(linkHeader) {
  if (!linkHeader) {
    return null
  }

  for (const part of linkHeader.split(",")) {
    const match = part.match(/<([^>]+)>;\s*rel="next"/)
    if (match) {
      return match[1]
    }
  }

  return null
}

async function fetchStarPage(url, token) {
  const headers = {
    Accept: "application/vnd.github.star+json",
    "X-GitHub-Api-Version": "2022-11-28",
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(url, { headers })
  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(`GitHub API ${response.status}: ${body.slice(0, 220) || response.statusText}`)
  }

  return {
    data: await response.json(),
    nextUrl: parseNextLink(response.headers.get("link")),
    remaining: response.headers.get("x-ratelimit-remaining"),
  }
}

async function fetchAllStars(username, token) {
  const trimmedUser = username.trim()
  if (!trimmedUser) {
    throw new Error("GitHub username is required.")
  }

  const baseUrl = `https://api.github.com/users/${encodeURIComponent(trimmedUser)}/starred?per_page=100&sort=updated&direction=desc`

  const repos = []
  let nextUrl = baseUrl
  let page = 1

  while (nextUrl) {
    updateProgress(`Fetching page ${page}. Loaded ${repos.length} repositories so far.`)
    const { data, nextUrl: next, remaining } = await fetchStarPage(nextUrl, token)
    for (const item of data) {
      const repo = item.repo ? { ...item.repo, starred_at: item.starred_at } : item
      repos.push(normalizeGitHubRepo(repo))
    }
    nextUrl = next
    page += 1

    if (remaining === "0" && nextUrl) {
      throw new Error("GitHub rate limit reached before all stars were loaded. Add a token and retry.")
    }
  }

  return repos
}

async function loadFromCache() {
  try {
    const cached = await readIndexedCache()
    if (Array.isArray(cached?.repos)) {
      setRepos(cached.repos, cached.meta)
      const savedUser = localStorage.getItem("github-star-search:username") || (isRefreshableCacheSource(cached.meta?.source) ? cached.meta.source : "")
      if (savedUser) elements.username.value = savedUser
      updateStatus(`Cached ${state.repos.length}`)
      const missingCreatedAt = countReposMissingCreatedAt(cached.repos)
      if (missingCreatedAt > 0 && savedUser) {
        await refreshCacheForStarRank(savedUser, `Refreshing ${missingCreatedAt} cached repositories so StarRank has repository creation dates.`)
      } else if (missingCreatedAt > 0) {
        updateProgress(`Loaded ${state.repos.length} repositories from cache. StarRank needs repository creation dates, so reload stars from GitHub or import JSON with createdAt.`)
      } else {
        updateProgress(`Loaded ${state.repos.length} repositories from IndexedDB cache. Search is local now.`)
      }
      return
    }
  } catch (error) {
    console.warn("IndexedDB cache unavailable", error)
  }

  for (const key of [cacheKey, ...previousCacheKeys]) {
    try {
      const legacy = JSON.parse(localStorage.getItem(key) || "null")
      if (Array.isArray(legacy?.repos)) {
        await saveToCache(legacy.repos, legacy.source || "legacy")
        localStorage.removeItem(key)
        setRepos(legacy.repos, readCacheMeta())
        const savedUser = localStorage.getItem("github-star-search:username") || (isRefreshableCacheSource(legacy.source) ? legacy.source : "")
        if (savedUser) elements.username.value = savedUser
        updateStatus(`Cached ${state.repos.length}`)
        const missingCreatedAt = countReposMissingCreatedAt(legacy.repos)
        if (missingCreatedAt > 0 && savedUser) {
          await refreshCacheForStarRank(savedUser, `Migrated ${state.repos.length} repositories from an older cache. Refreshing GitHub data so StarRank can be calculated.`)
        } else if (missingCreatedAt > 0) {
          updateProgress(`Migrated ${state.repos.length} repositories from an older cache. StarRank needs repository creation dates, so reload stars from GitHub or import JSON with createdAt.`)
        } else {
          updateProgress(`Migrated ${state.repos.length} repositories from the older browser cache.`)
        }
        return
      }
    } catch {
      localStorage.removeItem(key)
    }
  }
}

async function refreshCacheForStarRank(username, message) {
  updateStatus("Refreshing")
  updateProgress(message)
  try {
    const repos = await fetchAllStars(username, elements.token.value.trim())
    await saveToCache(repos, username)
    setRepos(repos, state.cacheMeta)
    updateStatus(`Loaded ${repos.length}`)
    updateProgress(`Refreshed ${repos.length} repositories from GitHub. StarRank is now calculated from repository creation dates.`)
  } catch (error) {
    updateStatus(`Cached ${state.repos.length}`)
    updateProgress(`${message} Refresh failed: ${error instanceof Error ? error.message : String(error)} Add a token if GitHub rate limits the refresh, then click Load starred repos.`)
  }
}

function readCacheMeta() {
  try {
    return JSON.parse(localStorage.getItem(cacheKey) || "null")
  } catch {
    localStorage.removeItem(cacheKey)
    return null
  }
}

async function saveToCache(repos, source) {
  const meta = {
    source,
    savedAt: new Date().toISOString(),
    count: repos.length,
    storage: "IndexedDB",
  }
  try {
    await writeIndexedCache({ meta, repos })
  } catch (error) {
    console.warn("IndexedDB cache write failed; using localStorage fallback", error)
    meta.storage = "localStorage"
    localStorage.setItem(
      legacyCacheKey,
      JSON.stringify({
        source,
        savedAt: meta.savedAt,
        repos,
      }),
    )
  }
  localStorage.setItem(cacheKey, JSON.stringify(meta))
  state.cacheMeta = meta
}

function updateProgress(message) {
  elements.progress.textContent = message
}

function updateStatus(message) {
  elements.status.textContent = message
}

function updateCacheSummary() {
  const meta = state.cacheMeta || readCacheMeta()
  if (!meta?.savedAt) {
    elements.cacheSummary.hidden = true
    elements.cacheSummary.textContent = ""
    return
  }

  elements.cacheSummary.hidden = false
  elements.cacheSummary.textContent = `Cache: ${meta.count?.toLocaleString?.() ?? state.repos.length.toLocaleString()} repos from ${meta.source || "unknown"} saved ${formatDateTime(meta.savedAt)}.`
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b))
}

function populateDatalist(datalist, values, maxItems = 500) {
  datalist.replaceChildren()
  for (const value of values.slice(0, maxItems)) {
    datalist.append(new Option(value, value))
  }
}

function updateControls() {
  const languageCounts = new Map()
  for (const repo of state.repos) {
    if (repo.language) {
      languageCounts.set(repo.language, (languageCounts.get(repo.language) || 0) + 1)
    }
  }
  const topLanguages = [...languageCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map((entry) => entry[0])

  populateDatalist(elements.languageList, topLanguages)

  const topicCounts = new Map()
  for (const repo of state.repos) {
    for (const topic of repo.topics) {
      topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1)
    }
  }
  const topTopics = [...topicCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map((entry) => entry[0])

  populateDatalist(elements.topicList, topTopics, 500)

  const hasRepos = state.repos.length > 0
  elements.exportButton.disabled = !hasRepos
  elements.exportDlcButton.disabled = !hasRepos
  elements.clearTableFiltersButton.disabled = !hasRepos
  elements.clearButton.disabled = !hasRepos
  elements.correlationButton.disabled = !hasRepos
  updateCorrelationRepoOptions()
}

function updateCorrelationRepoOptions() {
  const current = elements.correlationRepo.value
  const candidates = (state.filtered.length > 0 ? state.filtered : state.repos).slice(0, 250)
  elements.correlationRepo.replaceChildren(new Option("Top search result", ""))
  for (const repo of candidates) {
    elements.correlationRepo.append(new Option(repo.fullName, String(repo.id)))
  }
  if ([...elements.correlationRepo.options].some((option) => option.value === current)) {
    elements.correlationRepo.value = current
  }
}

function tokenizeQuery(query) {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
}

function scoreRepo(repo, tokens) {
  if (tokens.length === 0) {
    return 1
  }

  let score = 0
  for (const token of tokens) {
    if (!repo._search.includes(token)) {
      return -1
    }
    if (repo._nameSearch.includes(token)) {
      score += 8
    }
    if (repo._descriptionSearch.includes(token)) {
      score += 3
    }
    if (repo._topicsLower.some((topic) => topic.includes(token))) {
      score += 4
    }
    if (repo._languageLower === token) {
      score += 5
    }
  }

  return score
}

function queueSearch() {
  window.clearTimeout(state.searchTimer)
  state.searchTimer = window.setTimeout(applySearchNow, 140)
}

function applySearchNow() {
  const tokens = tokenizeQuery(elements.query.value)
  const language = elements.language.value
  const topic = elements.topic.value
  const topicLower = topic.toLowerCase()
  const includeArchived = elements.includeArchived.checked
  const forksOnly = elements.forksOnly.checked
  const hideForks = elements.hideForks.checked
  const matches = []

  for (const repo of state.repos) {
    if (!includeArchived && repo.archived) {
      continue
    }
    if (language && repo.language !== language) {
      continue
    }
    if (topic && !repo._topicsLower.includes(topicLower)) {
      continue
    }
    if (forksOnly && !repo.fork) {
      continue
    }
    if (hideForks && repo.fork) {
      continue
    }
    if (!matchesTableFilters(repo)) {
      continue
    }

    const score = scoreRepo(repo, tokens)
    if (score >= 0) {
      matches.push({ repo, score })
    }
  }

  matches.sort(compareSearchResults)
  state.filtered = matches.map((match) => match.repo)
  state.renderLimit = initialRenderLimit
  renderResults()
  updateCorrelationRepoOptions()
}

function compareSearchResults(a, b) {
  const direction = state.sortDirection === "asc" ? 1 : -1
  switch (elements.sort.value) {
    case "stars":
      return (a.repo.stars - b.repo.stars) * direction
    case "starrank":
      return (a.repo._starRankScore - b.repo._starRankScore) * direction || b.repo.stars - a.repo.stars
    case "language":
      return a.repo._languageLower.localeCompare(b.repo._languageLower) * direction || a.repo.fullName.localeCompare(b.repo.fullName)
    case "updated":
      return (a.repo._updatedTime - b.repo._updatedTime) * direction
    case "starred":
      return (a.repo._starredTime - b.repo._starredTime) * direction
    case "age":
      return ((a.repo._ageDays ?? Number.MAX_SAFE_INTEGER) - (b.repo._ageDays ?? Number.MAX_SAFE_INTEGER)) * direction
    case "name":
      return a.repo.fullName.localeCompare(b.repo.fullName) * direction
    default:
      return b.score - a.score || b.repo.stars - a.repo.stars
  }
}

function setSort(column) {
  if (elements.sort.value === column) {
    state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc"
  } else {
    elements.sort.value = column
    state.sortDirection = defaultSortDirection(column)
  }
  applySearchNow()
}

function defaultSortDirection(column) {
  if (column === "name" || column === "language" || column === "age") {
    return "asc"
  }
  return "desc"
}

function getSortLabel(column) {
  if (elements.sort.value !== column) {
    return ""
  }
  return state.sortDirection === "asc" ? " ↑" : " ↓"
}

function matchesTableFilters(repo) {
  return (
    matchesTextFilter(repo.fullName, state.tableFilters.name) &&
    matchesNumberFilter(repo.stars, state.tableFilters.stars) &&
    matchesNumberFilter(repo._starRankScore >= 0 ? repo._starRankScore : null, state.tableFilters.starrank) &&
    matchesTextFilter(repo.language || "Unknown", state.tableFilters.language) &&
    matchesDateFilter(repo.updatedAt, state.tableFilters.updated) &&
    matchesAgeFilter(repo, state.tableFilters.age)
  )
}

function matchesTextFilter(value, filter) {
  const query = filter.trim().toLowerCase()
  if (!query) {
    return true
  }
  return String(value || "").toLowerCase().includes(query)
}

function matchesDateFilter(value, filter) {
  const query = filter.trim().toLowerCase()
  if (!query) {
    return true
  }
  return [value || "", formatDate(value)].some((candidate) => candidate.toLowerCase().includes(query))
}

function matchesAgeFilter(repo, filter) {
  const query = filter.trim().toLowerCase()
  if (!query) {
    return true
  }
  if (repo._ageDays === null) {
    return false
  }
  if (matchesNumberFilter(repo._ageDays, query)) {
    return true
  }
  if (query.endsWith("y") || query.includes("year")) {
    return matchesNumberFilter(repo._ageYears, query.replace(/years?|y/g, "").trim())
  }
  return formatAge(repo).toLowerCase().includes(query)
}

function matchesNumberFilter(value, filter) {
  const query = filter.trim().replace(/,/g, "")
  if (!query) {
    return true
  }
  if (value === null || value === undefined || Number.isNaN(value)) {
    return false
  }
  const range = query.match(/^(-?\d+(?:\.\d+)?)\s*\.\.\s*(-?\d+(?:\.\d+)?)$/)
  if (range) {
    const min = Number(range[1])
    const max = Number(range[2])
    return value >= Math.min(min, max) && value <= Math.max(min, max)
  }
  const comparison = query.match(/^(>=|<=|>|<|=)?\s*(-?\d+(?:\.\d+)?)$/)
  if (!comparison) {
    return String(value).includes(query)
  }
  const operator = comparison[1] || "="
  const target = Number(comparison[2])
  if (operator === ">=") return value >= target
  if (operator === "<=") return value <= target
  if (operator === ">") return value > target
  if (operator === "<") return value < target
  return value === target
}

function formatDate(value) {
  if (!value) {
    return "Unknown"
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value))
}

function formatDateTime(value) {
  if (!value) {
    return "Unknown"
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}

function formatAge(repo) {
  if (repo._ageDays === null) {
    return "Refresh needed"
  }
  if (repo._ageDays < 90) {
    return `${repo._ageDays}d`
  }
  if (repo._ageDays < 730) {
    return `${Math.round(repo._ageDays / 30)}mo`
  }
  return `${repo._ageYears.toFixed(1)}y`
}

function renderResults() {
  elements.resultCount.textContent = `${state.filtered.length} result${state.filtered.length === 1 ? "" : "s"}`
  elements.results.className = "results"
  elements.results.replaceChildren()
  elements.showMoreButton.hidden = true

  if (state.repos.length === 0) {
    elements.results.classList.add("empty-state")
    elements.results.textContent = "Load stars to begin searching."
    return
  }

  if (state.filtered.length === 0) {
    elements.results.append(renderRepoTable([]))
    restoreTableFilterFocus()
    return
  }

  const table = renderRepoTable(state.filtered.slice(0, state.renderLimit))
  elements.results.append(table)
  restoreTableFilterFocus()
  elements.showMoreButton.hidden = state.filtered.length <= state.renderLimit
  elements.showMoreButton.textContent = `Show ${Math.min(renderBatchSize, state.filtered.length - state.renderLimit)} more`
}

function renderRepoTable(repos) {
  const shell = document.createElement("div")
  shell.className = "result-table-shell"
  const table = document.createElement("table")
  table.className = "result-table"
  table.append(renderTableHead(), renderTableBody(repos))
  shell.append(table)
  return shell
}

function renderTableHead() {
  const head = document.createElement("thead")
  const labels = document.createElement("tr")
  const filters = document.createElement("tr")
  filters.className = "table-filter-row"

  for (const column of [
    { key: "name", label: "Name", placeholder: "owner or repo" },
    { key: "stars", label: "Stars", placeholder: ">=1000" },
    { key: "starrank", label: "StarRank", placeholder: ">=75" },
    { key: "language", label: "Language", placeholder: "TypeScript" },
    { key: "updated", label: "Updated Date", placeholder: "2026" },
    { key: "age", label: "Age", placeholder: "<365 or >2y" },
  ]) {
    const header = document.createElement("th")
    const button = document.createElement("button")
    button.className = "table-sort-button"
    button.type = "button"
    button.textContent = `${column.label}${getSortLabel(column.key)}`
    button.addEventListener("click", () => setSort(column.key))
    header.append(button)
    labels.append(header)

    const filterCell = document.createElement("th")
    const input = document.createElement("input")
    input.className = "table-filter"
    input.dataset.column = column.key
    input.placeholder = column.placeholder
    input.value = state.tableFilters[column.key] || ""
    input.addEventListener("input", handleTableFilterInput)
    filterCell.append(input)
    filters.append(filterCell)
  }

  head.append(labels, filters)
  return head
}

function renderTableBody(repos) {
  const body = document.createElement("tbody")
  if (repos.length === 0) {
    const row = document.createElement("tr")
    const cell = document.createElement("td")
    cell.className = "empty-table-cell"
    cell.colSpan = 6
    cell.textContent = "No starred repositories match the current filters."
    row.append(cell)
    body.append(row)
    return body
  }
  for (const repo of repos) {
    body.append(renderRepoRow(repo))
  }
  return body
}

function renderRepoRow(repo) {
  const row = document.createElement("tr")
  row.append(
    renderNameCell(repo),
    renderTextCell(repo.stars.toLocaleString(), "numeric"),
    renderStarRankCell(repo),
    renderTextCell(repo.language || "Unknown"),
    renderTextCell(formatDate(repo.updatedAt)),
    renderTextCell(formatAge(repo), "numeric"),
  )
  return row
}

function renderNameCell(repo) {
  const cell = document.createElement("td")
  const link = document.createElement("a")
  link.className = "repo-table-name"
  link.href = repo.htmlUrl
  link.target = "_blank"
  link.rel = "noreferrer"
  link.textContent = repo.fullName
  const description = document.createElement("div")
  description.className = "repo-table-description"
  description.textContent = repo.description || "No description provided."
  cell.append(link, description)
  return cell
}

function renderTextCell(value, className = "") {
  const cell = document.createElement("td")
  if (className) {
    cell.className = className
  }
  cell.textContent = value
  return cell
}

function renderStarRankCell(repo) {
  const cell = document.createElement("td")
  cell.className = "numeric repo-table-starrank"
  if (repo.starRank) {
    cell.textContent = repo.starRank.score.toLocaleString()
    cell.title = repo.starRank.rankLabel
  } else {
    cell.textContent = "Refresh needed"
    cell.title = "This cached or imported row is missing createdAt. Reload stars from GitHub or import JSON with createdAt to calculate StarRank."
  }
  return cell
}

function handleTableFilterInput(event) {
  const column = event.currentTarget.dataset.column
  state.activeTableFilterColumn = column
  state.tableFilters[column] = event.currentTarget.value
  queueSearch()
}

function clearTableFilters() {
  for (const key of Object.keys(state.tableFilters)) {
    state.tableFilters[key] = ""
  }
  state.activeTableFilterColumn = null
  applySearchNow()
}

function restoreTableFilterFocus() {
  if (!state.activeTableFilterColumn) {
    return
  }
  const input = elements.results.querySelector(`.table-filter[data-column="${state.activeTableFilterColumn}"]`)
  if (!input) {
    return
  }
  input.focus()
  input.setSelectionRange(input.value.length, input.value.length)
}

function renderRepoCard(repo) {
  const node = elements.template.content.firstElementChild.cloneNode(true)
  const link = node.querySelector(".repo-name")
  link.textContent = repo.fullName
  link.href = repo.htmlUrl
  node.querySelector(".repo-description").textContent = repo.description || "No description provided."
  node.querySelector(".repo-language").textContent = repo.language || "Unknown"
  const starRank = node.querySelector(".repo-starrank")
  starRank.textContent = repo.starRank ? `${repo.starRank.score.toLocaleString()} · ${repo.starRank.rankLabel}` : "Refresh needed"
  if (repo.starRank) {
    const components = repo.starRank.components
    starRank.title = [
      `Stars/year: ${components.starsPerYear.toFixed(2)}`,
      `Forks/year: ${components.forksPerYear.toFixed(2)}`,
      `Fork surprise: ${components.forkSurprise.toFixed(2)}x`,
      `Expected forks: ${components.expectedForks.toFixed(2)}`,
      `Metadata bonus: ${components.metadataBonus}`,
    ].join("\n")
  } else {
    starRank.title = "This cached or imported row is missing createdAt. Reload stars from GitHub or import JSON with createdAt to calculate StarRank."
  }
  node.querySelector(".repo-stars").textContent = repo.stars.toLocaleString()
  node.querySelector(".repo-updated").textContent = formatDate(repo.updatedAt)

  const topics = node.querySelector(".topics")
  for (const topic of repo.topics.slice(0, 8)) {
    const tag = document.createElement("span")
    tag.className = "topic"
    tag.textContent = topic
    topics.append(tag)
  }

  return node
}

function setLoading(loading) {
  state.loading = loading
  elements.loadButton.disabled = loading
  elements.sampleButton.disabled = loading
  elements.loadButton.textContent = loading ? "Loading..." : "Load starred repos"
}

async function handleLoad(event) {
  event.preventDefault()
  setLoading(true)
  updateStatus("Loading")

  try {
    const source = elements.username.value.trim()
    localStorage.setItem("github-star-search:username", source)
    const repos = await fetchAllStars(source, elements.token.value.trim())
    await saveToCache(repos, source)
    setRepos(repos, state.cacheMeta)
    updateStatus(`Loaded ${repos.length}`)
    updateProgress(`Loaded and cached ${repos.length} repositories in IndexedDB. Search is now local in this browser.`)
  } catch (error) {
    updateStatus("Error")
    updateProgress(error instanceof Error ? error.message : String(error))
  } finally {
    setLoading(false)
  }
}

async function handleSample() {
  await saveToCache(sampleRepos, "sample")
  setRepos(sampleRepos, state.cacheMeta)
  updateStatus(`Loaded ${sampleRepos.length}`)
  updateProgress("Loaded sample repositories so the search UI can be tested without a GitHub API call.")
}

function stripPreparedFields(repo) {
  const {
    _search,
    _nameSearch,
    _descriptionSearch,
    _topicsLower,
    _languageLower,
    _updatedTime,
    _starredTime,
    _starRankScore,
    starRank,
    ...rawRepo
  } = repo
  return rawRepo
}

function handleExport() {
  const rawRepos = state.repos.map(stripPreparedFields)
  const blob = new Blob([`${JSON.stringify(rawRepos, null, 2)}\n`], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = "github-star-search-export.json"
  anchor.click()
  URL.revokeObjectURL(url)
}

function handleExportDlc() {
  const urls = state.repos.map((repo) => `https://raw.githubusercontent.com/${repo.owner}/${repo.name}/${repo.defaultBranch || "main"}/README.md`)
  const blob = new Blob([urls.join("\n") + "\n"], { type: "text/plain" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = "readmes.txt"
  anchor.click()
  URL.revokeObjectURL(url)
}

async function handleImport(event) {
  const [file] = event.target.files
  if (!file) {
    return
  }

  try {
    const repos = JSON.parse(await file.text())
    if (!Array.isArray(repos)) {
      throw new Error("Imported file must contain an array of repositories.")
    }
    await saveToCache(repos, "import")
    setRepos(repos, state.cacheMeta)
    updateStatus(`Imported ${repos.length}`)
    updateProgress(`Imported and cached ${repos.length} repositories from ${file.name}.`)
  } catch (error) {
    updateStatus("Import error")
    updateProgress(error instanceof Error ? error.message : String(error))
  } finally {
    event.target.value = ""
  }
}

async function clearCache() {
  try {
    await clearIndexedCache()
  } catch (error) {
    console.warn("IndexedDB cache clear failed", error)
  }
  localStorage.removeItem(cacheKey)
  for (const key of previousCacheKeys) {
    localStorage.removeItem(key)
  }
  state.repos = []
  state.filtered = []
  state.cacheMeta = null
  state.renderLimit = initialRenderLimit
  state.insightsBuilt = false
  elements.insightsStatus.textContent = "Off"
  elements.correlations.className = "insights-grid empty-state"
  elements.correlations.textContent = "Load stars to find correlations."
  updateControls()
  updateCacheSummary()
  renderResults()
  updateStatus("Not loaded")
  updateProgress("Cache cleared. Enter a username to load starred repositories.")
}

function buildCorrelations() {
  if (state.repos.length === 0) {
    return
  }

  const selectedRepo = getSelectedCorrelationRepo()
  const topicCounts = new Map()
  const topicPairs = new Map()
  const languageTopics = new Map()
  const ownerTopics = new Map()

  for (const repo of state.repos) {
    const uniqueTopics = [...new Set(repo.topics)].slice(0, 30)
    for (const topic of uniqueTopics) {
      incrementMap(topicCounts, topic)
      if (repo.language) {
        incrementMap(languageTopics, `${repo.language}\u0000${topic}`)
      }
      incrementMap(ownerTopics, `${repo.owner}\u0000${topic}`)
    }

    for (let first = 0; first < uniqueTopics.length; first += 1) {
      for (let second = first + 1; second < uniqueTopics.length; second += 1) {
        const pair = [uniqueTopics[first], uniqueTopics[second]].sort((a, b) => a.localeCompare(b))
        incrementMap(topicPairs, `${pair[0]}\u0000${pair[1]}`)
      }
    }
  }

  renderCorrelations({
    selectedRepo,
    similarRepos: selectedRepo ? findSimilarRepos(selectedRepo) : [],
    topicPairs: topEntries(topicPairs, 10),
    languageTopics: topEntries(languageTopics, 10),
    ownerTopics: topEntries(ownerTopics, 10).filter((entry) => entry.count > 1),
    topicCounts: topEntries(topicCounts, 12),
  })
}

function getSelectedCorrelationRepo() {
  const selectedId = Number(elements.correlationRepo.value)
  if (selectedId) {
    return state.repos.find((repo) => repo.id === selectedId) || null
  }
  return state.filtered[0] || state.repos[0] || null
}

function findSimilarRepos(baseRepo) {
  const baseTopics = new Set(baseRepo._topicsLower)
  return state.repos
    .filter((repo) => repo.id !== baseRepo.id)
    .map((repo) => {
      const sharedTopics = repo.topics.filter((topic) => baseTopics.has(topic.toLowerCase()))
      const sameLanguage = baseRepo.language && repo.language === baseRepo.language
      const sameOwner = baseRepo.owner && repo.owner === baseRepo.owner
      const score = sharedTopics.length * 8 + (sameLanguage ? 3 : 0) + (sameOwner ? 2 : 0)
      return { repo, sharedTopics, sameLanguage, sameOwner, score }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.repo.stars - a.repo.stars)
    .slice(0, 10)
}

function incrementMap(map, key) {
  map.set(key, (map.get(key) || 0) + 1)
}

function topEntries(map, limit) {
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, limit)
}

function renderCorrelations(insights) {
  elements.correlations.className = "insights-grid"
  elements.correlations.replaceChildren(
    renderSimilarReposCard(insights.selectedRepo, insights.similarRepos),
    renderTopicPairsCard(insights.topicPairs),
    renderLanguageTopicsCard(insights.languageTopics),
    renderOwnerTopicsCard(insights.ownerTopics),
    renderPopularTopicsCard(insights.topicCounts),
  )
  elements.insightsStatus.textContent = `${state.repos.length.toLocaleString()} repos`
  state.insightsBuilt = true
}

function renderSimilarReposCard(selectedRepo, similarRepos) {
  const card = createInsightCard("Similar Repositories")
  if (!selectedRepo) {
    card.append(createInsightEmpty("Load stars to compare repositories."))
    return card
  }

  const note = document.createElement("p")
  note.className = "insight-meta"
  note.textContent = `Compared against ${selectedRepo.fullName}.`
  card.append(note)

  const list = createInsightList()
  for (const item of similarRepos) {
    const reason = [
      item.sharedTopics.length ? item.sharedTopics.slice(0, 5).join(", ") : "",
      item.sameLanguage ? item.repo.language : "",
      item.sameOwner ? "same owner" : "",
    ].filter(Boolean).join(" · ")
    list.append(createRepoInsightItem(item.repo, reason || "metadata overlap"))
  }
  card.append(list.childElementCount ? list : createInsightEmpty("No similar repositories found."))
  return card
}

function renderTopicPairsCard(entries) {
  const card = createInsightCard("Topic Pairings")
  const list = createInsightList()
  for (const entry of entries) {
    const [first, second] = entry.key.split("\u0000")
    list.append(createSearchInsightItem(`${first} + ${second}`, `${entry.count} starred repos share both topics`, `${first} ${second}`, ""))
  }
  card.append(list.childElementCount ? list : createInsightEmpty("No repeated topic pairs found."))
  return card
}

function renderLanguageTopicsCard(entries) {
  const card = createInsightCard("Language Clusters")
  const list = createInsightList()
  for (const entry of entries) {
    const [language, topic] = entry.key.split("\u0000")
    list.append(createSearchInsightItem(`${language} + ${topic}`, `${entry.count} starred repos`, topic, topic))
  }
  card.append(list.childElementCount ? list : createInsightEmpty("No language/topic clusters found."))
  return card
}

function renderOwnerTopicsCard(entries) {
  const card = createInsightCard("Owner Concentrations")
  const list = createInsightList()
  for (const entry of entries) {
    const [owner, topic] = entry.key.split("\u0000")
    list.append(createSearchInsightItem(`${owner} + ${topic}`, `${entry.count} starred repos from this owner/topic`, `${owner} ${topic}`, topic))
  }
  card.append(list.childElementCount ? list : createInsightEmpty("No repeated owner/topic concentrations found."))
  return card
}

function renderPopularTopicsCard(entries) {
  const card = createInsightCard("Search Suggestions")
  const list = createInsightList()
  for (const entry of entries) {
    list.append(createSearchInsightItem(entry.key, `${entry.count} starred repos`, entry.key, entry.key))
  }
  card.append(list.childElementCount ? list : createInsightEmpty("No topics found."))
  return card
}

function createInsightCard(title) {
  const card = document.createElement("article")
  card.className = "insight-card"
  const heading = document.createElement("h3")
  heading.textContent = title
  card.append(heading)
  return card
}

function createInsightList() {
  const list = document.createElement("ul")
  list.className = "insight-list"
  return list
}

function createInsightEmpty(message) {
  const empty = document.createElement("p")
  empty.className = "insight-meta"
  empty.textContent = message
  return empty
}

function createRepoInsightItem(repo, reason) {
  const item = document.createElement("li")
  item.className = "insight-item"
  const link = document.createElement("a")
  link.className = "insight-title"
  link.href = repo.htmlUrl
  link.target = "_blank"
  link.rel = "noreferrer"
  link.textContent = repo.fullName
  const meta = document.createElement("div")
  meta.className = "insight-meta"
  meta.textContent = reason
  item.append(link, meta)
  return item
}

function createSearchInsightItem(title, metaText, query, topic) {
  const item = document.createElement("li")
  item.className = "insight-item"
  const titleElement = document.createElement("div")
  titleElement.className = "insight-title"
  titleElement.textContent = title
  const meta = document.createElement("div")
  meta.className = "insight-meta"
  meta.textContent = metaText
  const actions = document.createElement("div")
  actions.className = "insight-actions"
  const button = document.createElement("button")
  button.className = "secondary-button insight-action"
  button.type = "button"
  button.textContent = "Search"
  button.addEventListener("click", () => applyInsightSearch(query, topic))
  actions.append(button)
  item.append(titleElement, meta, actions)
  return item
}

function applyInsightSearch(query, topic) {
  elements.query.value = query
  elements.topic.value = topic || ""
  applySearchNow()
}

function showMoreResults() {
  state.renderLimit += renderBatchSize
  renderResults()
}

elements.form.addEventListener("submit", handleLoad)
elements.sampleButton.addEventListener("click", handleSample)
elements.exportButton.addEventListener("click", handleExport)
elements.exportDlcButton.addEventListener("click", handleExportDlc)
elements.clearTableFiltersButton.addEventListener("click", clearTableFilters)
elements.importInput.addEventListener("change", handleImport)
elements.clearButton.addEventListener("click", clearCache)
elements.correlationButton.addEventListener("click", buildCorrelations)
elements.correlationRepo.addEventListener("change", () => {
  if (state.insightsBuilt) {
    buildCorrelations()
  }
})
elements.showMoreButton.addEventListener("click", showMoreResults)
elements.sort.addEventListener("change", () => {
  state.sortDirection = defaultSortDirection(elements.sort.value)
})

for (const input of [
  elements.query,
  elements.language,
  elements.topic,
  elements.sort,
  elements.includeArchived,
  elements.forksOnly,
  elements.hideForks,
]) {
  input.addEventListener("input", queueSearch)
  input.addEventListener("change", queueSearch)
}

loadFromCache()
