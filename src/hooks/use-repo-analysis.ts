import { api } from "@/convex/_generated/api";
import { useAction, useQuery } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AnalysisError,
  AnalyzeResult,
  RepoAnalysis,
} from "@/convex/types";

export const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export const PIPELINE_STEPS = [
  "Validate repository reference",
  "Fetch repository metadata",
  "Read commit history",
  "Scan releases & contributors",
  "Inspect README & dependency manifests",
  "Check dependency freshness",
  "Score signals & classify",
] as const;

export type AnalysisStatus =
  | "checking-cache"
  | "analyzing"
  | "ready"
  | "error";

interface UseRepoAnalysisOptions {
  fullName: string;
  autoRun?: boolean;
}

export function useRepoAnalysis({ fullName, autoRun = true }: UseRepoAnalysisOptions) {
  const key = fullName.trim().toLowerCase();
  const cachedQuery = useQuery(api.analyses.get, { fullName: key });
  const runAction = useAction(api.analyze.analyzeRepo);

  const [status, setStatus] = useState<AnalysisStatus>(
    autoRun ? "checking-cache" : "ready",
  );
  const [analysis, setAnalysis] = useState<RepoAnalysis | null>(null);
  const [error, setError] = useState<AnalysisError | null>(null);
  const [cachedFlag, setCachedFlag] = useState(false);
  const [progress, setProgress] = useState(0);
  const runningRef = useRef(false);
  const startRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startProgress = useCallback(() => {
    clearTimer();
    startRef.current = Date.now();
    setProgress(0);
    // Steps tick every ~600ms so the pipeline feels informative; real results
    // are only shown when the server actually responds.
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const step = Math.min(PIPELINE_STEPS.length - 1, Math.floor(elapsed / 600));
      setProgress(step);
    }, 250);
  }, []);

  const finish = useCallback(
    (result: AnalyzeResult) => {
      clearTimer();
      if (result.ok) {
        setAnalysis(result.analysis);
        setCachedFlag(result.cached);
        setError(null);
        setStatus("ready");
      } else {
        setError(result.error);
        setStatus("error");
      }
    },
    [],
  );

  const execute = useCallback(
    async (force: boolean) => {
      if (runningRef.current) return;
      runningRef.current = true;
      setStatus("analyzing");
      setError(null);
      startProgress();
      try {
        const result = await runAction({
          url: key,
          force,
          demoIfUnreachable: true,
        });
        finish(result);
      } catch (err) {
        clearTimer();
        setError({
          code: "network",
          message:
            "The analysis service could not be reached. Please try again in a moment.",
          detail: err instanceof Error ? err.message : undefined,
        });
        setStatus("error");
      } finally {
        runningRef.current = false;
      }
    },
    [key, runAction, finish, startProgress],
  );

  // React to the cache: fresh cache short-circuits; stale/missing triggers run.
  useEffect(() => {
    if (!autoRun) return;
    if (cachedQuery === undefined) {
      setStatus("checking-cache");
      return;
    }
    if (
      cachedQuery &&
      Date.now() - cachedQuery.analyzedAt < CACHE_TTL_MS
    ) {
      setAnalysis(cachedQuery);
      setCachedFlag(true);
      setError(null);
      setStatus("ready");
      return;
    }
    void execute(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun, cachedQuery === undefined, cachedQuery?.analyzedAt, key, execute]);

  // Fresh analysis every load with force=true
  const refresh = useCallback(() => {
    void execute(true);
  }, [execute]);

  // Cleanup timers
  useEffect(() => clearTimer, []);

  return {
    status,
    analysis,
    error,
    fromCache: cachedFlag,
    isDemo: analysis?.source === "demo",
    progress,
    totalSteps: PIPELINE_STEPS.length,
    refresh,
    retry: () => execute(false),
  };
}
