import type { RepoAnalysis } from "@/convex/types";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Link, useNavigate } from "react-router";
import { GitCompareArrows, RefreshCcw, Search } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { RepoInput } from "@/components/site/RepoInput";
import { RepoHeader } from "./RepoHeader";
import { CategoryCards, HealthPanel, RecommendationPanel } from "./panels-core";
import {
  ActivityPanel,
  AlternativesPanel,
  DemoBanner,
  DependenciesPanel,
  MaintainersPanel,
  NotesPanel,
  ReleasesPanel,
  TimelinePanel,
} from "./panels-data";

export function RepoDashboard({
  analysis,
  fromCache,
  onRefresh,
}: {
  analysis: RepoAnalysis;
  fromCache: boolean;
  onRefresh: () => void;
}) {
  const { fullName } = analysis;
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <DemoBanner analysis={analysis} />

      {/* Analyzed-on + action row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Analyzed <strong className="font-bold text-foreground">{timeAgo(analysis.analyzedAt)}</strong>
          <span className="mx-2 text-border">|</span>
          <span className={cn(analysis.source === "demo" ? "text-health-warn" : "text-health-ok")}>
            {analysis.source === "demo" ? "demo source" : "live GitHub data"}
          </span>
          {fromCache && (
            <>
              <span className="mx-2 text-border">|</span> cached result
            </>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/compare?left=${encodeURIComponent(fullName)}`}
            className="inline-flex h-9 items-center gap-2 border-2 border-foreground bg-card px-3 text-xs font-black transition-colors hover:bg-foreground hover:text-background"
          >
            <GitCompareArrows className="size-4" />
            Compare this repo
          </Link>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex h-9 cursor-pointer items-center gap-2 border-2 border-foreground bg-card px-3 text-xs font-black transition-colors hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCcw className={cn("size-3.5", refreshing && "animate-spin")} />
            {refreshing ? "Re-analyzing..." : "Re-analyze"}
          </button>
        </div>
      </div>

      <RepoHeader analysis={analysis} />

      {/* Health + recommendation */}
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <HealthPanel analysis={analysis} />
        </div>
        <div className="lg:col-span-3">
          <RecommendationPanel rec={analysis.recommendation} />
        </div>
      </div>

      {/* Meaningful activity + timeline */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ActivityPanel analysis={analysis} />
        <TimelinePanel analysis={analysis} />
      </div>

      <CategoryCards analysis={analysis} />

      {/* Releases + maintainers */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ReleasesPanel analysis={analysis} />
        <MaintainersPanel analysis={analysis} />
      </div>

      <DependenciesPanel analysis={analysis} />

      {analysis.alternatives.length > 0 && (
        <AlternativesPanel
          analysis={analysis}
          onAnalyzeAlternative={(alt) => navigate(`/repo/${alt}`)}
        />
      )}

      <NotesPanel analysis={analysis} />

      {/* Secondary analyzer */}
      <section className="border-2 border-foreground bg-card px-4 py-5">
        <p className="flex items-center gap-2 text-sm font-black">
          <Search className="size-4" />
          Check another repository
        </p>
        <div className="mt-3">
          <RepoInput
            size="md"
            onAnalyze={(full) => navigate(`/repo/${full}`)}
            placeholder="Paste a GitHub repository URL..."
            className="max-w-2xl"
          />
        </div>
        {!isAuthenticated && (
          <p className="mt-3 text-[11px] text-muted-foreground">
            <Link to="/auth" className="font-bold underline underline-offset-2">
              Sign in
            </Link>{" "}
            to keep a personal history of the repositories you analyze.
          </p>
        )}
      </section>
    </div>
  );
}
