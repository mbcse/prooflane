export type BranchProtectionInfo = {
  enabled: boolean;
  allowsForcePushes: boolean;
  allowsDeletions: boolean;
  requiredReviewCount: number;
  requiredStatusChecks: string[];
  enforceAdmins: boolean;
  raw?: unknown;
};

export type CodeownersResult = {
  exists: boolean;
  contentSnippet?: string;
};

export type SecretScanResult = {
  filesScanned: number;
  findings: { path: string; pattern: string }[];
}

const SECRET_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "aws_access_key", re: /AKIA[0-9A-Z]{16}/ },
  { name: "generic_api_key", re: /(?:api[_-]?key|apikey)\s*[=:]\s*['"]?[a-zA-Z0-9_\-]{20,}/i },
  { name: "private_key_block", re: /-----BEGIN [A-Z ]+PRIVATE KEY-----/ },
  { name: "openai_sk", re: /sk-[a-zA-Z0-9]{20,}/ },
];

const TEXT_EXTENSIONS = new Set([
  ".md",
  ".txt",
  ".json",
  ".yml",
  ".yaml",
  ".env",
  ".example",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".py",
  ".toml",
  ".sh",
]);

function ghHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export async function fetchBranchProtection(
  token: string,
  owner: string,
  repo: string,
  branch: string,
): Promise<BranchProtectionInfo> {
  const url = `https://api.github.com/repos/${owner}/${repo}/branches/${branch}/protection`;
  const res = await fetch(url, { headers: ghHeaders(token) });
  if (res.status === 404) {
    return {
      enabled: false,
      allowsForcePushes: true,
      allowsDeletions: true,
      requiredReviewCount: 0,
      requiredStatusChecks: [],
      enforceAdmins: false,
      raw: null,
    };
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GitHub branch protection: ${res.status} ${t}`);
  }
  const data = (await res.json()) as Record<string, unknown>;
  const prReviews = data.required_pull_request_reviews as
    | { required_approving_review_count?: number }
    | undefined;
  const statusCheck = data.required_status_checks as
    | { contexts?: string[]; checks?: { context?: string }[] }
    | undefined;
  const contexts =
    statusCheck?.contexts ??
    (statusCheck?.checks?.map((c) => c.context).filter(Boolean) as string[] | undefined) ??
    [];
  const af = data.allow_force_pushes as { enabled?: boolean } | boolean | undefined;
  const ad = data.allow_deletions as { enabled?: boolean } | boolean | undefined;
  const forceOn =
    typeof af === "boolean" ? af : Boolean((af as { enabled?: boolean } | undefined)?.enabled);
  const delOn =
    typeof ad === "boolean" ? ad : Boolean((ad as { enabled?: boolean } | undefined)?.enabled);
  return {
    enabled: true,
    allowsForcePushes: forceOn,
    allowsDeletions: delOn,
    requiredReviewCount: prReviews?.required_approving_review_count ?? 0,
    requiredStatusChecks: contexts,
    enforceAdmins: Boolean(
      (data.enforce_admins as { enabled?: boolean } | undefined)?.enabled,
    ),
    raw: data,
  };
}

export async function fetchCodeowners(
  token: string,
  owner: string,
  repo: string,
): Promise<CodeownersResult> {
  const paths = [".github/CODEOWNERS", "CODEOWNERS", "docs/CODEOWNERS"];
  for (const path of paths) {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
    const res = await fetch(url, { headers: ghHeaders(token) });
    if (res.status === 404) continue;
    if (!res.ok) continue;
    const data = (await res.json()) as { content?: string; encoding?: string };
    if (data.content && data.encoding === "base64") {
      const decoded = Buffer.from(data.content, "base64").toString("utf-8");
      return { exists: true, contentSnippet: decoded.slice(0, 2000) };
    }
  }
  return { exists: false };
}

async function getDefaultBranch(token: string, owner: string, repo: string): Promise<string> {
  const url = `https://api.github.com/repos/${owner}/${repo}`;
  const res = await fetch(url, { headers: ghHeaders(token) });
  if (!res.ok) throw new Error(`GitHub repo: ${res.status}`);
  const data = (await res.json()) as { default_branch?: string };
  return data.default_branch ?? "main";
}

type TreeItem = { path?: string; type?: string; sha?: string; size?: number };

export async function scanRepoForSecrets(
  token: string,
  owner: string,
  repo: string,
  options?: { maxFiles?: number; maxBytes?: number },
): Promise<SecretScanResult> {
  const maxFiles = options?.maxFiles ?? 40;
  const maxBytes = options?.maxBytes ?? 64_000;
  const branch = await getDefaultBranch(token, owner, repo);
  const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
  const treeRes = await fetch(treeUrl, { headers: ghHeaders(token) });
  if (!treeRes.ok) throw new Error(`GitHub tree: ${treeRes.status}`);
  const treeData = (await treeRes.json()) as { tree?: TreeItem[] };
  const blobs = (treeData.tree ?? []).filter(
    (t) =>
      t.type === "blob" &&
      t.path &&
      TEXT_EXTENSIONS.has("." + (t.path.split(".").pop() ?? "").toLowerCase()),
  );

  const findings: { path: string; pattern: string }[] = [];
  let filesScanned = 0;

  for (const item of blobs) {
    if (filesScanned >= maxFiles) break;
    if (!item.path || !item.sha) continue;
    const contentUrl = `https://api.github.com/repos/${owner}/${repo}/git/blobs/${item.sha}`;
    const cRes = await fetch(contentUrl, { headers: ghHeaders(token) });
    if (!cRes.ok) continue;
    const blob = (await cRes.json()) as { content?: string; encoding?: string };
    if (blob.encoding !== "base64" || !blob.content) continue;
    const text = Buffer.from(blob.content, "base64").toString("utf-8");
    if (text.length > maxBytes) continue;
    filesScanned += 1;
    for (const { name, re } of SECRET_PATTERNS) {
      if (re.test(text)) {
        findings.push({ path: item.path, pattern: name });
        break;
      }
    }
  }

  return { filesScanned, findings };
}

export { getDefaultBranch };
