"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMemo, useState } from "react";
import { GitHubRepoSetup } from "@/components/github-repo-setup";
import { AwsConnectForm } from "@/components/aws-connect-form";
import { RunComplianceButton } from "@/components/run-compliance-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getApiUrl } from "@/lib/api-url";
import { formatApiErrorText } from "@/lib/api-response";
import { cn } from "@/lib/utils";
import { Check, ChevronRight, Cloud, FileText, FolderGit2, Shield } from "lucide-react";

const GOALS = [
  "SOC 2 Type II readiness",
  "SOC 2 Type I or readiness",
  "Enterprise security review (buyer diligence)",
  "HIPAA-relevant product",
  "GDPR + security narrative",
  "ISO 27001 path",
  "Not sure yet / explore",
] as const;

type OnboardingSnapshot = {
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

export function OnboardingWizard({
  data,
  oauthConfigured,
  initialStep,
}: {
  data: OnboardingSnapshot;
  oauthConfigured: boolean;
  initialStep: number;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const [activeStep, setActiveStep] = useState(initialStep);
  const [summary, setSummary] = useState(data.organization.productSummary ?? "");
  const [goal, setGoal] = useState(
    data.organization.primaryComplianceGoal ?? GOALS[0],
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const ghOk = data.githubIntegration?.status === "CONNECTED";
  const awsOk = data.awsIntegration?.status === "CONNECTED";
  const initialFullName = useMemo(() => {
    const o = data.githubIntegration;
    if (o?.owner && o?.repo) return `${o.owner}/${o.repo}`;
    return "";
  }, [data.githubIntegration]);

  const steps = useMemo(
    () => [
      { n: 1, label: "Product", icon: FileText },
      { n: 2, label: "Source code", icon: FolderGit2 },
      { n: 3, label: "Cloud", icon: Cloud },
      { n: 4, label: "Program", icon: Shield },
    ],
    [],
  );

  async function saveProduct(goNext: boolean) {
    setErr(null);
    const tok = session?.accessToken;
    if (!tok) {
      setErr("Session expired. Sign in again.");
      return;
    }
    if (!summary.trim()) {
      setErr("Add a short description of what you build and who it is for.");
      return;
    }
    setSaving(true);
    const res = await fetch(`${getApiUrl()}/v1/me/organization`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tok}`,
      },
      body: JSON.stringify({
        productSummary: summary.trim(),
        primaryComplianceGoal: goal,
      }),
    });
    const text = await res.text();
    setSaving(false);
    if (!res.ok) {
      setErr(formatApiErrorText(res.status, text));
      return;
    }
    router.refresh();
    if (goNext) setActiveStep(2);
  }

  async function skipSetup() {
    setErr(null);
    const tok = session?.accessToken;
    if (!tok) return;
    setSaving(true);
    const res = await fetch(`${getApiUrl()}/v1/me/organization`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tok}`,
      },
      body: JSON.stringify({ onboardingSkippedAt: new Date().toISOString() }),
    });
    setSaving(false);
    if (!res.ok) {
      const text = await res.text();
      setErr(formatApiErrorText(res.status, text));
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header className="space-y-3 text-center sm:text-left">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-teal-400/80">
          Setup your compliance program
        </p>
        <h1 className="font-[family-name:var(--font-heading)] text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Tell us what you ship. Connect evidence. Stay audit-ready.
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-white/55">
          Map what you ship, connect code and cloud evidence, then run automated checks and AI
          summaries so sales reviews and audits see continuous posture instead of a static export.
        </p>
      </header>

      <nav aria-label="Onboarding steps" className="flex flex-wrap justify-center gap-2 sm:justify-start">
        {steps.map(({ n, label, icon: Icon }) => (
          <button
            key={n}
            type="button"
            onClick={() => n <= activeStep && setActiveStep(n)}
            className={cn(
              "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              activeStep === n
                ? "border-teal-500/50 bg-teal-500/15 text-teal-100"
                : n < activeStep
                  ? "border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
                  : "cursor-default border-white/10 text-white/35",
            )}
          >
            <Icon className="size-3.5 opacity-80" aria-hidden />
            {n}. {label}
            {n < activeStep && <Check className="size-3 text-emerald-400/90" aria-hidden />}
          </button>
        ))}
      </nav>

      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/40 backdrop-blur-sm sm:p-10">
        {activeStep === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-[family-name:var(--font-heading)] text-xl font-semibold text-white">
                What are you building?
              </h2>
              <p className="mt-2 text-sm text-white/55">
                A few sentences help tailor controls and reports (customer-facing SaaS, internal
                tool, AI features, data you process, regions).
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="summary">Product &amp; scope</Label>
              <Textarea
                id="summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Example: B2B API for finance teams; we store customer configs in Postgres; multi-tenant; US + EU users."
                rows={5}
                className="min-h-[140px] border-white/10 bg-black/30 text-white placeholder:text-white/35"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal">Primary compliance goal</Label>
              <select
                id="goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
              >
                {GOALS.map((g) => (
                  <option key={g} value={g} className="bg-[oklch(0.14_0.03_260)]">
                    {g}
                  </option>
                ))}
              </select>
            </div>
            {err && <p className="text-sm text-red-400">{err}</p>}
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                disabled={saving}
                onClick={() => saveProduct(true)}
                className="gap-2 bg-gradient-to-r from-teal-600 to-emerald-600 text-white hover:from-teal-500 hover:to-emerald-500"
              >
                Save &amp; continue
                <ChevronRight className="size-4" aria-hidden />
              </Button>
              <Button type="button" variant="ghost" className="text-white/55 hover:text-white" onClick={skipSetup}>
                Skip setup for now
              </Button>
            </div>
          </div>
        )}

        {activeStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-[family-name:var(--font-heading)] text-xl font-semibold text-white">
                Connect GitHub
              </h2>
              <p className="mt-2 text-sm text-white/55">
                Authorize GitHub and pick the repository that best represents your production app.
                We use it for change signals and evidence during compliance runs.
              </p>
            </div>
            <GitHubRepoSetup
              organizationId={data.organization.id}
              initialFullName={initialFullName}
              githubOAuthConnected={data.githubOAuthConnected}
              oauthConfigured={oauthConfigured}
              oauthCallbackPath="/onboarding"
            />
            <div className="flex flex-wrap gap-3 pt-2">
              <Button type="button" variant="outline" className="border-white/15" onClick={() => setActiveStep(1)}>
                Back
              </Button>
              {ghOk && (
                <Button
                  type="button"
                  className="gap-2 bg-gradient-to-r from-teal-600 to-emerald-600 text-white"
                  onClick={() => setActiveStep(3)}
                >
                  Continue to AWS
                  <ChevronRight className="size-4" aria-hidden />
                </Button>
              )}
            </div>
          </div>
        )}

        {activeStep === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-[family-name:var(--font-heading)] text-xl font-semibold text-white">
                Connect AWS
              </h2>
              <p className="mt-2 text-sm text-white/55">
                AWS does not offer a single &quot;Sign in with AWS&quot; for arbitrary apps like social
                OAuth. Use a dedicated IAM user or role with read-only policy for the accounts you
                want in scope; paste keys here as a guided connection (production deployments often
                swap this for IAM roles / OIDC).
              </p>
            </div>
            <AwsConnectForm
              organizationId={data.organization.id}
              initialRegion={data.awsIntegration?.region ?? "us-east-1"}
              variant="onboarding"
            />
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" className="border-white/15" onClick={() => setActiveStep(2)}>
                Back
              </Button>
              {awsOk && (
                <Button
                  type="button"
                  className="gap-2 bg-gradient-to-r from-teal-600 to-emerald-600 text-white"
                  onClick={() => setActiveStep(4)}
                >
                  Continue
                  <ChevronRight className="size-4" aria-hidden />
                </Button>
              )}
            </div>
          </div>
        )}

        {activeStep === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-[family-name:var(--font-heading)] text-xl font-semibold text-white">
                Run your program
              </h2>
              <p className="mt-2 text-sm text-white/55">
                Evidence collection and AI summaries run in the background. Each run produces a
                structured report, control results you can share with buyers, and an audit trail when
                you anchor artifacts. Use runs anytime your stack or policies change.
              </p>
            </div>
            <ul className="space-y-2 text-sm text-white/70">
              <li className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-teal-400" aria-hidden />
                Continuous readiness narrative for enterprise deals
              </li>
              <li className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-teal-400" aria-hidden />
                Reports and gaps framed for remediation (control-by-control)
              </li>
              <li className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-teal-400" aria-hidden />
                Public trust page for prospects when you are ready to share
              </li>
            </ul>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <RunComplianceButton organizationId={data.organization.id} />
              <Link
                href="/compliance/runs"
                className={cn(
                  buttonVariants({ variant: "outline", size: "default" }),
                  "border-white/15",
                )}
              >
                View runs
              </Link>
            </div>
            <div className="border-t border-white/10 pt-6">
              <Link
                href="/dashboard"
                className={cn(
                  buttonVariants({ size: "default" }),
                  "inline-flex bg-white text-black hover:bg-white/90",
                )}
              >
                Open overview
              </Link>
              <p className="mt-3 text-xs text-white/40">
                You can revisit integrations or policies anytime from the sidebar.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
