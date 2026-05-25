import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

export const dataDir = path.resolve("data")
export const outDir = path.resolve("out")
export const starredReposPath = path.join(dataDir, "starred-repos.json")
export const metadataResultsPath = path.join(outDir, "metadata-search-results.json")
export const codeResultsPath = path.join(outDir, "code-search-results.json")

export async function ensureRuntimeDirs(): Promise<void> {
  await mkdir(dataDir, { recursive: true })
  await mkdir(outDir, { recursive: true })
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8")
  return JSON.parse(raw) as T
}

export async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}
