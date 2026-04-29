import type { ControlDef } from "../../domain/controlLibrary";

export type ProgramSnapshot = {
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
  /** Narrative model credentials (0G Compute or router) were present when the run executed. */
  llmConfigured: boolean;
  /** Enriched consultant-style prose from the narrative model was merged into this report. */
  aiNarrativeActive: boolean;
  assessedAt: string;
};

export type ComplianceReportJson = {
  executiveSummary: string;
  strengths: string[];
  topFixesNext7Days: { title: string; detail: string; controlId?: string }[];
  frameworkMapping: string;
  categoryCommentary: {
    github: string;
    aws: string;
    policy: string;
  };
  /** True when executive summary JSON was returned from a successful narrative model response. */
  modelNarrativeRendered?: boolean;
  /** Populated server-side from live control results for dashboards and the report UI. */
  programSnapshot?: ProgramSnapshot;
};

export type PromptAgentLens = {
  id: string;
  label: string;
  systemPromptPrefix: string;
  frameworkMappingLabel: string;
};

const BASE_SYSTEM = `You are a senior compliance consultant for cloud-native B2B SaaS startups. You speak clearly and practically to founders and engineering leaders.

Evidence discipline:
- Ground every claim in the supplied control results table (control id, title, status, message) and the environment summary. Quote themes from titles/messages; do not invent tools, scans, teams, or timelines not evidenced.
- Treat UNKNOWN as a first-class outcome: explain likely causes (missing integration, token/API failure, inconclusive policy extraction) and why auditors or customers will ask again until it is resolved.
- Separate “what we measured” from “what good compliance programs also need outside this scan.”

Output discipline:
- Valid JSON only (exact schema requested). No markdown code fences. No trailing commentary outside JSON.

Depth:
- Prefer dense, specific prose over generic platitudes. Each section should read like a diligent human reviewer wrote it after reading every row of the control table.`;

export function buildCompliancePrompt(
  input: {
    organizationName: string;
    overallScore: number;
    controlResults: {
      controlId: string;
      title: string;
      status: string;
      message: string;
      frameworkTags: string[];
    }[];
    controls: ControlDef[];
    envSummary: {
      github?: string;
      aws?: string;
      policy?: string;
    };
  },
  agent: PromptAgentLens,
): { system: string; user: string } {
  const system = `${BASE_SYSTEM}

Active assessment lens: ${agent.label} (${agent.id}).
${agent.systemPromptPrefix}`;

  const table = input.controlResults.map((r) => ({
    id: r.controlId,
    title: r.title,
    status: r.status,
    message: r.message,
    tags: r.frameworkTags,
  }));

  const user = `
Organization: ${input.organizationName}
Overall readiness score (0-100): ${input.overallScore}

Environment summary:
- GitHub: ${input.envSummary.github ?? "not connected"}
- AWS: ${input.envSummary.aws ?? "not connected"}
- Policy docs: ${input.envSummary.policy ?? "none uploaded"}

Control results (use internally; do not dump this JSON verbatim in narrative text):
${JSON.stringify(table, null, 0)}

Produce a JSON object with exactly these keys:
{
  "executiveSummary": "2-4 paragraphs, plain English, high-level posture",
  "strengths": ["3-6 bullets"],
  "topFixesNext7Days": [{ "title": "", "detail": "", "controlId": "OPTIONAL_CONTROL_ID" }],
  "frameworkMapping": "short paragraph: how this maps to ${agent.frameworkMappingLabel}, no legalese",
  "categoryCommentary": {
    "github": "one short paragraph",
    "aws": "one short paragraph",
    "policy": "one short paragraph"
  }
}

Map remediation items to specific control IDs where possible.
`.trim();

  return { system, user };
}
