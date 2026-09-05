/**
 * Dependency freshness.
 *
 * Detects the repository's package manifest(s), parses direct dependencies,
 * resolves "latest" from the public registry of each ecosystem, and classifies
 * every dependency as up-to-date / update recommended / major version behind /
 * missing.
 */
import type {
  DepRow,
  DepsResult,
  DepSpec,
  DepStatus,
  ManifestFile,
} from "../types";
import { mapWithConcurrency, registryLatest } from "./registries";
import { semverParts } from "./util";

interface Candidate {
  path: string;
  ecosystem: string;
  language: string;
}

const JAVASCRIPTY = new Set([
  "JavaScript",
  "TypeScript",
  "JSX",
  "TSX",
  "Vue",
  "Svelte",
  "CoffeeScript",
]);

export function manifestCandidates(primaryLanguage: string | null): Candidate[] {
  const lang = primaryLanguage ?? "";
  if (JAVASCRIPTY.has(lang) || lang === "") {
    return [{ path: "package.json", ecosystem: "npm", language: "JavaScript" }];
  }
  if (lang === "Python") {
    return [
      { path: "pyproject.toml", ecosystem: "pypi", language: "Python" },
      { path: "requirements.txt", ecosystem: "pypi", language: "Python" },
    ];
  }
  if (lang === "Rust") {
    return [{ path: "Cargo.toml", ecosystem: "cargo", language: "Rust" }];
  }
  if (lang === "Go") {
    return [{ path: "go.mod", ecosystem: "go", language: "Go" }];
  }
  if (lang === "PHP") {
    return [{ path: "composer.json", ecosystem: "composer", language: "PHP" }];
  }
  if (lang === "Ruby") {
    return [{ path: "Gemfile", ecosystem: "rubygems", language: "Ruby" }];
  }
  if (lang === "Java" || lang === "Kotlin" || lang === "Groovy") {
    return [{ path: "pom.xml", ecosystem: "maven", language: "Java" }];
  }
  return [];
}

/** Parse name/current pairs out of a manifest. Never throws. */
export function parseManifest(ecosystem: string, content: string): DepSpec[] {
  try {
    switch (ecosystem) {
      case "npm":
        return parseJsonDeps(content, ["dependencies", "devDependencies"], "");
      case "composer": {
        const specs = parseJsonDeps(content, ["require"], "");
        return specs.filter(
          (s) =>
            !s.name.startsWith("php") &&
            !s.name.startsWith("ext-") &&
            !s.name.startsWith("lib-"),
        );
      }
      case "pypi":
        return content.includes("[project]")
          ? parsePyproject(content)
          : parseRequirements(content);
      case "cargo":
        return parseCargo(content);
      case "go":
        return parseGoMod(content);
      case "rubygems":
        return parseGemfile(content);
      case "maven":
        return parsePom(content);
      default:
        return [];
    }
  } catch {
    return [];
  }
}

function parseJsonDeps(
  content: string,
  sections: string[],
  prefix: string,
): DepSpec[] {
  const parsed = JSON.parse(content);
  if (!parsed || typeof parsed !== "object") return [];
  const out: DepSpec[] = [];
  const seen = new Set<string>();
  for (const section of sections) {
    const group = parsed[section];
    if (!group || typeof group !== "object") continue;
    for (const [rawName, rawVersion] of Object.entries(group)) {
      const name = prefix + rawName;
      if (seen.has(name)) continue;
      seen.add(name);
      if (typeof rawVersion === "string" && rawVersion !== "*") {
        out.push({ name, current: rawVersion });
      }
    }
  }
  return out;
}

function parseRequirements(content: string): DepSpec[] {
  const out: DepSpec[] = [];
  const seen = new Set<string>();
  for (const rawLine of content.split("\n")) {
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;
    if (/^(-r|-e|-c|--)/.test(line)) continue;
    const m = line.match(/^([A-Za-z0-9][A-Za-z0-9._-]*)(.*)$/);
    if (!m) continue;
    const name = m[1];
    if (seen.has(name)) continue;
    seen.add(name);
    const versionPart = (m[2] ?? "").trim();
    out.push({ name, current: versionPart || "any" });
  }
  return out;
}

function parsePyproject(content: string): DepSpec[] {
  const specs: DepSpec[] = [];
  const seen = new Set<string>();
  // [project] dependencies and optional-dependencies blocks
  const blocks = [...content.matchAll(/\[project\]([^\[]*)/g)];
  for (const block of blocks) {
    const body = block[1] ?? "";
    const entries = [...body.matchAll(/(?:dependencies|optional-dependencies)\s*=\s*\[([^\]]*)\]/gs)];
    for (const entry of entries) {
      const itemRe = /["']([^"']+)["']/g;
      let itemMatch: RegExpExecArray | null;
      while ((itemMatch = itemRe.exec(entry[1] ?? ""))) {
        const dep = itemMatch[1].split(";")[0].trim();
        const m = dep.match(/^([A-Za-z0-9][A-Za-z0-9._-]*)(.*)$/);
        if (!m) continue;
        if (seen.has(m[1])) continue;
        seen.add(m[1]);
        specs.push({ name: m[1], current: m[2].trim() || "any" });
      }
    }
  }
  // Fallback for poetry-style projects.
  const poetry = [...content.matchAll(/\[tool\.poetry\.dependencies\]([^\[]*)/g)];
  for (const block of poetry) {
    const body = block[1] ?? "";
    for (const line of body.split("\n")) {
      const m = line.match(/^\s*([A-Za-z0-9][A-Za-z0-9._-]*)\s*=\s*["'](.*?)["']/);
      if (!m || m[1] === "python") continue;
      if (seen.has(m[1])) continue;
      seen.add(m[1]);
      specs.push({ name: m[1], current: m[2] });
    }
  }
  return specs;
}

function parseCargo(content: string): DepSpec[] {
  const specs: DepSpec[] = [];
  const seen = new Set<string>();
  let inDeps = false;
  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("[")) {
      inDeps = /^\[dependencies\]$/.test(line);
      continue;
    }
    if (!inDeps || !line || line.startsWith("#")) continue;
    const m = line.match(/^([\w-]+)\s*=\s*(.+)$/);
    if (!m) continue;
    if (seen.has(m[1])) continue;
    seen.add(m[1]);
    let version = m[2].trim().replace(/,$/, "");
    if (version.startsWith("{")) {
      const vm = version.match(/version\s*=\s*["']([^"']*)["']/);
      version = vm ? vm[1] : version;
    } else {
      version = version.replace(/^["']|["']$/g, "");
    }
    specs.push({ name: m[1], current: version || "any" });
  }
  return specs;
}

function parseGoMod(content: string): DepSpec[] {
  const specs: DepSpec[] = [];
  const seen = new Set<string>();
  const compact = content.replace(/\/\/.*$/gm, "");
  const inline = [...compact.matchAll(/^\s*require\s+([^\s(]+)\s+(v?[\w.+-]+)/gm)];
  for (const m of inline) {
    if (seen.has(m[1])) continue;
    seen.add(m[1]);
    specs.push({ name: m[1], current: m[2] });
  }
  // Block form:
  const blocks = [...compact.matchAll(/require\s*\(([^)]*)\)/g)];
  for (const block of blocks) {
    const lines = [...(block[1] ?? "").matchAll(/^\s*([^\s]+)\s+(v?[\w.+-]+)/gm)];
    for (const m of lines) {
      if (seen.has(m[1])) continue;
      seen.add(m[1]);
      specs.push({ name: m[1], current: m[2] });
    }
  }
  return specs;
}

function parseGemfile(content: string): DepSpec[] {
  const specs: DepSpec[] = [];
  const seen = new Set<string>();
  for (const raw of content.split("\n")) {
    const m = raw.match(/^\s*gem\s+["']([\w-]+)["']/);
    if (!m) continue;
    const verM = raw.match(/,\s*["']([\^~>=<][^"']*)["']/);
    if (seen.has(m[1])) continue;
    seen.add(m[1]);
    specs.push({ name: m[1], current: verM ? verM[1] : "any" });
  }
  return specs;
}

function parsePom(content: string): DepSpec[] {
  const specs: DepSpec[] = [];
  const seen = new Set<string>();
  const deps = [...content.matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)];
  for (const dep of deps) {
    const body = dep[1] ?? "";
    const g = body.match(/<groupId>(.*?)<\/groupId>/);
    const a = body.match(/<artifactId>(.*?)<\/artifactId>/);
    const v = body.match(/<version>(.*?)<\/version>/);
    if (!g || !a || !v) continue;
    const name = `${g[1].trim()}:${a[1].trim()}`;
    if (seen.has(name)) continue;
    seen.add(name);
    specs.push({ name, current: v[1].trim() });
  }
  return specs;
}

// ---------------------------------------------------------------------------
// Freshness classification
// ---------------------------------------------------------------------------

function family(version: string): number {
  const nums = semverParts(version);
  return nums.length ? nums[0] : -1;
}

function isRangeStyle(current: string): boolean {
  return /^[\^~><= ]/.test(current.trim());
}

function classifyRow(name: string, current: string, latest: string | null): DepRow {
  const display = current === "any" ? "unpinned" : current;
  if (!latest) {
    return {
      name,
      current: display,
      latest: null,
      status: "missing",
      note: "Package not found in its registry — it may have been unpublished, renamed or moved.",
    };
  }
  if (display === "unpinned") {
    return {
      name,
      current: display,
      latest,
      status: "up-to-date",
      note: "Unpinned — installation pulls the latest matching release.",
    };
  }
  if (isRangeStyle(current)) {
    const trimmed = current.trim();
    if (trimmed.startsWith(">")) {
      return {
        name,
        current: display,
        latest,
        status: "up-to-date",
        note: "Lower-bound constraint — the latest release satisfies it.",
      };
    }
    if (trimmed.startsWith("<")) {
      return {
        name,
        current: display,
        latest,
        status: "unknown",
        note: "Upper-bounded constraint — cannot tell which release you would get.",
      };
    }
    const curMajor = family(current);
    const latestMajor = family(latest);
    if (curMajor < 0 || latestMajor < 0) {
      return { name, current: display, latest, status: "unknown", note: "Version format could not be compared." };
    }
    if (latestMajor > curMajor) {
      return {
        name,
        current: display,
        latest,
        status: "major",
        note: `Major version behind (latest ${latestMajor}.x) — a caret/tilde range will NOT auto-update across majors.`,
      };
    }
    return {
      name,
      current: display,
      latest,
      status: "up-to-date",
      note: `${display.startsWith("^") ? "Caret" : display.startsWith("~") ? "Tilde" : "Declared"} range is compatible with the latest release.`,
    };
  }
  const c = semverParts(current);
  const l = semverParts(latest);
  if (c.length === 0 || l.length === 0) {
    return { name, current: display, latest, status: "unknown", note: "Version format could not be compared." };
  }
  if (l[0] > c[0]) {
    return {
      name,
      current: display,
      latest,
      status: "major",
      note: `Latest is ${latestMajor(latest)}.x — a major bump that may contain breaking changes.`,
    };
  }
  const minorGap = (l[1] ?? 0) - (c[1] ?? 0);
  const patchGap = (l[2] ?? 0) - (c[2] ?? 0);
  if (minorGap > 0 || patchGap > 0) {
    return {
      name,
      current: display,
      latest,
      status: "update",
      note: "A newer patch/minor release is available — update recommended.",
    };
  }
  return { name, current: display, latest, status: "up-to-date", note: "Pinned version matches the latest release." };
}

function latestMajor(version: string): string {
  const nums = semverParts(version);
  return String(nums.length ? nums[0] : version);
}

export interface ManifestInput {
  manifests: ManifestFile[];
  parsedDeps: { ecosystem: string; specs: DepSpec[] }[];
  primaryLanguage: string | null;
}

/** Which manifest to display when several exist. */
function primaryManifest(input: ManifestInput): ManifestFile | null {
  return input.manifests[0] ?? null;
}

export async function buildDepsResult(
  input: ManifestInput,
  repoCreatedIso: string | null,
): Promise<DepsResult> {
  const primary = primaryManifest(input);
  if (!primary) {
    return {
      manifest: null,
      ecosystem: null,
      language: null,
      registryChecked: false,
      rows: [],
      outdatedCount: 0,
      deprecatedCount: 0,
      note: "No package manifest detected (package.json, requirements.txt, go.mod, Cargo.toml, composer.json, pyproject.toml, pom.xml…).",
    };
  }

  const specs = input.parsedDeps.find((d) => d.ecosystem === primary.ecosystem)?.specs ?? [];
  const capped = specs.slice(0, 40);

  if (capped.length === 0) {
    return {
      manifest: primary.path,
      ecosystem: primary.ecosystem,
      language: primary.language,
      registryChecked: false,
      rows: [],
      outdatedCount: 0,
      deprecatedCount: 0,
      note: `Detected ${primary.path} but no direct dependencies could be parsed from it.`,
    };
  }

  // Resolve latest for up to 18 deps (direct deps first), with concurrency 6.
  const toCheck = capped.slice(0, 18);
  const lookups = await mapWithConcurrency(toCheck, 6, async (spec) => {
    try {
      return await registryLatest(primary.ecosystem, spec.name);
    } catch {
      return { ok: false, latest: null, missing: false, note: "registry unreachable" };
    }
  });

  const anyResolved = lookups.some((l) => l.ok && !l.missing);
  const rows: DepRow[] = toCheck.map((spec, i) => {
    const lookup = lookups[i];
    if (!lookup.ok || lookup.latest === null) {
      return {
        name: spec.name,
        current: spec.current === "any" ? "unpinned" : spec.current,
        latest: null,
        status: (lookup.missing ? "missing" : "unknown") as DepStatus,
        note: lookup.note,
      };
    }
    return classifyRow(spec.name, spec.current, lookup.latest);
  });

  // If more than 18 deps, add the remainder with unknown status.
  for (const spec of capped.slice(18)) {
    rows.push({
      name: spec.name,
      current: spec.current === "any" ? "unpinned" : spec.current,
      latest: null,
      status: "unknown",
      note: "Not checked against the registry (analysis capped at 18 packages).",
    });
  }

  const counted = rows.filter((r) => r.status !== "unknown");
  const outdated =
    rows.filter((r) => r.status === "update" || r.status === "major").length;
  const deprecated = rows.filter((r) => r.status === "missing").length;

  let note: string;
  if (!anyResolved) {
    note = `Detected ${primary.path}. Live version checks against the ${primary.ecosystem} registry failed — dependency freshness could not be verified, so this category is scored conservatively.`;
  } else if (outdated === 0 && deprecated === 0) {
    note = `All ${counted.length} checked dependencies are within reach of their latest releases.`;
  } else {
    const parts: string[] = [];
    if (outdated > 0) parts.push(`${outdated} of ${counted.length || rows.length} dependencies are behind their latest release`);
    if (deprecated > 0) parts.push(`${deprecated} package${deprecated === 1 ? "" : "s"} could not be found in the registry`);
    note = `${parts.join(", ")}.`;
  }

  void repoCreatedIso; // kept for future "repo older than deps" heuristics

  return {
    manifest: primary.path,
    ecosystem: primary.ecosystem,
    language: primary.language,
    registryChecked: anyResolved,
    rows,
    outdatedCount: outdated,
    deprecatedCount: deprecated,
    note,
  };
}
