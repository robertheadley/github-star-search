const cacheKey = "github-star-search:repos:v1"

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
}

const elements = {
  form: document.querySelector("#load-form"),
  username: document.querySelector("#username"),
  token: document.querySelector("#token"),
  loadButton: document.querySelector("#load-button"),
  sampleButton: document.querySelector("#sample-button"),
  progress: document.querySelector("#progress"),
  status: document.querySelector("#connection-status"),
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
  resultCount: document.querySelector("#result-count"),
  results: document.querySelector("#results"),
  template: document.querySelector("#repo-template"),
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

function loadFromCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey) || "null")
    if (Array.isArray(cached?.repos)) {
      state.repos = cached.repos
      updateControls()
      applySearch()
      updateStatus(`Cached ${state.repos.length}`)
      updateProgress(`Loaded ${state.repos.length} repositories from this browser cache.`)
    }
  } catch {
    localStorage.removeItem(cacheKey)
  }
}

function saveToCache(repos, source) {
  localStorage.setItem(
    cacheKey,
    JSON.stringify({
      source,
      savedAt: new Date().toISOString(),
      repos,
    }),
  )
}

function updateProgress(message) {
  elements.progress.textContent = message
}

function updateStatus(message) {
  elements.status.textContent = message
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
}

function tokenizeQuery(query) {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
}

function searchableText(repo) {
  return [
    repo.fullName,
    repo.owner,
    repo.name,
    repo.description,
    repo.language,
    repo.topics.join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

function scoreRepo(repo, tokens) {
  if (tokens.length === 0) {
    return 1
  }

  const name = repo.fullName.toLowerCase()
  const text = searchableText(repo)
  let score = 0

  for (const token of tokens) {
    if (!text.includes(token)) {
      return -1
    }
    if (name.includes(token)) {
      score += 8
    }
    if ((repo.description ?? "").toLowerCase().includes(token)) {
      score += 3
    }
    if (repo.topics.some((topic) => topic.toLowerCase().includes(token))) {
      score += 4
    }
    if ((repo.language ?? "").toLowerCase() === token) {
      score += 5
    }
  }

  return score
}

function dateValue(value) {
  return value ? new Date(value).getTime() || 0 : 0
}

function applySearch() {
  const tokens = tokenizeQuery(elements.query.value)
  const language = elements.language.value
  const topic = elements.topic.value
  const includeArchived = elements.includeArchived.checked
  const forksOnly = elements.forksOnly.checked
  const hideForks = elements.hideForks.checked

  state.filtered = state.repos
    .map((repo) => ({ repo, score: scoreRepo(repo, tokens) }))
    .filter(({ repo, score }) => {
      if (score < 0) {
        return false
      }
      if (!includeArchived && repo.archived) {
        return false
      }
      if (language && repo.language !== language) {
        return false
      }
      if (topic && !repo.topics.includes(topic)) {
        return false
      }
      if (forksOnly && !repo.fork) {
        return false
      }
      if (hideForks && repo.fork) {
        return false
      }
      return true
    })
    .sort((a, b) => {
      switch (elements.sort.value) {
        case "stars":
          return b.repo.stars - a.repo.stars
        case "updated":
          return dateValue(b.repo.updatedAt) - dateValue(a.repo.updatedAt)
        case "starred":
          return dateValue(b.repo.starredAt) - dateValue(a.repo.starredAt)
        case "name":
          return a.repo.fullName.localeCompare(b.repo.fullName)
        default:
          return b.score - a.score || b.repo.stars - a.repo.stars
      }
    })
    .map(({ repo }) => repo)

  renderResults()
}

function formatDate(value) {
  if (!value) {
    return "Unknown"
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value))
}

function renderResults() {
  elements.resultCount.textContent = `${state.filtered.length} result${state.filtered.length === 1 ? "" : "s"}`
  elements.results.className = "results"
  elements.results.replaceChildren()

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

  for (const repo of state.filtered.slice(0, 250)) {
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

    elements.results.append(node)
  }
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
    const repos = await fetchAllStars(elements.username.value, elements.token.value.trim())
    state.repos = repos
    saveToCache(repos, elements.username.value.trim())
    updateControls()
    applySearch()
    updateStatus(`Loaded ${repos.length}`)
    updateProgress(`Loaded ${repos.length} repositories. Search is now local in this browser.`)
  } catch (error) {
    updateStatus("Error")
    updateProgress(error instanceof Error ? error.message : String(error))
  } finally {
    setLoading(false)
  }
}

function handleSample() {
  state.repos = sampleRepos
  saveToCache(sampleRepos, "sample")
  updateControls()
  applySearch()
  updateStatus(`Loaded ${sampleRepos.length}`)
  updateProgress("Loaded sample repositories so the search UI can be tested without a GitHub API call.")
}

function handleExport() {
  const blob = new Blob([`${JSON.stringify(state.repos, null, 2)}\n`], { type: "application/json" })
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
    state.repos = repos
    saveToCache(repos, "import")
    updateControls()
    applySearch()
    updateStatus(`Imported ${repos.length}`)
    updateProgress(`Imported ${repos.length} repositories from ${file.name}.`)
  } catch (error) {
    updateStatus("Import error")
    updateProgress(error instanceof Error ? error.message : String(error))
  } finally {
    event.target.value = ""
  }
}

function clearCache() {
  localStorage.removeItem(cacheKey)
  state.repos = []
  state.filtered = []
  updateControls()
  renderResults()
  updateStatus("Not loaded")
  updateProgress("Cache cleared. Enter a username to load starred repositories.")
}

elements.form.addEventListener("submit", handleLoad)
elements.sampleButton.addEventListener("click", handleSample)
elements.exportButton.addEventListener("click", handleExport)
elements.importInput.addEventListener("change", handleImport)
elements.clearButton.addEventListener("click", clearCache)

for (const input of [
  elements.query,
  elements.language,
  elements.topic,
  elements.sort,
  elements.includeArchived,
  elements.forksOnly,
  elements.hideForks,
]) {
  input.addEventListener("input", applySearch)
  input.addEventListener("change", applySearch)
}

loadFromCache()
