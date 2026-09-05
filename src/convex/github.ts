/**
 * Minimal, typed GitHub REST API client used by the analyze action.
 * All requests go through the server (Convex "use node" action), so no token
 * is ever exposed to the browser.
 */
import type {
  RateInfo,
  RawAlternative,
  RawCommit,
  RawContributor,
  RawRelease,
  RawRepo,
} from "./types";

export class GitHubError extends Error {
  code: "not-found" | "rate-limited" | "forbidden" | "network" | "empty";
  status: number | null;
  detail?: string;

  constructor(
    code: GitHubError["code"],
    message: string,
    status: number | null = null,
    detail?: string,
  ) {
    super(message);
    this.name = "GitHubError";
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

const API = "https://api.github.com";
const REQUEST_TIMEOUT_MS = 12_000;
const USER_AGENT = "RepoPulse/1.0 (repository health analyzer)";

interface FetchResult {
  json: unknown;
  rate: RateInfo;
  ok: boolean;
  status: number;
}

async function request(
  path: string,
  token: string | undefined,
  acceptRaw = false,
): Promise<FetchResult> {
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, {
      headers: {
        Accept: acceptRaw
          ? "application/vnd.github.raw+json"
          : "application/vnd.github+json",
        "User-Agent": USER_AGENT,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut =
      err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    throw new GitHubError(
      "network",
      timedOut
        ? "The GitHub API request timed out."
        : "Could not reach the GitHub API. Check your network connection and try again.",
      null,
      err instanceof Error ? err.message : undefined,
    );
  }

  const remainingRaw = response.headers.get("x-ratelimit-remaining");
  const limitRaw = response.headers.get("x-ratelimit-limit");
  const rate: RateInfo = {
    remaining: remainingRaw ? Number(remainingRaw) : null,
    limit: limitRaw ? Number(limitRaw) : null,
    authenticated: Boolean(token),
  };

  if (!response.ok) {
    let bodyText = "";
    try {
      bodyText = await response.text();
    } catch {
      bodyText = "";
    }
    const message = extractMessage(bodyText);
    if (response.status === 403) {
      const isRate = /rate limit/i.test(message) || rate.remaining === 0;
      throw new GitHubError(
        isRate ? "rate-limited" : "forbidden",
        isRate
          ? "GitHub API rate limit reached. Add a GITHUB_TOKEN in your project keys and re-run the analysis."
          : "GitHub rejected this request (403). The repository may be blocked or the token may be invalid.",
        response.status,
        bodyText.slice(0, 500) || undefined,
      );
    }
    if (response.status === 404 || response.status === 410) {
      throw new GitHubError(
        "not-found",
        "We couldn't find this repository. It may be private, deleted, renamed, or the URL may be wrong.",
        response.status,
      );
    }
    if (response.status === 401) {
      throw new GitHubError(
        "forbidden",
        "GitHub authentication failed. Check that the configured GITHUB_TOKEN is valid.",
        response.status,
      );
    }
    if (response.status === 451) {
      throw new GitHubError(
        "forbidden",
        "GitHub is unable to display this repository for legal reasons.",
        response.status,
      );
    }
    throw new GitHubError(
      "forbidden",
      `GitHub returned an unexpected error (HTTP ${response.status}).`,
      response.status,
    );
  }

  const text = await response.text();
  let json: unknown;
  if (acceptRaw) {
    json = text;
  } else {
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
  }
  return { json, rate, ok: true, status: response.status };
}

function extractMessage(bodyText: string): string {
  try {
    const parsed = JSON.parse(bodyText);
    if (parsed && typeof parsed.message === "string") return parsed.message;
  } catch {
    /* not JSON */
  }
  return bodyText.slice(0, 300);
}

export async function fetchRepoMeta(
  owner: string,
  name: string,
  token: string | undefined,
): Promise<{ repo: RawRepo; rate: RateInfo }> {
  const res = await request(`/repos/${owner}/${name}`, token);
  const r = res.json as Record<string, any>;
  const repo: RawRepo = {
    fullName: String(r.full_name ?? `${owner}/${name}`),
    description: typeof r.description === "string" ? r.description : null,
    avatarUrl: r.owner?.avatar_url ?? null,
    htmlUrl: String(r.html_url ?? `https://github.com/${owner}/${name}`),
    homepage: typeof r.homepage === "string" && r.homepage ? r.homepage : null,
    language: typeof r.language === "string" ? r.language : null,
    stars: Number(r.stargazers_count ?? 0),
    forks: Number(r.forks_count ?? 0),
    openIssues: Number(r.open_issues_count ?? 0),
    watchers: Number(r.watchers_count ?? r.subscribers_count ?? 0),
    createdAt: typeof r.created_at === "string" ? r.created_at : null,
    updatedAt: typeof r.updated_at === "string" ? r.updated_at : null,
    pushedAt: typeof r.pushed_at === "string" ? r.pushed_at : null,
    archived: Boolean(r.archived),
    disabled: Boolean(r.disabled),
    isFork: Boolean(r.fork),
    visibility:
      typeof r.visibility === "string"
        ? r.visibility
        : (r.private ? "private" : "public"),
    topics: Array.isArray(r.topics) ? r.topics.filter((t) => typeof t === "string") : [],
    license: typeof r.license?.spdx_id === "string" ? r.license.spdx_id : null,
    defaultBranch: typeof r.default_branch === "string" ? r.default_branch : null,
    ownerType: typeof r.owner?.type === "string" ? r.owner.type : null,
    sizeKb: Number(r.size ?? 0),
  };
  return { repo, rate: res.rate };
}

export async function fetchCommits(
  owner: string,
  name: string,
  token: string | undefined,
): Promise<RawCommit[]> {
  const res = await request(
    `/repos/${owner}/${name}/commits?per_page=100`,
    token,
  );
  const list = Array.isArray(res.json) ? (res.json as any[]) : [];
  return list
    .filter((c) => c && c.sha && c.commit)
    .map((c) => ({
      sha: String(c.sha),
      message: String(c.commit.message ?? ""),
      authorName:
        typeof c.commit.author?.name === "string" ? c.commit.author.name : null,
      authorLogin:
        typeof c.author?.login === "string"
          ? c.author.login
          : typeof c.committer?.login === "string"
            ? c.committer.login
            : null,
      date:
        typeof c.commit.author?.date === "string"
          ? c.commit.author.date
          : typeof c.commit.committer?.date === "string"
            ? c.commit.committer.date
            : null,
    }));
}

export async function fetchContributors(
  owner: string,
  name: string,
  token: string | undefined,
): Promise<RawContributor[]> {
  const res = await request(
    `/repos/${owner}/${name}/contributors?per_page=30`,
    token,
  );
  const list = Array.isArray(res.json) ? (res.json as any[]) : [];
  return list
    .filter((c) => c && c.login)
    .map((c) => ({
      login: String(c.login),
      avatarUrl: typeof c.avatar_url === "string" ? c.avatar_url : null,
      contributions: Number(c.contributions ?? 0),
    }));
}

export async function fetchReleases(
  owner: string,
  name: string,
  token: string | undefined,
): Promise<RawRelease[]> {
  const res = await request(
    `/repos/${owner}/${name}/releases?per_page=30`,
    token,
  );
  const list = Array.isArray(res.json) ? (res.json as any[]) : [];
  return list
    .filter((r) => r && r.tag_name && !r.draft)
    .map((r) => ({
      tagName: String(r.tag_name),
      name: typeof r.name === "string" && r.name ? r.name : null,
      publishedAt:
        typeof r.published_at === "string"
          ? r.published_at
          : typeof r.created_at === "string"
            ? r.created_at
            : null,
      prerelease: Boolean(r.prerelease),
      draft: Boolean(r.draft),
      htmlUrl: typeof r.html_url === "string" ? r.html_url : "",
    }));
}

/** Raw content of the README (first 120KB), or null when there is none. */
export async function fetchReadme(
  owner: string,
  name: string,
  token: string | undefined,
): Promise<string | null> {
  try {
    const res = await request(`/repos/${owner}/${name}/readme`, token, true);
    return typeof res.json === "string" ? res.json.slice(0, 120_000) : null;
  } catch (err) {
    if (err instanceof GitHubError && err.code === "not-found") return null;
    throw err;
  }
}

/**
 * Raw content of a single file path. Returns null on 404 (file does not
 * exist); other failures throw.
 */
export async function fetchFile(
  owner: string,
  name: string,
  path: string,
  token: string | undefined,
): Promise<string | null> {
  const segments = path.split("/").map(encodeURIComponent).join("/");
  try {
    const res = await request(
      `/repos/${owner}/${name}/contents/${segments}`,
      token,
      true,
    );
    return typeof res.json === "string" ? res.json.slice(0, 300_000) : null;
  } catch (err) {
    if (err instanceof GitHubError && err.code === "not-found") return null;
    throw err;
  }
}

/**
 * Candidate repositories from the same owner (user or org) sorted by stars —
 * the basis for the "recommended alternatives" panel when the GitHub search
 * API is not available.
 */
export async function fetchOwnerRepos(
  owner: string,
  ownerType: string | null,
  token: string | undefined,
): Promise<RawAlternative[]> {
  const path =
    ownerType === "Organization"
      ? `/orgs/${owner}/repos?sort=stars&per_page=30&type=public`
      : `/users/${owner}/repos?sort=stars&per_page=30`;
  const res = await request(path, token);
  const list = Array.isArray(res.json) ? (res.json as any[]) : [];
  return list
    .filter((r) => r && r.full_name && !r.fork && !r.disabled)
    .map((r) => ({
      fullName: String(r.full_name),
      description: typeof r.description === "string" ? r.description : null,
      language: typeof r.language === "string" ? r.language : null,
      stars: Number(r.stargazers_count ?? 0),
      htmlUrl: typeof r.html_url === "string" ? r.html_url : "",
      pushedAt: typeof r.pushed_at === "string" ? r.pushed_at : null,
    }));
}

/** One-off direct fetch for plain GitHub HTML (non-API, no token). */
export async function fetchGitHubWeb(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    return (await response.text()).slice(0, 60_000);
  } catch {
    return null;
  }
}
