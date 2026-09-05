import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { RepoInput } from "@/components/site/RepoInput";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useSeo } from "@/lib/use-seo";
import { STATUS_CHIP, STATUS_LABELS } from "@/lib/status";
import { fmtCount, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  BarChart3,
  GitCompareArrows,
  History,
  LogOut,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router";
import type { RepoStatus } from "@/convex/types";

export default function Dashboard() {
  const { user, isAuthenticated, signOut } = useAuth();
  const navigate = useNavigate();
  const history = useQuery(api.history.recent, { limit: 40 });
  const removeHistory = useMutation(api.history.remove);

  useSeo("My analyses | RepoPulse", "Your recent RepoPulse repository analyses.");

  const handleRemove = async (historyId: string, fullName: string) => {
    try {
      await removeHistory({ historyId: historyId as never });
      toast(`Removed ${fullName} from history.`);
    } catch {
      toast("Could not remove that entry.", { description: "Please try again." });
    }
  };

  const entries = history ?? [];
  const scores = entries.map((e) => e.summary?.score ?? 0);
  const avg =
    scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null;
  const statusCounts = entries.reduce<Record<string, number>>((acc, e) => {
    const s = e.summary?.status ?? "stale";
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
          {/* Rail */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="border-2 border-foreground bg-card p-4">
              <p className="brutal-label">Workspace</p>
              <nav className="mt-3 flex flex-col gap-1 text-sm">
                <span className="flex items-center gap-2 border-2 border-foreground bg-foreground px-3 py-2 font-black text-background">
                  <History className="size-4" /> My analyses
                </span>
                <Link to="/" className="flex items-center gap-2 border-2 border-foreground px-3 py-2 font-semibold hover:bg-accent">
                  <Search className="size-4" /> New analysis
                </Link>
                <Link to="/compare" className="flex items-center gap-2 border-2 border-foreground px-3 py-2 font-semibold hover:bg-accent">
                  <GitCompareArrows className="size-4" /> Compare
                </Link>
              </nav>
            </div>
            <div className="mt-4 border-2 border-foreground bg-card p-4">
              <p className="brutal-label">Signed in</p>
              <p className="mt-2 break-all text-sm font-black">
                {user?.name ?? user?.email ?? "Guest"}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {user?.isAnonymous ? "Guest session — history stays with this device until you sign in with email." : "Email account"}
              </p>
              <button
                type="button"
                onClick={() => {
                  void signOut().finally(() => navigate("/"));
                }}
                className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 border-2 border-foreground px-3 py-2 text-xs font-black transition-colors hover:bg-destructive hover:text-white"
              >
                <LogOut className="size-3.5" /> Sign out
              </button>
            </div>
          </aside>

          {/* Content */}
          <div className="min-w-0 space-y-6">
            <header>
              <p className="brutal-label">
                {isAuthenticated ? "Personal history" : "Protected workspace"}
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                Repositories you&apos;ve checked
              </h1>
            </header>

            <RepoInput
              size="md"
              onAnalyze={(full) => navigate(`/repo/${full}`)}
              placeholder="Analyze another repository…"
              className="max-w-xl"
            />

            {/* Stat band */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatBand icon={<Activity className="size-4" />} value={String(entries.length)} label="analyses saved" />
              <StatBand icon={<BarChart3 className="size-4" />} value={avg === null ? "—" : String(avg)} label="average health" />
              <StatBand icon={<span className="text-xs">🟢</span>} value={String(statusCounts.active ?? 0)} label="actively maintained" />
              <StatBand icon={<span className="text-xs">🔴</span>} value={String((statusCounts.abandoned ?? 0) + (statusCounts.stale ?? 0))} label="stale or at risk" />
            </div>

            {/* History list */}
            {entries.length === 0 ? (
              <div className="flex flex-col items-center gap-3 border-2 border-dashed border-foreground/50 px-6 py-14 text-center">
                <span className="grid size-14 place-items-center border-2 border-foreground bg-card">
                  <History className="size-6" />
                </span>
                <p className="text-sm font-black">Nothing analyzed yet</p>
                <p className="max-w-sm text-xs leading-5 text-muted-foreground">
                  Paste a repository URL above, or pick an example, and every
                  analysis will appear here for instant re-checks.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {entries.map((entry, idx) => {
                  const s = entry.summary;
                  if (!s) {
                    return (
                      <li key={entry.historyId} className="flex items-center justify-between border-2 border-foreground bg-card px-4 py-3">
                        <span className="font-mono text-sm font-bold">{entry.fullName}</span>
                        <span className="text-xs text-muted-foreground">cached analysis missing</span>
                      </li>
                    );
                  }
                  const status = s.status as RepoStatus;
                  return (
                    <motion.li
                      key={entry.historyId}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: Math.min(idx * 0.03, 0.3) }}
                      className="group border-2 border-foreground bg-card transition-colors hover:bg-foreground hover:text-background"
                    >
                      <div className="flex items-center gap-3 px-4 py-3">
                        <Link to={`/repo/${s.fullName}`} className="flex min-w-0 flex-1 items-center gap-3">
                          {s.avatarUrl ? (
                            <img src={s.avatarUrl} alt="" loading="lazy" className="size-9 shrink-0 border-2 border-foreground object-cover" />
                          ) : (
                            <span className="grid size-9 shrink-0 place-items-center border-2 border-foreground bg-muted font-black">
                              {s.fullName.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-mono text-sm font-black group-hover:text-background">
                              {s.fullName}
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground group-hover:text-background/70">
                              {s.language ? `${s.language} · ` : ""}★ {fmtCount(s.stars)} · analyzed {timeAgo(entry.analyzedAt)}
                              {s.source === "demo" && " · demo"}
                            </p>
                          </div>
                        </Link>
                        <span className={cn("hidden border-2 border-foreground px-1.5 py-0.5 text-[10px] font-black uppercase sm:inline-flex", STATUS_CHIP[status])}>
                          {STATUS_LABELS[status]}
                        </span>
                        <span className={cn("font-mono text-sm font-black", scoreClass(s.score))}>
                          {s.score}
                        </span>
                        <button
                          type="button"
                          aria-label={`Remove ${s.fullName} from history`}
                          onClick={() => handleRemove(entry.historyId, s.fullName)}
                          className="cursor-pointer p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus:opacity-100 group-hover:opacity-100 group-hover:text-background/80"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </motion.li>
                  );
                })}
              </ul>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-2 border-foreground bg-card px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Prefer a visual decision? Compare two projects side by side.
              </p>
              <Link to="/compare" className="inline-flex items-center gap-2 text-xs font-black underline underline-offset-4">
                Open the comparator <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function StatBand({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="border-2 border-foreground bg-card px-4 py-3">
      <div className="flex items-center gap-2 text-muted-foreground">{icon}</div>
      <p className="mt-1 text-2xl font-black tabular-nums">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function scoreClass(score: number): string {
  if (score >= 70) return "text-health-ok";
  if (score >= 55) return "text-health-warn";
  if (score >= 40) return "text-health-stale";
  return "text-health-risk";
}
