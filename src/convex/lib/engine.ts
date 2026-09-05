/**
 * RepoPulse scoring engine.
 *
 * Transparent, deterministic scoring of repository health from the raw
 * signals collected by the fetch layer. Every category lists the factors that
 * produced its score, so the result is never a mysterious number.
 *
 * Weighting (out of 100):
 *   Development activity  30
 *   Release freshness     20
 *   Dependency health     20
 *   Maintainer activity   15
 *   Documentation         10
 *   Repository metadata    5
 *
 * Philosophy guardrails:
 *  - A repository is never declared "abandoned" purely from commit dates.
 *    Mature, stable projects intentionally receive fewer changes; the status
 *    logic always corroborates recency with releases, dependency health and
 *    overall quality, and wording stays probabilistic ("appears", "possibly").
 */
import { buildDevSignals, normalizeCommits } from "./activity";
import { buildDepsResult } from "./deps";
import { clamp } from "./util";
import type {
  CategoryScore,
  CommitInfo,
  DepsResult,
  DevSignals,
  RawAlternative,
  RawContext,
  RawRelease,
  Recommendation,
  ReleaseInfo,
  RepoAnalysis,
  RepoStatus,
  ReleasesResult,
  SubFactor,
  TimelineItem,
  TimelineKind,
} from "../types";

const MONTH_MS = 30.44 * 24 * 60 * 60 * 1000;
const INF = Number.MAX_SAFE_INTEGER;
const NOW_TS = Date.now();

function monthsAgoIso(iso: string | null): number {
  if (!iso) return INF;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return INF;
  return Math.max(0, (NOW_TS - t) / MONTH_MS);
}

function agoText(months: number, fallback = "never"): string {
  if (months === INF) return fallback;
  if (months <= 0.04) return "in the last few days";
  if (months < 1) return "less than a month ago";
  const m = Math.round(months);
  return m <= 1 ? "about 1 month ago" : `about ${m} months ago`;
}

function weeksText(months: number, fallback = "never"): string {
  if (months === INF) return fallback;
  const weeks = Math.max(1, Math.round(months * 4.345));
  if (weeks < 2) return "a few days ago";
  return `about ${weeks} weeks ago`;
}

function factor(label: string, earned: number, max: number, note: string): SubFactor {
  return { label, earned: clamp(Math.round(earned * 100) / 100, 0, max), max, note };
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

// ---------------------------------------------------------------------------
// Commit-level helpers
// ---------------------------------------------------------------------------

function countInMonths(commits: CommitInfo[], months: number): number {
  const cutoff = NOW_TS - months * MONTH_MS;
  return commits.filter((c) => {
    const t = c.date ? new Date(c.date).getTime() : NaN;
    return !isNaN(t) && t >= cutoff;
  }).length;
}

function topAuthorShare(commits: CommitInfo[]): number | null {
  if (commits.length === 0) return null;
  const counts = new Map<string, number>();
  for (const c of commits) {
    const key = c.authorLogin ?? c.authorName ?? "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Math.max(...counts.values()) / commits.length;
}

function distinctAuthors(commits: CommitInfo[]): number {
  return new Set(commits.map((c) => c.authorLogin ?? c.authorName ?? "?")).size;
}

// ---------------------------------------------------------------------------
// Development activity (30)
// ---------------------------------------------------------------------------

function scoreDevelopment(
  commits: CommitInfo[],
  stars: number,
  openIssues: number,
): CategoryScore {
  const total = commits.length;
  const meaningfulCount = commits.filter((c) => c.meaningful).length;
  const meaningfulShare = total > 0 ? meaningfulCount / total : 0;
  const lastMeaningful = commits.find((c) => c.meaningful && c.date) ?? null;
  const m = lastMeaningful ? monthsAgoIso(lastMeaningful.date) : INF;

  const recency =
    m === INF ? 0 : m <= 1.5 ? 10 : m <= 3 ? 9 : m <= 6 ? 7 : m <= 12 ? 4 : m <= 18 ? 2 : 0;
  const recent3 = countInMonths(commits, 3);
  const velocity =
    recent3 >= 45 ? 8 : recent3 >= 20 ? 7 : recent3 >= 10 ? 6 : recent3 >= 6 ? 5 : recent3 >= 4 ? 4 : recent3 >= 2 ? 2 : recent3 >= 1 ? 1 : 0;
  const breadthN = distinctAuthors(commits);
  const breadth =
    breadthN >= 10 ? 6 : breadthN >= 6 ? 5 : breadthN >= 4 ? 4 : breadthN >= 3 ? 3 : breadthN >= 2 ? 2 : breadthN >= 1 ? 1 : 0;
  const share =
    meaningfulShare >= 0.6 ? 3 : meaningfulShare >= 0.4 ? 2 : meaningfulShare >= 0.2 ? 1 : 0;

  // Issue load: GitHub's open_issues_count includes pull requests.
  let issuePoints = 0;
  let issueNote = "Not enough data to judge the issue backlog.";
  if (stars >= 100 && openIssues >= 0) {
    const density = (openIssues / stars) * 1000;
    if (density <= 20) {
      issuePoints = 3;
      issueNote = `Open issue density is low (~${Math.round(density)} per 1k stars) relative to community size.`;
    } else if (density <= 80) {
      issuePoints = 2;
      issueNote = `Open issue density is moderate (~${Math.round(density)} per 1k stars).`;
    } else if (density <= 250) {
      issuePoints = 1;
      issueNote = `Open issue density is high (~${Math.round(density)} per 1k stars); the backlog may be slow to clear.`;
    } else {
      issuePoints = 0;
      issueNote = `Open issue density is very high (~${Math.round(density)} per 1k stars).`;
    }
  } else if (openIssues < 60) {
    issuePoints = 2;
    issueNote = "Small open issue count.";
  }

  const earnedTotal = clamp(sum([recency, velocity, breadth, share, issuePoints]), 0, 30);
  const summary =
    total === 0
      ? "No commit history was returned by the GitHub API, so development activity could not be assessed."
      : `${meaningfulCount} of ${total} sampled commits are substantive. Last meaningful development activity ${agoText(m, "was not detected")}.`;

  return {
    key: "development",
    label: "Development Activity",
    earned: earnedTotal,
    max: 30,
    pct: Math.round((earnedTotal / 30) * 100),
    summary,
    factors: [
      factor("Recency of meaningful development", recency, 10,
        lastMeaningful
          ? `Last meaningful commit ${agoText(m)}: "${truncate(lastMeaningful.message, 90)}".`
          : "No meaningful commit in the sampled history."),
      factor("Commit velocity (last ~3 months)", velocity, 8,
        recent3 > 0
          ? `${recent3} commits in the last ~3 months (out of ${total} sampled).`
          : "Fewer than one commit per month recently."),
      factor("Contributor breadth", breadth, 6,
        `${breadthN} distinct author${breadthN === 1 ? "" : "s"} in the sampled history.`),
      factor("Share of meaningful vs. minor commits", share, 3,
        `${Math.round(meaningfulShare * 100)}% of sampled commits are substantive (features, fixes, dependency work, maintenance).`),
      factor("Open issue load", issuePoints, 3, issueNote),
    ],
  };
}

// ---------------------------------------------------------------------------
// Releases (20)
// ---------------------------------------------------------------------------

function releasesResult(releasesAsc: RawRelease[]): ReleasesResult {
  const mapped: ReleaseInfo[] = releasesAsc.filter((r) => !r.draft).map((r) => ({
    tag: r.tagName,
    name: r.name,
    publishedAt: r.publishedAt,
    prerelease: r.prerelease,
    draft: false,
    htmlUrl: r.htmlUrl,
  }));
  const latest = mapped.length > 0 ? mapped[mapped.length - 1] : null;
  const latestIsPrerelease = Boolean(latest?.prerelease);

  let cadenceNote = "No releases found.";
  if (mapped.length >= 2) {
    const first = new Date(mapped[0].publishedAt ?? "").getTime();
    const last = new Date(mapped[mapped.length - 1].publishedAt ?? "").getTime();
    if (!isNaN(first) && !isNaN(last) && last >= first) {
      const years = Math.max((last - first) / (365.25 * 24 * 60 * 60 * 1000), 0.03);
      const perYear = Math.round((mapped.length / years) * 10) / 10;
      cadenceNote = `${mapped.length} releases over the sampled period (≈${perYear}/year).`;
    } else {
      cadenceNote = `${mapped.length} releases found.`;
    }
  } else if (mapped.length === 1) {
    cadenceNote = "Only one release found in the sampled history.";
  }

  const summary = latest
    ? `Latest release ${latest.tag} published ${agoText(monthsAgoIso(latest.publishedAt))}${latest.prerelease ? " (pre-release)" : ""}.`
    : "This repository has no tagged GitHub releases.";

  return {
    releases: mapped.slice(0, 30),
    latest,
    latestIsPrerelease,
    cadenceNote,
    summary,
  };
}

function scoreReleases(rel: ReleasesResult): CategoryScore {
  const visible = rel.releases;
  const latestM = rel.latest ? monthsAgoIso(rel.latest.publishedAt) : INF;

  const recency =
    latestM === INF ? 0 : latestM <= 2 ? 9 : latestM <= 4 ? 8 : latestM <= 6 ? 6 : latestM <= 9 ? 5 : latestM <= 12 ? 4 : latestM <= 18 ? 2 : 0;

  let cadence = 0;
  let cadenceNote = "No releases to measure cadence from.";
  if (visible.length >= 2) {
    const firstT = new Date(visible[0].publishedAt ?? "").getTime();
    const lastT = new Date(visible[visible.length - 1].publishedAt ?? "").getTime();
    if (!isNaN(firstT) && !isNaN(lastT) && lastT >= firstT) {
      const years = Math.max((lastT - firstT) / (365.25 * 24 * 60 * 60 * 1000), 0.03);
      const perYear = visible.length / years;
      cadence =
        perYear >= 6 ? 7 : perYear >= 3 ? 6 : perYear >= 1.5 ? 5 : perYear >= 0.75 ? 4 : perYear >= 0.33 ? 3 : perYear >= 0.16 ? 2 : 1;
      cadenceNote = `≈${Math.round(perYear * 10) / 10} releases per year over the sampled period.`;
    }
  } else if (visible.length === 1) {
    cadence = 2;
    cadenceNote = "Single release in the sampled period — too early to measure cadence.";
  }

  const stablePoints = rel.latest
    ? rel.latestIsPrerelease
      ? 2
      : 4
    : 0;
  const stableNote = rel.latest
    ? rel.latestIsPrerelease
      ? "Latest release is a pre-release; a stable tag is expected but not confirmed."
      : "Latest release is a stable (non pre-release) tag."
    : "No stable release tag available.";

  const earnedTotal = clamp(sum([recency, cadence, stablePoints]), 0, 20);
  return {
    key: "releases",
    label: "Release Freshness",
    earned: earnedTotal,
    max: 20,
    pct: Math.round((earnedTotal / 20) * 100),
    summary: rel.summary,
    factors: [
      factor("Recency of latest release", recency, 9,
        rel.latest ? `Latest release ${rel.latest.tag} ${agoText(latestM, "— no date available")}.` : "No releases found."),
      factor("Release cadence", cadence, 7, cadenceNote),
      factor("Stable release availability", stablePoints, 4, stableNote),
    ],
  };
}

// ---------------------------------------------------------------------------
// Dependencies (20)
// ---------------------------------------------------------------------------

function scoreDependencies(deps: DepsResult): CategoryScore {
  if (deps.manifest === null) {
    const earned = 12; // neutral: not applicable
    return {
      key: "dependencies",
      label: "Dependency Health",
      earned,
      max: 20,
      pct: 60,
      summary:
        "No supported package manifest was detected (package.json, requirements.txt, pyproject.toml, go.mod, Cargo.toml, composer.json, Gemfile, pom.xml). The category is treated as not applicable.",
      factors: [
        factor("Manifest detection", 0, 16,
          "No supported manifest found; nothing to be unhealthy about."),
        factor("Not applicable", 12, 4,
          "Neutral score: dependency risk could not be evaluated because the repository does not expose a supported manifest."),
      ],
    };
  }

  const checked = deps.rows.filter((r) => r.status !== "unknown");
  const upToDate = deps.rows.filter((r) => r.status === "up-to-date").length;
  const missing = deps.rows.filter((r) => r.status === "missing").length;
  const freshness = checked.length > 0 ? (upToDate / checked.length) * 16 : 0;
  const regPoints = deps.registryChecked ? 4 : 0;
  const regNote = deps.registryChecked
    ? `Checked ${checked.length} direct dependencies against the ${deps.ecosystem} registry (latest versions resolved live).`
    : "Registry checks failed — dependency freshness could not be verified, so this category is scored conservatively.";

  const earnedTotal = clamp(freshness + regPoints - Math.min(missing, 4), 0, 20);
  return {
    key: "dependencies",
    label: "Dependency Health",
    earned: earnedTotal,
    max: 20,
    pct: Math.round((earnedTotal / 20) * 100),
    summary: deps.note,
    factors: [
      factor("Direct dependency freshness", Math.round(freshness * 100) / 100, 16,
        checked.length > 0
          ? `${upToDate} of ${checked.length} checked dependencies are at or within reach of their latest release.`
          : "No comparable dependency versions to judge."),
      factor("Live registry verification", regPoints, 4, regNote),
      factor("Missing / unverifiable packages", -Math.min(missing, 4), 0,
        missing > 0 ? `${missing} package${missing === 1 ? "" : "s"} not found in the registry.` : "All dependencies resolve in their registry."),
    ],
  };
}

// ---------------------------------------------------------------------------
// Maintainers (15)
// ---------------------------------------------------------------------------

function scoreMaintainers(
  commits: CommitInfo[],
  rel: ReleasesResult,
): CategoryScore {
  const total = commits.length;
  const authorN = distinctAuthors(commits);
  const share = topAuthorShare(commits);

  const breadth =
    authorN >= 8 ? 5 : authorN >= 5 ? 4 : authorN >= 3 ? 3 : authorN >= 2 ? 2 : authorN >= 1 ? 1 : 0;

  let balance = 0;
  let balanceNote = "Contribution balance could not be measured (no commits).";
  if (share !== null) {
    balance =
      share <= 0.3 ? 5 : share <= 0.5 ? 4 : share <= 0.7 ? 3 : share <= 0.9 ? 2 : 1;
    balanceNote =
      share <= 0.3
        ? "Recent work is distributed across many committers (low bus factor risk)."
        : share <= 0.5
          ? "Work is shared, with one author still dominant."
          : share <= 0.7
            ? "A small core of authors does most of the recent work."
            : share > 0.9
              ? "Almost all recent commits come from a single author — check who actually maintains this project."
              : "One author dominates recent commits.";
  }

  const latestM = rel.latest ? monthsAgoIso(rel.latest.publishedAt) : INF;
  const releasePoints =
    latestM === INF ? 0 : latestM <= 6 ? 5 : latestM <= 12 ? 3 : latestM <= 24 ? 1 : 0;
  const releaseNote = rel.latest
    ? `Maintainers shipped a release ${agoText(latestM)}.`
    : "No recent releases to confirm maintainer activity.";

  const earnedTotal = clamp(sum([breadth, balance, releasePoints]), 0, 15);
  const summary =
    total === 0
      ? "No commit history available to assess maintainer activity."
      : `${authorN} distinct committer${authorN === 1 ? "" : "s"} in the recent history${rel.latest ? `; last release ${agoText(latestM)}` : ""}.`;

  return {
    key: "maintainers",
    label: "Maintainer Activity",
    earned: earnedTotal,
    max: 15,
    pct: Math.round((earnedTotal / 15) * 100),
    summary,
    factors: [
      factor("Distinct committers", breadth, 5,
        `${authorN} committer${authorN === 1 ? "" : "s"} in the sampled history.`),
      factor("Contribution balance", balance, 5, balanceNote),
      factor("Maintainer release activity", releasePoints, 5, releaseNote),
    ],
  };
}

// ---------------------------------------------------------------------------
// Documentation (10) + metadata (5)
// ---------------------------------------------------------------------------

function scoreDocumentation(
  readme: string | null,
  commits: CommitInfo[],
): CategoryScore {
  const readmeLen = readme ? readme.length : 0;
  const lenPoints =
    !readme ? 0 : readmeLen >= 4000 ? 4 : readmeLen >= 1500 ? 3 : readmeLen >= 300 ? 2 : 1;
  const lenNote = !readme
    ? "No README detected."
    : `README detected (${readmeLen} characters).`;

  const sectionKeywords = [
    "install", "usage", "getting started", "quick start", "contribut",
    "license", "api", "example", "configuration", "config", "faq",
  ];
  const text = (readme ?? "").toLowerCase().slice(0, 60_000);
  const foundSections = sectionKeywords.filter((s) => {
    const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|\\n)#+[^\\n]*\\b${escaped}\\b`).test(text) || text.includes(s);
  });
  const sectionPoints = Math.min(foundSections.length, 4);
  const sectionNote = foundSections.length
    ? `Covers ${foundSections.length} key areas: ${foundSections.slice(0, 6).join(", ")}.`
    : "No obvious guidance sections found in the README.";

  const docsCommit = commits.find((c) => c.kind === "documentation" && c.date);
  const docsM = docsCommit ? monthsAgoIso(docsCommit.date) : INF;
  const docsPoints = docsM === INF ? 0 : docsM <= 6 ? 2 : 1;
  const docsNote = docsCommit
    ? `Documentation was touched ${agoText(docsM)}.`
    : "No documentation commits in the sampled history.";

  const earnedTotal = clamp(sum([lenPoints, sectionPoints, docsPoints]), 0, 10);
  return {
    key: "documentation",
    label: "Documentation",
    earned: earnedTotal,
    max: 10,
    pct: Math.round((earnedTotal / 10) * 100),
    summary: !readme
      ? "No README file was detected."
      : `README present (${readmeLen} chars) covering ${foundSections.length} common guidance areas.`,
    factors: [
      factor("README presence & depth", lenPoints, 4, lenNote),
      factor("Guidance sections (install/usage/contributing…)", sectionPoints, 4, sectionNote),
      factor("Documentation recency", docsPoints, 2, docsNote),
    ],
  };
}

function scoreMetadata(repo: RepoAnalysis["repo"]): CategoryScore {
  const factors: SubFactor[] = [];
  factors.push(
    factor("License declared", repo.license ? 1 : 0, 1,
      repo.license ? `${repo.license} license detected.` : "No license detected."),
    factor("Homepage / website", repo.homepage ? 1 : 0, 1,
      repo.homepage ? "Homepage or website link present." : "No homepage set."),
    factor("Topic tags", Math.min(repo.topics.length, 1), 1,
      repo.topics.length >= 3 ? `${repo.topics.length} topic tags.` : "Fewer than 3 topic tags."),
    factor("Description", repo.description ? 1 : 0, 1,
      repo.description ? "A clear description is set." : "No description set."),
    factor("Community traction", repo.stars >= 1000 ? 1 : 0, 1,
      repo.stars >= 1000 ? `${formatCount(repo.stars)} stars — meaningful community traction.` : "Below 1k stars."),
  );
  const earnedTotal = clamp(sum(factors.map((f) => f.earned)), 0, 5);
  return {
    key: "metadata",
    label: "Repository Metadata",
    earned: earnedTotal,
    max: 5,
    pct: Math.round((earnedTotal / 5) * 100),
    summary: "Signal quality of the repository itself (license, topics, description, traction).",
    factors,
  };
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${Math.round(n / 100_000) / 10}M`;
  if (n >= 1_000) return `${Math.round(n / 100) / 10}K`;
  return String(n);
}

// ---------------------------------------------------------------------------
// Status classification (guardrailed)
// ---------------------------------------------------------------------------

export interface StatusDecisionInput {
  commits: CommitInfo[];
  rel: ReleasesResult;
  score: number;
  repo: RepoAnalysis["repo"];
}

function decideStatus(input: StatusDecisionInput): RepoStatus {
  const { commits, rel, score, repo } = input;
  const lastMeaningful = commits.find((c) => c.meaningful && c.date) ?? null;
  const m = lastMeaningful ? monthsAgoIso(lastMeaningful.date) : INF;
  const lastCommit = commits.find((c) => c.date) ?? null;
  const lastC = lastCommit ? monthsAgoIso(lastCommit.date) : INF;
  const relM = rel.latest ? monthsAgoIso(rel.latest.publishedAt) : INF;
  const age = monthsAgoIso(repo.createdAt);

  if (repo.archived) return "stale";

  // Young repos with commits but no meaningful history yet
  if (m === INF && lastC !== INF) {
    if (age < 3) return "active"; // just getting started, not abandoned
    if (age < 12 && lastC <= 3) return "maintenance";
    if (age > 24 && lastC > 12) return "abandoned";
    if (lastC <= 6) return "maintenance";
    if (score < 40 && age > 12) return "stale";
    return "stale";
  }

  // No commits at all
  if (lastC === INF) {
    if (age < 3 && repo.pushedAt) return "maintenance";
    if (score < 30 && age > 18) return "abandoned";
    return "stale";
  }

  const releaseBacking = relM !== INF && relM <= 12;
  const stableMature =
    score >= 65 && (repo.stars >= 5_000 || (repo.stars >= 500 && age >= 48));

  if (m <= 1) return "active";
  if (m <= 2 && score >= 72) return "active";
  if (m <= 3 && score >= 85) return "active";

  if (m <= 12) {
    // Maintenance window: still changing, but slower
    if (m <= 6 && (score >= 60 || releaseBacking)) return "maintenance";
    if (score >= 72 && releaseBacking) return "maintenance";
    if (lastC <= 6 && score >= 65) return "maintenance";
    return "stale";
  }

  if (m <= 24) {
    if (score >= 60 && (releaseBacking || stableMature)) return "maintenance";
    if (score >= 60 && m <= 18 && lastC <= 12) return "maintenance";
    return score >= 45 ? "stale" : "abandoned";
  }

  // More than ~2 years since meaningful work: never call it abandoned purely
  // from dates — a mature stable project can legitimately go quiet.
  if (score >= 60 && (stableMature || relM <= 18)) {
    return age >= 60 ? "maintenance" : "stale";
  }
  return "abandoned";
}

// ---------------------------------------------------------------------------
// Recommendation wording
// ---------------------------------------------------------------------------

function recommendationFor(
  status: RepoStatus,
  score: number,
  dev: DevSignals,
  rel: ReleasesResult,
  deps: DepsResult,
  repo: RepoAnalysis["repo"],
): Recommendation {
  const meaningfulM = dev.lastMeaningfulAt ? monthsAgoIso(dev.lastMeaningfulAt) : INF;
  const relM = rel.latest ? monthsAgoIso(rel.latest.publishedAt) : INF;

  const fact = [
    dev.lastMeaningfulAt
      ? `The last substantive commit was ${agoText(meaningfulM)}`
      : "No substantive commits were detected in the sampled history",
    rel.latest
      ? `the latest release (${rel.latest.tag}) came ${agoText(relM)}`
      : "no tagged releases were found",
    deps.manifest
      ? `${deps.rows.filter((r) => r.status !== "unknown").length} direct dependencies were checked against the ${deps.ecosystem} registry`
      : "no supported package manifest was detected",
    `${repo.stars.toLocaleString()} stars and ${repo.forks.toLocaleString()} forks`,
  ].join("; ") + ".";

  if (status === "active" && score >= 70) {
    return {
      verdict: "recommended",
      headline: "YES — RECOMMENDED",
      emoji: "🟢",
      fact,
      analysis:
        "This repository shows recent meaningful development activity with active committers and either recent releases or a healthy release cadence. The overall health score is strong.",
      recommendation:
        "It appears safe to install, fork, or integrate. As with any dependency, still skim the README and open issues for project-specific caveats.",
    };
  }

  if (status === "maintenance" || (status === "stale" && score >= 60)) {
    return {
      verdict: "caution",
      headline: "USE WITH CAUTION",
      emoji: "🟡",
      fact,
      analysis:
        status === "maintenance"
          ? "The project appears stable and still maintained, but development has slowed to maintenance mode: expect fewer new features and slower response to issues."
          : "Development activity has slowed and the project may now be in a quiet, stable phase rather than an abandoned one.",
      recommendation:
        "It may still work well for a stable, well-understood use case — but verify that the APIs you depend on match the maintained surface, and prefer actively developed alternatives when you need ongoing fixes or features.",
    };
  }

  if (status === "stale") {
    return {
      verdict: "caution",
      headline: "USE WITH CAUTION",
      emoji: "🟠",
      fact,
      analysis:
        "Development activity has significantly slowed: commits are infrequent, the release cadence has dropped, and dependencies or documentation appear outdated relative to the ecosystem.",
      recommendation:
        "Before integrating, confirm the repository still works in your environment and consider alternatives below. Treat it as best-effort, not as an actively evolving project.",
    };
  }

  return {
    verdict: "alternative",
    headline: "FIND AN ALTERNATIVE",
    emoji: "🔴",
    fact,
    analysis:
      "The public signals suggest limited recent maintenance: little or no meaningful development activity for a long period, no recent releases, and dependencies that are likely outdated. Note: it is possible the project is a mature stable codebase that intentionally changes rarely — but that is hard to distinguish without maintainer communication.",
    recommendation:
      "For new projects, evaluate the suggested alternatives first. If nothing else fits, this repository can still be useful — verify it yourself, check issues for known breakage, and expect to maintain it on your own.",
  };
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

function buildTimeline(
  commits: CommitInfo[],
  rel: ReleasesResult,
  repoCreatedAt: string | null,
): TimelineItem[] {
  const priority: Record<TimelineKind, number> = {
    release: 0,
    created: 1,
    dependency: 2,
    development: 3,
    maintenance: 4,
    documentation: 5,
    activity: 6,
  };

  const perMonth = new Map<string, { count: number; meaningful: number; development: number; maintenance: number; documentation: number; dependency: number }>();
  const bucket = (key: string) => {
    let b = perMonth.get(key);
    if (!b) {
      b = { count: 0, meaningful: 0, development: 0, maintenance: 0, documentation: 0, dependency: 0 };
      perMonth.set(key, b);
    }
    return b;
  };
  for (const c of commits) {
    if (!c.date) continue;
    const d = new Date(c.date);
    if (isNaN(d.getTime())) continue;
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const b = bucket(key);
    b.count += 1;
    if (c.meaningful) b.meaningful += 1;
    if (c.kind === "development") b.development += 1;
    if (c.kind === "maintenance") b.maintenance += 1;
    if (c.kind === "documentation") b.documentation += 1;
    if (/\b(bump|upgrad|depend|deprecat|security|vuln|cve)\b/i.test(c.message)) b.dependency += 1;
  }

  interface Candidate {
    key: string;
    kind: TimelineKind;
    title: string;
    detail?: string;
    at: string;
    meaningful: boolean;
  }

  const candidates: Candidate[] = [];

  if (repoCreatedAt) {
    const d = new Date(repoCreatedAt);
    if (!isNaN(d.getTime())) {
      candidates.push({
        key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
        kind: "created",
        title: "Repository created",
        at: repoCreatedAt,
        meaningful: false,
      });
    }
  }

  const seenMonths = new Set<string>();
  const createdCandidate = candidates.find((c) => c.kind === "created") ?? null;
  const monthBlocks: TimelineItem[] = [];

  const releaseItems: Candidate[] = rel.releases.slice(-8).reverse().map((r) => ({
    key: monthKeyOf(r.publishedAt),
    kind: "release" as TimelineKind,
    title: r.prerelease ? `Pre-release ${r.tag}` : `Release ${r.tag}`,
    detail: r.name ?? undefined,
    at: r.publishedAt ?? "",
    meaningful: true,
  }));

  const dependencyItems: Candidate[] = [];
  const devItems: Candidate[] = [];
  const maintenanceItems: Candidate[] = [];
  const docsItems: Candidate[] = [];

  for (const [key, b] of perMonth) {
    const monthDate = key + "-01";
    if (b.dependency >= 2) {
      dependencyItems.push({
        key,
        kind: "dependency",
        title: "Dependency / security work",
        detail: `${b.dependency} commits touching dependencies or security`,
        at: monthDate,
        meaningful: true,
      });
    }
    if (b.meaningful >= 4 && b.development > 0) {
      devItems.push({
        key,
        kind: "development",
        title: "Meaningful development activity",
        detail: `${b.development} substantive commits`,
        at: monthDate,
        meaningful: true,
      });
    } else if (b.count >= 6) {
      devItems.push({
        key,
        kind: "activity",
        title: "Active commit month",
        detail: `${b.count} commits`,
        at: monthDate,
        meaningful: b.meaningful >= b.count / 2,
      });
    }
    if (b.maintenance >= 3) {
      maintenanceItems.push({
        key,
        kind: "maintenance",
        title: "Maintenance & test work",
        detail: `${b.maintenance} commits`,
        at: monthDate,
        meaningful: true,
      });
    }
    if (b.documentation >= 2) {
      docsItems.push({
        key,
        kind: "documentation",
        title: "Documentation update",
        detail: `${b.documentation} doc commits`,
        at: monthDate,
        meaningful: true,
      });
    }
  }

  // Interleave by type priority (releases first), newest first within each
  // type, keeping a single event per month and a 10-item cap overall.
  const groups: Candidate[][] = [
    releaseItems,
    dependencyItems,
    devItems,
    maintenanceItems,
    docsItems,
  ];
  for (const group of groups) {
    group.sort((a, b) => (b.at < a.at ? -1 : 1));
    for (const item of group) {
      if (monthBlocks.length >= 10) break;
      if (seenMonths.has(item.key)) continue;
      seenMonths.add(item.key);
      monthBlocks.push({
        at: item.at,
        kind: item.kind,
        title: item.title,
        detail: item.detail,
        meaningful: item.meaningful,
      });
    }
  }
  if (createdCandidate && monthBlocks.length < 10 && !seenMonths.has(createdCandidate.key)) {
    monthBlocks.push({
      at: createdCandidate.at,
      kind: "created",
      title: createdCandidate.title,
      meaningful: false,
    });
  }

  return monthBlocks
    .filter((c) => Boolean(c.at))
    .sort((a, b) => (b.at < a.at ? -1 : 1))
    .slice(0, 10);
}

function monthKeyOf(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Alternatives
// ---------------------------------------------------------------------------

function pickAlternatives(
  repo: RepoAnalysis["repo"],
  alts: RawAlternative[],
): RepoAnalysis["alternatives"] {
  const current = repo.fullName.toLowerCase();
  const description = `${repo.description ?? ""} ${repo.topics.join(" ")}`.toLowerCase();
  const words = new Set(description.split(/\W+/).filter((w) => w.length > 3));

  const ranked = alts
    .filter((a) => a.fullName.toLowerCase() !== current && a.stars > 0)
    .map((a) => {
      let points = 0;
      if (a.language && a.language === repo.language) points += 3;
      const descWords = new Set(
        `${a.description ?? ""}`.toLowerCase().split(/\W+/).filter((w) => w.length > 3),
      );
      let overlap = 0;
      for (const w of descWords) if (words.has(w)) overlap += 1;
      points += Math.min(overlap, 3);
      points += Math.log10(a.stars + 1);
      const pushed = monthsAgoIso(a.pushedAt);
      const healthy = pushed !== INF && pushed <= 3.5;
      if (healthy) points += 1;
      return { a, points, healthy };
    })
    .sort((x, y) => y.points - x.points)
    .slice(0, 3);

  return ranked.map(({ a, healthy }) => {
    const reasons: string[] = [];
    if (a.language && a.language === repo.language) reasons.push("same primary language");
    if (healthy) reasons.push("recently pushed");
    if (a.stars > 0) reasons.push(`${formatCount(a.stars)} stars`);
    return {
      fullName: a.fullName,
      description: a.description,
      language: a.language,
      stars: a.stars,
      htmlUrl: a.htmlUrl,
      reason: reasons.length ? reasons.join(" · ") : "popular repository by the same owner",
      healthy,
    };
  });
}

// ---------------------------------------------------------------------------
// Public entry: full analysis
// ---------------------------------------------------------------------------

export async function buildAnalysis(
  ctx: RawContext,
  opts: { url: string },
): Promise<RepoAnalysis> {
  const { tokenPresent } = ctx;
  // RawRepo → RepoMeta (the engine works with display-ready metadata).
  const rawRepo = ctx.repo;
  const parts = rawRepo.fullName.split("/");
  const repo: RepoAnalysis["repo"] = {
    ...rawRepo,
    owner: parts[0] ?? "",
    name: parts[1] ?? rawRepo.fullName,
  };
  const commits = normalizeCommits(ctx.commits);
  const dev = buildDevSignals(commits);
  const relResult = releasesResult(sortAsc(ctx.releases));
  const depsResult = await buildDepsResult(
    {
      manifests: ctx.manifests,
      parsedDeps: ctx.parsedDeps,
      primaryLanguage: repo.language,
    },
    repo.createdAt,
  );

  const categories: CategoryScore[] = [
    scoreDevelopment(commits, repo.stars, repo.openIssues),
    scoreReleases(relResult),
    scoreDependencies(depsResult),
    scoreMaintainers(commits, relResult),
    scoreDocumentation(ctx.readme, commits),
    scoreMetadata(repo),
  ];

  const score = clamp(Math.round(sum(categories.map((c) => c.earned))), 0, 100);
  const status = decideStatus({ commits, rel: relResult, score, repo });

  const statusLabel =
    status === "active"
      ? "Actively Maintained"
      : status === "maintenance"
        ? "Maintenance Mode"
        : status === "stale"
          ? "Stale"
          : "Possibly Abandoned";

  const notes: string[] = [];
  notes.push("Scored from up to 100 recent commits, the latest 30 releases and live registry lookups — small samples by design.");
  if (ctx.commits.length === 100) notes.push("Commit sample hit the 100-commit cap; deeper history was not inspected.");
  if (relResult.releases.length === 30) notes.push("Release sample hit the 30-release cap.");
  notes.push("GitHub's open issue counter includes pull requests, so issue density is an approximation.");
  if (status !== "active") {
    notes.push("RepoPulse never declares a project abandoned with certainty — mature stable codebases can legitimately change rarely.");
  }
  if (repo.archived) notes.push("This repository is archived by its owner (read-only).");

  const recommendation = recommendationFor(status, score, dev, relResult, depsResult, repo);

  const alternatives = pickAlternatives(repo, ctx.alternatives);

  const timeline = buildTimeline(commits, relResult, repo.createdAt);

  const mainResult: RepoAnalysis = {
    source: "live",
    demoReason: null,
    analyzedAt: NOW_TS,
    url: opts.url,
    fullName: repo.fullName,
    repo,
    health: {
      score,
      maxScore: 100,
      status,
      statusLabel,
      summary:
        status === "active"
          ? "This repository shows strong recent development activity, active committers and regular releases."
          : status === "maintenance"
            ? "The project appears stable and maintained, but new development has slowed and releases are less frequent."
            : status === "stale"
              ? "Development activity has slowed significantly; dependencies or releases may be outdated."
              : "The public signals suggest little or no recent maintenance activity. Treat this classification as a possibility, not a certainty.",
      categories,
    },
    dev,
    deps: depsResult,
    maintainers: {
      topContributors: ctx.contributors.slice(0, 12),
      uniqueRecentAuthors: dev.uniqueAuthors,
      summary: `Recent history involves ${dev.uniqueAuthors} distinct committer${dev.uniqueAuthors === 1 ? "" : "s"}.`,
    },
    releases: relResult,
    timeline,
    recommendation,
    alternatives,
    rate: ctx.rate,
    notes,
  };
  return mainResult;
}

function sortAsc(releases: RawRelease[]): RawRelease[] {
  return [...releases].sort((a, b) => {
    const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return ta - tb;
  });
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max - 1).trimEnd() + "…" : clean;
}
