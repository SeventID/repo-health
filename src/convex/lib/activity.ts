import type {
  CommitInfo,
  CommitKind,
  DevSignals,
  MonthPoint,
  RawCommit,
} from "../types";
import { monthKey, monthLabel } from "./util";

/**
 * Meaningful activity detection.
 *
 * RepoPulse never judges a repository by its last commit alone. Every sampled
 * commit is classified into one of four buckets, and "last meaningful
 * development activity" is derived only from commits that actually move the
 * project forward:
 *
 *  - development     (features, bug/security fixes, dependency work)
 *  - maintenance     (tests, refactoring, cleanup)
 *  - documentation   (docs, README, guides)
 *  - minor           (typos, formatting, CI metadata, tiny chores)
 */

const DEV_STRONG = [
  "fix", "bug", "bugfix", "hotfix", "security", "vulnerab", "cve",
  "bump", "upgrad", "depend", "deprecat", "feat", "feature", "implement",
  "migrat", "breaking", "perf", "optimiz", "incompat", "backport",
  "patch", "regress", "crash", "memory leak", "compile", "build failure",
];
const DEV_SOFT = [
  "add", "support", "introduc", "enable", "handle", "allow", "revert",
  "improve", "rewrite", "rework", "extend", "expose", "remove", "update",
  "change", "correct", "avoid", "prevent", "stop",
];
const TEST_TOKENS = ["test", "spec", "coverage", "snapshot", "fixture"];
const MAINT_TOKENS = [
  "refactor", "cleanup", "restructur", "simplif", "tidy", "polish", "reorg",
];
const DOC_TOKENS = [
  "docs", "documentation", "readme", "contribut", "changelog", "guide",
  "website", "examples",
];
const MINOR_TOKENS = [
  "typo", "whitespace", "format", "prettier", "lint", "spell", "cosmetic",
  "style", "comment", "trailing", "indent", "newline", "capitaliz",
];

function countMatches(text: string, tokens: string[]): number {
  let total = 0;
  for (const token of tokens) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}`, "gi");
    const matches = text.match(re);
    if (matches) total += matches.length;
  }
  return total;
}

export function classifyCommit(message: string): {
  kind: CommitKind;
  meaningful: boolean;
} {
  const text = (message ?? "").slice(0, 500).toLowerCase();
  if (!text.trim()) return { kind: "minor", meaningful: false };

  const devStrong = countMatches(text, DEV_STRONG);
  const devSoft = countMatches(text, DEV_SOFT);
  const tests = countMatches(text, TEST_TOKENS);
  const maint = countMatches(text, MAINT_TOKENS);
  const docs = countMatches(text, DOC_TOKENS);
  const minor = countMatches(text, MINOR_TOKENS);

  // Weighting tuned so "fix typo in README" reads as minor, while
  // "chore(deps): bump lodash to 4.17.21" reads as real development.
  const scoreDev = devStrong * 4 + devSoft * 1;
  const scoreMaint = tests * 3 + maint * 2;
  const scoreDocs = docs * 2;
  const scoreMinor = minor * 5;

  const docPrefixed = /^\s*(?:docs?|doc)\s*[:)\-(]/i.test(text);
  if (docPrefixed && scoreDev <= 8) return { kind: "documentation", meaningful: true };

  if (scoreMinor >= 3 && scoreMinor >= scoreDev && scoreMinor >= scoreDocs) {
    return { kind: "minor", meaningful: false };
  }
  if (scoreDocs >= 4 && scoreDev <= 4) {
    return { kind: "documentation", meaningful: true };
  }
  if (scoreDev >= scoreMaint && scoreDev >= scoreDocs && scoreDev >= 1) {
    return { kind: "development", meaningful: true };
  }
  if (scoreMaint >= scoreDocs && scoreMaint >= 1) {
    return { kind: "maintenance", meaningful: true };
  }
  if (scoreDocs >= 1) return { kind: "documentation", meaningful: true };
  return { kind: "minor", meaningful: false };
}

export function normalizeCommits(commits: RawCommit[]): CommitInfo[] {
  return commits
    .map((c) => {
      const kind = classifyCommit(c.message);
      return {
        sha: c.sha,
        message: (c.message ?? "").slice(0, 200).trim(),
        authorName: c.authorName,
        authorLogin: c.authorLogin,
        date: c.date,
        kind: kind.kind,
        meaningful: kind.meaningful,
      };
    })
    .sort((a, b) => (a.date! < b.date! ? 1 : -1));
}

function lastMeaningfulCommit(commits: CommitInfo[]) {
  return (
    commits.find((c) => c.meaningful && c.date) ??
    commits.find((c) => c.date) ??
    null
  );
}

export function buildDevSignals(commits: CommitInfo[]): DevSignals {
  const counts: Record<CommitKind, number> = {
    development: 0,
    maintenance: 0,
    documentation: 0,
    minor: 0,
  };
  for (const c of commits) counts[c.kind] += 1;

  const total = commits.length;
  const lastCommit = commits.find((c) => c.date) ?? null;
  const meaningful = lastMeaningfulCommit(commits);

  const authors = new Set<string>();
  for (const c of commits) {
    authors.add(c.authorLogin ?? c.authorName ?? "unknown");
  }

  // Per-month rollup for a small bar chart + timeline hints.
  const byMonth = new Map<string, MonthPoint>();
  for (const c of commits) {
    const key = monthKey(c.date);
    if (!key) continue;
    const cur = byMonth.get(key) ?? { key, label: monthLabel(key), count: 0, meaningful: 0 };
    cur.count += 1;
    if (c.meaningful) cur.meaningful += 1;
    byMonth.set(key, cur);
  }
  const monthly = [...byMonth.values()]
    .sort((a, b) => (a.key < b.key ? -1 : 1))
    .slice(-12);

  const breakdownRows = [
    { label: "Meaningful development", kind: "development" as const, count: counts.development },
    { label: "Maintenance", kind: "maintenance" as const, count: counts.maintenance },
    { label: "Documentation", kind: "documentation" as const, count: counts.documentation },
    { label: "Minor changes", kind: "minor" as const, count: counts.minor },
  ].map((row) => ({
    ...row,
    pct: total > 0 ? Math.round((row.count / total) * 1000) / 10 : 0,
  }));

  let note: string;
  if (total === 0) {
    note = "No recent commits were returned by the GitHub API.";
  } else if (counts.minor / Math.max(1, total) > 0.5) {
    note = "Most recent commits are minor (typos, formatting, CI metadata) — the meaningful activity signal is much weaker than the last-commit date suggests.";
  } else if (counts.development / Math.max(1, total) > 0.5) {
    note = "A large share of recent commits are substantive (features, fixes, dependency work).";
  } else {
    note = "Recent activity mixes real development with maintenance, docs and minor changes.";
  }

  return {
    commitsExamined: total,
    lastCommitAt: lastCommit?.date ?? null,
    lastCommitMessage: lastCommit?.message ?? null,
    lastMeaningfulAt: meaningful?.date ?? null,
    lastMeaningfulMessage: meaningful?.message ?? null,
    uniqueAuthors: authors.size,
    counts,
    breakdown: breakdownRows,
    monthly,
    note,
  };
}
