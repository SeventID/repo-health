import { STATUS_CHIP } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { DepStatus, RepoStatus } from "@/convex/types";
import type { ReactNode } from "react";

/** Squared colored chip for a repo status */
export function StatusChip({
  status,
  label,
  className,
}: {
  status: RepoStatus;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border-2 border-foreground px-2 py-0.5 text-xs font-black uppercase tracking-wide",
        STATUS_CHIP[status],
        className,
      )}
    >
      {status === "active" ? "🟢" : status === "maintenance" ? "🟡" : status === "stale" ? "🟠" : "🔴"}
      {label}
    </span>
  );
}

const DEP_STATUS: Record<DepStatus, { label: string; cls: string }> = {
  "up-to-date": { label: "Up to date", cls: "bg-health-ok text-black" },
  update: { label: "Update recommended", cls: "bg-health-warn text-black" },
  major: { label: "Major version behind", cls: "bg-health-stale text-black" },
  missing: { label: "Not found in registry", cls: "bg-health-risk text-white" },
  unknown: { label: "Unknown", cls: "bg-muted text-muted-foreground" },
};

export function DepStatusChip({ status }: { status: DepStatus }) {
  const meta = DEP_STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center border-2 border-foreground px-1.5 py-0.5 text-[11px] font-bold",
        meta.cls,
      )}
    >
      {meta.label}
    </span>
  );
}

export function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-2 border-foreground bg-card", className)}>
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  eyebrow,
  action,
  className,
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex items-start justify-between gap-3 border-b-2 border-foreground px-4 py-3",
        className,
      )}
    >
      <div>
        <p className="brutal-label">{eyebrow ?? "RepoPulse analysis"}</p>
        <h2 className="mt-0.5 text-lg font-black tracking-tight">{title}</h2>
      </div>
      {action}
    </header>
  );
}

export function Stat({
  label,
  value,
  icon,
  hint,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline gap-2">
      {icon && <span className="shrink-0 text-sm leading-none">{icon}</span>}
      <span className="font-black tabular-nums">{value}</span>
      <span className="truncate text-xs text-muted-foreground" title={hint}>
        {label}
      </span>
    </div>
  );
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <code className={cn("font-mono text-[13px] leading-snug", className)}>
      {children}
    </code>
  );
}

export function AvatarBlock({
  name,
  src,
  size = "md",
}: {
  name: string;
  src: string | null | undefined;
  size?: "sm" | "md" | "lg";
}) {
  const dim = size === "lg" ? "size-16" : size === "sm" ? "size-7 text-[10px]" : "size-10 text-sm";
  return src ? (
    <img
      src={src}
      alt={name}
      loading="lazy"
      className={cn(
        "shrink-0 border-2 border-foreground bg-muted object-cover",
        dim,
      )}
    />
  ) : (
    <span
      className={cn(
        "grid shrink-0 place-items-center border-2 border-foreground bg-foreground font-black text-background",
        dim,
      )}
    >
      {(name ?? "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Color-coded square used in the activity legend */
export function Swatch({ kind }: { kind: "dev" | "maint" | "docs" | "minor" | "neutral" }) {
  const cls =
    kind === "dev"
      ? "bg-health-ok"
      : kind === "maint"
        ? "bg-health-warn"
        : kind === "docs"
          ? "bg-chart-3"
          : kind === "minor"
            ? "bg-muted-foreground"
            : "bg-muted";
  return <span className={cn("inline-block size-3 border border-foreground/40", cls)} aria-hidden="true" />;
}

export function StatusDot({ tone }: { tone: "ok" | "warn" | "stale" | "risk" | "neutral" }) {
  const cls =
    tone === "ok"
      ? "bg-health-ok"
      : tone === "warn"
        ? "bg-health-warn"
        : tone === "stale"
          ? "bg-health-stale"
          : tone === "risk"
            ? "bg-health-risk"
            : "bg-muted-foreground";
  return <span className={cn("inline-block size-2.5 border border-foreground/30", cls)} aria-hidden="true" />;
}
