export const exportSchemaVersion = 1;
const filterFields = new Set(["topic", "language", "owner", "license"]);
const flagFields = new Set(["archived", "disabled", "private", "fork"]);
export function parseQuery(input) {
    const tokens = [];
    let token = "";
    let quoted = false;
    for (const character of input.trim()) {
        if (character === '"') {
            quoted = !quoted;
            token += character;
        }
        else if (/\s/.test(character) && !quoted) {
            if (token)
                tokens.push(token);
            token = "";
        }
        else {
            token += character;
        }
    }
    if (token)
        tokens.push(token);
    if (quoted)
        return { groups: [], clauses: [], error: "Close the quoted phrase with a double quote." };
    const groups = [[]];
    for (const rawToken of tokens) {
        if (rawToken.toUpperCase() === "OR") {
            if (groups.at(-1)?.length === 0) {
                return { groups: [], clauses: [], error: "OR must appear between two search expressions." };
            }
            groups.push([]);
            continue;
        }
        const exclude = rawToken.startsWith("-");
        const withoutPrefix = exclude ? rawToken.slice(1) : rawToken;
        const separator = withoutPrefix.indexOf(":");
        const rawField = separator > 0 ? withoutPrefix.slice(0, separator).toLowerCase() : "";
        const rawValue = separator > 0 ? withoutPrefix.slice(separator + 1) : withoutPrefix;
        const value = unquote(rawValue).trim().toLowerCase();
        if (!value) {
            return { groups: [], clauses: [], error: `Add a value after ${rawField || "the exclusion marker"}.` };
        }
        if (rawField && !filterFields.has(rawField)) {
            return { groups: [], clauses: [], error: `Unsupported filter “${rawField}:”. Use topic:, language:, owner:, or license:.` };
        }
        const clause = rawField
            ? { kind: "filter", field: rawField, value, exclude }
            : flagFields.has(value)
                ? { kind: "flag", value, exclude }
                : { kind: "term", value, exclude };
        groups.at(-1)?.push(clause);
    }
    if (groups.at(-1)?.length === 0 && groups.length > 1) {
        return { groups: [], clauses: [], error: "OR must appear between two search expressions." };
    }
    return { groups, clauses: groups.flat(), error: null };
}
function unquote(value) {
    return value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;
}
export function scoreRepoForQuery(repo, parsed) {
    if (parsed.error)
        return -1;
    if (parsed.clauses.length === 0)
        return 1;
    let bestScore = -1;
    for (const group of parsed.groups) {
        let score = 0;
        let matches = true;
        for (const clause of group) {
            const clauseScore = scoreClause(repo, clause);
            const clauseMatches = clauseScore >= 0;
            if ((clause.exclude && clauseMatches) || (!clause.exclude && !clauseMatches)) {
                matches = false;
                break;
            }
            if (!clause.exclude)
                score += clauseScore;
        }
        if (matches)
            bestScore = Math.max(bestScore, score || 1);
    }
    return bestScore;
}
function scoreClause(repo, clause) {
    const value = clause.value;
    if (clause.kind === "flag")
        return Boolean(repo[clause.value]) ? 1 : -1;
    if (clause.kind === "filter") {
        if (clause.field === "topic")
            return normalizeArray(repo.topics).includes(value) ? 6 : -1;
        const candidate = String(repo[clause.field ?? "owner"] ?? "").toLowerCase();
        return candidate === value ? 6 : -1;
    }
    const fullName = String(repo.fullName ?? "").toLowerCase();
    const owner = String(repo.owner ?? "").toLowerCase();
    const name = String(repo.name ?? "").toLowerCase();
    const description = String(repo.description ?? "").toLowerCase();
    const language = String(repo.language ?? "").toLowerCase();
    const topics = normalizeArray(repo.topics);
    if (![fullName, owner, name, description, language, topics.join(" ")].some((candidate) => candidate.includes(value)))
        return -1;
    return (fullName.includes(value) ? 8 : 0) + (description.includes(value) ? 3 : 0) + (topics.some((topic) => topic.includes(value)) ? 4 : 0) + (language === value ? 5 : 0);
}
function normalizeArray(values) {
    return Array.isArray(values) ? values.map((value) => String(value).toLowerCase()) : [];
}
export function calculateStarRank(repo, now = new Date()) {
    if (!repo.createdAt)
        return null;
    const createdAt = new Date(repo.createdAt);
    if (Number.isNaN(createdAt.getTime()))
        return null;
    const stars = Number(repo.stars) || 0;
    const forks = Number(repo.forks) || 0;
    const ageDays = Math.max(daysBetween(createdAt, now), 1);
    const ageYears = Math.max(ageDays / 365.25, 0.25);
    const starsPerYear = stars / ageYears;
    const forksPerYear = forks / ageYears;
    const starMomentumScore = Math.log10(starsPerYear + 1) * 50;
    const forkMomentumScore = Math.log10(forksPerYear + 1) * 25;
    const expectedForks = Math.max(stars * expectedForkRatioForAge(ageDays), 1);
    const forkSurprise = forks / expectedForks;
    const forkSurpriseScore = Math.log10(Math.min(forkSurprise, 10) + 1) * 20;
    const rawPopularityScore = Math.log10(stars + 1) * 5;
    const rawForkScore = Math.log10(forks + 1) * 3;
    const metadataBonus = Math.min(Math.min(repo.topics?.length ?? 0, 5) * 2 + (repo.description?.trim() ? 3 : 0) + (repo.hasReadme ? 4 : 0) + (repo.hasLicense ? 3 : 0), 20);
    const score = Math.round((starMomentumScore + forkMomentumScore + forkSurpriseScore + rawPopularityScore + rawForkScore + metadataBonus) * 100) / 100;
    return { score, rankLabel: getStarRankLabel(score), components: { stars, forks, ageDays, ageYears, starsPerYear, forksPerYear, expectedForks, forkSurprise, starMomentumScore, forkMomentumScore, forkSurpriseScore, rawPopularityScore, rawForkScore, metadataBonus } };
}
export function getStarRankLabel(score) {
    if (score >= 100)
        return "Exceptional Momentum";
    if (score >= 75)
        return "High Momentum";
    if (score >= 50)
        return "Moderate Momentum";
    if (score >= 25)
        return "Low Momentum";
    return "Minimal Momentum";
}
export function expectedForkRatioForAge(ageDays) {
    if (ageDays < 90)
        return 0.01;
    if (ageDays < 365)
        return 0.03;
    if (ageDays < 1095)
        return 0.06;
    return 0.1;
}
export function daysBetween(start, end) {
    return Math.floor((end.getTime() - start.getTime()) / 86_400_000);
}
export function createRepoExport(repos, scope, now = new Date()) {
    return { schemaVersion: exportSchemaVersion, exportedAt: now.toISOString(), scope, repos };
}
export function validateRepoImport(value) {
    const migratedLegacy = Array.isArray(value);
    const candidate = migratedLegacy ? value : value && typeof value === "object" ? value.repos : null;
    if (!migratedLegacy) {
        const version = value && typeof value === "object" ? value.schemaVersion : undefined;
        if (version !== exportSchemaVersion)
            throw new Error(`Unsupported export schema version “${String(version)}”. Expected version ${exportSchemaVersion}.`);
    }
    if (!Array.isArray(candidate))
        throw new Error("Imported JSON must contain a repos array.");
    if (candidate.length > 100_000)
        throw new Error("Import contains more than the supported maximum of 100,000 repositories.");
    candidate.forEach((repo, index) => {
        if (!repo || typeof repo !== "object")
            throw new Error(`Repository ${index + 1} must be an object.`);
        const record = repo;
        for (const field of ["id", "fullName", "owner", "name", "htmlUrl"]) {
            if (record[field] === undefined || record[field] === null || record[field] === "")
                throw new Error(`Repository ${index + 1} is missing required field “${field}”.`);
        }
        if (!Array.isArray(record.topics))
            throw new Error(`Repository ${index + 1} must provide topics as an array.`);
    });
    return { repos: candidate, migratedLegacy };
}
