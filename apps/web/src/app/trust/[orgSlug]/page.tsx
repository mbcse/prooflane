import { notFound } from "next/navigation";
import { ApiErrorCallout } from "@/components/api-error-callout";
import { getApiUrl } from "@/lib/api-url";
import { fetchApiJson } from "@/lib/api-response";
import { chainTxUrl } from "@/lib/chain-tx";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Params = { params: Promise<{ orgSlug: string }> };

type AiDetails = {
  strengths?: string[];
  topFixesNext7Days?: { title: string; detail: string }[];
};

type TrustPayload = {
  organization: { id: string; name: string; slug: string };
  run: {
    overallScore: number | null;
    finishedAt: string | null;
    storageTxHash: string | null;
    report: { aiSummary: string; aiDetails: unknown } | null;
  } | null;
  connectedTypes: string[];
};

export default async function TrustPage({ params }: Params) {
  const { orgSlug } = await params;
  const parsed = await fetchApiJson<TrustPayload>(
    `${getApiUrl()}/v1/public/trust/${encodeURIComponent(orgSlug)}`,
    { cache: "no-store" },
  );
  if (!parsed.ok) {
    if (parsed.message.includes("HTTP 404")) notFound();
    return (
      <div className="mx-auto max-w-lg px-6 py-16">
        <ApiErrorCallout title="Trust page unavailable" message={parsed.message} />
      </div>
    );
  }

  const payload = parsed.data;
  const { organization: org, run, connectedTypes } = payload;
  const monitors = connectedTypes.join(" · ") || "None connected";
  const details = (run?.report?.aiDetails as AiDetails | null) ?? {};

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-card/30">
      <div className="mx-auto max-w-3xl px-6 py-16 space-y-10">
        <div className="text-center space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Trust report</p>
          <h1 className="text-3xl font-semibold tracking-tight">{org.name}</h1>
          <p className="text-muted-foreground text-sm">
            Automated readiness snapshot, not a formal audit.
          </p>
        </div>

        <Card className="border-border/60 bg-card/50">
          <CardHeader>
            <CardTitle className="text-center text-5xl font-semibold tabular-nums">
              {run?.overallScore ?? "n/a"}
              <span className="text-xl font-normal text-muted-foreground">/100</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground space-y-2">
            {run?.finishedAt && (
              <p>Last updated {new Date(run.finishedAt).toLocaleDateString()}</p>
            )}
            <p>
              Monitors: <span className="text-foreground">{monitors}</span>
            </p>
            {run?.storageTxHash && !run.storageTxHash.startsWith("0x0000") && (
              <a
                href={chainTxUrl(run.storageTxHash)}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-xs underline underline-offset-4 font-mono"
              >
                Verify on-chain anchor (0G Galileo)
              </a>
            )}
          </CardContent>
        </Card>

        {run?.report?.aiSummary && (
          <Card className="border-border/60 bg-card/40">
            <CardHeader>
              <CardTitle className="text-lg">Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                {run.report.aiSummary}
              </p>
            </CardContent>
          </Card>
        )}

        {details.strengths && details.strengths.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">Strengths</h2>
            <ul className="space-y-2">
              {details.strengths.slice(0, 6).map((s, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <Badge variant="outline" className="shrink-0">
                    ✓
                  </Badge>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {details.topFixesNext7Days && details.topFixesNext7Days.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">
              Active remediation focus
            </h2>
            <ul className="space-y-3">
              {details.topFixesNext7Days.slice(0, 5).map((f, i) => (
                <li key={i} className="text-sm border-l-2 border-amber-500/40 pl-3">
                  <span className="font-medium">{f.title}</span>
                  <p className="text-muted-foreground">{f.detail}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground pt-8">
          Evidence anchored with{" "}
          <a href="https://docs.0g.ai/" className="underline">
            0G decentralized storage
          </a>{" "}
          · AI narrative via{" "}
          <a
            href="https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/overview"
            className="underline"
          >
            0G Compute Router
          </a>
        </p>
      </div>
    </div>
  );
}
