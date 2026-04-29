import OpenAI from "openai";
import type { ComplianceReportJson } from "../../server/ai/buildCompliancePrompt";

/** Legacy integratenetwork Router (OpenAI-style base already includes /v1). */
const DEFAULT_LEGACY_ROUTER =
  "https://router-api-testnet.integratenetwork.work/v1";

/**
 * Resolve OpenAI-compatible endpoint + key.
 *
 * Preferred: 0G Compute quickstart: set ZG_COMPUTE_SERVICE_URL (service host from
 * `get-secret`) + ZG_COMPUTE_API_SECRET (Bearer token). Client uses `${SERVICE_URL}/v1/proxy`.
 * @see https://build.0g.ai/compute/#quickstart
 *
 * Legacy: OG_ROUTER_BASE_URL + OG_ROUTER_API_KEY (integratenetwork-style).
 */
function resolveClientConfig(): {
  apiKey: string | undefined;
  baseURL: string;
  model: string;
} {
  const serviceUrl =
    process.env.ZG_COMPUTE_SERVICE_URL?.replace(/\/$/, "") ?? "";
  const computeSecret = process.env.ZG_COMPUTE_API_SECRET;
  const legacyKey = process.env.OG_ROUTER_API_KEY;
  const legacyBase =
    process.env.OG_ROUTER_BASE_URL ?? DEFAULT_LEGACY_ROUTER;

  const model =
    process.env.ZG_COMPUTE_MODEL ??
    process.env.OG_ROUTER_MODEL ??
    "qwen/qwen-2.5-7b-instruct";

  if (serviceUrl && computeSecret) {
    return {
      apiKey: computeSecret,
      baseURL: `${serviceUrl}/v1/proxy`,
      model,
    };
  }

  if (legacyKey) {
    return {
      apiKey: legacyKey,
      baseURL: legacyBase,
      model,
    };
  }

  return {
    apiKey: undefined,
    baseURL: legacyBase,
    model,
  };
}

/** True when ZG_COMPUTE_* quickstart or legacy OG_ROUTER_API_KEY is set (narrative model available). */
export function isNarrativeModelConfigured(): boolean {
  const serviceUrl = process.env.ZG_COMPUTE_SERVICE_URL?.replace(/\/$/, "") ?? "";
  const computeSecret = process.env.ZG_COMPUTE_API_SECRET;
  const legacyKey = process.env.OG_ROUTER_API_KEY;
  return Boolean((serviceUrl && computeSecret) || legacyKey);
}

/**
 * Generate compliance narrative via 0G Compute (OpenAI-compatible).
 * @see https://build.0g.ai/compute/#quickstart
 */
export async function generateComplianceReport(
  systemPrompt: string,
  userPrompt: string,
): Promise<ComplianceReportJson> {
  const { apiKey, baseURL, model } = resolveClientConfig();

  if (!apiKey) {
    console.warn(
      "[0G Compute] Narrative model unavailable: set ZG_COMPUTE_SERVICE_URL + ZG_COMPUTE_API_SECRET or OG_ROUTER_API_KEY. Using control-led summary. See npm run 0g:compute-setup",
    );
    return structuredFallbackReport();
  }

  const client = new OpenAI({ apiKey, baseURL });

  try {
    const res = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
    });

    const text = res.choices[0]?.message?.content ?? "";
    return parseReportJson(text);
  } catch (e) {
    const detail = formatLlmError(e);
    if (/insufficient balance|locked balance|Provider proxy.*balance/i.test(detail)) {
      console.warn(
        "[0G Compute] Request rejected: ledger balance too low. Top up or increase OG_COMPUTE_TRANSFER_AMOUNT. Using control-led summary. Detail:",
        detail.slice(0, 500),
      );
    } else {
      console.warn(
        "[0G Compute] Narrative request failed; using control-led summary. Detail:",
        detail.slice(0, 500),
      );
    }
    return structuredFallbackReport();
  }
}

function formatLlmError(e: unknown): string {
  if (typeof e === "object" && e !== null) {
    const o = e as Record<string, unknown>;
    if (typeof o.error === "string") return o.error;
    if (o.error && typeof o.error === "object") {
      try {
        return JSON.stringify(o.error);
      } catch {
        /* fall through */
      }
    }
  }
  if (e instanceof Error) {
    const anyE = e as Error & { error?: unknown; status?: number };
    const nested =
      anyE.error !== undefined
        ? typeof anyE.error === "string"
          ? anyE.error
          : JSON.stringify(anyE.error)
        : "";
    return `${anyE.message}${nested ? ` ${nested}` : ""}`;
  }
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

function structuredFallbackReport(): ComplianceReportJson {
  return {
    executiveSummary:
      "Assessment complete against the active control library. Detailed findings and scores below reflect live checks for this organization.",
    strengths: [
      "Control evaluation completed end to end for this run.",
      "Evidence and scores were derived from configured integrations and policies.",
    ],
    topFixesNext7Days: [],
    frameworkMapping:
      "SOC 2 and ISO 27001 expect auditable access controls, logging, and secure configuration. Technical checks here align with those themes.",
    categoryCommentary: {
      github: "GitHub controls reflect change management and code integrity.",
      aws: "AWS controls reflect logging, data protection, and IAM hygiene.",
      policy: "Policy documents support governance and incident readiness.",
    },
    modelNarrativeRendered: false,
  };
}

function parseReportJson(text: string): ComplianceReportJson {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return structuredFallbackReport();
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as ComplianceReportJson;
    if (!parsed.executiveSummary) return structuredFallbackReport();
    return { ...parsed, modelNarrativeRendered: true };
  } catch {
    return structuredFallbackReport();
  }
}
