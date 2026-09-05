import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { RepoDashboard } from "@/components/repo/RepoDashboard";
import { RepoInput } from "@/components/site/RepoInput";
import { PIPELINE_STEPS, useRepoAnalysis } from "@/hooks/use-repo-analysis";
import { useSeo } from "@/lib/use-seo";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  AlertOctagon,
  Check,
  ExternalLink,
  GitBranch,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { useNavigate, useParams } from "react-router";

export default function RepoPage() {
  const { owner = "", name = "" } = useParams();
  const fullName = `${owner.toLowerCase()}/${name.toLowerCase()}`;
  const hook = useRepoAnalysis({ fullName });

  useSeo(
    `Is ${fullName} still maintained? | RepoPulse`,
    `RepoPulse analyzed ${fullName}: activity, maintenance signals, releases and dependency freshness — see the health score and recommendation.`,
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        {hook.status === "ready" && hook.analysis ? (
          <RepoDashboard
            analysis={hook.analysis}
            fromCache={hook.fromCache}
            onRefresh={hook.refresh}
          />
        ) : hook.status === "error" ? (
          <AnalysisError
            fullName={fullName}
            message={hook.error?.message}
            onRetry={hook.retry}
          />
        ) : (
          <AnalyzingState fullName={fullName} progress={hook.progress} />
        )}
      </main>
      <Footer />
    </div>
  );
}

function AnalyzingState({
  fullName,
  progress,
}: {
  fullName: string;
  progress: number;
}) {
  const step = Math.min(progress, PIPELINE_STEPS.length - 1);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mx-auto max-w-2xl"
    >
      <div className="border-2 border-foreground bg-card px-5 py-6">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center border-2 border-foreground bg-foreground">
            <GitBranch className="size-5 text-background" />
          </div>
          <div>
            <p className="brutal-label">Repository analysis</p>
            <h1 className="text-xl font-black tracking-tight">
              Analyzing {fullName}...
            </h1>
          </div>
        </div>

        <div className="mt-6 space-y-2.5">
          {PIPELINE_STEPS.map((label, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <motion.div
                key={label}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.08, 0.6) }}
                className={cn(
                  "flex items-center gap-3 border-2 border-foreground px-3 py-2 text-sm",
                  active && "border-foreground",
                  done && "border-foreground/30",
                  !done && !active && "border-border/60 opacity-60",
                )}
              >
                {done ? (
                  <span className="grid size-5 shrink-0 place-items-center border-2 border-foreground bg-health-ok text-black">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                ) : active ? (
                  <Loader2 className="size-5 shrink-0 animate-spin" />
                ) : (
                  <span className="size-5 shrink-0 border-2 border-foreground/30" />
                )}
                <span className={cn("font-semibold", done && "text-muted-foreground")}>
                  {label}
                </span>
              </motion.div>
            );
          })}
        </div>

        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          First analyses fetch metadata, up to 100 commits, 30 releases,
          contributor stats and dependency manifests — this usually takes 10–40
          seconds. Results are cached so revisits are instant.
        </p>
      </div>
    </motion.div>
  );
}

function AnalysisError({
  fullName,
  message,
  onRetry,
}: {
  fullName: string;
  message?: string;
  onRetry: () => void;
}) {
  const navigate = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mx-auto max-w-2xl"
    >
      <div className="border-2 border-foreground bg-card px-5 py-6">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center border-2 border-foreground bg-health-risk text-white">
            <AlertOctagon className="size-5" />
          </div>
          <div>
            <p className="brutal-label">We couldn't analyze this repository</p>
            <h1 className="text-xl font-black tracking-tight">{fullName}</h1>
          </div>
        </div>

        <p className="mt-4 border-l-4 border-health-risk bg-health-risk-soft px-4 py-3 text-sm leading-6">
          {message ??
            "The repository may be private, unavailable, renamed, or the GitHub API rate limit may have been reached."}
        </p>

        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          Tips: double-check the owner and name, make sure the repository is
          public, and try again in a few minutes if GitHub rate limits are the
          cause. Adding a{" "}
          <code className="font-mono">GITHUB_TOKEN</code> in your project keys
          raises the API budget significantly.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex h-9 cursor-pointer items-center gap-2 border-2 border-foreground bg-foreground px-4 text-sm font-black text-background transition-opacity hover:opacity-85"
          >
            <RotateCcw className="size-4" />
            Try again
          </button>
          <a
            href={`https://github.com/${fullName}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-2 border-2 border-foreground bg-card px-4 text-sm font-bold"
          >
            <ExternalLink className="size-4" />
            Open on GitHub
          </a>
        </div>
      </div>

      <div className="mt-6 border-2 border-foreground bg-card px-5 py-5">
        <p className="text-sm font-black">Check a different repository</p>
        <div className="mt-3">
          <RepoInput
            size="md"
            onAnalyze={(full) => navigate(`/repo/${full}`)}
            placeholder="Paste a GitHub repository URL..."
            className="max-w-xl"
          />
        </div>
      </div>
    </motion.div>
  );
}
