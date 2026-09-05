import type { CategoryKey, CategoryScore, Recommendation, RepoAnalysis } from "@/convex/types";
import { scoreHex, scoreTextClass } from "@/lib/status";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  Activity,
  BadgeCheck,
  FileText,
  Package,
  Rocket,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { Panel, PanelHeader, StatusChip } from "./bits";

const CATEGORY_ICONS: Record<CategoryKey, ReactNode> = {
  development: <Activity className="size-4" />,
  releases: <Rocket className="size-4" />,
  dependencies: <Package className="size-4" />,
  maintainers: <Users className="size-4" />,
  documentation: <FileText className="size-4" />,
  metadata: <BadgeCheck className="size-4" />,
};

export function ScoreRing({ score, size = 168 }: { score: number; size?: number }) {
  const pct = Math.max(0, Math.min(100, score));
  const radius = 74;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 168 168" width={size} height={size} className="-rotate-90">
        <circle
          cx="84"
          cy="84"
          r={radius}
          fill="none"
          strokeWidth="10"
          className="stroke-muted"
        />
        <motion.circle
          cx="84"
          cy="84"
          r={radius}
          fill="none"
          strokeWidth="10"
          strokeLinecap="butt"
          stroke={scoreHex(score)}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - (circumference * pct) / 100 }}
          transition={{ duration: 1.1, ease: "easeOut", delay: 0.1 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-5xl font-black tabular-nums tracking-tight", scoreTextClass(score))}>
          {score}
        </span>
        <span className="mt-1 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
          / 100
        </span>
      </div>
    </div>
  );
}

/** Circular score, status, summary and the transparent breakdown. */
export function HealthPanel({ analysis }: { analysis: RepoAnalysis }) {
  const { health } = analysis;
  return (
    <Panel>
      <PanelHeader title="Repository Health" eyebrow="Health score" />
      <div className="flex flex-col items-center gap-5 px-6 py-7 text-center sm:flex-row sm:items-center sm:gap-8 sm:text-left">
        <ScoreRing score={health.score} />
        <div className="min-w-0 flex-1">
          <StatusChip status={health.status} label={health.statusLabel} />
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {health.summary}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground/80">
            Score is the sum of six weighted categories — everything below is
            transparent and recalculated from public signals.
          </p>
        </div>
      </div>
      <div className="border-t-2 border-foreground px-4 py-3">
        <details className="group">
          <summary className="cursor-pointer list-none text-sm font-bold [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              <span className="grid size-5 place-items-center border-2 border-foreground bg-foreground font-mono text-[11px] text-background transition-transform group-open:rotate-90">
                +
              </span>
              How is this score calculated?
            </span>
          </summary>
          <div className="mt-3 space-y-2">
            {health.categories.map((cat) => (
              <div
                key={cat.key}
                className="flex items-center justify-between gap-3 border-2 border-foreground bg-background px-3 py-2 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2 font-semibold">
                  <span className="text-muted-foreground">{CATEGORY_ICONS[cat.key]}</span>
                  <span className="truncate">{cat.label}</span>
                </span>
                <span className="shrink-0 font-mono text-xs tabular-nums">
                  <span className={cn("font-black", scoreTextClass(cat.pct))}>
                    {Math.round(cat.earned)}
                  </span>
                  <span className="text-muted-foreground"> / {cat.max} pts</span>
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between border-2 border-foreground bg-foreground px-3 py-2 text-sm text-background">
              <span className="font-black">Total health score</span>
              <span className="font-mono text-xs font-black tabular-nums">
                {health.score} / {health.maxScore}
              </span>
            </div>
          </div>
        </details>
      </div>
    </Panel>
  );
}

/** Category cards — one per weighted bucket, factors expandable. */
export function CategoryCards({ analysis }: { analysis: RepoAnalysis }) {
  return (
    <Panel>
      <PanelHeader title="Score Breakdown" eyebrow="Six weighted categories" />
      <div className="grid sm:grid-cols-2 sm:divide-x-2 sm:divide-y-0 divide-y-2 divide-foreground border-t-2 border-foreground">
        {analysis.health.categories.map((cat) => (
          <CategoryCard key={cat.key} cat={cat} />
        ))}
      </div>
    </Panel>
  );
}

function CategoryCard({ cat }: { cat: CategoryScore }) {
  return (
    <div className="border-foreground bg-card">
      <details className="group px-4 py-4" open={cat.key === "development"}>
        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid size-8 shrink-0 place-items-center border-2 border-foreground bg-background text-foreground">
                {CATEGORY_ICONS[cat.key]}
              </span>
              <div className="min-w-0">
                <h3 className="truncate text-sm font-black">{cat.label}</h3>
                <p className="text-[11px] text-muted-foreground">
                  {Math.round(cat.earned)} of {cat.max} points
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className={cn("text-2xl font-black tabular-nums", scoreTextClass(cat.pct))}>
                {cat.pct}
              </span>
              <span className="text-xs font-bold text-muted-foreground">/100</span>
            </div>
          </div>
          <div className="mt-3 h-2 border border-foreground bg-muted">
            <motion.div
              className={cn("h-full", catPctColor(cat.pct))}
              initial={{ width: 0 }}
              whileInView={{ width: `${cat.pct}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
            />
          </div>
        </summary>
        <div className="mt-3">
          <p className="text-xs leading-5 text-muted-foreground">{cat.summary}</p>
          <ul className="mt-3 space-y-1.5 border-l-4 border-foreground pl-3">
            {cat.factors.map((f, idx) => (
              <li key={idx} className="text-xs leading-5">
                <span className="font-bold">{f.label}:</span>{" "}
                <span className="text-muted-foreground">{f.note || "—"}</span>
                {f.earned > 0 && (
                  <span className={cn("ml-1.5 font-mono font-black", scoreTextClass(cat.pct))}>
                    +{Math.round(f.earned)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </details>
    </div>
  );
}

function catPctColor(pct: number): string {
  if (pct >= 70) return "bg-health-ok";
  if (pct >= 55) return "bg-health-warn";
  if (pct >= 40) return "bg-health-stale";
  return "bg-health-risk";
}

/** Verdict card with FACT / ANALYSIS / RECOMMENDATION separation. */
export function RecommendationPanel({ rec }: { rec: Recommendation }) {
  const tone =
    rec.verdict === "recommended"
      ? "bg-health-ok text-black"
      : rec.verdict === "caution"
        ? "bg-health-warn text-black"
        : "bg-health-risk text-white";

  return (
    <Panel>
      <PanelHeader title="Can I still use this repository?" eyebrow="RepoPulse assessment" />
      <div className="px-4 py-4">
        <div className={cn("border-2 border-foreground px-4 py-4", tone)}>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] opacity-80">
            Recommendation
          </p>
          <p className="mt-1 text-2xl font-black leading-tight tracking-tight">
            {rec.emoji} {rec.headline}
          </p>
        </div>

        <div className="mt-3 space-y-2 text-sm">
          <RecBlock label="Fact" text={rec.fact} mono />
          <RecBlock label="Analysis" text={rec.analysis} />
          <RecBlock label="Recommendation" text={rec.recommendation} strong />
        </div>

        <p className="mt-3 text-[11px] leading-4 text-muted-foreground">
          RepoPulse never asserts abandonment with certainty — classifications
          are assessments of public signals, and mature projects may
          intentionally change rarely.
        </p>
      </div>
    </Panel>
  );
}

function RecBlock({
  label,
  text,
  mono = false,
  strong = false,
}: {
  label: string;
  text: string;
  mono?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="border-2 border-foreground bg-background p-3">
      <p className="brutal-label">{label}</p>
      <p className={cn("mt-1 text-[13px] leading-5", mono && "font-mono text-xs text-muted-foreground", strong && "font-medium")}>
        {text}
      </p>
    </div>
  );
}
