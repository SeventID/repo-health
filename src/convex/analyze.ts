"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import {
  GitHubError,
  fetchCommits,
  fetchContributors,
  fetchFile,
  fetchOwnerRepos,
  fetchReadme,
  fetchReleases,
  fetchRepoMeta,
} from "./github";
import { manifestCandidates, parseManifest } from "./lib/deps";
import { demoAnalysisFor } from "./lib/demo";
import { buildAnalysis } from "./lib/engine";
import { monthsBetweenIso, parseRepoUrl } from "./lib/util";
import type {
  AnalyzeResult,
  ManifestFile,
  RawAlternative,
  RawCommit,
  RawContributor,
  RawRelease,
} from "./types";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

function getToken(): string | undefined {
  const token = process.env.GITHUB_TOKEN;
  return token && token.trim() ? token.trim() : undefined;
}

export const analyzeRepo = action({
  args: {
    url: v.string(),
    force: v.optional(v.boolean()),
    demoIfUnreachable: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<AnalyzeResult> => {
    const parsed = parseRepoUrl(args.url);
    if (!parsed) {
      return {
        ok: false,
        error: {
          code: "invalid-url",
          message:
            "That doesn't look like a GitHub repository URL. Try something like https://github.com/owner/repository or just owner/repository.",
        },
      };
    }
    const fullName = parsed.fullName;
    const token = getToken();
    const allowDemo = args.demoIfUnreachable !== false;

    // 1) Fresh cached analysis? Serve it (unless forced).
    if (!args.force) {
      const cached = await ctx.runQuery(internal.crud.getByFullName, {
        fullName,
      });
      if (cached && Date.now() - cached.analyzedAt < CACHE_TTL_MS) {
        await ctx.runMutation(internal.crud.recordHistory, { fullName }).catch(() => undefined);
        return { ok: true, analysis: cached, cached: true };
      }
    }

    // 2) Fetch repository metadata.
    let repoRaw;
    let rate;
    try {
      const meta = await fetchRepoMeta(parsed.owner, parsed.name, token);
      repoRaw = meta.repo;
      rate = meta.rate;
    } catch (err) {
      return handleFetchError(err, parsed, allowDemo);
    }

    if (repoRaw.disabled) {
      return {
        ok: false,
        error: {
          code: "forbidden",
          message: "This repository has been disabled by GitHub.",
        },
      };
    }

    // 3) Parallel secondary fetches; endpoint gaps degrade gracefully.
    const notes: string[] = [];
    const settled = await Promise.allSettled([
      fetchCommits(parsed.owner, parsed.name, token),
      fetchContributors(parsed.owner, parsed.name, token),
      fetchReleases(parsed.owner, parsed.name, token),
      fetchReadme(parsed.owner, parsed.name, token),
    ]);
    const commits = settleOrDefault(settled[0], [] as RawCommit[], notes, "commit history");
    const contributors = settleOrDefault(settled[1], [] as RawContributor[], notes, "contributors");
    const releases = settleOrDefault(settled[2], [] as RawRelease[], notes, "releases");
    const readme = settleOrDefault(settled[3], null as string | null, notes, "README");

    // 4) Manifest detection (a handful of file fetches).
    const manifests: ManifestFile[] = [];
    for (const candidate of manifestCandidates(repoRaw.language)) {
      if (manifests.length >= 2) break;
      try {
        const content = await fetchFile(parsed.owner, parsed.name, candidate.path, token);
        if (content) manifests.push({ ...candidate, content });
      } catch (err) {
        if (err instanceof GitHubError && err.code === "network") {
          notes.push(`Could not inspect ${candidate.path} (network error).`);
        }
      }
    }
    const parsedDeps = manifests.map((m) => ({
      ecosystem: m.ecosystem,
      specs: parseManifest(m.ecosystem, m.content),
    }));

    // 5) Alternatives (only worth the request for quieter repos).
    let alternatives: RawAlternative[] = [];
    const pushedAge = repoRaw.pushedAt
      ? monthsBetweenIso(repoRaw.pushedAt, new Date().toISOString())
      : 0;
    if (repoRaw.archived || pushedAge >= 9) {
      try {
        alternatives = await fetchOwnerRepos(
          repoRaw.fullName.split("/")[0],
          repoRaw.ownerType,
          token,
        );
      } catch {
        alternatives = [];
      }
    }

    // 6) Score + classify.
    const analysis = await buildAnalysis(
      {
        repo: repoRaw,
        commits,
        contributors,
        releases,
        readme,
        manifests,
        parsedDeps,
        alternatives,
        rate,
        tokenPresent: Boolean(token),
      },
      { url: args.url },
    );
    if (notes.length) analysis.notes.push(...notes);

    // 7) Cache + record history (best-effort). Demo fallbacks are never
    // persisted: next visitor gets a fresh live attempt, not stale demo data.
    if (analysis.source === "live") {
      await ctx
        .runMutation(internal.crud.upsertAnalysis, {
          fullName,
          analyzedAt: analysis.analyzedAt,
          source: analysis.source,
          result: analysis,
        })
        .catch(() => undefined);
      await ctx.runMutation(internal.crud.recordHistory, { fullName }).catch(() => undefined);
    }

    return { ok: true, analysis, cached: false };
  },
});

// ---------------------------------------------------------------------------

function settleOrDefault<T>(
  settled: PromiseSettledResult<T>,
  fallback: T,
  notes: string[],
  label: string,
): T {
  if (settled.status === "fulfilled") return settled.value;
  const err = settled.reason;
  if (err instanceof GitHubError && err.code === "rate-limited") {
    notes.push(`GitHub rate limit prevented reading ${label}; that section is incomplete.`);
  } else {
    notes.push(`Could not fully load ${label}.`);
  }
  return fallback;
}

function handleFetchError(
  err: unknown,
  parsed: { owner: string; name: string; fullName: string },
  allowDemo: boolean,
): AnalyzeResult {
  const url = `https://github.com/${parsed.owner}/${parsed.name}`;
  if (err instanceof GitHubError && err.code === "network" && allowDemo) {
    return {
      ok: true,
      analysis: demoAnalysisFor(parsed.fullName, url, err.message),
      cached: false,
    };
  }
  if (err instanceof GitHubError) {
    return {
      ok: false,
      error: { code: err.code, message: err.message, detail: err.detail },
    };
  }
  if (allowDemo) {
    return {
      ok: true,
      analysis: demoAnalysisFor(
        parsed.fullName,
        url,
        "An unexpected error occurred while contacting the GitHub API.",
      ),
      cached: false,
    };
  }
  return {
    ok: false,
    error: {
      code: "network",
      message: "An unexpected error occurred while analyzing this repository.",
      detail: err instanceof Error ? err.message : undefined,
    },
  };
}
