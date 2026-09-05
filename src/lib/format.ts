export function fmtCount(n: number | undefined | null): string {
  const value = n ?? 0;
  if (value >= 1_000_000) {
    const v = value / 1_000_000;
    return `${v >= 10 ? Math.round(v) : Math.round(v * 10) / 10}M`;
  }
  if (value >= 1_000) {
    const v = value / 1_000;
    return `${v >= 10 ? Math.round(v) : Math.round(v * 10) / 10}K`;
  }
  return String(value);
}

export function fmtInt(n: number | undefined | null): string {
  return (n ?? 0).toLocaleString("en-US");
}

export function timeAgo(iso: string | number | null | undefined): string {
  if (!iso) return "never";
  const t = typeof iso === "number" ? iso : new Date(iso).getTime();
  if (isNaN(t)) return "unknown";
  const diff = Date.now() - t;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return years === 1 ? "1y ago" : `${years}y ago`;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "September 2026" */
export function monthYear(iso: string | number | null | undefined): string {
  if (!iso) return "";
  const t = typeof iso === "number" ? iso : new Date(iso).getTime();
  if (isNaN(t)) return "";
  const d = new Date(t);
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "Sep 2, 2026" */
export function shortDate(iso: string | number | null | undefined): string {
  if (!iso) return "";
  const t = typeof iso === "number" ? iso : new Date(iso).getTime();
  if (isNaN(t)) return "";
  const d = new Date(t);
  const m = MONTH_NAMES[d.getUTCMonth()].slice(0, 3);
  return `${m} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function daysBetween(iso: string | null): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000)));
}

export function repoDisplayName(fullName: string): string {
  return fullName.split("/").pop() ?? fullName;
}
