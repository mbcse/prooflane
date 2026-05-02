import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { ApiErrorCallout } from "@/components/api-error-callout";
import { getApiUrl } from "@/lib/api-url";
import { fetchApiJson } from "@/lib/api-response";
import { chainTxUrl } from "@/lib/chain-tx";
import { RunDetailTabs } from "@/components/run-detail-tabs";
import { Badge } from "@/components/ui/badge";

type Params = { params: Promise<{ id: string }> };

type RunDetailResponse = {
  run: {
    id: string;
    organizationId: string;
    status: string;
    overallScore: number | null;
    startedAt: string;
    finishedAt: string | null;
    storageRootHash: string | null;
    storageTxHash: string | null;
    ogEvidenceUri: string | null;
    ogEvidenceHash: string | null;
    routerModel: string | null;
    errorMessage: string | null;
    agentId: string;
  };
  controlResults: {
    id: string;
    controlId: string;
    status: string;
    message: string;
  }[];
  report: { aiSummary: string; aiDetails: unknown } | null;
};

export default async function ComplianceRunDetailPage({ params }: Params) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id || !session.accessToken) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/compliance/runs/${id}`)}`);
  }

  const parsed = await fetchApiJson<RunDetailResponse>(`${getApiUrl()}/v1/compliance/runs/${id}`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    cache: "no-store",
  });
  if (!parsed.ok) {
    if (parsed.message.includes("HTTP 404")) notFound();
    return (
      <ApiErrorCallout title="Could not load this compliance run" message={parsed.message} />
    );
  }

  const data = parsed.data;
  const { run } = data;

  const finished =
    run.finishedAt != null
      ? new Date(run.finishedAt).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : null;

  return (
    <div className="space-y-10 max-w-6xl">
      <div className="rounded-xl border border-border/60 bg-gradient-to-br from-card/90 via-card/50 to-muted/20 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <Link
              href="/compliance/runs"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← All runs
            </Link>
            <h1 className="text-3xl font-semibold tracking-tight">Compliance report</h1>
            <p className="text-sm text-muted-foreground font-mono break-all">{run.id}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground pt-1">
              <span>
                Agent{" "}
                <span className="font-medium text-foreground uppercase">{run.agentId}</span>
              </span>
              {run.routerModel && (
                <span>
                  Model <span className="font-mono text-xs text-foreground/90">{run.routerModel}</span>
                </span>
              )}
              {finished && <span>Completed {finished}</span>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 shrink-0">
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Readiness</p>
              <span className="text-5xl font-semibold tabular-nums leading-none">
                {run.overallScore ?? "-"}
                <span className="text-xl font-normal text-muted-foreground">/100</span>
              </span>
            </div>
            <Badge className="text-xs uppercase px-3 py-1">{run.status}</Badge>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/25 p-5 text-sm space-y-3">
        <p className="font-medium text-foreground">Evidence anchor</p>
        <p className="text-muted-foreground">
          <span className="text-foreground/90">0G Storage bundle · </span>
          {run.storageTxHash && !run.storageTxHash.startsWith("0x0000") ? (
            <a
              href={chainTxUrl(run.storageTxHash)}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4 font-mono text-xs"
            >
              {run.storageTxHash.slice(0, 20)}…
            </a>
          ) : (
            <span className="text-muted-foreground">No chain transaction linked</span>
          )}
        </p>
        {run.storageRootHash && (
          <p className="font-mono text-xs text-muted-foreground break-all leading-relaxed">
            Root: {run.storageRootHash}
          </p>
        )}
        {run.errorMessage && (
          <p className="text-destructive text-sm">Error: {run.errorMessage}</p>
        )}
      </div>

      <RunDetailTabs run={run} controlResults={data.controlResults} report={data.report} />
    </div>
  );
}
