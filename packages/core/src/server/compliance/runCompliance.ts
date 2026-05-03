import { defaultAgent, getAgent } from "../../../agents/registry";
import type { ComplianceAgent } from "../../../agents/types";
import { CONTROLS } from "../../domain/controlLibrary";
import type { AwsCredentials } from "../../integrations/aws";
import { anchorSnapshot } from "../../integrations/zerog/anchor";
import { generateComplianceReport, isNarrativeModelConfigured } from "../../integrations/zerog/llm";
import { storeEvidence } from "../../integrations/zerog/storage";
import prisma from "../../lib/db";
import { buildCompliancePrompt } from "../ai/buildCompliancePrompt";
import { groundComplianceReport } from "../ai/groundReport";
import { evaluateAll } from "./evaluators/runEvaluators";
import { computeOverallScore } from "./scoring";

type GhConfig = { token: string; owner: string; repo: string };

export type ProgressLogEntry = {
  ts: string;
  kind: "phase" | "control" | "evidence" | "report";
  message: string;
  controlId?: string;
  status?: string;
};

function resolveAgent(agentId?: string): ComplianceAgent {
  if (!agentId) return defaultAgent();
  return getAgent(agentId) ?? defaultAgent();
}

async function appendProgress(runId: string, partial: Omit<ProgressLogEntry, "ts">) {
  const run = await prisma.complianceRun.findUnique({
    where: { id: runId },
    select: { progressLog: true },
  });
  const prev = (run?.progressLog as ProgressLogEntry[] | null) ?? [];
  const entry: ProgressLogEntry = {
    ...partial,
    ts: new Date().toISOString(),
  };
  await prisma.complianceRun.update({
    where: { id: runId },
    data: { progressLog: [...prev, entry] as object },
  });
}

async function runComplianceWork(
  runId: string,
  organizationId: string,
  triggeredByUserId: string,
  agent: ComplianceAgent,
) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: { integrations: true },
  });
  if (!org) throw new Error("Organization not found");

  const activeControls = CONTROLS.filter((c) => agent.appliesTo(c));

  try {
    await appendProgress(runId, {
      kind: "phase",
      message: `Framework: ${agent.label} (${agent.id}): evaluating ${activeControls.length} control(s).`,
    });

    const ghInt = org.integrations.find((i) => i.type === "GITHUB" && i.status === "CONNECTED");
    const awsInt = org.integrations.find((i) => i.type === "AWS" && i.status === "CONNECTED");

    let github: GhConfig | null = null;
    if (ghInt?.config) {
      const c = ghInt.config as Record<string, unknown>;
      if (c.token && c.owner && c.repo) {
        github = {
          token: String(c.token),
          owner: String(c.owner),
          repo: String(c.repo),
        };
      }
    }

    let aws: AwsCredentials | null = null;
    if (awsInt?.config) {
      const c = awsInt.config as Record<string, unknown>;
      if (c.accessKeyId && c.secretAccessKey && c.region) {
        aws = {
          accessKeyId: String(c.accessKeyId),
          secretAccessKey: String(c.secretAccessKey),
          region: String(c.region),
        };
      }
    }

    await appendProgress(runId, {
      kind: "phase",
      message: github
        ? `Connected to GitHub repository ${github.owner}/${github.repo}.`
        : "GitHub not connected. GitHub-scoped checks will return UNKNOWN.",
    });
    await appendProgress(runId, {
      kind: "phase",
      message: aws
        ? `AWS connected (region ${aws.region}).`
        : "AWS not connected. AWS-scoped checks will return UNKNOWN.",
    });

    await appendProgress(runId, {
      kind: "phase",
      message: "Loading policy documents from your organization…",
    });

    const evalRows = await evaluateAll({
      organizationId,
      github,
      aws,
      activeControls,
      onProgress: async ({ row, index, total, title }) => {
        await appendProgress(runId, {
          kind: "control",
          controlId: row.controlId,
          status: row.status,
          message: `[${index}/${total}] ${title} → ${row.status}`,
        });
      },
    });

    await appendProgress(runId, {
      kind: "evidence",
      message: "Serializing evidence bundle and uploading to 0G Storage…",
    });

    const evidenceBundle = {
      agentId: agent.id,
      agentLabel: agent.label,
      organizationId,
      organizationName: org.name,
      runId,
      at: new Date().toISOString(),
      results: evalRows.map((r) => ({
        controlId: r.controlId,
        status: r.status,
        message: r.message,
        rawData: r.rawData,
      })),
    };

    const stored = await storeEvidence(evidenceBundle);
    if (stored.degraded) {
      await appendProgress(runId, {
        kind: "evidence",
        message:
          "Evidence fingerprint recorded locally (0G upload skipped or timed out). Continuing to scoring and report.",
      });
    }
    const anchored = await anchorSnapshot(stored.txHash);

    const evidencePointer = stored.storagescanUrl;

    await appendProgress(runId, {
      kind: "evidence",
      message: stored.degraded
        ? "Computing weighted score…"
        : `Evidence anchored (root hash recorded). Computing weighted score…`,
    });

    await prisma.controlResult.createMany({
      data: evalRows.map((r) => ({
        complianceRunId: runId,
        controlId: r.controlId,
        status: r.status,
        rawData: r.rawData as object,
        evidencePointer,
        message: r.message,
      })),
    });

    const overallScore = computeOverallScore(
      evalRows.map((r) => ({ controlId: r.controlId, status: r.status })),
      activeControls,
    );

    const controlMeta = new Map(activeControls.map((c) => [c.id, c]));
    const prompt = buildCompliancePrompt(
      {
        organizationName: org.name,
        overallScore,
        controlResults: evalRows.map((r) => {
          const def = controlMeta.get(r.controlId);
          return {
            controlId: r.controlId,
            title: def?.title ?? r.controlId,
            status: r.status,
            message: r.message,
            frameworkTags: def?.frameworkTags ?? [],
          };
        }),
        controls: activeControls,
        envSummary: {
          github: github ? `${github.owner}/${github.repo}` : undefined,
          aws: aws ? `region ${aws.region}` : undefined,
          policy: "see POLICY_* control results",
        },
      },
      {
        id: agent.id,
        label: agent.label,
        systemPromptPrefix: agent.systemPromptPrefix,
        frameworkMappingLabel: agent.frameworkMappingLabel,
      },
    );

    const model =
      process.env.ZG_COMPUTE_MODEL ??
      process.env.OG_ROUTER_MODEL ??
      "router-default";

    await appendProgress(runId, {
      kind: "report",
      message: "Generating compliance narrative…",
    });

    const reportJson = await generateComplianceReport(prompt.system, prompt.user);
    const grounded = groundComplianceReport({
      report: reportJson,
      evalRows,
      activeControls,
      organizationName: org.name,
      overallScore,
      envSummary: {
        github: github ? `${github.owner}/${github.repo}` : undefined,
        aws: aws ? `region ${aws.region}` : undefined,
        policy: "see POLICY_* control results",
      },
      llmConfigured: isNarrativeModelConfigured(),
    });

    await prisma.report.create({
      data: {
        complianceRunId: runId,
        aiSummary: grounded.executiveSummary,
        aiDetails: grounded as object,
      },
    });

    await prisma.complianceRun.update({
      where: { id: runId },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
        overallScore,
        storageRootHash: stored.rootHash,
        storageTxHash: stored.txHash,
        ogEvidenceUri: evidencePointer,
        ogEvidenceHash: stored.rootHash,
        routerModel: model,
      },
    });

    await appendProgress(runId, {
      kind: "phase",
      message: `Run complete. Readiness score: ${overallScore}/100.`,
    });

    return { runId, anchored, agentId: agent.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    await appendProgress(runId, {
      kind: "phase",
      message: `Failed: ${msg}`,
    });
    await prisma.complianceRun.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorMessage: msg,
      },
    });
    throw e;
  }
}

/** Full synchronous run (waits until finished). Webhooks and tests can use this. */
export async function runCompliance(
  organizationId: string,
  triggeredByUserId: string,
  options?: { agentId?: string },
) {
  const agent = resolveAgent(options?.agentId);

  const run = await prisma.complianceRun.create({
    data: {
      organizationId,
      triggeredByUserId,
      status: "RUNNING",
      agentId: agent.id,
    },
  });

  return runComplianceWork(run.id, organizationId, triggeredByUserId, agent);
}

/**
 * Creates the run row and executes work in the background so the API can return `runId`
 * immediately while the client polls for `progressLog`.
 */
export async function queueComplianceRun(
  organizationId: string,
  triggeredByUserId: string,
  options?: { agentId?: string },
): Promise<{ runId: string }> {
  const agent = resolveAgent(options?.agentId);

  const run = await prisma.complianceRun.create({
    data: {
      organizationId,
      triggeredByUserId,
      status: "RUNNING",
      agentId: agent.id,
    },
  });

  void runComplianceWork(run.id, organizationId, triggeredByUserId, agent).catch((err) => {
    console.error("[queueComplianceRun]", run.id, err);
  });

  return { runId: run.id };
}
