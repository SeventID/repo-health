const NAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/;
const FULL_RE = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)\/([^/\s#?]+)/i;

export interface ParsedRepo {
  owner: string;
  name: string;
  fullName: string;
}

export function parseRepoUrl(input: string): ParsedRepo | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;

  let owner: string | undefined;
  let name: string | undefined;
  const full = raw.match(FULL_RE);
  if (full) {
    owner = full[1];
    name = full[2];
  } else if (!raw.includes("://") && !raw.includes("github.com")) {
    const bare = raw.match(/^([^/\s]+)\/([^/\s#?]+)/);
    if (bare) {
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

export function repoPath(fullName: string): string {
  return `/repo/${fullName}`;
}
