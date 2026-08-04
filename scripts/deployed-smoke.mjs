const site = process.env.PAGES_URL || "https://robertheadley.github.io/github-star-search/"
const response = await fetch(site, { redirect: "follow" })
if (!response.ok) throw new Error(`Deployed site returned HTTP ${response.status}: ${site}`)
const html = await response.text()
for (const marker of ["GitHub Star Search", "Search your GitHub stars", "app.js"]) {
  if (!html.includes(marker)) throw new Error(`Deployed site is missing expected marker: ${marker}`)
}
console.log(`Deployed Pages smoke passed: ${response.url}`)
