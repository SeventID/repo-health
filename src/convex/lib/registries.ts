/**
 * Latest-version lookups against the public package registries.
 * Registry endpoints are not rate-limited by GitHub, so dependency freshness
 * checks do not consume the GitHub API budget.
 */

export interface RegistryLookup {
  ok: boolean;
  latest: string | null;
  missing: boolean;
  note: string;
}

const TIMEOUT_MS = 7_000;

async function getJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "RepoPulse/1.0", ...headers },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) return null;
  return response.json();
}

function missingLookup(): RegistryLookup {
  return { ok: true, latest: null, missing: true, note: "not found in its package registry" };
}

function failedLookup(note: string): RegistryLookup {
  return { ok: false, latest: null, missing: false, note };
}

export async function registryLatest(
  ecosystem: string,
  rawName: string,
): Promise<RegistryLookup> {
  const name = rawName.trim();
  if (!name) return failedLookup("empty package name");

  try {
    switch (ecosystem) {
      case "npm": {
        // Scope packages need their "/" URL-encoded on the npm registry.
        const encoded = name.startsWith("@")
          ? name.replace("/", "%2F")
          : name;
        const json = (await getJson(
          `https://registry.npmjs.org/${encoded}/latest`,
        )) as { version?: string } | null;
        if (!json || typeof json.version !== "string") return missingLookup();
        return { ok: true, latest: json.version, missing: false, note: "" };
      }
      case "pypi": {
        const json = (await getJson(
          `https://pypi.org/pypi/${encodeURIComponent(name)}/json`,
        )) as { info?: { version?: string } } | null;
        if (!json?.info || typeof json.info.version !== "string") return missingLookup();
        return { ok: true, latest: json.info.version, missing: false, note: "" };
      }
      case "go": {
        // Go proxy requires uppercase letters escaped as !lowercase.
        const escaped = name.replace(/[A-Z]/g, (m) => `!${m.toLowerCase()}`);
        const json = (await getJson(
          `https://proxy.golang.org/${escaped}/@latest`,
        )) as { Version?: string } | null;
        if (!json || typeof json.Version !== "string") return missingLookup();
        return { ok: true, latest: json.Version, missing: false, note: "" };
      }
      case "cargo": {
        const json = (await getJson(
          `https://crates.io/api/v1/crates/${encodeURIComponent(name)}`,
        )) as { crate?: { max_stable_version?: string } } | null;
        if (!json?.crate || typeof json.crate.max_stable_version !== "string") {
          return missingLookup();
        }
        return { ok: true, latest: json.crate.max_stable_version, missing: false, note: "" };
      }
      case "composer": {
        const parts = name.split("/");
        if (parts.length !== 2) return failedLookup("composer package names use vendor/package");
        const json = (await getJson(
          `https://repo.packagist.org/p2/${parts[0]}/${parts[1]}.json`,
        )) as { packages?: Record<string, { version?: string }[]> } | null;
        const versions = json?.packages?.[name];
        if (!versions || versions.length === 0) return missingLookup();
        const stable = versions.find((v) => v.version && !v.version.includes("-dev") && !v.version.includes("-beta") && !v.version.includes("-rc") && !v.version.includes("-alpha"));
        const picked = stable ?? versions[0];
        if (!picked?.version) return missingLookup();
        return { ok: true, latest: picked.version, missing: false, note: "" };
      }
      case "rubygems": {
        const json = (await getJson(
          `https://rubygems.org/api/v1/gems/${encodeURIComponent(name)}.json`,
        )) as { version?: string } | null;
        if (!json || typeof json.version !== "string") return missingLookup();
        return { ok: true, latest: json.version, missing: false, note: "" };
      }
      case "maven": {
        const parts = name.split(":");
        if (parts.length !== 2) return failedLookup("maven artifacts use groupId:artifactId");
        const json = (await getJson(
          `https://search.maven.org/solrsearch/select?q=${encodeURIComponent(
            `g:"${parts[0]}" AND a:"${parts[1]}"`,
          )}&rows=1&wt=json`,
        )) as { response?: { docs?: { latestVersion?: string }[] } } | null;
        const doc = json?.response?.docs?.[0];
        if (!doc || typeof doc.latestVersion !== "string") return missingLookup();
        return { ok: true, latest: doc.latestVersion, missing: false, note: "" };
      }
      default:
        return failedLookup(`no registry configured for ecosystem "${ecosystem}"`);
    }
  } catch {
    return failedLookup("registry unreachable");
  }
}

/** Run many lookups with limited concurrency. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}
