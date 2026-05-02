import { auth } from "@/auth";
import { ApiErrorCallout } from "@/components/api-error-callout";
import { AwsConnectForm } from "@/components/aws-connect-form";
import { getApiUrl } from "@/lib/api-url";
import { fetchApiJson } from "@/lib/api-response";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Cloud } from "lucide-react";

type IntegrationRes = {
  organizationId: string;
  integration: {
    status: string;
    lastSyncedAt: string | null;
    region: string;
  } | null;
};

export default async function AwsIntegrationPage() {
  const session = await auth();
  if (!session?.user?.id || !session.accessToken) return null;

  const parsed = await fetchApiJson<IntegrationRes>(`${getApiUrl()}/v1/me/integration/aws`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    cache: "no-store",
  });
  if (!parsed.ok) {
    return (
      <ApiErrorCallout title="Could not load AWS integration" message={parsed.message} />
    );
  }

  const data = parsed.data;
  const integration = data.integration;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-orange-500/25 bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-200/90">
          <Cloud className="size-3.5" aria-hidden />
          Cloud evidence
        </div>
        <h1 className="font-[family-name:var(--font-heading)] text-3xl font-semibold tracking-tight text-white">
          Amazon Web Services
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/55">
          Connect read-oriented credentials so compliance runs can pull posture signals (IAM, logs,
          buckets where configured). There is no universal &quot;Sign in with AWS&quot; for third-party
          apps; use a scoped IAM user or role here, and plan to move to role assumption or OIDC for
          production.
        </p>
      </div>
      <Card className="border-white/10 bg-white/[0.03] shadow-xl shadow-black/30">
        <CardHeader>
          <CardTitle className="text-white">Connection</CardTitle>
          <CardDescription className="text-white/50">
            Status:{" "}
            <span className="text-white/90">
              {integration?.status === "CONNECTED" ? "Connected" : "Not connected"}
            </span>
            {integration?.lastSyncedAt && (
              <span className="mt-1 block text-xs">
                Last saved: {new Date(integration.lastSyncedAt).toLocaleString()}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AwsConnectForm
            organizationId={data.organizationId}
            initialRegion={integration?.region ?? "us-east-1"}
            variant="onboarding"
          />
        </CardContent>
      </Card>
    </div>
  );
}
