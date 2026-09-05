import type { RepoStatus, Verdict } from "@/convex/types";

export const STATUS_LABELS: Record<RepoStatus, string> = {
  active: "Actively Maintained",
  maintenance: "Maintenance Mode",
  stale: "Stale",
  abandoned: "Possibly Abandoned",
};

export const STATUS_EMOJI: Record<RepoStatus, string> = {
  active: "🟢",
  maintenance: "🟡",
  stale: "🟠",
  abandoned: "🔴",
};

/** Chip classes: vivid flat fill + ink text + strong border (both themes). */
export const STATUS_CHIP: Record<RepoStatus, string> = {
  active: "bg-health-ok text-black",
  maintenance: "bg-health-warn text-black",
  stale: "bg-health-stale text-black",
  abandoned: "bg-health-risk text-white",
};

export const STATUS_DESCRIPTIONS: Record<RepoStatus, string> = {
  active:
    "Recent meaningful development activity, active maintainers, and regular releases or commits.",
  maintenance:
    "Stable and still maintained, but new features are limited and activity has slowed.",
  stale:
    "Development has slowed significantly; dependencies or releases may be outdated.",
  abandoned:
    "No meaningful activity for a long time. Appears inactive — always treat this as a possibility, not a certainty.",
};

export function scoreTone(score: number): "ok" | "warn" | "stale" | "risk" {
  if (score >= 70) return "ok";
  if (score >= 55) return "warn";
  if (score >= 40) return "stale";
  return "risk";
}

/** text color class for a numeric score */
export function scoreTextClass(score: number): string {
  const tone = scoreTone(score);
  if (tone === "ok") return "text-health-ok";
  if (tone === "warn") return "text-health-warn";
  if (tone === "stale") return "text-health-stale";
  return "text-health-risk";
}

export function scoreHex(score: number): string {
  const tone = scoreTone(score);
  switch (tone) {
    case "ok":
      return "var(--health-ok)";
    case "warn":
      return "var(--health-warn)";
    case "stale":
      return "var(--health-stale)";
    default:
      return "var(--health-risk)";
  }
}

/** Dot/background tint classes for lists & small indicators */
export const STATUS_SOFT: Record<RepoStatus, string> = {
  active: "bg-health-ok-soft",
  maintenance: "bg-health-warn-soft",
  stale: "bg-health-stale-soft",
  abandoned: "bg-health-risk-soft",
};

export function verdictLabel(verdict: Verdict): string {
  if (verdict === "recommended") return "Recommended";
  if (verdict === "caution") return "Use with caution";
  return "Find an alternative";
}
