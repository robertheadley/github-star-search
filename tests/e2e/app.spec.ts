import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

test.beforeEach(async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Try sample data" }).click()
  await expect(page.getByText("723 results")).toBeVisible()
})

test("qualifiers filter fields instead of matching literal text", async ({ page }) => {
  await page.getByRole("textbox", { name: "Query" }).fill("topic:mcp language:TypeScript")
  await expect(page.getByText("1 result", { exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: "modelcontextprotocol/servers" })).toBeVisible()
  await expect(page.getByRole("button", { name: /Remove filter topic:mcp/ })).toBeVisible()
  await expect(page).toHaveURL(/q=topic%3Amcp\+language%3ATypeScript/)
})

test("persists URL state and exports explicit result scopes", async ({ page }) => {
  await page.getByRole("textbox", { name: "Query" }).fill("owner:github")
  await page.getByLabel("Sort").selectOption("stars")
  await expect(page.getByText("1 result", { exact: true })).toBeVisible()

  const resultsDownload = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export current results" }).click()
  expect((await resultsDownload).suggestedFilename()).toBe("github-star-search-results.v1.json")

  const allDownload = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export all repositories" }).click()
  expect((await allDownload).suggestedFilename()).toBe("github-star-search-all.v1.json")
})

test("cache clear is confirmed and keyboard focus remains visible", async ({ page }) => {
  page.once("dialog", (dialog) => dialog.dismiss())
  await page.getByRole("button", { name: "Clear cache" }).click()
  await expect(page.getByText("723 results")).toBeVisible()

  page.once("dialog", (dialog) => dialog.accept())
  await page.getByRole("button", { name: "Clear cache" }).click()
  await expect(page.getByText("Load stars to begin searching.")).toBeVisible()
  await page.keyboard.press("Tab")
  await expect(page.locator(":focus")).toBeVisible()
})

test("sample workflow has no serious automated accessibility violations", async ({ page }) => {
  await expect(page.getByText("Fresh", { exact: true })).toBeVisible()
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact || ""))).toEqual([])
})

test("saves and restores named searches", async ({ page }) => {
  await page.getByRole("textbox", { name: "Query" }).fill("license:MIT -archived")
  page.once("dialog", (dialog) => dialog.accept("MIT shortlist"))
  await page.getByRole("button", { name: "Save current search" }).click()
  await page.getByRole("textbox", { name: "Query" }).fill("")
  await page.getByLabel("Saved searches").selectOption("MIT shortlist")
  await expect(page.getByRole("textbox", { name: "Query" })).toHaveValue("license:MIT -archived")
})

test("validates malformed imports with actionable feedback", async ({ page }) => {
  await page.locator("#import-input").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"schemaVersion":1,"repos":[{"id":1}]}'),
  })
  await expect(page.getByRole("status")).toContainText("Repository 1 is missing required field")
})

test("uses a token only for GitHub and clears it immediately", async ({ page }) => {
  let authorization = ""
  await page.route("https://api.github.com/users/test-user/starred**", async (route) => {
    authorization = route.request().headers().authorization || ""
    await route.fulfill({
      status: 200,
      headers: { "content-type": "application/json", "x-ratelimit-remaining": "4999" },
      body: JSON.stringify([]),
    })
  })
  await page.getByLabel("GitHub username").fill("test-user")
  await page.getByLabel("Optional token").fill("secret-test-token")
  await page.getByRole("button", { name: "Load starred repos" }).click()
  await expect(page.getByLabel("Optional token")).toHaveValue("")
  await expect.poll(() => authorization).toBe("Bearer secret-test-token")
})
