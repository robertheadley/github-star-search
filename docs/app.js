const cacheKey = "github-star-search:repos:v2"
const legacyCacheKey = "github-star-search:repos:v1"
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
    pushedAt: "2026-05-20T12:30:00Z",
    updatedAt: "2026-05-22T09:15:00Z",
    starredAt: "2026-05-24T15:00:00Z",
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
    pushedAt: "2026-05-21T17:20:00Z",
    updatedAt: "2026-05-24T08:05:00Z",
    starredAt: "2026-05-23T18:30:00Z",
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
    pushedAt: "2026-05-18T12:00:00Z",
    updatedAt: "2026-05-18T12:00:00Z",
    starredAt: "2026-05-22T14:00:00Z",
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
    pushedAt: "2026-05-01T00:00:00Z",
    updatedAt: "2026-05-20T00:00:00Z",
    starredAt: "2026-05-21T00:00:00Z",
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
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(repoStoreName, "readonly")
    const request = transaction.objectStore(repoStoreName).get(cacheKey)
    request.onsuccess = () => resolve(request.result ?? null)
    request.onerror = () => reject(request.error)
  }).finally(() => db.close())
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
    pushedAt: repo.pushed_at,
    updatedAt: repo.updated_at,
    starredAt: repo.starred_at ?? null,
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

  return {
    ...repo,
    topics,
    language,
    _search: [fullName, owner, name, description, language, topicText].join(" ").toLowerCase(),
    _nameSearch: fullName.toLowerCase(),
    _descriptionSearch: description.toLowerCase(),
    _topicsLower: topics.map((topic) => topic.toLowerCase()),
    _languageLower: (language || "").toLowerCase(),
    _updatedTime: Date.parse(repo.updatedAt || "") || 0,
    _starredTime: Date.parse(repo.starredAt || "") || 0,
  }
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
      const savedUser = localStorage.getItem("github-star-search:username") || (cached.meta?.source !== "sample" && cached.meta?.source !== "legacy" && cached.meta?.source !== "import" ? cached.meta?.source : "")
      if (savedUser) elements.username.value = savedUser
      updateStatus(`Cached ${state.repos.length}`)
      updateProgress(`Loaded ${state.repos.length} repositories from IndexedDB cache. Search is local now.`)
      return
    }
  } catch (error) {
    console.warn("IndexedDB cache unavailable", error)
  }

  try {
    const legacy = JSON.parse(localStorage.getItem(legacyCacheKey) || "null")
    if (Array.isArray(legacy?.repos)) {
      await saveToCache(legacy.repos, legacy.source || "legacy")
      localStorage.removeItem(legacyCacheKey)
      setRepos(legacy.repos, readCacheMeta())
      const savedUser = localStorage.getItem("github-star-search:username") || (legacy.source !== "sample" && legacy.source !== "legacy" && legacy.source !== "import" ? legacy.source : "")
      if (savedUser) elements.username.value = savedUser
      updateStatus(`Cached ${state.repos.length}`)
      updateProgress(`Migrated ${state.repos.length} repositories from the older browser cache.`)
    }
  } catch {
    localStorage.removeItem(legacyCacheKey)
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
  switch (elements.sort.value) {
    case "stars":
      return b.repo.stars - a.repo.stars
    case "updated":
      return b.repo._updatedTime - a.repo._updatedTime
    case "starred":
      return b.repo._starredTime - a.repo._starredTime
    case "name":
      return a.repo.fullName.localeCompare(b.repo.fullName)
    default:
      return b.score - a.score || b.repo.stars - a.repo.stars
  }
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
    elements.results.classList.add("empty-state")
    elements.results.textContent = "No starred repositories match the current search."
    return
  }

  const fragment = document.createDocumentFragment()
  for (const repo of state.filtered.slice(0, state.renderLimit)) {
    fragment.append(renderRepoCard(repo))
  }

  elements.results.append(fragment)
  elements.showMoreButton.hidden = state.filtered.length <= state.renderLimit
  elements.showMoreButton.textContent = `Show ${Math.min(renderBatchSize, state.filtered.length - state.renderLimit)} more`
}

function renderRepoCard(repo) {
  const node = elements.template.content.firstElementChild.cloneNode(true)
  const link = node.querySelector(".repo-name")
  link.textContent = repo.fullName
  link.href = repo.htmlUrl
  node.querySelector(".repo-description").textContent = repo.description || "No description provided."
  node.querySelector(".repo-language").textContent = repo.language || "Unknown"
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
  localStorage.removeItem(legacyCacheKey)
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
elements.importInput.addEventListener("change", handleImport)
elements.clearButton.addEventListener("click", clearCache)
elements.correlationButton.addEventListener("click", buildCorrelations)
elements.correlationRepo.addEventListener("change", () => {
  if (state.insightsBuilt) {
    buildCorrelations()
  }
})
elements.showMoreButton.addEventListener("click", showMoreResults)

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
