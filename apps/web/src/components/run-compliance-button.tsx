"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { getApiUrl } from "@/lib/api-url";
import { formatApiErrorText } from "@/lib/api-response";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const AGENTS = [
  { id: "soc2", label: "SOC 2", blurb: "Full control library in Trust Services style." },
  { id: "gdpr", label: "GDPR", blurb: "GDPR-tagged controls + shared baselines." },
  { id: "pci", label: "PCI DSS", blurb: "Cardholder-data readiness themes (subset)." },
  { id: "hipaa", label: "HIPAA", blurb: "HIPAA-tagged technical safeguards (subset)." },
] as const;

type AgentId = (typeof AGENTS)[number]["id"];

type ProgressLogEntry = {
  ts: string;
  kind: "phase" | "control" | "evidence" | "report";
  message: string;
  controlId?: string;
  status?: string;
};

type RunDetailPoll = {
  run: {
    id: string;
    status: string;
    agentId: string;
    progressLog?: ProgressLogEntry[] | null;
    errorMessage?: string | null;
    overallScore?: number | null;
  };
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function statusBadgeClass(s: string | undefined) {
  if (s === "PASS") return "border-emerald-500/50 bg-emerald-500/15 text-emerald-200";
  if (s === "FAIL") return "border-rose-500/50 bg-rose-500/15 text-rose-100";
  if (s === "UNKNOWN") return "border-amber-500/50 bg-amber-500/15 text-amber-100";
  return "border-border bg-muted/40 text-muted-foreground";
}

export function RunComplianceButton({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [agentId, setAgentId] = useState<AgentId>("soc2");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [lines, setLines] = useState<{ entry: ProgressLogEntry; agent?: string }[]>([]);
  const [modalTitle, setModalTitle] = useState("");

  async function fetchRun(runId: string, token: string): Promise<RunDetailPoll | null> {
    const res = await fetch(`${getApiUrl()}/v1/compliance/runs/${runId}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) return null;
    try {
      return JSON.parse(text) as RunDetailPoll;
    } catch {
      return null;
    }
  }

  async function pollUntilTerminal(
    runId: string,
    token: string,
    agentLabel: string,
    prefix?: { entry: ProgressLogEntry; agent?: string }[],
  ): Promise<"COMPLETED" | "FAILED"> {
    for (;;) {
      const data = await fetchRun(runId, token);
      if (data?.run) {
        const log = data.run.progressLog ?? [];
        const live = log.map((entry) => ({ entry, agent: agentLabel }));
        setLines(prefix?.length ? [...prefix, ...live] : live);
        if (data.run.status === "COMPLETED") return "COMPLETED";
        if (data.run.status === "FAILED") return "FAILED";
      }
      await sleep(450);
    }
  }

  async function runSingle() {
    setError(null);
    const token = session?.accessToken;
    if (!token) {
      setError("Not signed in");
      return;
    }
    setPending(true);
    setModalOpen(true);
    setLines([]);
    setModalTitle(`${AGENTS.find((a) => a.id === agentId)?.label ?? agentId} assessment`);
    try {
      const res = await fetch(`${getApiUrl()}/v1/compliance/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ organizationId, agentId }),
      });
      const text = await res.text();
      if (!res.ok) {
        setError(formatApiErrorText(res.status, text));
        setPending(false);
        setModalOpen(false);
        return;
      }
      let data: { runId?: string };
      try {
        data = JSON.parse(text) as { runId?: string };
      } catch {
        setError("Invalid response from compliance run.");
        setPending(false);
        setModalOpen(false);
        return;
      }
      if (!data.runId) {
        setError("No run ID in response.");
        setPending(false);
        setModalOpen(false);
        return;
      }
      const label = AGENTS.find((a) => a.id === agentId)?.label ?? agentId;
      const outcome = await pollUntilTerminal(data.runId, token, label);
      setPending(false);
      if (outcome === "COMPLETED") {
        setModalOpen(false);
        router.push(`/compliance/runs/${data.runId}`);
        router.refresh();
      } else {
        const last = await fetchRun(data.runId, token);
        setError(last?.run.errorMessage ?? "Run failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setPending(false);
    }
  }

  async function runAllFrameworks() {
    setError(null);
    const token = session?.accessToken;
    if (!token) {
      setError("Not signed in");
      return;
    }
    setPending(true);
    setModalOpen(true);
    setLines([]);
    setModalTitle("All frameworks (sequential)");
    try {
      let frozen: { entry: ProgressLogEntry; agent?: string }[] = [];
      for (const ag of AGENTS) {
        const banner = {
          entry: {
            ts: new Date().toISOString(),
            kind: "phase" as const,
            message: `━━━━━━━━ ${ag.label} (${ag.id}) ━━━━━━━━`,
          },
          agent: ag.label,
        };
        frozen = [...frozen, banner];
        setLines(frozen);

        const res = await fetch(`${getApiUrl()}/v1/compliance/run`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ organizationId, agentId: ag.id }),
        });
        const text = await res.text();
        if (!res.ok) {
          setError(formatApiErrorText(res.status, text));
          setPending(false);
          return;
        }
        const started = JSON.parse(text) as { runId?: string };
        if (!started.runId) {
          setError("No run ID");
          setPending(false);
          return;
        }

        const outcome = await pollUntilTerminal(started.runId, token, ag.label, frozen);
        const detail = await fetchRun(started.runId, token);
        const tail = (detail?.run.progressLog ?? []).map((entry) => ({
          entry,
          agent: ag.label,
        }));
        frozen = [...frozen, ...tail];
        setLines(frozen);

        if (outcome === "FAILED") {
          setError(detail?.run.errorMessage ?? `${ag.label} failed`);
          setPending(false);
          return;
        }

        frozen = [
          ...frozen,
          {
            entry: {
              ts: new Date().toISOString(),
              kind: "phase",
              message: `Finished ${ag.label}.`,
            },
            agent: ag.label,
          },
        ];
        setLines(frozen);
      }
      setPending(false);
      setModalOpen(false);
      router.push("/compliance/runs");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="agent">Compliance framework</Label>
          <select
            id="agent"
            className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value as AgentId)}
          >
            {AGENTS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {AGENTS.find((a) => a.id === agentId)?.blurb}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button size="lg" onClick={runSingle} disabled={pending} className="min-w-[200px]">
          {pending && modalTitle.includes("All frameworks") ? "Running…" : pending ? "Running…" : "Run compliance check"}
        </Button>
        <Button
          size="lg"
          variant="secondary"
          onClick={runAllFrameworks}
          disabled={pending}
          className="min-w-[200px]"
        >
          Run all frameworks
        </Button>
      </div>

      <p className="text-xs text-muted-foreground max-w-xl">
        Live activity streams from the API while controls execute (GitHub → AWS → policies → evidence →
        report). Each framework uses a different subset of checks. GDPR, PCI, and HIPAA agents only evaluate
        controls tagged for that lens.
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
            aria-label="Close"
            onClick={() => {
              if (!pending) setModalOpen(false);
            }}
          />
          <div className="relative z-10 flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-border bg-card shadow-2xl">
            <div className="border-b border-border px-4 py-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{modalTitle}</p>
                <p className="text-xs text-muted-foreground">
                  {pending ? "Streaming engine activity…" : "Done."}
                </p>
              </div>
              {!pending && (
                <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)}>
                  Close
                </Button>
              )}
            </div>
            <div className="min-h-[240px] flex-1 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed space-y-1.5 bg-muted/30">
              {lines.length === 0 && pending && (
                <p className="text-muted-foreground animate-pulse">Connecting to compliance engine…</p>
              )}
              {lines.map((row, i) => (
                <div
                  key={`${row.entry.ts}-${i}-${row.entry.message.slice(0, 40)}`}
                  className="flex flex-wrap items-start gap-2 border-b border-border/40 pb-1.5 last:border-0"
                >
                  <span className="text-muted-foreground shrink-0 tabular-nums w-[72px]">
                    {new Date(row.entry.ts).toLocaleTimeString()}
                  </span>
                  {row.agent && (
                    <span className="text-[9px] uppercase tracking-wide text-teal-500/90 w-12 truncate shrink-0">
                      {row.agent}
                    </span>
                  )}
                  {row.entry.kind === "control" && row.entry.status && (
                    <Badge variant="outline" className={cn("text-[9px] h-5 px-1", statusBadgeClass(row.entry.status))}>
                      {row.entry.status}
                    </Badge>
                  )}
                  <span className="text-foreground/95 flex-1 min-w-0 break-words">{row.entry.message}</span>
                  {row.entry.controlId && (
                    <code className="text-[10px] text-muted-foreground shrink-0">{row.entry.controlId}</code>
                  )}
                </div>
              ))}
            </div>
            <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground flex justify-between">
              <span>{lines.filter((l) => l.entry.kind === "control").length} control line(s) logged</span>
              <Link href="/compliance/runs" className="underline underline-offset-4">
                All runs
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
