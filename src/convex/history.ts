import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { AnalysisSummary } from "./types";

export interface HistoryEntry {
  historyId: string;
  fullName: string;
  analyzedAt: number;
  summary: AnalysisSummary | null;
}

function summarize(doc: { result?: unknown }): AnalysisSummary | null {
  const result = doc.result as
    | {
        repo?: {
          fullName?: string;
          stars?: number;
          language?: string | null;
          description?: string | null;
          avatarUrl?: string | null;
          pushedAt?: string | null;
        };
        health?: { score?: number; status?: AnalysisSummary["status"] };
        url?: string;
        analyzedAt?: number;
      }
    | undefined;
  if (!result?.repo?.fullName) return null;
  return {
    fullName: result.repo.fullName,
    url: result.url ?? `https://github.com/${result.repo.fullName}`,
    source: (doc as { source?: "live" | "demo" }).source ?? "live",
    analyzedAt: result.analyzedAt ?? 0,
    score: result.health?.score ?? 0,
    status: result.health?.status ?? "stale",
    stars: result.repo.stars ?? 0,
    language: result.repo.language ?? null,
    description: result.repo.description ?? null,
    avatarUrl: result.repo.avatarUrl ?? null,
    pushedAt: result.repo.pushedAt ?? null,
  };
}

/** Recent analyses for the signed-in user, newest first. */
export const recent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }): Promise<HistoryEntry[]> => {
    const subjectId = await getAuthUserId(ctx);
    if (subjectId === null) return [];
    const wanted = Math.min(Math.max(limit ?? 24, 1), 50);

    const rows = await ctx.db
      .query("history")
      .withIndex("by_user", (q) => q.eq("userId", subjectId as any))
      .collect();
    rows.sort((a, b) => (a._creationTime < b._creationTime ? 1 : -1));
    const recentRows = rows.slice(0, wanted);

    const entries: HistoryEntry[] = [];
    for (const row of recentRows) {
      const analysisDoc = await ctx.db
        .query("analyses")
        .withIndex("by_fullName", (q) => q.eq("fullName", row.fullName))
        .first();
      entries.push({
        historyId: row._id,
        fullName: row.fullName,
        analyzedAt: row._creationTime,
        summary: analysisDoc ? summarize(analysisDoc) : null,
      });
    }
    return entries;
  },
});

/** Remove one history entry — only the owning user may delete it. */
export const remove = mutation({
  args: { historyId: v.id("history") },
  handler: async (ctx, { historyId }) => {
    const subjectId = await getAuthUserId(ctx);
    if (subjectId === null) throw new Error("Not authenticated");
    const row = await ctx.db.get(historyId);
    if (!row) throw new Error("History entry not found");
    if (row.userId !== subjectId) throw new Error("Not authorized");
    await ctx.db.delete(historyId);
  },
});
