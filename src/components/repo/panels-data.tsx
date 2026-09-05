import type {
  AlternativeRepo,
  ContributorInfo,
  DepRow,
  RepoAnalysis,
  RepoStatus,
  TimelineItem,
} from "@/convex/types";
import { fmtCount, monthYear, shortDate, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  Package,
  Rocket,
  Users,
} from "lucide-react";
import { AvatarBlock, DepStatusChip, Mono, Panel, PanelHeader } from "./bits";

// ---------------------------------------------------------------------------
// Demo banner
// ---------------------------------------------------------------------------

export function DemoBanner({ analysis }: { analysis: RepoAnalysis }) {
  if (analysis.source !== "demo") return null;
  return (
    <div className="border-2 border-foreground bg-health-warn-soft px-4 py-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="text-sm font-black uppercase tracking-wide">
            Demo analysis — not live data
          </p>
          <p className="mt-1 text-xs leading-5 text-foreground">
            {analysis.demoReason ??
              "Live GitHub data was unavailable."}{" "}
            Everything on this page was fabricated so you can explore the
            interface. Re-run the analysis when the GitHub API is reachable.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Meaningful activity
// ---------------------------------------------------------------------------

const KIND_BAR: Record<string, string> = {
  development: "bg-health-ok",
  maintenance: "bg-health-warn",
  documentation: "bg-chart-3",
  minor: "bg-muted-foreground",
};

export function ActivityPanel({ analysis }: { analysis: RepoAnalysis }) {
  const dev = analysis.dev;
  const lastCommit = dev.lastCommitAt
    ? new Date(dev.lastCommitAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—";
  const lastMeaningful = dev.lastMeaningfulAt
    ? new Date(dev.lastMeaningfulAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—";

  const maxMonth = Math.max(1, ...dev.monthly.map((m) => m.count));

  return (
    <Panel>
      <PanelHeader
        title="Meaningful Activity"
        eyebrow="Last commit ≠ real activity"
        action={
          <span className="brutal-chip bg-card text-foreground">
            {dev.commitsExamined} commits sampled
          </span>
        }
      />
      <div className="grid divide-y-2 divide-foreground sm:grid-cols-2 sm:divide-x-2 sm:divide-y-0">
        <CommitFact
          label="Last Git commit"
          date={lastCommit}
          message={dev.lastCommitMessage}
          neutral
        />
        <CommitFact
          label="Last meaningful development"
          date={lastMeaningful}
          message={dev.lastMeaningfulMessage}
          highlighted
        />
      </div>

      <div className="border-t-2 border-foreground px-4 py-4">
        <p className="brutal-label">Activity breakdown (share of sampled commits)</p>
        <div className="mt-3 space-y-2.5">
          {dev.breakdown.map((row) => (
            <div key={row.label}>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="font-semibold">{row.label}</span>
                <span className="font-mono font-black tabular-nums">
                  {row.pct}%
                  <span className="ml-1.5 font-normal text-muted-foreground">
                    {row.count} commits
                  </span>
                </span>
              </div>
              <div className="mt-1 h-3 border border-foreground bg-muted">
                <motion.div
                  className={cn("h-full", KIND_BAR[row.kind])}
                  initial={{ width: 0 }}
                  whileInView={{ width: `${Math.max(row.pct, row.count > 0 ? 2 : 0)}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>
            </div>
          ))}
        </div>

        {dev.monthly.length > 1 && (
          <div className="mt-6">
            <p className="brutal-label">Commits per month (last {dev.monthly.length})</p>
            <div className="mt-3 flex items-end gap-1.5 border-b-2 border-foreground pb-px" style={{ height: 110 }}>
              {dev.monthly.map((m) => {
                const total = Math.max(1, (m.count / maxMonth) * 100);
                const meaningfulShare = m.count > 0 ? Math.max(1, (m.meaningful / m.count) * 100) : 0;
                return (
                  <div
                    key={m.key}
                    className="group relative flex-1"
                    title={`${m.label}: ${m.count} commits (${m.meaningful} meaningful)`}
                  >
                    <div
                      className="relative w-full border border-foreground/50 bg-health-ok"
                      style={{ height: `${Math.max(2, total)}%` }}
                    >
                      <div
                        className="absolute inset-x-0 bottom-0 bg-muted-foreground/70"
                        style={{ height: `${100 - meaningfulShare}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
              {dev.monthly.map((m) => (
                <span key={m.key}>{m.label.split(" ")[0].slice(0, 3)}</span>
              ))}
            </div>
          </div>
        )}

        <p className="mt-4 text-xs leading-5 text-muted-foreground">{dev.note}</p>
      </div>
    </Panel>
  );
}

function CommitFact({
  label,
  date,
  message,
  highlighted = false,
  neutral = false,
}: {
  label: string;
  date: string;
  message: string | null;
  highlighted?: boolean;
  neutral?: boolean;
}) {
  return (
    <div className="px-4 py-4">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-block size-2.5",
            highlighted ? "bg-health-ok" : neutral ? "bg-muted-foreground" : "bg-health-ok",
          )}
        />
        <p className="brutal-label">{label}</p>
      </div>
      <p className="mt-1 text-xl font-black tabular-nums">{date}</p>
      {message ? (
        <p className="mt-1 font-mono text-[11px] leading-4 text-muted-foreground">
          “{truncate(message, 90)}”
        </p>
      ) : (
        <p className="mt-1 text-[11px] text-muted-foreground">No activity detected.</p>
      )}
    </div>
  );
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max).trimEnd()}…` : clean;
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export function TimelinePanel({ analysis }: { analysis: RepoAnalysis }) {
  const items = analysis.timeline;
  if (items.length === 0) return null;
  return (
    <Panel>
      <PanelHeader title="Activity Timeline" eyebrow="Key events (sampled)" />
      <ol className="px-4 py-4">
        {items.map((item, idx) => (
          <TimelineRow key={idx} item={item} last={idx === items.length - 1} />
        ))}
      </ol>
    </Panel>
  );
}

function TimelineRow({ item, last }: { item: TimelineItem; last: boolean }) {
  const dot =
    !item.meaningful
      ? "bg-muted-foreground"
      : item.kind === "release"
        ? "bg-health-ok"
        : item.kind === "dependency" || item.kind === "activity"
          ? "bg-health-warn"
          : item.kind === "documentation"
            ? "bg-chart-3"
            : "bg-health-ok";
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      <div className="flex flex-col items-center">
        <span className={cn("mt-1 size-3 shrink-0 border border-foreground", dot)} />
        {!last && <span className="w-px flex-1 bg-foreground/70" />}
      </div>
      <div className="min-w-0 flex-1 pb-0">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className="text-sm font-black">{item.title}</p>
          <span className="font-mono text-[11px] font-semibold text-muted-foreground">
            {monthYear(item.at)}
          </span>
        </div>
        {item.detail && (
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{item.detail}</p>
        )}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Releases
// ---------------------------------------------------------------------------

export function ReleasesPanel({ analysis }: { analysis: RepoAnalysis }) {
  const rel = analysis.releases;
  const visible = [...rel.releases].reverse();
  const latest = rel.latest;
  return (
    <Panel>
      <PanelHeader title="Releases" eyebrow="Release freshness" />
      <div className="px-4 py-4">
        {latest ? (
          <div className="border-2 border-foreground bg-background px-3 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Rocket className="size-4 text-muted-foreground" />
              <Mono className="text-base font-black">{latest.tag}</Mono>
              {latest.prerelease && (
                <span className="brutal-chip bg-health-warn text-black">pre-release</span>
              )}
              <span className="ml-auto text-xs text-muted-foreground">
                {latest.publishedAt ? timeAgo(latest.publishedAt) : ""}
              </span>
            </div>
            {latest.name && <p className="mt-1 text-xs text-muted-foreground">{latest.name}</p>}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No tagged releases found.</p>
        )}
        <p className="mt-3 text-xs leading-5 text-muted-foreground">{rel.cadenceNote}</p>

        {visible.length > 1 && (
          <ul className="mt-3 divide-y divide-border border-t border-border">
            {visible.slice(1, 7).map((r) => (
              <li key={r.tag} className="flex items-center justify-between gap-3 py-2 text-xs">
                <Mono className="font-bold">{r.tag}</Mono>
                <span className="flex items-center gap-2 text-muted-foreground">
                  {r.prerelease && <span className="text-health-warn">pre-release</span>}
                  {r.publishedAt ? shortDate(r.publishedAt) : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
        <a
          href={`https://github.com/${analysis.fullName}/releases`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs font-bold underline underline-offset-4 hover:text-muted-foreground"
        >
          View all releases <ArrowUpRight className="size-3" />
        </a>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

export function DependenciesPanel({ analysis }: { analysis: RepoAnalysis }) {
  const deps = analysis.deps;
  return (
    <Panel>
      <PanelHeader
        title="Dependency Freshness"
        eyebrow={deps.manifest ? `Detected ${deps.manifest}` : "Manifest detection"}
        action={
          deps.ecosystem ? (
            <span className="brutal-chip bg-card text-foreground">{deps.ecosystem}</span>
          ) : undefined
        }
      />
      <div className="px-4 py-4">
        {deps.rows.length === 0 ? (
          <div className="border-2 border-dashed border-foreground/40 px-4 py-6 text-center">
            <Boxes className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-2 text-sm font-semibold">
              {deps.manifest ? "No dependencies to compare" : "No package manifest detected"}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{deps.note}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-xs">
                <thead>
                  <tr className="border-b-2 border-foreground text-[10px] uppercase tracking-widest text-muted-foreground">
                    <th className="py-2 pr-3 font-bold">Package</th>
                    <th className="py-2 pr-3 font-bold">Declared</th>
                    <th className="py-2 pr-3 font-bold">Latest</th>
                    <th className="py-2 text-right font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {deps.rows.map((row, idx) => (
                    <DepRowView key={`${row.name}-${idx}`} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">{deps.note}</p>
            {!deps.registryChecked && (
              <p className="mt-1 text-[11px] text-muted-foreground/80">
                Latest versions are resolved live from the {deps.ecosystem ?? "package"} registry
                when the repository is reachable.
              </p>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}

function DepRowView({ row }: { row: DepRow }) {
  return (
    <tr className="border-b border-border align-middle">
      <td className="py-2 pr-3">
        <div className="flex items-center gap-1.5">
          <Package className="size-3 shrink-0 text-muted-foreground" />
          <Mono className="break-all">{row.name}</Mono>
        </div>
      </td>
      <td className="py-2 pr-3 font-mono text-muted-foreground">{row.current}</td>
      <td className="py-2 pr-3 font-mono text-muted-foreground">{row.latest ?? "—"}</td>
      <td className="py-2 text-right">
        <DepStatusChip status={row.status} />
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Maintainers
// ---------------------------------------------------------------------------

export function MaintainersPanel({ analysis }: { analysis: RepoAnalysis }) {
  const contributors: ContributorInfo[] = analysis.maintainers.topContributors;
  const sample = contributors.slice(0, 9);
  return (
    <Panel>
      <PanelHeader
        title="Maintainer Activity"
        eyebrow="Who is driving the project"
        action={
          contributors.length > 0 ? (
            <span className="brutal-chip bg-card text-foreground">
              <Users className="size-3" /> top {contributors.length}
            </span>
          ) : undefined
        }
      />
      <div className="px-4 py-4">
        {sample.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Contributor data is unavailable for this repository right now
            (rate limit or restricted visibility).{analysis.dev.uniqueAuthors > 0 &&
              ` Recent commits still show ${analysis.dev.uniqueAuthors} distinct author(s).`}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {sample.map((c) => (
                <div
                  key={c.login}
                  className="flex min-w-0 items-center gap-2 border-2 border-foreground bg-background px-2 py-1.5"
                >
                  <AvatarBlock name={c.login} src={c.avatarUrl} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold">{c.login}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {fmtCount(c.contributions)} commits
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              {analysis.maintainers.summary} Contribution balance, recent author
              diversity and release activity determine the Maintainer Activity
              score in the breakdown above.
            </p>
          </>
        )}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Alternatives
// ---------------------------------------------------------------------------

export function AlternativesPanel({
  analysis,
  onAnalyzeAlternative,
}: {
  analysis: RepoAnalysis;
  onAnalyzeAlternative: (fullName: string) => void;
}) {
  const alts = analysis.alternatives;
  if (alts.length === 0) return null;
  return (
    <Panel>
      <PanelHeader
        title="Recommended Alternatives"
        eyebrow="Same ecosystem, same owner"
        action={
          <span className="brutal-chip bg-card text-foreground">similar signal</span>
        }
      />
      <div className="px-4 py-4">
        <div className="grid gap-3">
          {alts.map((alt) => (
            <AlternativeCard
              key={alt.fullName}
              alt={alt}
              onAnalyze={onAnalyzeAlternative}
            />
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-4 text-muted-foreground">
          Alternatives come from the repository&apos;s own owner or organization
          (public repos sorted by relevance), so they share context. Always run
          your own check before switching.
        </p>
      </div>
    </Panel>
  );
}

function AlternativeCard({
  alt,
  onAnalyze,
}: {
  alt: AlternativeRepo;
  onAnalyze: (fullName: string) => void;
}) {
  return (
    <div className="border-2 border-foreground bg-background px-3 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <a
          href={alt.htmlUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-w-0 items-center gap-1 text-sm font-black hover:underline"
        >
          <Mono>{alt.fullName}</Mono>
          <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" />
        </a>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 border-2 border-foreground px-1.5 py-0.5 text-[10px] font-black uppercase",
            alt.healthy ? "bg-health-ok text-black" : "bg-muted text-muted-foreground",
          )}
        >
          {alt.healthy ? "recently active" : "status unverified"}
        </span>
        <span className="ml-auto flex items-center gap-2 font-mono text-xs text-muted-foreground">
          {alt.language && <span>{alt.language}</span>}
          {alt.stars > 0 && <span>★ {fmtCount(alt.stars)}</span>}
        </span>
      </div>
      {alt.description && (
        <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
          {alt.description}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[10px] text-muted-foreground">{alt.reason}</span>
        <button
          type="button"
          onClick={() => onAnalyze(alt.fullName)}
          className="cursor-pointer border-2 border-foreground px-2 py-0.5 text-[11px] font-black transition-colors hover:bg-foreground hover:text-background"
        >
          Analyze →
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notes & methodology
// ---------------------------------------------------------------------------

export function NotesPanel({ analysis }: { analysis: RepoAnalysis }) {
  return (
    <Panel>
      <PanelHeader title="Limitations & Notes" eyebrow="Read before you decide" />
      <ul className="space-y-2 px-4 py-4 text-xs leading-5 text-muted-foreground">
        {analysis.notes.map((note, idx) => (
          <li key={idx} className="flex gap-2">
            <span className="mt-1.5 size-1.5 shrink-0 bg-muted-foreground" />
            {note}
          </li>
        ))}
        {analysis.rate.remaining !== null && (
          <li className="flex gap-2">
            <span className="mt-1.5 size-1.5 shrink-0 bg-muted-foreground" />
            GitHub API budget for this request: {analysis.rate.remaining ?? "?"} of{" "}
            {analysis.rate.limit ?? "?"} remaining
            {analysis.rate.authenticated ? " (authenticated)" : " (unauthenticated — add a GITHUB_TOKEN for a higher budget)"}.
          </li>
        )}
      </ul>
    </Panel>
  );
}


