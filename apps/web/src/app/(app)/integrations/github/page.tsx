import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ApiErrorCallout } from "@/components/api-error-callout";
import { GitHubWebhookSetup } from "@/components/github-webhook-setup";
import { GitHubRepoSetup } from "@/components/github-repo-setup";
import { getApiUrl } from "@/lib/api-url";
import { fetchApiJson } from "@/lib/api-response";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type IntegrationRes = {
  organizationId: string;
  githubOAuthConnected: boolean;
  webhookUrl: string;
  webhookSecretConfigured: boolean;
  integration: {
    status: string;
    lastSyncedAt: string | null;
    owner: string;
    repo: string;
    activityPreview: { sha: string; message: string; at: string }[] | null;
    activitySyncedAt: string | null;
    webhookSecret: string | null;
  } | null;
};

export default async function GitHubIntegrationPage() {
  const session = await auth();
  if (!session?.user?.id || !session.accessToken) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/integrations/github")}`);
  }

  const parsed = await fetchApiJson<IntegrationRes>(`${getApiUrl()}/v1/me/integration/github`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    cache: "no-store",
  });
  if (!parsed.ok) {
    return (
      <ApiErrorCallout title="Could not load GitHub integration" message={parsed.message} />
    );
  }

  const data = parsed.data;
  const integration = data.integration;
  const activity = integration?.activityPreview;

  const oauthConfigured = Boolean(
    process.env.GITHUB_CLIENT_ID &&
      process.env.GITHUB_CLIENT_SECRET &&
      process.env.INTERNAL_OAUTH_PROVISION_SECRET,
  );

  const initialFullName =
    integration?.owner && integration?.repo ? `${integration.owner}/${integration.repo}` : "";

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-heading)] text-3xl font-semibold tracking-tight text-white">
          GitHub
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/55">
          Authorize GitHub and select the repository that represents your shipping surface. We sync
          recent activity for evidence during automated runs and audit narratives.
        </p>
      </div>
      <Card className="border-white/10 bg-white/[0.03] shadow-xl shadow-black/30">
        <CardHeader>
          <CardTitle className="text-white">Repository</CardTitle>
          <CardDescription className="text-white/50">
            Status:{" "}
            <span className="text-white/90">
              {integration?.status === "CONNECTED" ? "Connected" : "Not connected"}
            </span>
            {integration?.owner && integration?.repo && (
              <span className="mt-1 block font-mono text-xs text-teal-400/90">
                {integration.owner}/{integration.repo}
              </span>
            )}
            {integration?.lastSyncedAt && (
              <span className="mt-1 block text-xs">
                Last saved: {new Date(integration.lastSyncedAt).toLocaleString()}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <GitHubRepoSetup
            organizationId={data.organizationId}
            initialFullName={initialFullName}
            githubOAuthConnected={data.githubOAuthConnected}
            oauthConfigured={oauthConfigured}
          />
          <GitHubWebhookSetup
            connected={integration?.status === "CONNECTED"}
            webhookUrl={data.webhookUrl}
            webhookSecret={integration?.webhookSecret ?? null}
          />
          {integration?.status === "CONNECTED" && activity && activity.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-white/45">
                Recent commits (synced for audit trail)
              </p>
              {integration.activitySyncedAt && (
                <p className="mt-1 text-[11px] text-white/35">
                  Snapshot: {new Date(integration.activitySyncedAt).toLocaleString()}
                </p>
              )}
              <ul className="mt-3 space-y-2 font-mono text-xs text-white/70">
                {activity.slice(0, 8).map((c) => (
                  <li
                    key={c.sha}
                    className="flex flex-col gap-0.5 border-b border-white/5 pb-2 last:border-0"
                  >
                    <span className="text-teal-400/90">{c.sha}</span>
                    <span className="text-white/80">{c.message}</span>
                    {c.at && (
                      <span className="text-[10px] text-white/40">
                        {new Date(c.at).toLocaleString()}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
