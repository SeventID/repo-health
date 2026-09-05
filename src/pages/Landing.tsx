import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { RepoInput } from "@/components/site/RepoInput";
import { LogoMark } from "@/components/site/Logo";
import { api } from "@/convex/_generated/api";
import { useSeo } from "@/lib/use-seo";
import { STATUS_CHIP, STATUS_DESCRIPTIONS, STATUS_LABELS } from "@/lib/status";
import { fmtCount, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  GitCommitHorizontal,
  GitCompareArrows,
  GitPullRequest,
  History,
  PackageSearch,
  RefreshCcw,
  Rocket,
  ShieldQuestion,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import type { RepoStatus } from "@/convex/types";

export default function Landing() {
  const navigate = useNavigate();
  useSeo(
    "RepoPulse — Is this GitHub repository still alive?",
    "Paste any public GitHub repository URL. RepoPulse analyzes activity, maintenance signals, releases, dependencies and development history, then tells you if it is safe to integrate.",
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <LandingHero onAnalyze={(full) => navigate(`/repo/${full}`)} />
      <HowItWorks />
      <StatusSystem />
      <MeaningfulFeature onAnalyze={(full) => navigate(`/repo/${full}`)} />
      <RecentlyAnalyzed />
      <LandingCta onAnalyze={(full) => navigate(`/repo/${full}`)} />
      <Footer />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

function LandingHero({ onAnalyze }: { onAnalyze: (fullName: string) => void }) {
  const stat = useMemo(
    () => [
      { icon: <GitCommitHorizontal className="size-4" />, label: "100 recent commits sampled", title: "Meaningful activity, not just the last commit" },
      { icon: <Rocket className="size-4" />, label: "30 releases checked", title: "Release recency and cadence" },
      { icon: <PackageSearch className="size-4" />, label: "Live registry lookups", title: "npm, PyPI, Go, crates, Packagist" },
    ],
    [],
  );

  return (
    <section className="relative overflow-hidden border-b-2 border-foreground">
      <div className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:44px_44px]" />
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative mx-auto w-full max-w-4xl px-4 pb-16 pt-14 text-center sm:px-6 sm:pt-20"
      >
        <span className="inline-flex items-center gap-2 border-2 border-foreground bg-card px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em]">
          <ShieldQuestion className="size-3.5 text-health-warn" />
          GitHub repository health checks
        </span>

        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
          Know if a GitHub repository
          <span className="relative mx-3 inline-block px-2 text-background">
            <span className="absolute inset-0 -z-0 border-2 border-foreground bg-foreground" />
            <span className="relative z-10">is still alive.</span>
          </span>
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          RepoPulse analyzes repository activity, maintenance signals, releases,
          dependencies, and development history — before you waste time
          integrating an outdated project.
        </p>

        <div className="mx-auto mt-9 max-w-2xl text-left">
          <RepoInput
            onAnalyze={onAnalyze}
            size="lg"
            autoFocus
            showExamples
            placeholder="Paste a GitHub repository URL..."
            className="text-left"
          />
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {stat.map((s) => (
            <span
              key={s.label}
              title={s.title}
              className="inline-flex cursor-help items-center gap-2 border-2 border-foreground bg-card px-3 py-1.5 font-mono text-[11px] font-bold"
            >
              <span className="text-muted-foreground">{s.icon}</span>
              {s.label}
            </span>
          ))}
        </div>
      </motion.div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// How it works
// ---------------------------------------------------------------------------

const STEPS = [
  {
    n: "01",
    icon: <GitCommitHorizontal className="size-5" />,
    title: "Paste a repository URL",
    body: "Paste any public GitHub repository — facebook/react or a full https://github.com/owner/repo URL both work.",
  },
  {
    n: "02",
    icon: <Sparkles className="size-5" />,
    title: "RepoPulse analyzes it",
    body: "We read activity, commits, releases, contributors, dependencies and maintenance signals — server-side, from the GitHub API.",
  },
  {
    n: "03",
    icon: <ShieldQuestion className="size-5" />,
    title: "Know what you're getting into",
    body: "Get a transparent health score, a maintenance status and a clear recommendation with the reasoning shown.",
  },
];

function HowItWorks() {
  const location = useLocation();
  useEffect(() => {
    if (location.hash === "#how-it-works") {
      requestAnimationFrame(() => {
        document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
      });
    }
  }, [location.hash]);

  return (
    <section id="how-it-works" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
      <SectionHeading
        kicker="How it works"
        title="Three steps to a decision"
        sub="No sign-up required for basic checks. Paste, analyze, decide."
      />
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <motion.div
            key={step.n}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
            className="relative flex flex-col border-2 border-foreground bg-card p-5"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-4xl font-black text-foreground/15">{step.n}</span>
              <span className="grid size-10 place-items-center border-2 border-foreground bg-foreground text-background">
                {step.icon}
              </span>
            </div>
            <h3 className="mt-4 text-lg font-black tracking-tight">{step.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.body}</p>
            {i < STEPS.length - 1 && (
              <ArrowRight className="absolute -right-4 top-1/2 hidden size-5 -translate-y-1/2 text-muted-foreground md:block" />
            )}
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function SectionHeading({
  kicker,
  title,
  sub,
}: {
  kicker: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="brutal-label">{kicker}</p>
      <h2 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">{title}</h2>
      {sub && <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status system
// ---------------------------------------------------------------------------

const STATUS_ORDER: RepoStatus[] = ["active", "maintenance", "stale", "abandoned"];

function StatusSystem() {
  return (
    <section className="border-y-2 border-foreground bg-card/50">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <SectionHeading
          kicker="Maintenance status"
          title="Four honest buckets"
          sub="Every repository lands in one of these. Wording is deliberately probabilistic — RepoPulse never claims abandonment with certainty."
        />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STATUS_ORDER.map((status) => (
            <div key={status} className="border-2 border-foreground bg-card p-4">
              <span className={cn("inline-flex items-center gap-1.5 border-2 border-foreground px-2 py-1 text-xs font-black uppercase tracking-wide", STATUS_CHIP[status])}>
                {status === "active" ? "🟢" : status === "maintenance" ? "🟡" : status === "stale" ? "🟠" : "🔴"}
                {STATUS_LABELS[status]}
              </span>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                {STATUS_DESCRIPTIONS[status]}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Meaningful activity feature
// ---------------------------------------------------------------------------

function MeaningfulFeature({ onAnalyze }: { onAnalyze: (fullName: string) => void }) {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <div className="grid items-start gap-8 lg:grid-cols-2">
        <div>
          <SectionHeading
            kicker="The important feature"
            title="A last commit date can lie to you"
            sub="This is RepoPulse's most important distinction. A repository whose only recent change was “Fix README typo” looks alive — but nothing was actually built."
          />
          <div className="mt-6 space-y-3">
            <FeaturePoint
              icon={<RefreshCcw className="size-4" />}
              title="High importance"
              body="Features, bug & security fixes, dependency upgrades, major code changes."
              tone="bg-health-ok"
            />
            <FeaturePoint
              icon={<GitPullRequest className="size-4" />}
              title="Medium importance"
              body="Documentation, tests, refactoring."
              tone="bg-health-warn"
            />
            <FeaturePoint
              icon={<GitCommitHorizontal className="size-4" />}
              title="Low importance"
              body="Typo fixes, formatting, minor README edits, CI metadata changes."
              tone="bg-muted-foreground"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="border-2 border-foreground bg-card p-4">
            <p className="brutal-label">What GitHub shows you</p>
            <p className="mt-1 text-2xl font-black">Last commit: 2 days ago</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              “Fix README typo”
            </p>
            <div className="mt-3 h-3 border border-foreground bg-muted">
              <div className="h-full w-[4%] bg-muted-foreground" />
            </div>
          </div>
          <div className="border-2 border-foreground bg-card p-4">
            <p className="brutal-label">What RepoPulse reports</p>
            <p className="mt-1 text-2xl font-black text-health-ok">
              Last meaningful development: 4 months ago
            </p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              “feat: add configurable retry policy”
            </p>
            <div className="mt-3 h-3 border border-foreground bg-muted">
              <motion.div
                className="h-full bg-health-ok"
                initial={{ width: 0 }}
                whileInView={{ width: "72%" }}
                viewport={{ once: true }}
                transition={{ duration: 0.7 }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="border-2 border-foreground bg-card p-3">
              <p className="font-mono text-2xl font-black text-health-ok">72%</p>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                meaningful development
              </p>
            </div>
            <div className="border-2 border-foreground bg-card p-3">
              <p className="font-mono text-2xl font-black text-muted-foreground">10%</p>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                minor changes
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onAnalyze("facebook/react")}
            className="group flex w-full cursor-pointer items-center justify-between border-2 border-foreground bg-foreground px-4 py-3 text-sm font-black text-background transition-opacity hover:opacity-90"
          >
            See it live on facebook/react
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </div>
    </section>
  );
}

function FeaturePoint({
  icon,
  title,
  body,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  tone: string;
}) {
  return (
    <div className="flex items-start gap-3 border-2 border-foreground bg-card p-3">
      <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center border-2 border-foreground text-black", tone)}>
        {icon}
      </span>
      <div>
        <p className="text-sm font-black">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recently analyzed + CTA
// ---------------------------------------------------------------------------

function RecentlyAnalyzed() {
  const recent = useQuery(api.analyses.recentPublic, { limit: 8 });
  const navigate = useNavigate();

  return (
    <section className="border-y-2 border-foreground bg-card/50">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading
            kicker="Search history"
            title="Recently analyzed"
            sub="Public checks run across RepoPulse. Click any repository to reopen its full analysis."
          />
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 border-2 border-foreground bg-card px-3 py-2 text-xs font-black transition-colors hover:bg-foreground hover:text-background"
          >
            <History className="size-4" />
            Your history
          </Link>
        </div>

        {recent === undefined ? (
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse border-2 border-foreground bg-muted" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <div className="mt-8 flex flex-col items-center gap-3 border-2 border-dashed border-foreground/50 px-6 py-12 text-center">
            <span className="grid size-14 place-items-center border-2 border-foreground bg-card">
              <History className="size-6" />
            </span>
            <p className="text-sm font-black">No analyses yet</p>
            <p className="max-w-sm text-xs leading-5 text-muted-foreground">
              Paste a GitHub repository URL above to run the first check. Once
              you&apos;re signed in, every analysis is saved to your personal
              history on the dashboard.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {recent.map((item, idx) => (
              <motion.button
                key={item.fullName}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: idx * 0.04 }}
                onClick={() => navigate(`/repo/${item.fullName}`)}
                className="cursor-pointer border-2 border-foreground bg-card p-4 text-left transition-colors hover:border-foreground hover:bg-foreground hover:text-background group"
              >
                <div className="flex items-center justify-between gap-2">
                  <LogoMark className="size-5 text-[9px]" />
                  <span className={cn("brutal-chip border-foreground", STATUS_CHIP[item.status])}>
                    {fmtCount(item.score)}
                  </span>
                </div>
                <p className="mt-3 break-all font-mono text-sm font-black group-hover:text-background">
                  {item.fullName}
                </p>
                <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground group-hover:text-background/80">
                  {item.description || "No description"}
                </p>
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80 group-hover:text-background/70">
                  {item.source === "demo" ? "demo" : "live"} · {timeAgo(item.analyzedAt)}
                </p>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function LandingCta({ onAnalyze }: { onAnalyze: (fullName: string) => void }) {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <div className="border-2 border-foreground bg-foreground px-5 py-10 text-center text-background sm:px-10">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-background/70">
          Before you install, fork, or integrate
        </p>
        <h2 className="mx-auto mt-3 max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">
          Check whether a GitHub repository is still alive.
        </h2>
        <div className="mx-auto mt-7 max-w-2xl text-left">
          <RepoInput
            onAnalyze={onAnalyze}
            size="md"
            placeholder="Paste a GitHub repository URL..."
          />
        </div>
        <p className="mt-5 text-xs text-background/70">
          Prefer numbers?{" "}
          <Link
            to="/compare"
            className="inline-flex items-center gap-1 font-black underline underline-offset-4 hover:text-background/90"
          >
            Compare two repositories side by side
            <GitCompareArrows className="size-3.5" />
          </Link>
        </p>
      </div>
    </section>
  );
}
