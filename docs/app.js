const cacheKey = "github-star-search:repos:v2"
const legacyCacheKey = "github-star-search:repos:v1"
const databaseName = "github-star-search"
const repoStoreName = "repo-cache"
const initialRenderLimit = 100
const renderBatchSize = 100
const maxTopicCloudItems = 500
const topicCloudWidth = 1440
const topicCloudHeight = 960
const topicCloudPadding = 14

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

const state = {
  repos: [],
  filtered: [],
  loading: false,
  renderLimit: initialRenderLimit,
  cacheMeta: null,
  searchTimer: null,
  topicCloudBuilt: false,
  topicCounts: [],
  topicWordHitboxes: [],
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
  topic: document.querySelector("#topic"),
  sort: document.querySelector("#sort"),
  includeArchived: document.querySelector("#include-archived"),
  forksOnly: document.querySelector("#forks-only"),
  hideForks: document.querySelector("#hide-forks"),
  exportButton: document.querySelector("#export-button"),
  importInput: document.querySelector("#import-input"),
  clearButton: document.querySelector("#clear-button"),
  topicCloudButton: document.querySelector("#topic-cloud-button"),
  topicCloud: document.querySelector("#topic-cloud"),
  topicCloudCount: document.querySelector("#topic-cloud-count"),
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
  state.topicCloudBuilt = false
  state.topicCounts = []
  state.topicWordHitboxes = []
  elements.topicCloud.hidden = true
  elements.topicCloudCount.textContent = "Off"
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

function replaceOptions(select, values, firstLabel) {
  const current = select.value
  select.replaceChildren(new Option(firstLabel, ""))
  for (const value of values) {
    select.append(new Option(value, value))
  }
  if (values.includes(current)) {
    select.value = current
  }
}

function updateControls() {
  replaceOptions(
    elements.language,
    uniqueSorted(state.repos.map((repo) => repo.language)),
    "Any language",
  )
  replaceOptions(
    elements.topic,
    uniqueSorted(state.repos.flatMap((repo) => repo.topics)),
    "Any topic",
  )

  const hasRepos = state.repos.length > 0
  elements.exportButton.disabled = !hasRepos
  elements.clearButton.disabled = !hasRepos
  elements.topicCloudButton.disabled = !hasRepos
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
  state.topicCloudBuilt = false
  state.topicCounts = []
  state.topicWordHitboxes = []
  elements.topicCloud.hidden = true
  elements.topicCloudCount.textContent = "Off"
  updateControls()
  updateCacheSummary()
  renderResults()
  updateStatus("Not loaded")
  updateProgress("Cache cleared. Enter a username to load starred repositories.")
}

function buildTopicCounts() {
  const counts = new Map()
  for (const repo of state.repos) {
    for (const topic of repo.topics) {
      counts.set(topic, (counts.get(topic) || 0) + 1)
    }
  }

  return [...counts.entries()]
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic))
}

function renderTopicCloud() {
  if (!state.topicCloudBuilt) {
    state.topicCounts = buildTopicCounts()
    state.topicCloudBuilt = true
  }

  drawTopicCloud()
  elements.topicCloud.hidden = false
  elements.topicCloudCount.textContent = `${state.topicWordHitboxes.length.toLocaleString()} of ${state.topicCounts.length.toLocaleString()} topics`
  elements.topicCloudButton.textContent = "Rebuild topic cloud"
}

function drawTopicCloud() {
  const canvas = elements.topicCloud
  const context = canvas.getContext("2d")
  const pixelRatio = window.devicePixelRatio || 1
  canvas.width = topicCloudWidth * pixelRatio
  canvas.height = topicCloudHeight * pixelRatio
  canvas.style.aspectRatio = `${topicCloudWidth} / ${topicCloudHeight}`
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  context.clearRect(0, 0, topicCloudWidth, topicCloudHeight)
  context.fillStyle = "#ffffff"
  context.fillRect(0, 0, topicCloudWidth, topicCloudHeight)

  const mask = buildTopicCloudMask(topicCloudWidth, topicCloudHeight)
  const placed = []
  const words = state.topicCounts.slice(0, maxTopicCloudItems)
  const maxCount = words[0]?.count || 1
  const minCount = words.at(-1)?.count || 1

  state.topicWordHitboxes = []
  context.textBaseline = "middle"
  context.textAlign = "center"

  for (const item of words) {
    const fontSize = scaleTopicFont(item.count, minCount, maxCount)
    const angle = item.topic.length > 16 && placed.length % 5 === 0 ? -Math.PI / 2 : 0
    const fontWeight = item.count > maxCount * 0.35 ? 820 : 720
    context.font = `${fontWeight} ${fontSize}px Inter, Segoe UI, sans-serif`
    const metrics = context.measureText(item.topic)
    const width = Math.ceil(metrics.width) + 4
    const height = Math.ceil(fontSize * 1.05)
    const box = findWordPlacement(mask, placed, width, height, angle)

    if (!box) {
      continue
    }

    const colorWeight = item.count / maxCount
    context.save()
    context.translate(box.cx, box.cy)
    context.rotate(angle)
    context.fillStyle = colorWeight > 0.45 ? "#115e59" : colorWeight > 0.18 ? "#0f766e" : "#35566a"
    context.fillText(item.topic, 0, 0)
    context.restore()

    const hitbox = {
      topic: item.topic,
      count: item.count,
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
    }
    placed.push(hitbox)
    state.topicWordHitboxes.push(hitbox)
  }
}

function scaleTopicFont(count, minCount, maxCount) {
  if (maxCount === minCount) {
    return 18
  }

  const normalized = (Math.log(count + 1) - Math.log(minCount + 1)) / (Math.log(maxCount + 1) - Math.log(minCount + 1))
  return Math.round(8 + normalized * 28)
}

function buildTopicCloudMask(width, height) {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d", { willReadFrequently: true })
  context.fillStyle = "#000000"

  context.beginPath()
  context.moveTo(width * 0.18, height * 0.03)
  context.bezierCurveTo(width * 0.25, height * 0.02, width * 0.33, height * 0.10, width * 0.40, height * 0.13)
  context.bezierCurveTo(width * 0.50, height * 0.10, width * 0.61, height * 0.10, width * 0.70, height * 0.13)
  context.bezierCurveTo(width * 0.77, height * 0.08, width * 0.86, height * 0.01, width * 0.94, height * 0.02)
  context.bezierCurveTo(width * 0.98, height * 0.13, width * 0.98, height * 0.25, width * 0.94, height * 0.36)
  context.bezierCurveTo(width * 1.01, height * 0.48, width * 0.98, height * 0.69, width * 0.82, height * 0.80)
  context.bezierCurveTo(width * 0.68, height * 0.90, width * 0.35, height * 0.91, width * 0.19, height * 0.78)
  context.bezierCurveTo(width * 0.03, height * 0.65, width * 0.03, height * 0.42, width * 0.16, height * 0.31)
  context.bezierCurveTo(width * 0.14, height * 0.20, width * 0.14, height * 0.10, width * 0.18, height * 0.03)
  context.closePath()
  context.fill()

  context.beginPath()
  context.ellipse(width * 0.54, height * 0.83, width * 0.18, height * 0.17, 0, 0, Math.PI * 2)
  context.fill()

  context.beginPath()
  context.moveTo(width * 0.34, height * 0.80)
  context.bezierCurveTo(width * 0.26, height * 0.82, width * 0.24, height * 0.70, width * 0.16, height * 0.69)
  context.bezierCurveTo(width * 0.11, height * 0.69, width * 0.08, height * 0.71, width * 0.06, height * 0.73)
  context.bezierCurveTo(width * 0.14, height * 0.78, width * 0.17, height * 0.98, width * 0.35, height * 0.93)
  context.closePath()
  context.fill()

  context.fillRect(width * 0.41, height * 0.77, width * 0.09, height * 0.20)
  context.fillRect(width * 0.52, height * 0.76, width * 0.08, height * 0.23)
  context.fillRect(width * 0.62, height * 0.77, width * 0.08, height * 0.20)

  return context.getImageData(0, 0, width, height).data
}

function findWordPlacement(mask, placed, width, height, angle) {
  const centerX = topicCloudWidth * 0.52
  const centerY = topicCloudHeight * 0.46
  const rotatedWidth = angle === 0 ? width : height
  const rotatedHeight = angle === 0 ? height : width
  const maxRadius = Math.max(topicCloudWidth, topicCloudHeight) * 0.7

  for (let step = 0; step < 5200; step++) {
    const theta = step * 0.47
    const radius = 2.7 * Math.sqrt(step)
    if (radius > maxRadius) {
      break
    }

    const cx = centerX + Math.cos(theta) * radius
    const cy = centerY + Math.sin(theta) * radius * 0.78
    const box = {
      cx,
      cy,
      x: Math.round(cx - rotatedWidth / 2),
      y: Math.round(cy - rotatedHeight / 2),
      width: rotatedWidth,
      height: rotatedHeight,
    }

    if (isInsideTopicMask(mask, box) && !intersectsPlacedWords(box, placed)) {
      return box
    }
  }

  return null
}

function isInsideTopicMask(mask, box) {
  if (
    box.x < topicCloudPadding ||
    box.y < topicCloudPadding ||
    box.x + box.width > topicCloudWidth - topicCloudPadding ||
    box.y + box.height > topicCloudHeight - topicCloudPadding
  ) {
    return false
  }

  const samplesX = Math.max(2, Math.ceil(box.width / 34))
  const samplesY = Math.max(2, Math.ceil(box.height / 28))
  let inside = 0
  let total = 0
  for (let yIndex = 0; yIndex <= samplesY; yIndex++) {
    for (let xIndex = 0; xIndex <= samplesX; xIndex++) {
      const x = Math.round(box.x + (box.width * xIndex) / samplesX)
      const y = Math.round(box.y + (box.height * yIndex) / samplesY)
      const alphaIndex = (y * topicCloudWidth + x) * 4 + 3
      total += 1
      if (mask[alphaIndex] > 0) {
        inside += 1
      }
    }
  }

  return inside / total >= 0.82
}

function intersectsPlacedWords(box, placed) {
  const gap = 1
  return placed.some(
    (item) =>
      box.x < item.x + item.width + gap &&
      box.x + box.width + gap > item.x &&
      box.y < item.y + item.height + gap &&
      box.y + box.height + gap > item.y,
  )
}

function handleTopicCloudClick(event) {
  if (elements.topicCloud.hidden) {
    return
  }

  const bounds = elements.topicCloud.getBoundingClientRect()
  const x = ((event.clientX - bounds.left) / bounds.width) * topicCloudWidth
  const y = ((event.clientY - bounds.top) / bounds.height) * topicCloudHeight
  const hit = state.topicWordHitboxes.find(
    (item) => x >= item.x && x <= item.x + item.width && y >= item.y && y <= item.y + item.height,
  )

  if (!hit) {
    return
  }

  elements.query.value = hit.topic
  if ([...elements.topic.options].some((option) => option.value === hit.topic)) {
    elements.topic.value = hit.topic
  }
  applySearchNow()
}

function showMoreResults() {
  state.renderLimit += renderBatchSize
  renderResults()
}

elements.form.addEventListener("submit", handleLoad)
elements.sampleButton.addEventListener("click", handleSample)
elements.exportButton.addEventListener("click", handleExport)
elements.importInput.addEventListener("change", handleImport)
elements.clearButton.addEventListener("click", clearCache)
elements.topicCloudButton.addEventListener("click", renderTopicCloud)
elements.topicCloud.addEventListener("click", handleTopicCloudClick)
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
