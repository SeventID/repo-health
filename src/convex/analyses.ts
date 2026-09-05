import { query } from "./_generated/server";
import { v } from "convex/values";
import type { AnalysisSummary, RepoAnalysis } from "./types";

function toSummary(doc: {
  fullName: string;
  analyzedAt: number;
  source: "live" | "demo";
  result: unknown;
}): AnalysisSummary | null {
  const result = doc.result as RepoAnalysis | undefined;
  if (!result || !result.repo) return null;
  return {
    fullName: result.fullName ?? doc.fullName,
    url: result.url ?? `https://github.com/${doc.fullName}`,
    source: doc.source,
    analyzedAt: doc.analyzedAt ?? result.analyzedAt ?? 0,
    score: result.health?.score ?? 0,
    status: result.health?.status ?? "stale",
    stars: result.repo?.stars ?? 0,
    language: result.repo?.language ?? null,
    description: result.repo?.description ?? null,
    avatarUrl: result.repo?.avatarUrl ?? null,
    pushedAt: result.repo?.pushedAt ?? null,
  };
}

/** Fetch a single cached analysis for owner/repo. */
export const get = query({
  args: { fullName: v.string() },
  handler: async (ctx, { fullName }): Promise<RepoAnalysis | null> => {
    const key = fullName.trim().toLowerCase();
    if (!key.includes("/")) return null;
    const doc = await ctx.db
      .query("analyses")
      .withIndex("by_fullName", (q) => q.eq("fullName", key))
      .first();
    return doc ? (doc.result as RepoAnalysis) : null;
  },
});

/** Most recent analyses across the whole app (used for the landing strip). */
export const recentPublic = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }): Promise<AnalysisSummary[]> => {
    const wanted = Math.min(Math.max(limit ?? 6, 1), 12);
    const docs = await ctx.db.query("analyses").collect();
    const summaries = docs
      .map(toSummary)
      .filter((s): s is AnalysisSummary => s !== null)
      .sort((a, b) => b.analyzedAt - a.analyzedAt);
    return summaries.slice(0, wanted);
  },
});
