import type { ControlCategory, ControlDef } from "../../domain/controlLibrary";
import type { EvalRow } from "../compliance/evaluators/runEvaluators";
import type { ComplianceReportJson, ProgramSnapshot } from "./buildCompliancePrompt";

const CATEGORY_LABEL: Record<ControlCategory, string> = {
  GITHUB: "GitHub & change management",
  AWS: "AWS & infrastructure",
  POLICY: "Policies & governance",
};

/** Legacy saved summaries that embedded setup instructions (detect for grounding behavior only). */
const LEGACY_SETUP_HINT_MARKERS = ["npm run 0g:compute-setup", "0g:compute-setup", "ZG_COMPUTE_"];

function executiveSummaryHasLegacySetupHints(text: string): boolean {
  return LEGACY_SETUP_HINT_MARKERS.some((m) => text.includes(m));
}

function fixTitleLooksLikeSetupRouter(title: string): boolean {
  return title.includes("0G Compute") || title.includes("ZG_COMPUTE");
}

type GroundInput = {
  report: ComplianceReportJson;
  evalRows: EvalRow[];
  activeControls: ControlDef[];
  organizationName: string;
  overallScore: number;
  envSummary: { github?: string; aws?: string; policy?: string };
  llmConfigured: boolean;
};

type ControlStats = {
  passCount: number;
  failCount: number;
  unknownCount: number;
  byCategory: ProgramSnapshot["byCategory"];
};

function collectControlStats(
  evalRows: EvalRow[],
  activeControls: ControlDef[],
): ControlStats {
  let passCount = 0;
  let failCount = 0;
  let unknownCount = 0;
  const byCategoryMap = new Map<
    ControlCategory,
    { pass: number; fail: number; unknown: number; total: number }
  >();

  for (const cat of ["GITHUB", "AWS", "POLICY"] as ControlCategory[]) {
    byCategoryMap.set(cat, { pass: 0, fail: 0, unknown: 0, total: 0 });
  }

  const rowById = new Map(evalRows.map((r) => [r.controlId, r]));

  for (const def of activeControls) {
    const row = rowById.get(def.id);
    const bucket = byCategoryMap.get(def.category);
    if (!bucket) continue;
    bucket.total += 1;
    const status = row?.status ?? "UNKNOWN";
    if (status === "PASS") {
      passCount += 1;
      bucket.pass += 1;
    } else if (status === "FAIL") {
      failCount += 1;
      bucket.fail += 1;
    } else {
      unknownCount += 1;
      bucket.unknown += 1;
    }
  }

  const byCategory: ProgramSnapshot["byCategory"] = (
    ["GITHUB", "AWS", "POLICY"] as ControlCategory[]
  ).map((id) => {
    const b = byCategoryMap.get(id)!;
    return {
      id,
      label: CATEGORY_LABEL[id],
      pass: b.pass,
      fail: b.fail,
      unknown: b.unknown,
      total: b.total,
    };
  });

  return { passCount, failCount, unknownCount, byCategory };
}

function buildProgramSnapshot(
  input: GroundInput,
  stats: ControlStats,
  aiNarrativeActive: boolean,
): ProgramSnapshot {
  const { overallScore, llmConfigured, activeControls } = input;

  return {
    overallScore,
    passCount: stats.passCount,
    failCount: stats.failCount,
    unknownCount: stats.unknownCount,
    totalControls: activeControls.length,
    byCategory: stats.byCategory,
    llmConfigured,
    aiNarrativeActive,
    assessedAt: new Date().toISOString(),
  };
}

function buildDataLeadParagraph(input: GroundInput, stats: ControlStats): string {
  const { organizationName, overallScore, envSummary } = input;

  const parts: string[] = [];
  parts.push(
    `This run assessed ${organizationName} against ${input.activeControls.length} active controls. Weighted readiness score: ${overallScore}/100.`,
  );
  parts.push(
    `Raw outcomes: ${stats.passCount} passed, ${stats.failCount} failed, ${stats.unknownCount} not verified (UNKNOWN may mean missing integration or inconclusive signal).`,
  );

  const gh = envSummary.github ? `GitHub ${envSummary.github}` : "GitHub not connected";
  const aws = envSummary.aws ? `AWS (${envSummary.aws})` : "AWS not connected";
  parts.push(`Integrations at assessment time: ${gh}; ${aws}.`);

  return parts.join(" ");
}

function buildMetricsLedBody(input: GroundInput): string {
  const controlMeta = new Map(input.activeControls.map((c) => [c.id, c]));
  const rowById = new Map(input.evalRows.map((r) => [r.controlId, r]));

  const paragraphs: string[] = [];

  const fails = input.evalRows.filter((r) => r.status === "FAIL");
  const unks = input.evalRows.filter((r) => r.status === "UNKNOWN");

  if (fails.length === 0 && unks.length === 0) {
    paragraphs.push(
      "All checks returned PASS for the configured scope. Keep monitoring as repositories and cloud accounts change; automate these checks on every release or weekly.",
    );
  } else {
    if (fails.length > 0) {
      paragraphs.push(
        `${fails.length} control(s) failed and should be remediated to align with common SOC 2 / ISO 27001 expectations for secure engineering and logging.`,
      );
    }
    if (unks.length > 0) {
      paragraphs.push(
        `${unks.length} control(s) could not be verified. UNKNOWN often indicates missing GitHub or AWS credentials, API errors, or insufficient evidence. Resolve connectivity before treating them as green.`,
      );
    }
  }

  const awsUnknownWithNote = unks.filter(
    (r) =>
      controlMeta.get(r.controlId)?.category === "AWS" &&
      Boolean(r.rawData?.awsCallFailed),
  );
  if (awsUnknownWithNote.length > 0) {
    paragraphs.push(
      "Some AWS-scoped checks returned UNKNOWN because the AWS API call failed (credentials, permissions, or token). GitHub and policy checks are unaffected; rotate keys or attach the IAM policy expected by this product, then re-run.",
    );
  }

  return paragraphs.join("\n\n");
}

function strengthBullets(input: GroundInput): string[] {
  const controlMeta = new Map(input.activeControls.map((c) => [c.id, c]));
  return input.evalRows
    .filter((r) => r.status === "PASS")
    .map((r) => {
      const def = controlMeta.get(r.controlId);
      if (!def) return `${r.controlId} passed.`;
      return `${def.title}: criteria met.`;
    });
}

function remediationItems(input: GroundInput): ComplianceReportJson["topFixesNext7Days"] {
  const controlMeta = new Map(input.activeControls.map((c) => [c.id, c]));
  const ranked = [...input.evalRows].filter(
    (r) => r.status === "FAIL" || r.status === "UNKNOWN",
  );
  ranked.sort((a, b) => {
    if (a.status !== b.status) return a.status === "FAIL" ? -1 : 1;
    const aw =
      Boolean(a.rawData?.awsCallFailed) === Boolean(b.rawData?.awsCallFailed)
        ? 0
        : a.rawData?.awsCallFailed
          ? -1
          : 1;
    return aw;
  });

  return ranked.slice(0, 8).map((r) => {
    const def = controlMeta.get(r.controlId);
    return {
      title: def?.title ?? r.controlId,
      detail: r.message,
      controlId: r.controlId,
    };
  });
}

function mergeUniqueBullets(base: string[], extra: string[], max = 10): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of [...extra, ...base]) {
    const k = s.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

function mergeFixes(
  dataFixes: ComplianceReportJson["topFixesNext7Days"],
  aiFixes: ComplianceReportJson["topFixesNext7Days"] | undefined,
  allowSupplementalFromModel: boolean,
): ComplianceReportJson["topFixesNext7Days"] {
  const out: ComplianceReportJson["topFixesNext7Days"] = [...dataFixes];
  const ids = new Set(out.map((f) => f.controlId).filter(Boolean));
  for (const f of aiFixes ?? []) {
    if (!allowSupplementalFromModel && fixTitleLooksLikeSetupRouter(f.title)) continue;
    if (f.controlId && ids.has(f.controlId)) continue;
    if (!f.controlId && fixTitleLooksLikeSetupRouter(f.title)) continue;
    out.push(f);
    if (f.controlId) ids.add(f.controlId);
  }
  return out.slice(0, 10);
}

function categoryLines(
  input: GroundInput,
  stats: ControlStats,
): ComplianceReportJson["categoryCommentary"] {
  const { byCategory } = stats;
  const rowById = new Map(input.evalRows.map((r) => [r.controlId, r]));

  function lineFor(cat: "GITHUB" | "AWS" | "POLICY"): string {
    const snap = byCategory.find((b) => b.id === cat)!;
    if (snap.total === 0) {
      return `No ${CATEGORY_LABEL[cat]} controls were in scope for this agent.`;
    }
    const parts = [`${snap.pass}/${snap.total} passed`];
    if (snap.fail) parts.push(`${snap.fail} failed`);
    if (snap.unknown) parts.push(`${snap.unknown} unknown`);

    const titlesInCat = input.activeControls
      .filter((c) => c.category === cat)
      .map((c) => {
        const r = rowById.get(c.id);
        if (r?.status === "FAIL") return c.title;
        return null;
      })
      .filter(Boolean) as string[];

    let detail = `${CATEGORY_LABEL[cat]}: ${parts.join(", ")}.`;
    if (titlesInCat.length > 0) {
      detail += ` Focus: ${titlesInCat.slice(0, 3).join("; ")}${titlesInCat.length > 3 ? "…" : "."}`;
    }
    return detail;
  }

  return {
    github: lineFor("GITHUB"),
    aws: lineFor("AWS"),
    policy: lineFor("POLICY"),
  };
}

/**
 * Merge narrative model output with live control metrics so stored reports stay accurate when the model is unavailable.
 */
export function groundComplianceReport(input: GroundInput): ComplianceReportJson {
  const { report, llmConfigured } = input;

  const stats = collectControlStats(input.evalRows, input.activeControls);

  const metricsLedExecutiveSummary =
    !llmConfigured ||
    !report.executiveSummary ||
    executiveSummaryHasLegacySetupHints(report.executiveSummary) ||
    report.modelNarrativeRendered === false;
  const aiNarrativeActive = llmConfigured && !metricsLedExecutiveSummary;

  const dataLead = buildDataLeadParagraph(input, stats);
  let executiveSummary: string;
  if (aiNarrativeActive) {
    executiveSummary = `${dataLead}\n\n${report.executiveSummary.trim()}`;
  } else {
    const body = buildMetricsLedBody(input);
    const hint = llmConfigured
      ? ""
      : "\n\nAdd ZG_COMPUTE_SERVICE_URL and ZG_COMPUTE_API_SECRET (or OG_ROUTER_API_KEY) for expanded narrative prose alongside these metrics.";
    executiveSummary = `${dataLead}\n\n${body}${hint}`.trim();
  }

  const dataStrengths = strengthBullets(input);
  const strengths = mergeUniqueBullets(report.strengths ?? [], dataStrengths, 10);

  const dataFixes = remediationItems(input);
  const allPass =
    input.activeControls.length > 0 &&
    stats.passCount === input.activeControls.length;
  const allowSupplementalFromModel = dataFixes.length === 0 && !allPass;
  const topFixesNext7Days = mergeFixes(dataFixes, report.topFixesNext7Days, allowSupplementalFromModel);

  const categoryCommentary = metricsLedExecutiveSummary
    ? categoryLines(input, stats)
    : {
        github: report.categoryCommentary.github,
        aws: report.categoryCommentary.aws,
        policy: report.categoryCommentary.policy,
      };

  const frameworkMapping =
    metricsLedExecutiveSummary || !report.frameworkMapping?.trim()
      ? "Technical controls map to SOC 2 (change management, logging, access) and ISO 27001 (A.5, A.8, A.12 themes). Use failures and UNKNOWN rows as audit backlog items, not as legal attestations."
      : report.frameworkMapping;

  const programSnapshot = buildProgramSnapshot(input, stats, aiNarrativeActive);

  return {
    executiveSummary,
    strengths,
    topFixesNext7Days,
    frameworkMapping,
    categoryCommentary,
    programSnapshot,
    modelNarrativeRendered: aiNarrativeActive,
  };
}
