"use client";

import { useMemo, useState } from "react";
import { chainTxUrl } from "@/lib/chain-tx";
import { getControlMeta, type ControlCategory } from "@/lib/control-labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type RunShape = {
  id: string;
  status: string;
  overallScore: number | null;
  startedAt: string | Date;
  finishedAt: string | Date | null;
  storageRootHash: string | null;
  storageTxHash: string | null;
  ogEvidenceUri: string | null;
  ogEvidenceHash: string | null;
  errorMessage: string | null;
  agentId: string;
};

type ControlResult = {
  id: string;
  controlId: string;
  status: string;
  message: string;
};

type Report = {
  aiSummary: string;
  aiDetails: unknown;
} | null;

type ProgramSnapshot = {
  overallScore: number;
  passCount: number;
  failCount: number;
  unknownCount: number;
  totalControls: number;
  byCategory: {
    id: "GITHUB" | "AWS" | "POLICY";
    label: string;
    pass: number;
    fail: number;
    unknown: number;
    total: number;
  }[];
  llmConfigured: boolean;
  aiNarrativeActive: boolean;
  assessedAt: string;
};

type AiDetails = {
  strengths?: string[];
  topFixesNext7Days?: { title: string; detail: string; controlId?: string }[];
  frameworkMapping?: string;
  categoryCommentary?: { github?: string; aws?: string; policy?: string };
  programSnapshot?: ProgramSnapshot;
};

const CATEGORY_LABEL: Record<ControlCategory, string> = {
  GITHUB: "GitHub & change management",
  AWS: "AWS & infrastructure",
  POLICY: "Policies & governance",
};

const CATEGORY_BADGE: Record<ControlCategory, string> = {
  GITHUB: "border-sky-500/40 bg-sky-500/10 text-sky-200",
  AWS: "border-amber-500/40 bg-amber-500/10 text-amber-100",
  POLICY: "border-violet-500/40 bg-violet-500/10 text-violet-100",
};

function computeSnapshotFromResults(
  overallScore: number | null,
  controlResults: ControlResult[],
  finishedAt: string | Date | null,
): ProgramSnapshot {
  const passCount = controlResults.filter((c) => c.status === "PASS").length;
  const failCount = controlResults.filter((c) => c.status === "FAIL").length;
  const unknownCount = controlResults.filter((c) => c.status === "UNKNOWN").length;

  const cats: ("GITHUB" | "AWS" | "POLICY")[] = ["GITHUB", "AWS", "POLICY"];
  const byCategory = cats.map((id) => {
    const rows = controlResults.filter((cr) => getControlMeta(cr.controlId)?.category === id);
    return {
      id,
      label: CATEGORY_LABEL[id],
      pass: rows.filter((r) => r.status === "PASS").length,
      fail: rows.filter((r) => r.status === "FAIL").length,
      unknown: rows.filter((r) => r.status === "UNKNOWN").length,
      total: rows.length,
    };
  });

  return {
    overallScore: overallScore ?? 0,
    passCount,
    failCount,
    unknownCount,
    totalControls: controlResults.length,
    byCategory,
    llmConfigured: false,
    aiNarrativeActive: false,
    assessedAt: finishedAt ? new Date(finishedAt).toISOString() : new Date().toISOString(),
  };
}

function PassRateBar({ pass, total }: { pass: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((pass / total) * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Pass rate</span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted/80 overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-500/85 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function CopyJsonButton({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="text-xs"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      }}
    >
      {done ? "Copied" : label}
    </Button>
  );
}

export function RunDetailTabs({
  run,
  controlResults,
  report,
}: {
  run: RunShape;
  controlResults: ControlResult[];
  report: Report;
}) {
  const details = (report?.aiDetails as AiDetails | null) ?? {};
  const evidenceJson = {
    agentId: run.agentId,
    runId: run.id,
    rootHash: run.storageRootHash,
    txHash: run.storageTxHash,
    uri: run.ogEvidenceUri,
  };

  const snapshot = useMemo(() => {
    return (
      details.programSnapshot ??
      computeSnapshotFromResults(run.overallScore, controlResults, run.finishedAt)
    );
  }, [details.programSnapshot, run.overallScore, run.finishedAt, controlResults]);

  const sortedControls = useMemo(() => {
    const order: Record<ControlCategory, number> = { GITHUB: 0, AWS: 1, POLICY: 2 };
    return [...controlResults].sort((a, b) => {
      const ca = getControlMeta(a.controlId)?.category ?? "POLICY";
      const cb = getControlMeta(b.controlId)?.category ?? "POLICY";
      if (ca !== cb) return order[ca] - order[cb];
      const ta = getControlMeta(a.controlId)?.title ?? a.controlId;
      const tb = getControlMeta(b.controlId)?.title ?? b.controlId;
      return ta.localeCompare(tb);
    });
  }, [controlResults]);

  const score = run.overallScore ?? snapshot.overallScore;
  const assessedLabel = new Date(snapshot.assessedAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const fullReportJson = JSON.stringify(
    report
      ? { aiSummary: report.aiSummary, aiDetails: report.aiDetails }
      : { aiSummary: null, aiDetails: null },
    null,
    2,
  );

  const summaryText = report?.aiSummary ?? "";
  const summaryHasLegacySetupHint =
    summaryText.includes("npm run 0g:compute-setup") ||
    summaryText.includes("0g:compute-setup");

  return (
    <Tabs defaultValue="summary" className="w-full">
      <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/40 p-1">
        <TabsTrigger value="summary" className="rounded-md">
          Summary
        </TabsTrigger>
        <TabsTrigger value="controls" className="rounded-md">
          Controls
        </TabsTrigger>
        <TabsTrigger value="evidence" className="rounded-md">
          Evidence
        </TabsTrigger>
      </TabsList>

      <TabsContent value="summary" className="space-y-6 mt-6">
        {/* Readiness hero */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <Card className="border-border/60 bg-gradient-to-br from-card/80 to-card/40 overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-xl">Readiness overview</CardTitle>
                {snapshot.aiNarrativeActive ? (
                  <Badge variant="default" className="font-normal">
                    Enriched narrative
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="font-normal">
                    Control-led summary
                  </Badge>
                )}
                {!snapshot.llmConfigured && (
                  <span className="text-xs text-muted-foreground">
                    (Narrative enhancement is optional. Scores always reflect live control results.)
                  </span>
                )}
              </div>
              <CardDescription>
                Assessed {assessedLabel} · Agent {run.agentId.toUpperCase()}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-border/50 bg-background/30 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Score</p>
                <p className="mt-1 text-4xl font-semibold tabular-nums">
                  {score}
                  <span className="text-lg font-normal text-muted-foreground">/100</span>
                </p>
              </div>
              <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-4">
                <p className="text-xs uppercase tracking-wide text-emerald-200/90">Passed</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums text-emerald-100">
                  {snapshot.passCount}
                </p>
                <p className="text-xs text-muted-foreground">
                  of {snapshot.totalControls} controls
                </p>
              </div>
              <div className="rounded-lg border border-rose-500/25 bg-rose-500/5 p-4">
                <p className="text-xs uppercase tracking-wide text-rose-200/90">Failed</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums text-rose-100">
                  {snapshot.failCount}
                </p>
                <p className="text-xs text-muted-foreground">Needs remediation</p>
              </div>
              <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-4">
                <p className="text-xs uppercase tracking-wide text-amber-100/90">Unknown</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums text-amber-50">
                  {snapshot.unknownCount}
                </p>
                <p className="text-xs text-muted-foreground">Inconclusive / skipped signal</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/40 flex flex-col justify-between">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Risk posture</CardTitle>
              <CardDescription className="text-xs">
                Quick read on where gaps cluster. UNKNOWN often means missing credentials or API
                errors, not a clean bill of health.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Failure density</span>
                <span className="font-medium tabular-nums">
                  {snapshot.totalControls
                    ? Math.round((snapshot.failCount / snapshot.totalControls) * 100)
                    : 0}
                  %
                </span>
              </div>
              <Separator />
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Unverified</span>
                <span className="font-medium tabular-nums">
                  {snapshot.totalControls
                    ? Math.round((snapshot.unknownCount / snapshot.totalControls) * 100)
                    : 0}
                  %
                </span>
              </div>
              <Separator />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Use the Controls tab to trace each finding to GitHub, AWS, or policy evidence. Re-run
                after fixing integrations or IAM.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Category breakdown */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Coverage by domain</h3>
          <div className="grid gap-4 md:grid-cols-3">
            {snapshot.byCategory.map((c) => (
              <Card key={c.id} className="border-border/60 bg-card/40">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base leading-snug">{c.label}</CardTitle>
                    <Badge variant="outline" className={cn("text-[10px]", CATEGORY_BADGE[c.id])}>
                      {c.id}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs tabular-nums">
                    {c.pass} pass · {c.fail} fail · {c.unknown} unknown · {c.total} in scope
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PassRateBar pass={c.pass} total={c.total} />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Executive summary */}
        <Card className="border-border/60 bg-card/40">
          <CardHeader>
            <CardTitle className="text-lg">Executive summary</CardTitle>
            <CardDescription>Narrative plus grounded metrics from this run.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-foreground/90">
            {summaryHasLegacySetupHint && (
              <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-50/95">
                <p className="font-medium text-amber-100">Updated summary format</p>
                <p className="mt-1 text-amber-50/90 leading-relaxed">
                  This run still shows older onboarding copy in the executive summary. Your control
                  results and scores are current.{" "}
                  <span className="font-medium text-foreground">Start a new compliance run</span> to
                  refresh the summary, or add narrative credentials in your deployment for extended
                  prose.
                </p>
              </div>
            )}
            {summaryText.trim() ? (
              summaryText.split("\n\n").map((para, i) => (
                <p key={i} className="whitespace-pre-wrap">
                  {para}
                </p>
              ))
            ) : (
              <p className="text-muted-foreground">
                No summary text was stored for this run. Open a newer run or trigger a fresh
                assessment.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          {details.strengths && details.strengths.length > 0 && (
            <Card className="border-border/60 bg-card/40">
              <CardHeader>
                <CardTitle className="text-lg">What is working</CardTitle>
                <CardDescription>Strengths observed from passing controls.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="list-disc pl-5 space-y-2 text-sm text-foreground/90">
                  {details.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {details.topFixesNext7Days && details.topFixesNext7Days.length > 0 && (
            <Card className="border-border/60 bg-card/40">
              <CardHeader>
                <CardTitle className="text-lg">Prioritized remediation</CardTitle>
                <CardDescription>Ordered by severity. Tackle failures before UNKNOWN noise.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {details.topFixesNext7Days.map((f, i) => {
                  const cat = f.controlId ? getControlMeta(f.controlId)?.category : undefined;
                  return (
                    <div
                      key={i}
                      className="rounded-lg border border-border/50 bg-background/20 p-4 space-y-2"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-sm">{f.title}</span>
                        {cat && (
                          <Badge variant="outline" className={cn("text-[10px]", CATEGORY_BADGE[cat])}>
                            {cat}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{f.detail}</p>
                      {f.controlId && (
                        <code className="text-[11px] text-muted-foreground">{f.controlId}</code>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Category commentary + framework */}
        <div className="grid gap-4 lg:grid-cols-3">
          {details.categoryCommentary?.github && (
            <Card className="border-border/60 bg-card/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-sky-100">GitHub</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground leading-relaxed">
                {details.categoryCommentary.github}
              </CardContent>
            </Card>
          )}
          {details.categoryCommentary?.aws && (
            <Card className="border-border/60 bg-card/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-amber-100">AWS</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground leading-relaxed">
                {details.categoryCommentary.aws}
              </CardContent>
            </Card>
          )}
          {details.categoryCommentary?.policy && (
            <Card className="border-border/60 bg-card/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-violet-100">Policies</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground leading-relaxed">
                {details.categoryCommentary.policy}
              </CardContent>
            </Card>
          )}
        </div>

        {details.frameworkMapping && (
          <Card className="border-dashed border-border/70 bg-muted/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Framework mapping</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-relaxed">
              {details.frameworkMapping}
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="controls" className="mt-6 space-y-4">
        <p className="text-sm text-muted-foreground">
          Every row ties to evidence captured during the run. UNKNOWN is not a pass. Verify
          integrations and IAM, then re-run.
        </p>
        <div className="rounded-lg border border-border/60 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-[110px]">Domain</TableHead>
                <TableHead>Control</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[140px] hidden md:table-cell">Frameworks</TableHead>
                <TableHead>Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedControls.map((cr) => {
                const def = getControlMeta(cr.controlId);
                const cat = def?.category ?? "POLICY";
                return (
                  <TableRow key={cr.id}>
                    <TableCell className="align-top">
                      <Badge variant="outline" className={cn("text-[10px]", CATEGORY_BADGE[cat])}>
                        {cat}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium align-top max-w-[220px]">
                      {def?.title ?? cr.controlId}
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge
                        variant={
                          cr.status === "PASS"
                            ? "default"
                            : cr.status === "FAIL"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {cr.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground align-top hidden md:table-cell">
                      {(def?.frameworkTags ?? []).join(", ")}
                    </TableCell>
                    <TableCell className="text-sm align-top max-w-xl">
                      <span className="text-foreground/90">{cr.message}</span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </TabsContent>

      <TabsContent value="evidence" className="mt-6 space-y-6">
        <Card className="border-border/60 bg-card/40">
          <CardHeader>
            <CardTitle className="text-lg">On-chain & storage</CardTitle>
            <CardDescription>
              Tamper-evident bundle on 0G Storage; transaction on Galileo ChainScan.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {run.storageTxHash && run.storageTxHash !== "0x" + "0".repeat(64) && (
              <a
                href={chainTxUrl(run.storageTxHash)}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4 font-mono text-xs block"
              >
                ChainScan: {run.storageTxHash.slice(0, 22)}…
              </a>
            )}
            {run.ogEvidenceUri && (
              <a
                href={run.ogEvidenceUri}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4 block"
              >
                Storage explorer / root reference
              </a>
            )}
            <div className="flex flex-wrap gap-2">
              <CopyJsonButton label="Copy anchor JSON" value={JSON.stringify(evidenceJson, null, 2)} />
              <CopyJsonButton label="Copy full report JSON" value={fullReportJson} />
            </div>
            <pre className="text-xs bg-muted/40 p-4 rounded-lg overflow-auto max-h-72 border border-border/50">
              {JSON.stringify(evidenceJson, null, 2)}
            </pre>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/40">
          <CardHeader>
            <CardTitle className="text-base">Stored report payload</CardTitle>
            <CardDescription className="text-xs">
              Exact object persisted for auditors and integrations (includes program snapshot when
              present).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted/40 p-4 rounded-lg overflow-auto max-h-[28rem] border border-border/50">
              {fullReportJson}
            </pre>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
