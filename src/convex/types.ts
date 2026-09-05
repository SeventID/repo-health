/**
 * Shared RepoPulse domain types.
 *
 * This module is intentionally dependency-free: it is imported by Convex
 * functions (server) and, with `import type`, by the React frontend so both
 * sides speak the exact same shape for a repository analysis.
 */

// ---------------------------------------------------------------------------
// Health & classification
// ---------------------------------------------------------------------------

export type RepoStatus = "active" | "maintenance" | "stale" | "abandoned";

export type Verdict = "recommended" | "caution" | "alternative";

export type CategoryKey =
  | "development"
  | "releases"
  | "dependencies"
  | "maintainers"
  | "documentation"
  | "metadata";

export type CommitKind =
  | "development"
  | "maintenance"
  | "documentation"
  | "minor";

// ---------------------------------------------------------------------------
// Repository metadata
// ---------------------------------------------------------------------------

export interface RepoMeta {
  fullName: string;
  owner: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  htmlUrl: string;
  homepage: string | null;
  language: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  watchers: number;
  createdAt: string | null;
  updatedAt: string | null;
  pushedAt: string | null;
  archived: boolean;
  disabled: boolean;
  isFork: boolean;
  visibility: string | null;
  topics: string[];
  license: string | null;
  defaultBranch: string | null;
  ownerType: string | null;
  sizeKb: number;
}

// ---------------------------------------------------------------------------
// Activity signals
// ---------------------------------------------------------------------------

export interface CommitInfo {
  sha: string;
  message: string;
  authorName: string | null;
  authorLogin: string | null;
  date: string | null;
  kind: CommitKind;
  meaningful: boolean;
}

export interface ContributorInfo {
  login: string;
  avatarUrl: string | null;
  contributions: number;
}

export interface ReleaseInfo {
  tag: string;
  name: string | null;
  publishedAt: string | null;
  prerelease: boolean;
  draft: boolean;
  htmlUrl: string;
}

export interface SubFactor {
  label: string;
  earned: number;
  max: number;
  note: string;
}

export interface CategoryScore {
  key: CategoryKey;
  label: string;
  earned: number;
  max: number;
  /** normalized 0..100 so every category card reads the same way */
  pct: number;
  summary: string;
  factors: SubFactor[];
}

export interface HealthResult {
  score: number;
  maxScore: number;
  status: RepoStatus;
  statusLabel: string;
  summary: string;
  categories: CategoryScore[];
}

export interface BreakdownRow {
  label: string;
  pct: number;
  kind: CommitKind;
  count: number;
}

export interface MonthPoint {
  key: string;
  label: string;
  count: number;
  meaningful: number;
}

export interface DevSignals {
  commitsExamined: number;
  lastCommitAt: string | null;
  lastCommitMessage: string | null;
  lastMeaningfulAt: string | null;
  lastMeaningfulMessage: string | null;
  uniqueAuthors: number;
  counts: Record<CommitKind, number>;
  breakdown: BreakdownRow[];
  monthly: MonthPoint[];
  note: string;
}

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

export type DepStatus =
  | "up-to-date"
  | "update"
  | "major"
  | "missing"
  | "unknown";

export interface DepRow {
  name: string;
  current: string;
  latest: string | null;
  status: DepStatus;
  note: string;
}

export interface DepsResult {
  manifest: string | null;
  ecosystem: string | null;
  language: string | null;
  registryChecked: boolean;
  rows: DepRow[];
  outdatedCount: number;
  deprecatedCount: number;
  note: string;
}

// ---------------------------------------------------------------------------
// Maintainers & releases
// ---------------------------------------------------------------------------

export interface MaintainersResult {
  topContributors: ContributorInfo[];
  uniqueRecentAuthors: number;
  summary: string;
}

export interface ReleasesResult {
  releases: ReleaseInfo[];
  latest: ReleaseInfo | null;
  latestIsPrerelease: boolean;
  cadenceNote: string;
  summary: string;
}

// ---------------------------------------------------------------------------
// Timeline, recommendation, alternatives
// ---------------------------------------------------------------------------

export type TimelineKind =
  | "release"
  | "development"
  | "documentation"
  | "dependency"
  | "maintenance"
  | "created"
  | "activity";

export interface TimelineItem {
  at: string; // ISO date
  kind: TimelineKind;
  title: string;
  detail?: string;
  meaningful: boolean;
}

export interface Recommendation {
  verdict: Verdict;
  headline: string;
  emoji: string;
  fact: string;
  analysis: string;
  recommendation: string;
}

export interface AlternativeRepo {
  fullName: string;
  description: string | null;
  language: string | null;
  stars: number;
  htmlUrl: string;
  reason: string;
  healthy: boolean;
}

export interface RateInfo {
  remaining: number | null;
  limit: number | null;
  authenticated: boolean;
}

// ---------------------------------------------------------------------------
// Full analysis document
// ---------------------------------------------------------------------------

export interface RepoAnalysis {
  source: "live" | "demo";
  demoReason: string | null;
  analyzedAt: number;
  url: string;
  fullName: string;
  repo: RepoMeta;
  health: HealthResult;
  dev: DevSignals;
  deps: DepsResult;
  maintainers: MaintainersResult;
  releases: ReleasesResult;
  timeline: TimelineItem[];
  recommendation: Recommendation;
  alternatives: AlternativeRepo[];
  rate: RateInfo;
  /** Human-readable caveats about data limits (e.g. 100 commits sampled). */
  notes: string[];
}

export type AnalysisErrorCode =
  | "invalid-url"
  | "not-found"
  | "private"
  | "rate-limited"
  | "forbidden"
  | "unsupported"
  | "network"
  | "empty";

export interface AnalysisError {
  code: AnalysisErrorCode;
  message: string;
  detail?: string;
}

export type AnalyzeResult =
  | { ok: true; analysis: RepoAnalysis; cached: boolean }
  | { ok: false; error: AnalysisError };

export interface AnalysisSummary {
  fullName: string;
  url: string;
  source: "live" | "demo";
  analyzedAt: number;
  score: number;
  status: RepoStatus;
  stars: number;
  language: string | null;
  description: string | null;
  avatarUrl: string | null;
  pushedAt: string | null;
}

// ---------------------------------------------------------------------------
// Raw GitHub shapes (fetch layer input)
// ---------------------------------------------------------------------------

export interface RawRepo {
  fullName: string;
  description: string | null;
  avatarUrl: string | null;
  htmlUrl: string;
  homepage: string | null;
  language: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  watchers: number;
  createdAt: string | null;
  updatedAt: string | null;
  pushedAt: string | null;
  archived: boolean;
  disabled: boolean;
  isFork: boolean;
  visibility: string | null;
  topics: string[];
  license: string | null;
  defaultBranch: string | null;
  ownerType: string | null;
  sizeKb: number;
}

export interface RawCommit {
  sha: string;
  message: string;
  authorName: string | null;
  authorLogin: string | null;
  date: string | null;
}

export interface RawContributor {
  login: string;
  avatarUrl: string | null;
  contributions: number;
}

export interface RawRelease {
  tagName: string;
  name: string | null;
  publishedAt: string | null;
  prerelease: boolean;
  draft: boolean;
  htmlUrl: string;
}

export interface RawAlternative {
  fullName: string;
  description: string | null;
  language: string | null;
  stars: number;
  htmlUrl: string;
  pushedAt: string | null;
}

export interface ManifestFile {
  path: string;
  ecosystem: string;
  language: string;
  content: string;
}

export interface DepSpec {
  name: string;
  current: string;
}

/** Everything the scoring engine needs, gathered from the GitHub API. */
export interface RawContext {
  repo: RawRepo;
  commits: RawCommit[];
  contributors: RawContributor[];
  releases: RawRelease[];
  readme: string | null;
  manifests: ManifestFile[];
  parsedDeps: { ecosystem: string; specs: DepSpec[] }[];
  alternatives: RawAlternative[];
  rate: RateInfo;
  tokenPresent: boolean;
}
