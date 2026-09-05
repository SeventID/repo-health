/** Pure utilities shared by the analysis pipeline (no node APIs). */

export interface ParsedRepo {
  owner: string;
  name: string;
  fullName: string;
}

const NAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/;
const FULL_RE = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)\/([^/\s#?]+)/i;

/**
 * Parse anything reasonably GitHub-like into an owner/repo pair:
 *  - "https://github.com/facebook/react"
 *  - "github.com/facebook/react"
 *  - "facebook/react"
 * Returns null when the input does not look like a valid public repo.
 */
export function parseRepoUrl(input: string): ParsedRepo | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;

  let owner: string | undefined;
  let name: string | undefined;
  const full = raw.match(FULL_RE);
  if (full) {
    owner = full[1];
    name = full[2];
  } else {
    // Try the bare "owner/name" form (no scheme, no host).
    const bare = raw.match(/^([^/\s]+)\/([^/\s#?]+)/);
    if (bare && !raw.includes("://")) {
      owner = bare[1];
      name = bare[2];
    }
  }

  if (!owner || !name) return null;
  const cleanOwner = owner.replace(/^@/, "").toLowerCase();
  const cleanName = name.replace(/\.git$/i, "").toLowerCase();
  if (!NAME_RE.test(cleanOwner) || !NAME_RE.test(cleanName)) return null;
  return {
    owner: cleanOwner,
    name: cleanName,
    fullName: `${cleanOwner}/${cleanName}`,
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Round to at most 1 decimal and format for display ("72" or "87.5"). */
export function fmtPct(value: number): string {
  const r = Math.round(value * 10) / 10;
  return Number.isInteger(r) ? String(Math.round(r)) : String(r);
}

/** Whole months between two ISO dates (at least 0). */
export function monthsBetweenIso(earlierIso: string | null, laterIso: string | null): number {
  if (!earlierIso || !laterIso) return Number.MAX_SAFE_INTEGER;
  const a = new Date(earlierIso);
  const b = new Date(laterIso);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return Number.MAX_SAFE_INTEGER;
  return monthDiff(a, b);
}

function monthDiff(from: Date, to: Date): number {
  let months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

export function monthKey(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const monthName = MONTHS[(m ?? 1) - 1] ?? "";
  return `${monthName} ${y}`;
}

/** Deterministic 32-bit hash for pseudo-random demo data. */
export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pseudoRandom(seed: number): () => number {
  let state = seed || 1;
  return () => {
    // xorshift32 — good enough for demo shaping
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}

export function semverParts(version: string): number[] {
  // Strip npm-style prefixes (^, ~, >=, =, v…) before tokenizing so the
  // leading caret/tilde does not corrupt the major/minor/patch split.
  const cleaned = (version ?? "")
    .trim()
    .replace(/^[vV]/, "")
    .replace(/^[^\d]*/, "");
  const parts = cleaned.split(/[.\-+_]/);
  const nums: number[] = [];
  for (const part of parts) {
    const n = Number(part);
    if (!isNaN(n) && part !== "") nums.push(n);
    if (nums.length >= 3) break;
  }
  return nums.length ? nums : [0];
}

/** 0 same-major family, 1 minor/patch behind, 2 major behind, -1 uncomparable */
export function versionGap(current: string, latest: string): -1 | 0 | 1 | 2 {
  const c = semverParts(current);
  const l = semverParts(latest);
  if (c.length === 0 || l.length === 0) return -1;
  if (c[0] === 0 && l[0] === 0) {
    // Pre-1.0: treat any bump in the first non-zero position as major-ish risk
    for (let i = 0; i < Math.max(c.length, l.length); i++) {
      const cv = c[i] ?? 0;
      const lv = l[i] ?? 0;
      if (lv > cv) return l[0] !== c[0] ? 1 : i === 0 ? 2 : 1;
      if (lv < cv) return 0;
    }
    return 0;
  }
  if (l[0] > c[0]) return 2;
  if (l[0] < c[0]) return 0;
  if (l.length === 1 && c.length === 1) return 0;
  if (l[1] > c[1] || (l[1] === c[1] && (l[2] ?? 0) > (c[2] ?? 0))) return 1;
  return 0;
}
