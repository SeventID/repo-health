import type { RepoAnalysis } from "@/convex/types";
import { daysBetween, fmtCount, fmtInt, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ArrowUpRight, CalendarDays, GitFork, Globe, Scale, Star } from "lucide-react";
import { AvatarBlock, Mono } from "./bits";

export function RepoHeader({ analysis }: { analysis: RepoAnalysis }) {
  const repo = analysis.repo;
  const stalePush = daysBetween(repo.pushedAt) > 180;

  return (
    <section className="border-2 border-foreground bg-card">
      <div className="px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <AvatarBlock name={repo.fullName} src={repo.avatarUrl} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={repo.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="group inline-flex items-center gap-1.5"
              >
                <Mono className="text-xl font-black tracking-tight sm:text-2xl">
                  {repo.owner}
                  <span className="text-muted-foreground">/</span>
                  {repo.name}
                </Mono>
                <ArrowUpRight className="size-4 text-muted-foreground transition-colors group-hover:text-foreground" />
              </a>
              <span className="brutal-chip bg-muted text-muted-foreground">
                {repo.visibility ?? "public"}
              </span>
              {repo.isFork && <span className="brutal-chip bg-muted text-muted-foreground">fork</span>}
              {repo.archived && (
                <span className="brutal-chip bg-health-stale text-black">archived</span>
              )}
            </div>

            {repo.description && (
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                {repo.description}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5">
              {repo.language && (
                <span className="brutal-chip bg-card text-foreground">
                  <span className="size-2 rounded-full bg-health-ok" />
                  {repo.language}
                </span>
              )}
              {repo.license && (
                <span className="brutal-chip bg-card text-foreground">
                  <Scale className="size-3" />
                  {repo.license}
                </span>
              )}
              {repo.topics.slice(0, 4).map((topic) => (
                <span key={topic} className="border-2 border-foreground bg-card px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  {topic}
                </span>
              ))}
              {stalePush && repo.pushedAt && (
                <span className="text-[11px] font-bold text-health-stale">
                  ⚠ last push {timeAgo(repo.pushedAt)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-px border-2 border-foreground bg-foreground sm:grid-cols-4">
          <HeaderStat
            icon={<Star className="size-3.5" />}
            value={fmtCount(repo.stars)}
            label="stars"
            accent
          />
          <HeaderStat
            icon={<GitFork className="size-3.5" />}
            value={fmtCount(repo.forks)}
            label="forks"
          />
          <HeaderStat
            icon={<span className="text-[13px]">🐛</span>}
            value={fmtCount(repo.openIssues)}
            label="open issues + PRs"
          />
          <HeaderStat
            icon={<CalendarDays className="size-3.5" />}
            value={timeAgo(repo.pushedAt)}
            label="last push"
            labelClass="uppercase"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] text-muted-foreground">
          <span>
            created <strong className="font-bold text-foreground/90">{timeAgo(repo.createdAt)}</strong>
          </span>
          <span>
            default branch{" "}
            <Mono className="text-[11px] font-bold text-foreground/90">{repo.defaultBranch ?? "—"}</Mono>
          </span>
          <span>{fmtInt(repo.watchers)} watching</span>
          {repo.homepage && (
            <a
              href={repo.homepage}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-bold underline underline-offset-2 hover:text-foreground"
            >
              <Globe className="size-3" /> homepage
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

function HeaderStat({
  icon,
  value,
  label,
  accent = false,
  labelClass,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  accent?: boolean;
  labelClass?: string;
}) {
  return (
    <div className="flex items-center gap-2 bg-card px-3 py-2.5">
      <span className="text-muted-foreground">{icon}</span>
      <span
        className={cn(
          "text-base font-black tabular-nums leading-none",
          accent && "text-foreground",
        )}
      >
        {value}
      </span>
      <span className={cn("truncate text-[10px] font-semibold text-muted-foreground", labelClass)}>
        {label}
      </span>
    </div>
  );
}
