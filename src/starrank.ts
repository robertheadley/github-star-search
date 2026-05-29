import type { StarRank, StarRankLabel, StarredRepo } from "./types.js"

export function calculateStarRank(repo: StarredRepo, now = new Date()): StarRank | null {
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

export function getStarRankLabel(score: number): StarRankLabel {
  if (score >= 100) return "Exceptional Momentum"
  if (score >= 75) return "High Momentum"
  if (score >= 50) return "Moderate Momentum"
  if (score >= 25) return "Low Momentum"
  return "Minimal Momentum"
}

export function expectedForkRatioForAge(ageDays: number): number {
  if (ageDays < 90) return 0.01
  if (ageDays < 365) return 0.03
  if (ageDays < 1095) return 0.06
  return 0.1
}

export function daysBetween(start: Date, end: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.floor((end.getTime() - start.getTime()) / msPerDay)
}
