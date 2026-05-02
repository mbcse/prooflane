"use client";

import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { getApiUrl } from "@/lib/api-url";
import { formatApiErrorText } from "@/lib/api-response";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type RepoRow = {
  id: number;
  fullName: string;
  name: string;
  ownerLogin: string;
  private: boolean;
  defaultBranch: string;
  updatedAt: string;
};

function splitFullName(fullName: string): { owner: string; repo: string } | null {
  const i = fullName.indexOf("/");
  if (i <= 0 || i >= fullName.length - 1) return null;
  return { owner: fullName.slice(0, i), repo: fullName.slice(i + 1) };
}

export function GitHubRepoSetup({
  organizationId,
  initialFullName,
  githubOAuthConnected,
  oauthConfigured,
  oauthCallbackPath = "/integrations/github",
}: {
  organizationId: string;
  /** e.g. acme/widget-service */
  initialFullName: string;
  githubOAuthConnected: boolean;
  oauthConfigured: boolean;
  /** Where GitHub redirects after OAuth (must match your OAuth app callback base path). */
  oauthCallbackPath?: string;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const [repos, setRepos] = useState<RepoRow[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedFullName, setSelectedFullName] = useState(initialFullName);
  const [pat, setPat] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const tok = session?.accessToken;

  useEffect(() => {
    if (!githubOAuthConnected || !tok) {
      setRepos([]);
      return;
    }
    let cancelled = false;
    setLoadingRepos(true);
    setRepoError(null);
    void (async () => {
      const res = await fetch(`${getApiUrl()}/v1/me/github/repos`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      const text = await res.text();
      if (cancelled) return;
      setLoadingRepos(false);
      if (!res.ok) {
        setRepoError(formatApiErrorText(res.status, text));
        setRepos([]);
        return;
      }
      try {
        const j = JSON.parse(text) as { repos: RepoRow[] };
        setRepos(j.repos ?? []);
      } catch {
        setRepoError("Invalid response from server");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [githubOAuthConnected, tok]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return repos;
    return repos.filter((r) => r.fullName.toLowerCase().includes(q));
  }, [repos, query]);

  async function onConnect(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!tok) {
      setError("Not signed in");
      return;
    }
    const parts = splitFullName(selectedFullName);
    if (!parts) {
      setError("Select a repository from the list, or type owner/repo (e.g. acme/api).");
      return;
    }
    setPending(true);
    const body: { organizationId: string; owner: string; repo: string; token?: string } = {
      organizationId,
      owner: parts.owner,
      repo: parts.repo,
    };
    if (pat.trim()) body.token = pat.trim();

    const res = await fetch(`${getApiUrl()}/v1/integrations/github`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tok}`,
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    setPending(false);
    if (!res.ok) {
      setError(formatApiErrorText(res.status, text));
      return;
    }
    setPat("");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {!oauthConfigured && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200/90">
          GitHub OAuth is not configured on the server. Add GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET,
          and INTERNAL_OAUTH_PROVISION_SECRET to your environment.
        </p>
      )}

      {oauthConfigured && !githubOAuthConnected && (
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-sm text-white/75">
            Authorize GitHub with repository access. Then choose the repo that powers your product
            evidence without manually pasting tokens.
          </p>
          <Button
            type="button"
            className="mt-4 gap-2 bg-white text-black hover:bg-white/90"
            onClick={() => signIn("github", { callbackUrl: oauthCallbackPath })}
          >
            <svg className="size-4" viewBox="0 0 24 24" aria-hidden>
              <path
                fill="currentColor"
                d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
              />
            </svg>
            Connect GitHub
          </Button>
          <p className="mt-3 text-xs text-white/40">
            Already use email login? We link the same account when your GitHub email matches. After
            connecting, you will return here to choose a repo.
          </p>
        </div>
      )}

      {githubOAuthConnected && (
        <form onSubmit={onConnect} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="repo-search">Search repositories</Label>
            <Input
              id="repo-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by name…"
              className="border-white/10 bg-white/5"
              disabled={loadingRepos}
            />
          </div>

          {loadingRepos && (
            <p className="text-sm text-white/45">Loading repositories from GitHub…</p>
          )}
          {repoError && (
            <p className="text-sm text-red-400">
              {repoError}{" "}
              <button
                type="button"
                className="underline underline-offset-4"
                onClick={() => signIn("github", { callbackUrl: oauthCallbackPath })}
              >
                Re-authorize GitHub
              </button>
            </p>
          )}

          {!loadingRepos && !repoError && filtered.length > 0 && (
            <div className="space-y-2">
              <Label>Select repository</Label>
              <div className="max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-black/30">
                {filtered.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedFullName(r.fullName)}
                    className={`flex w-full flex-col gap-0.5 border-b border-white/5 px-3 py-2.5 text-left text-sm transition-colors last:border-0 hover:bg-white/5 ${
                      selectedFullName === r.fullName ? "bg-teal-500/15" : ""
                    }`}
                  >
                    <span className="font-medium text-white">{r.fullName}</span>
                    <span className="text-xs text-white/45">
                      {r.private ? "Private" : "Public"} · default {r.defaultBranch}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!loadingRepos && !repoError && githubOAuthConnected && repos.length === 0 && (
            <p className="text-sm text-white/45">No repositories returned. Create a repo on GitHub or check org access.</p>
          )}

          <div className="space-y-2">
            <Label htmlFor="full-name">Repository (owner/repo)</Label>
            <Input
              id="full-name"
              value={selectedFullName}
              onChange={(e) => setSelectedFullName(e.target.value)}
              placeholder="acme/my-service"
              required
              className="border-white/10 bg-white/5 font-mono text-sm"
            />
            <p className="text-xs text-white/45">
              Choose from the list above or edit manually. We store the connection using your GitHub
              OAuth token.
            </p>
          </div>

          <button
            type="button"
            className="text-xs text-teal-400/90 underline underline-offset-4"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            {showAdvanced ? "Hide" : "Advanced"}: use a personal access token instead
          </button>
          {showAdvanced && (
            <div className="space-y-2 rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <Label htmlFor="pat">Personal access token (optional)</Label>
              <Input
                id="pat"
                type="password"
                autoComplete="off"
                value={pat}
                onChange={(e) => setPat(e.target.value)}
                placeholder="Overrides OAuth token for this save only"
                className="border-white/10 bg-white/5"
              />
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button
            type="submit"
            disabled={pending}
            className="bg-gradient-to-r from-teal-600 to-emerald-600 text-white hover:from-teal-500 hover:to-emerald-500"
          >
            {pending ? "Connecting…" : "Connect repository"}
          </Button>
        </form>
      )}
    </div>
  );
}
