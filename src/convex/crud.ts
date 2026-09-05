import { getAuthUserId } from "@convex-dev/auth/server";
import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import type { RepoAnalysis } from "./types";

/** Cached analysis for a repo key, or null. */
export const getByFullName = internalQuery({
  args: { fullName: v.string() },
  handler: async (ctx, { fullName }) => {
    const doc = await ctx.db
      .query("analyses")
      .withIndex("by_fullName", (q) => q.eq("fullName", fullName))
      .first();
    return doc ? (doc.result as RepoAnalysis) : null;
  },
});

/** Upsert (insert or refresh) a cached analysis. */
export const upsertAnalysis = internalMutation({
  args: {
    fullName: v.string(),
    analyzedAt: v.number(),
    source: v.union(v.literal("live"), v.literal("demo")),
    result: v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("analyses")
      .withIndex("by_fullName", (q) => q.eq("fullName", args.fullName))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        analyzedAt: args.analyzedAt,
        source: args.source,
        result: args.result,
      });
    } else {
      await ctx.db.insert("analyses", {
        fullName: args.fullName,
        analyzedAt: args.analyzedAt,
        source: args.source,
        result: args.result,
      });
    }
  },
});

/**
 * Record one history row for the calling user (if signed in). Re-analysis of
 * the same repository deletes the old row so it floats back to the top.
 */
export const recordHistory = internalMutation({
  args: { fullName: v.string() },
  handler: async (ctx, { fullName }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return;
    const dup = await ctx.db
      .query("history")
      .withIndex("by_user_repo", (q) => q.eq("userId", userId).eq("fullName", fullName))
      .first();
    if (dup) await ctx.db.delete(dup._id);
    await ctx.db.insert("history", { userId, fullName });
  },
});
