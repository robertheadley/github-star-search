import dotenv from "dotenv"

dotenv.config()

export type AppConfig = {
  token: string
  apiBaseUrl: string
}

export function loadConfig(): AppConfig {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN

  if (!token) {
    throw new Error("Missing GH_TOKEN. Copy .env.example to .env or set $env:GH_TOKEN in PowerShell.")
  }

  return {
    token,
    apiBaseUrl: process.env.GITHUB_API_BASE_URL || "https://api.github.com",
  }
}
