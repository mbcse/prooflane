import { auth } from "@/auth";
import { ApiErrorCallout } from "@/components/api-error-callout";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { getApiUrl } from "@/lib/api-url";
import { fetchApiJson } from "@/lib/api-response";

type OnboardingPayload = {
  organization: {
    id: string;
    name: string;
    productSummary: string | null;
    primaryComplianceGoal: string | null;
  };
  githubOAuthConnected: boolean;
  githubIntegration: { status: string; owner: string; repo: string } | null;
  awsIntegration: { status: string; region: string } | null;
};

function computeInitialStep(data: OnboardingPayload): number {
  const hasProduct = Boolean(data.organization.productSummary?.trim());
  const ghOk = data.githubIntegration?.status === "CONNECTED";
  const awsOk = data.awsIntegration?.status === "CONNECTED";
  if (!hasProduct) return 1;
  if (!ghOk) return 2;
  if (!awsOk) return 3;
  return 4;
}

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id || !session.accessToken) return null;

  const parsed = await fetchApiJson<OnboardingPayload>(`${getApiUrl()}/v1/me/onboarding`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    cache: "no-store",
  });
  if (!parsed.ok) {
    return <ApiErrorCallout title="Could not load setup" message={parsed.message} />;
  }

  const oauthConfigured = Boolean(
    process.env.GITHUB_CLIENT_ID &&
      process.env.GITHUB_CLIENT_SECRET &&
      process.env.INTERNAL_OAUTH_PROVISION_SECRET,
  );

  const initialStep = computeInitialStep(parsed.data);

  return (
    <OnboardingWizard
      data={parsed.data}
      oauthConfigured={oauthConfigured}
      initialStep={initialStep}
    />
  );
}
