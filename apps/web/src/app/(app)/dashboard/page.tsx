import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ApiErrorCallout } from "@/components/api-error-callout";
import { getApiUrl } from "@/lib/api-url";
import { fetchApiJson } from "@/lib/api-response";
import { PolicyUploadForm } from "@/components/policy-upload-form";
import { RunComplianceButton } from "@/components/run-compliance-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Activity, Blocks, ExternalLink, FolderGit2, Server, Sparkles } from "lucide-react";

type DashboardPayload = {
  organization: {
    id: string;
    name: string;
    slug: string;
    productSummary: string | null;
    primaryComplianceGoal: string | null;
    onboardingSkippedAt: string | null;
    integrations: { type: string; status: string; owner?: string; repo?: string }[];
  };
  latestRun: {
    id: string;
    overallScore: number | null;
    finishedAt: string | null;
    status: string;
  } | null;
};

function ScoreRing({ score }: { score: number | null }) {
  const pct = score != null ? Math.min(100, Math.max(0, score)) : 0;
  const r = 52;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div className="relative mx-auto flex size-40 items-center justify-center sm:mx-0 sm:size-48">
      <svg className="size-full -rotate-90" viewBox="0 0 120 120" aria-hidden>
        <defs>
          <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2dd4bf" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
        </defs>
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          className="stroke-white/10"
          strokeWidth="10"
        />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="url(#scoreGrad)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={score != null ? offset : c}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-[family-name:var(--font-heading)] text-4xl font-bold tabular-nums text-white sm:text-5xl">
          {score != null ? score : "n/a"}
        </span>
        <span className="text-xs font-medium uppercase tracking-wider text-white/45">/ 100</span>
        <span className="mt-1 text-[10px] text-teal-400/90">Readiness</span>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id || !session.accessToken) return null;

  const parsed = await fetchApiJson<DashboardPayload>(`${getApiUrl()}/v1/me/dashboard`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    cache: "no-store",
  });
  if (!parsed.ok) {
    return (
      <ApiErrorCallout
        title="Could not load dashboard"
        message={`${parsed.message} · API base: ${getApiUrl()}`}
      />
    );
  }

  const data = parsed.data;
  const { organization: org, latestRun } = data;

  const gh = org.integrations.find((i) => i.type === "GITHUB");
  const aws = org.integrations.find((i) => i.type === "AWS");
  const ghOk = gh?.status === "CONNECTED";
  const awsOk = aws?.status === "CONNECTED";
  const displayName = gh?.repo?.trim() || org.name;
  const connectedCount = [ghOk, awsOk].filter(Boolean).length;
  const progressPct = latestRun?.overallScore != null ? latestRun.overallScore : 0;

  const needsOnboarding =
    !org.onboardingSkippedAt &&
    (!org.productSummary?.trim() || !ghOk || !awsOk);
  if (needsOnboarding) {
    redirect("/onboarding");
  }

  return (
    <div className="relative min-h-[calc(100vh-8rem)] space-y-10 pb-10">
      <div className="pointer-events-none absolute inset-x-0 -top-6 h-64 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,oklch(0.45_0.12_195/0.2),transparent)]" />

      <div className="relative flex flex-col gap-6 border-b border-white/10 pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-teal-500/40 bg-teal-500/15 text-teal-200 hover:bg-teal-500/20">
              Continuous control monitoring
            </Badge>
            <Badge variant="outline" className="border-white/15 text-white/60">
              {connectedCount}/2 evidence sources live
            </Badge>
          </div>
          <h1 className="mt-4 font-[family-name:var(--font-heading)] text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
            {displayName}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55 sm:text-base">
            One place to run your security program, collect evidence, and export what revenue and
            audit teams ask for. On-chain anchoring is available when you need receipts that
            stand up in review.
          </p>
          {(org.primaryComplianceGoal || org.productSummary) && (
            <div className="mt-5 max-w-2xl rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/70">
              {org.primaryComplianceGoal && (
                <p>
                  <span className="text-white/45">Goal: </span>
                  <span className="text-white/85">{org.primaryComplianceGoal}</span>
                </p>
              )}
              {org.productSummary?.trim() && (
                <p className={org.primaryComplianceGoal ? "mt-2" : ""}>
                  <span className="text-white/45">Program context: </span>
                  {org.productSummary.trim()}
                </p>
              )}
              <Link
                href="/onboarding"
                className="mt-3 inline-block text-xs font-medium text-teal-400/90 underline decoration-teal-500/40 underline-offset-4 hover:text-teal-300"
              >
                Edit in program setup
              </Link>
            </div>
          )}
        </div>
        <Link
          href={`/trust/${org.slug}`}
          className={cn(
            buttonVariants({ variant: "outline", size: "default" }),
            "w-fit gap-2 border-white/20 bg-white/5 text-white shadow-lg shadow-black/20 hover:bg-white/10",
          )}
        >
          <Blocks className="size-4 text-teal-400" aria-hidden />
          Public trust page
          <ExternalLink className="size-3.5 opacity-60" aria-hidden />
        </Link>
      </div>

      <div className="relative grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="md:col-span-2 md:row-span-1">
          <div className="relative h-full overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.1] via-white/[0.02] to-transparent p-1 shadow-2xl shadow-black/50">
            <div className="h-full rounded-[1.4rem] bg-[oklch(0.16_0.03_260_/_0.6)] p-6 backdrop-blur-sm sm:p-8">
              <div
                className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-teal-500/25 blur-3xl"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute -bottom-20 -left-10 size-48 rounded-full bg-amber-500/10 blur-3xl"
                aria-hidden
              />
              <div className="relative flex flex-col gap-8 lg:flex-row lg:items-stretch lg:justify-between">
                <div className="flex min-w-0 flex-1 flex-col justify-center space-y-5">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/45">
                      Latest assessment
                    </p>
                    <p className="mt-2 text-sm text-white/70">
                      {latestRun?.finishedAt
                        ? `Completed ${new Date(latestRun.finishedAt).toLocaleString()}`
                        : "No completed run yet. Connect sources, then run your first check."}
                    </p>
                  </div>
                  {latestRun?.status && (
                    <Badge
                      variant="secondary"
                      className="w-fit border-white/10 bg-white/10 text-white/90"
                    >
                      {latestRun.status}
                    </Badge>
                  )}
                  <div className="max-w-md space-y-2">
                    <div className="flex justify-between text-xs text-white/50">
                      <span>Program progress</span>
                      <span className="tabular-nums text-white/80">
                        {latestRun?.overallScore != null ? `${latestRun.overallScore}%` : "n/a"}
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={cn(
                          "h-full rounded-full bg-gradient-to-r from-teal-400 via-emerald-400 to-amber-400/90 transition-all",
                          latestRun?.overallScore == null && "w-0",
                        )}
                        style={{
                          width:
                            latestRun?.overallScore != null
                              ? `${latestRun.overallScore}%`
                              : undefined,
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <RunComplianceButton organizationId={org.id} />
                    {latestRun?.id && (
                      <Link
                        href={`/compliance/runs/${latestRun.id}`}
                        className="inline-flex text-sm font-medium text-teal-400/90 underline decoration-teal-500/40 underline-offset-4 hover:text-teal-300"
                      >
                        Open latest report
                      </Link>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center gap-4 border-t border-white/10 pt-6 lg:w-[min(100%,240px)] lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                  <ScoreRing score={latestRun?.overallScore ?? null} />
                  <p className="text-center text-xs text-white/40">
                    {latestRun?.overallScore != null
                      ? `Model index: ${progressPct} of 100`
                      : "Run a check to compute your index."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-lg shadow-black/30">
            <div className="flex items-center gap-2 text-white/80">
              <Activity className="size-4 text-teal-400" aria-hidden />
              <span className="text-xs font-medium uppercase tracking-wider text-white/45">
                Health
              </span>
            </div>
            <p className="mt-3 text-2xl font-semibold tabular-nums text-white">
              {connectedCount === 2 ? "Strong" : connectedCount === 1 ? "Partial" : "Setup"}
            </p>
            <p className="mt-1 text-xs text-white/45">
              {connectedCount === 2
                ? "Both evidence sources connected."
                : "Connect GitHub and AWS for full coverage."}
            </p>
          </div>
          <div className="flex flex-1 flex-col justify-center rounded-2xl border border-white/10 bg-gradient-to-b from-teal-500/10 to-transparent p-5">
            <div className="flex items-center gap-2 text-teal-200/90">
              <Sparkles className="size-4" aria-hidden />
              <span className="text-xs font-medium uppercase tracking-wider">Next step</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-white/70">
              Run a compliance check after each meaningful change in Git or cloud config so your
              narrative stays aligned with production.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-[0.15em] text-white/45">
            Evidence sources
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <Link
              href="/integrations/github"
              className={cn(
                "group flex items-center justify-between rounded-2xl border p-5 transition-all",
                ghOk
                  ? "border-teal-500/35 bg-teal-500/[0.07] hover:border-teal-400/50"
                  : "border-white/10 bg-white/[0.03] hover:border-white/25",
              )}
            >
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10">
                  <FolderGit2 className="size-5 text-white" />
                </span>
                <div>
                  <p className="text-sm font-medium text-white">GitHub</p>
                  <p className="text-xs text-white/45">Repo change signals</p>
                </div>
              </div>
              <Badge
                className={cn(
                  ghOk
                    ? "border-0 bg-emerald-500/20 text-emerald-200"
                    : "border-white/15 bg-white/5 text-white/55",
                )}
              >
                {ghOk ? "Live" : "Setup"}
              </Badge>
            </Link>
            <Link
              href="/integrations/aws"
              className={cn(
                "group flex items-center justify-between rounded-2xl border p-5 transition-all",
                awsOk
                  ? "border-teal-500/35 bg-teal-500/[0.07] hover:border-teal-400/50"
                  : "border-white/10 bg-white/[0.03] hover:border-white/25",
              )}
            >
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10">
                  <Server className="size-5 text-white" />
                </span>
                <div>
                  <p className="text-sm font-medium text-white">Amazon Web Services</p>
                  <p className="text-xs text-white/45">Cloud posture</p>
                </div>
              </div>
              <Badge
                className={cn(
                  awsOk
                    ? "border-0 bg-emerald-500/20 text-emerald-200"
                    : "border-white/15 bg-white/5 text-white/55",
                )}
              >
                {awsOk ? "Live" : "Setup"}
              </Badge>
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
          <div className="mb-6 max-w-xl">
            <h2 className="font-[family-name:var(--font-heading)] text-xl font-semibold text-white">
              Policies and attestations
            </h2>
            <p className="mt-2 text-sm text-white/55">
              Upload security and incident response policies for automated keyword checks. Files are
              processed and can be anchored for audit linkage.
            </p>
          </div>
          <PolicyUploadForm organizationId={org.id} />
        </div>
      </div>
    </div>
  );
}
