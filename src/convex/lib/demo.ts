/**
 * Demo analysis generator.
 *
 * Used ONLY when live GitHub access is unavailable (offline sandbox, network
 * errors). Output is deterministic per repository and is always clearly
 * labeled `source: "demo"` with a visible reason — demo data is never
 * presented as a real analysis.
 */
import { hashString, pseudoRandom } from "./util";
import type {
  AnalysisError,
  CategoryScore,
  CommitInfo,
  DepRow,
  DepsResult,
  DevSignals,
  MaintainersResult,
  Recommendation,
  RepoAnalysis,
  RepoMeta,
  RepoStatus,
  ReleasesResult,
  TimelineItem,
} from "../types";

const MONTH_MS = 30.44 * 24 * 60 * 60 * 1000;
const DEMO_NOTE =
  "DEMO DATA — the GitHub API was unreachable, so this illustrative profile was generated locally instead of from live repository data. It exists so you can explore the interface; do not act on its verdict.";

function isoMonthsAgo(months: number): string {
  return new Date(Date.now() - months * MONTH_MS).toISOString();
}

function demoCommit(message: string, monthsAgo: number, login: string): CommitInfo {
  const msg = message.toLowerCase();
  const minor =
    /\b(typo|readme|format|lint|spell|whitespace|style)\b/.test(msg) ||
    /^(fix )?typo/i.test(msg);
  const docs = /\bdocs?|documentation|readme\b/.test(msg);
  const maint = /\b(test|spec|refactor|cleanup|coverage)\b/.test(msg);
  const kind = minor ? "minor" : docs ? "documentation" : maint ? "maintenance" : "development";
  return {
    sha: `demo-${hashString(message + login)}`,
    message,
    authorName: login,
    authorLogin: login,
    date: isoMonthsAgo(monthsAgo),
    kind,
    meaningful: kind !== "minor",
  };
}

function demoProfile(seed: number) {
  const rnd = pseudoRandom(seed);
  const statusRoll = rnd();
  const status: RepoStatus =
    statusRoll < 0.55
      ? "active"
      : statusRoll < 0.8
        ? "maintenance"
        : statusRoll < 0.94
          ? "stale"
          : "abandoned";
  const score =
    status === "active"
      ? Math.round(70 + rnd() * 24)
      : status === "maintenance"
        ? Math.round(52 + rnd() * 18)
        : status === "stale"
          ? Math.round(32 + rnd() * 22)
          : Math.round(14 + rnd() * 18);
  return { status, score };
}

function categoriesFor(status: RepoStatus, score: number, seed: number): CategoryScore[] {
  const rnd = pseudoRandom(seed ^ 0x9e37);
  const base = status === "active" ? 0.85 : status === "maintenance" ? 0.62 : status === "stale" ? 0.42 : 0.22;
  const scale = (points: number, max: number, minShare = 0.05) => {
    const ideal = max * base * (0.7 + rnd() * 0.5);
    return Math.round(Math.min(max, Math.max(max * minShare, ideal)));
  };

  const dev = scale(30, 30);
  const rel = scale(20, 20);
  const dep = scale(20, 20);
  const maint = scale(15, 15);
  const docs = scale(10, 10);
  const meta = Math.min(5, Math.round(2 + rnd() * 3));

  const mk = (
    key: CategoryScore["key"],
    label: string,
    earned: number,
    max: number,
    summary: string,
    factorLabels: string[],
  ): CategoryScore => ({
    key,
    label,
    earned,
    max,
    pct: Math.round((earned / max) * 100),
    summary,
    factors: factorLabels.map((f) => ({ label: f, earned: 0, max: 0, note: f })),
  });

  void score; void seed;
  return [
    mk("development", "Development Activity", dev, 30,
      `Demo signal: ${dev}/30 from recent meaningful activity.`,
      [
        "Recency of meaningful development — demo",
        "Commit velocity (last ~3 months) — demo",
        "Contributor breadth — demo",
        "Share of meaningful vs. minor commits — demo",
        "Open issue load — demo",
      ]),
    mk("releases", "Release Freshness", rel, 20,
      `Demo signal: ${rel}/20 for release cadence and recency.`,
      ["Recency of latest release — demo", "Release cadence — demo", "Stable release availability — demo"]),
    mk("dependencies", "Dependency Health", dep, 20,
      `Demo signal: ${dep}/20 for dependency freshness.`,
      ["Direct dependency freshness — demo", "Live registry verification — demo", "Missing packages — demo"]),
    mk("maintainers", "Maintainer Activity", maint, 15,
      `Demo signal: ${maint}/15 for maintainer activity.`,
      ["Distinct committers — demo", "Contribution balance — demo", "Maintainer release activity — demo"]),
    mk("documentation", "Documentation", docs, 10,
      `Demo signal: ${docs}/10 for documentation quality.`,
      ["README presence & depth — demo", "Guidance sections — demo", "Documentation recency — demo"]),
    mk("metadata", "Repository Metadata", meta, 5,
      `Demo signal: ${meta}/5 for repository metadata.`,
      ["License — demo", "Topics — demo", "Description — demo", "Traction — demo"]),
  ];
}

function demoHealth(status: RepoStatus, score: number, seed: number) {
  const statusLabel =
    status === "active"
      ? "Actively Maintained"
      : status === "maintenance"
        ? "Maintenance Mode"
        : status === "stale"
          ? "Stale"
          : "Possibly Abandoned";
  return {
    score,
    maxScore: 100,
    status,
    statusLabel,
    summary: `DEMO classification (${statusLabel}) generated without live GitHub data.`,
    categories: categoriesFor(status, score, seed),
  };
}

export function demoAnalysisFor(
  fullName: string,
  url: string,
  reason: string,
): RepoAnalysis {
  const seed = hashString(fullName);
  const rnd = pseudoRandom(seed);
  const { status, score } = demoProfile(seed);
  const [owner, name] = fullName.split("/");

  const years = Math.max(1, Math.round(1 + rnd() * 8));
  const months = Math.round(rnd() * 11);
  const createdIso = isoMonthsAgo(years * 12 + months);

  const languageRoll = rnd();
  const language =
    languageRoll < 0.35 ? "TypeScript" : languageRoll < 0.55 ? "JavaScript" : languageRoll < 0.7 ? "Go" : languageRoll < 0.82 ? "Python" : languageRoll < 0.92 ? "Rust" : "Java";
  const stars = Math.round((status === "active" ? 4_000 + rnd() * 60_000 : 300 + rnd() * 8_000));
  const forks = Math.round(stars * (0.04 + rnd() * 0.1));
  const openIssues = Math.round(stars * (0.005 + rnd() * 0.03));

  const commits: CommitInfo[] = [];
  const authors = status === "active" ? 9 : status === "maintenance" ? 5 : 2;
  const logins = Array.from({ length: authors }, (_, i) => `dev-${i + 1}`);
  const template =
    status === "active"
      ? ["feat: add configurable adapter API", "fix: handle empty input edge case", "perf: cache compiled pattern results", "docs: rewrite quick-start section", "test: cover retry behaviour", "chore(deps): bump lodash to latest patch", "fix: null pointer when options missing", "feat: stream large payloads", "refactor: simplify request pipeline"]
      : status === "maintenance"
        ? ["fix: regression in v2 parsing", "docs: update installation steps", "test: pin expected output", "chore(deps): patch-level bumps", "docs: clarify configuration reference"]
        : ["docs: update README links", "chore: housekeeping", "fix: readme typo", "chore(ci): refresh workflow"];

  const activityWindow = status === "active" ? 1.2 : status === "maintenance" ? 6 : 14;
  const commitCount = status === "active" ? 80 : status === "maintenance" ? 40 : 12;
  for (let i = 0; i < commitCount; i++) {
    const age = (i / commitCount) * activityWindow + rnd() * 0.4;
    const login = logins[Math.floor(rnd() * logins.length)];
    const message = template[Math.floor(rnd() * template.length)];
    commits.push(demoCommit(message, age, login));
  }
  const sorted = [...commits].sort((a, b) => (a.date! < b.date! ? 1 : -1));
  const lastMeaningful = sorted.find((c) => c.meaningful) ?? null;
  const lastCommit = sorted[0] ?? null;

  const meaningfulCount = commits.filter((c) => c.meaningful).length;
  const counts = {
    development: commits.filter((c) => c.kind === "development").length,
    maintenance: commits.filter((c) => c.kind === "maintenance").length,
    documentation: commits.filter((c) => c.kind === "documentation").length,
    minor: commits.filter((c) => c.kind === "minor").length,
  };

  const latestReleaseMonths =
    status === "active" ? 0.8 + rnd() * 1.6 : status === "maintenance" ? 4 + rnd() * 6 : 14 + rnd() * 18;
  const releaseCount = status === "active" ? 14 : status === "maintenance" ? 8 : 3;
  const relReleases: ReleasesResult["releases"] = Array.from({ length: releaseCount }, (_, i) => {
    const age = (i * 1.7) + 0.2;
    return {
      tag: `v${(6 - Math.floor(i / 4)).toString()}.${(i % 4) + 1}.0`,
      name: null,
      publishedAt: isoMonthsAgo(Math.max(0.05, latestReleaseMonths + age - latestReleaseMonths)),
      prerelease: false,
      draft: false,
      htmlUrl: `https://github.com/${fullName}/releases`,
    };
  }).sort((a, b) => (a.publishedAt! < b.publishedAt! ? -1 : 1));

  const dev: DevSignals = {
    commitsExamined: commits.length,
    lastCommitAt: lastCommit?.date ?? null,
    lastCommitMessage: lastCommit?.message ?? null,
    lastMeaningfulAt: lastMeaningful?.date ?? null,
    lastMeaningfulMessage: lastMeaningful?.message ?? null,
    uniqueAuthors: authors,
    counts,
    breakdown: [
      { label: "Meaningful development", pct: Math.round((counts.development / commits.length) * 100), kind: "development", count: counts.development },
      { label: "Maintenance", pct: Math.round((counts.maintenance / commits.length) * 100), kind: "maintenance", count: counts.maintenance },
      { label: "Documentation", pct: Math.round((counts.documentation / commits.length) * 100), kind: "documentation", count: counts.documentation },
      { label: "Minor changes", pct: Math.round((counts.minor / commits.length) * 100), kind: "minor", count: counts.minor },
    ],
    monthly: [],
    note: DEMO_NOTE,
  };

  const relResult: ReleasesResult = {
    releases: relReleases,
    latest: relReleases.length ? relReleases[relReleases.length - 1] : null,
    latestIsPrerelease: false,
    cadenceNote: "Demo cadence data.",
    summary: `Demo release summary — latest release approximately ${Math.round(latestReleaseMonths)} months ago.`,
  };

  const demoDeps: DepRow[] = [
    { name: "demo-core", current: "2.14.1", latest: "2.14.1", status: "up-to-date", note: "Matches latest." },
    { name: "demo-utils", current: "1.9.0", latest: "1.12.3", status: "update", note: "Minor/patch releases available." },
    { name: "demo-legacy", current: "0.4.0", latest: "2.0.0", status: "major", note: "Two major versions behind." },
  ];
  if (status === "stale" || status === "abandoned") {
    demoDeps[1] = { ...demoDeps[1], status: "major", latest: "3.1.0", note: "Major version behind — likely breaking changes." };
  }
  const depsResult: DepsResult = {
    manifest: "package.json",
    ecosystem: "npm",
    language: language === "TypeScript" || language === "JavaScript" ? "JavaScript" : language,
    registryChecked: false,
    rows: demoDeps,
    outdatedCount: demoDeps.filter((d) => d.status === "update" || d.status === "major").length,
    deprecatedCount: 0,
    note: DEMO_NOTE,
  };

  const maintainers: MaintainersResult = {
    topContributors: logins.slice(0, 6).map((l, i) => ({
      login: l,
      avatarUrl: null,
      contributions: Math.round(20 + rnd() * 300 - i * 15),
    })),
    uniqueRecentAuthors: authors,
    summary: `Demo maintainer profile with ${authors} simulated committers.`,
  };

  const timeline: TimelineItem[] = [
    { at: isoMonthsAgo(1), kind: "release", title: relResult.latest ? `Release ${relResult.latest.tag}` : "Release", meaningful: true },
    { at: isoMonthsAgo(2), kind: "development", title: "Meaningful development activity", detail: "Demo events — not real data", meaningful: true },
    { at: isoMonthsAgo(4), kind: "dependency", title: "Dependency update", meaningful: true },
    { at: isoMonthsAgo(8), kind: "documentation", title: "Documentation update", meaningful: true },
    { at: createdIso, kind: "created", title: "Repository created (demo date)", meaningful: false },
  ];

  const recommendation: Recommendation =
    status === "active"
      ? { verdict: "recommended", headline: "YES — RECOMMENDED (DEMO)", emoji: "🟢",
          fact: "No live GitHub data was available — all facts below are simulated.",
          analysis: "This demo profile was shaped to look like an actively maintained repository.",
          recommendation: "Re-run the analysis once the GitHub API is reachable before trusting any verdict." }
      : status === "maintenance"
        ? { verdict: "caution", headline: "USE WITH CAUTION (DEMO)", emoji: "🟡",
            fact: "No live GitHub data was available — all facts below are simulated.",
            analysis: "This demo profile was shaped to look like a maintenance-mode repository.",
            recommendation: "Re-run the analysis once the GitHub API is reachable before trusting any verdict." }
        : { verdict: "alternative", headline: "FIND AN ALTERNATIVE (DEMO)", emoji: "🔴",
            fact: "No live GitHub data was available — all facts below are simulated.",
            analysis: "This demo profile was shaped to look like a stale repository.",
            recommendation: "Re-run the analysis once the GitHub API is reachable before trusting any verdict." };

  const repo: RepoMeta = {
    fullName,
    owner,
    name,
    description: `Demo profile for ${name} — generated because live GitHub data was unreachable.`,
    avatarUrl: null,
    htmlUrl: `https://github.com/${fullName}`,
    homepage: null,
    language,
    stars,
    forks,
    openIssues,
    watchers: Math.round(stars * 0.2),
    createdAt: createdIso,
    updatedAt: isoMonthsAgo(1 + rnd() * 5),
    pushedAt: isoMonthsAgo(status === "active" ? 0.3 : status === "maintenance" ? 2 : 9 + rnd() * 10),
    archived: false,
    disabled: false,
    isFork: false,
    visibility: "public",
    topics: ["demo", "example", language.toLowerCase()],
    license: "MIT",
    defaultBranch: "main",
    ownerType: "User",
    sizeKb: Math.round(800 + rnd() * 4000),
  };

  return {
    source: "demo",
    demoReason: reason,
    analyzedAt: Date.now(),
    url,
    fullName,
    repo,
    health: demoHealth(status, score, seed),
    dev,
    deps: depsResult,
    maintainers,
    releases: relResult,
    timeline,
    recommendation,
    alternatives: [],
    rate: { remaining: null, limit: null, authenticated: false },
    notes: [
      DEMO_NOTE,
      "The values above (stars, commits, releases, dependencies) were fabricated for interface demonstration and do not describe the real repository.",
    ],
  };
}

export function demoErrorFor(fullName: string): AnalysisError {
  return {
    code: "network",
    message: `We couldn't analyze ${fullName}: the GitHub API is unreachable from this environment right now.`,
    detail: "A demo profile is available below so you can explore RepoPulse's interface.",
  };
}
