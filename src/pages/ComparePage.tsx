import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { useRepoAnalysis } from "@/hooks/use-repo-analysis";
import { parseRepoUrl } from "@/lib/repo-url";
import { useSeo } from "@/lib/use-seo";
import { scoreTextClass } from "@/lib/status";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ArrowRight, GitCompareArrows, Loader2, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router";
import type { RepoAnalysis } from "@/convex/types";

export default function ComparePage() {
  const [params] = useSearchParams();
  const [leftRaw, setLeftRaw] = useState(params.get("left") ?? "");
  const [rightRaw, setRightRaw] = useState(params.get("right") ?? "");
  const [leftKey, setLeftKey] = useState<string | null>(normalize(params.get("left")));
  const [rightKey, setRightKey] = useState<string | null>(normalize(params.get("right")));

  useSeo(
    "Compare two GitHub repositories | RepoPulse",
    "Run two GitHub repositories through RepoPulse side by side: health score, activity, releases, dependencies and verdicts.",
  );

  const parseAndSet = (
    raw: string,
    setter: (s: string | null) => void,
  ) => {
    const parsed = parseRepoUrl(raw);
    setter(parsed ? parsed.fullName : null);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <header className="flex items-center gap-3">
          <span className="grid size-10 place-items-center border-2 border-foreground bg-foreground text-background">
            <GitCompareArrows className="size-5" />
          </span>
          <div>
            <p className="brutal-label">Side-by-side</p>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              Compare two repositories
            </h1>
          </div>
        </header>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Drop in two public GitHub repositories. RepoPulse analyzes both, then
          lays out health score, category statuses and verdicts in one table.
        </p>

        {/* Inputs */}
        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
          <CompareInput label="Repository A" value={leftRaw} onChange={setLeftRaw} onGo={() => parseAndSet(leftRaw, setLeftKey)} goKey={leftKey} />
          <div className="hidden justify-center lg:flex">
            <span className="grid size-12 place-items-center border-2 border-foreground bg-card font-black">
              VS
            </span>
          </div>
          <CompareInput label="Repository B" value={rightRaw} onChange={setRightRaw} onGo={() => parseAndSet(rightRaw, setRightKey)} goKey={rightKey} />
        </div>

        {(!leftKey || !rightKey) && (
          <p className="mt-4 text-xs text-muted-foreground">
            {!leftKey && !rightKey
              ? "Both inputs are empty — enter two repository URLs above to start."
              : !leftKey
                ? "Repository A is missing or invalid."
                : "Repository B is missing or invalid."}
          </p>
        )}

        {leftKey && rightKey && leftKey === rightKey && (
          <p className="mt-4 border-2 border-health-warn bg-health-warn-soft px-3 py-2 text-xs font-bold">
            The two inputs are the same repository — compare it with something
            else.
          </p>
        )}

        {leftKey && rightKey && leftKey !== rightKey && (
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <CompareColumn label="Repository A" fullName={leftKey} />
            <CompareColumn label="Repository B" fullName={rightKey} />
          </div>
        )}

        <p className="mt-8 text-xs leading-5 text-muted-foreground">
          Comparisons reuse cached analyses when available. Repositories are
          analyzed on-demand against live GitHub data otherwise.
        </p>
      </main>
      <Footer />
    </div>
  );
}

function normalize(raw: string | null): string | null {
  if (!raw) return null;
  const parsed = parseRepoUrl(raw);
  return parsed ? parsed.fullName : null;
}

function CompareInput({
  label,
  value,
  onChange,
  onGo,
  goKey,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onGo: () => void;
  goKey: string | null;
}) {
  const alreadyApplied = Boolean(goKey && parseRepoUrl(value)?.fullName === goKey);
  return (
    <div>
      <p className="brutal-label">{label}</p>
      <div className="mt-1.5 flex items-stretch border-2 border-foreground bg-card">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onGo();
          }}
          placeholder="facebook/react"
          spellCheck={false}
          className="h-11 min-w-0 flex-1 bg-transparent px-3 font-mono text-sm focus:outline-none"
        />
        <button
          type="button"
          onClick={onGo}
          disabled={alreadyApplied || !value.trim()}
          className="cursor-pointer border-l-2 border-foreground bg-foreground px-3 font-black text-background transition-opacity hover:opacity-85 disabled:cursor-default disabled:opacity-60"
        >
          <ArrowRight className="size-4" />
        </button>
      </div>
      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
        {goKey ?? "not set"}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column: runs its own analysis
// ---------------------------------------------------------------------------

function CompareColumn({ label, fullName }: { label: string; fullName: string }) {
  const hook = useRepoAnalysis({ fullName });

  return (
    <div className="border-2 border-foreground bg-card">
      <header className="flex items-center justify-between gap-3 border-b-2 border-foreground px-4 py-3">
        <p className="brutal-label">{label}</p>
        <span className="max-w-[55%] truncate font-mono text-xs font-black">{fullName}</span>
      </header>
      <div className="px-4 py-4">
        {hook.status === "ready" && hook.analysis ? (
          <ColumnSummary analysis={hook.analysis} />
        ) : hook.status === "error" ? (
          <div className="text-center">
            <p className="text-xs text-muted-foreground">{hook.error?.message}</p>
            <button
              type="button"
              onClick={hook.retry}
              className="mt-3 inline-flex cursor-pointer items-center gap-2 border-2 border-foreground bg-foreground px-3 py-1.5 text-xs font-black text-background"
            >
              <RotateCcw className="size-3.5" /> Retry
            </button>
          </div>
        ) : (
          <MiniLoading />
        )}
      </div>
    </div>
  );
}

function MiniLoading() {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
      <p className="text-xs font-semibold text-muted-foreground">
        Fetching from GitHub and scoring signals…
      </p>
      <div className="h-2 w-40 overflow-hidden border border-foreground bg-muted">
        <motion.div
          className="h-full bg-health-ok"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 14, ease: "linear" }}
        />
      </div>
    </div>
  );
}

function ColumnSummary({ analysis }: { analysis: RepoAnalysis }) {
  const health = analysis.health;
  const findCat = (key: string) => health.categories.find((c) => c.key === key);

  const rows: Array<{ label: string; nodeA: React.ReactNode }> = [
    { label: "Health score", nodeA: <ScoreBadge score={health.score} /> },
    { label: "Status", nodeA: <StatusBadge status={health.status} /> },
    { label: "Development", nodeA: <CatBadge cat={findCat("development")?.pct ?? 0} /> },
    { label: "Releases", nodeA: <CatBadge cat={findCat("releases")?.pct ?? 0} /> },
    { label: "Dependencies", nodeA: <CatBadge cat={findCat("dependencies")?.pct ?? 0} /> },
    { label: "Maintainers", nodeA: <CatBadge cat={findCat("maintainers")?.pct ?? 0} /> },
    { label: "Documentation", nodeA: <CatBadge cat={findCat("documentation")?.pct ?? 0} /> },
    {
      label: "Last meaningful commit",
      nodeA: (
        <span className="font-mono text-[11px] font-semibold">
          {analysis.dev.lastMeaningfulAt
            ? new Date(analysis.dev.lastMeaningfulAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })
            : "—"}
        </span>
      ),
    },
    {
      label: "Latest release",
      nodeA: (
        <span className="font-mono text-[11px] font-semibold">
          {analysis.releases.latest?.tag ?? "none"}
        </span>
      ),
    },
    {
      label: "Dependencies checked",
      nodeA: (
        <span className="font-mono text-[11px] font-semibold">
          {analysis.deps.rows.filter((r) => r.status !== "unknown").length}
        </span>
      ),
    },
  ];

  return (
    <div>
      <table className="w-full text-left text-xs">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-border last:border-b-0">
              <td className="py-2 pr-3 font-semibold text-muted-foreground">{row.label}</td>
              <td className="py-2 text-right">{row.nodeA}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <VerdictBar rec={analysis.recommendation.verdict} label={analysis.recommendation.headline} />
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  return (
    <span className={cn("text-lg font-black tabular-nums", scoreTextClass(score))}>
      {score}
      <span className="text-[10px] text-muted-foreground">/100</span>
    </span>
  );
}

function CatBadge({ cat }: { cat: number }) {
  const cls =
    cat >= 70
      ? "bg-health-ok text-black"
      : cat >= 55
        ? "bg-health-warn text-black"
        : cat >= 40
          ? "bg-health-stale text-black"
          : "bg-health-risk text-white";
  return (
    <span className={cn("inline-flex min-w-[3.5rem] items-center justify-center border-2 border-foreground px-1.5 py-0.5 font-mono text-[11px] font-black", cls)}>
      {cat}
    </span>
  );
}

function StatusBadge({ status }: { status: RepoAnalysis["health"]["status"] }) {
  const map = {
    active: "bg-health-ok text-black",
    maintenance: "bg-health-warn text-black",
    stale: "bg-health-stale text-black",
    abandoned: "bg-health-risk text-white",
  } as const;
  const emoji = { active: "🟢", maintenance: "🟡", stale: "🟠", abandoned: "🔴" } as const;
  return (
    <span className={cn("inline-flex items-center gap-1 border-2 border-foreground px-1.5 py-0.5 text-[10px] font-black uppercase", map[status])}>
      {emoji[status]} {status}
    </span>
  );
}

function VerdictBar({
  rec,
  label,
}: {
  rec: RepoAnalysis["recommendation"]["verdict"];
  label: string;
}) {
  const tone =
    rec === "recommended"
      ? "bg-health-ok text-black"
      : rec === "caution"
        ? "bg-health-warn text-black"
        : "bg-health-risk text-white";
  return (
    <div className={cn("mt-4 border-2 border-foreground px-3 py-2 text-center text-[11px] font-black uppercase tracking-wider", tone)}>
      {label}
    </div>
  );
}
