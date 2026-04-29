import type { ControlDef } from "../../../domain/controlLibrary";
import {
  fetchBranchProtection,
  fetchCodeowners,
  getDefaultBranch,
  scanRepoForSecrets,
} from "../../../integrations/github";
import {
  checkCloudTrailEnabled,
  checkPasswordPolicy,
  checkRootMFAAndKeys,
  checkS3EncryptionAndPublicAccess,
  type AwsCredentials,
} from "../../../integrations/aws";
import prisma from "../../../lib/db";

export type EvalRow = {
  controlId: string;
  status: "PASS" | "FAIL" | "UNKNOWN";
  message: string;
  rawData: Record<string, unknown>;
};

type GhCtx = { token: string; owner: string; repo: string };
type AwsCtx = AwsCredentials;

export async function evaluateAll(input: {
  organizationId: string;
  github?: GhCtx | null;
  aws?: AwsCtx | null;
  /** Controls in scope for this agent / framework run (subset of the global library). */
  activeControls: ControlDef[];
  /** Fires after each control finishes (for live progress UI). */
  onProgress?: (p: {
    row: EvalRow;
    index: number;
    total: number;
    title: string;
  }) => void | Promise<void>;
}): Promise<EvalRow[]> {
  const policies = await prisma.policyDocument.findMany({
    where: { organizationId: input.organizationId },
  });
  const securityDoc = policies.find((p) => p.kind === "SECURITY");
  const irDoc = policies.find((p) => p.kind === "IR");

  const rows: EvalRow[] = [];
  const total = input.activeControls.length;

  for (let i = 0; i < input.activeControls.length; i++) {
    const c = input.activeControls[i]!;
    const row = await evalOne(c, input, securityDoc, irDoc);
    rows.push(row);
    await input.onProgress?.({
      row,
      index: i + 1,
      total,
      title: c.title,
    });
  }
  return rows;
}

async function evalOne(
  control: ControlDef,
  input: { github?: GhCtx | null; aws?: AwsCtx | null },
  securityDoc: { textExtract: string | null } | undefined,
  irDoc: { textExtract: string | null } | undefined,
): Promise<EvalRow> {
  const { github, aws } = input;

  if (control.category === "GITHUB") {
    if (!github) {
      return {
        controlId: control.id,
        status: "UNKNOWN",
        message: "GitHub integration not connected.",
        rawData: { reason: "no_integration" },
      };
    }
    return evalGithubControl(control.id, github);
  }

  if (control.category === "AWS") {
    if (!aws) {
      return {
        controlId: control.id,
        status: "UNKNOWN",
        message: "AWS integration not connected.",
        rawData: { reason: "no_integration" },
      };
    }
    try {
      return await evalAwsControl(control.id, aws);
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      const friendly =
        /security token|invalid|InvalidClientTokenId|SignatureDoesNotMatch|could not load credentials/i.test(
          raw,
        )
          ? "AWS credentials rejected or expired; fix keys in Integrations. GitHub checks still ran."
          : raw;
      return {
        controlId: control.id,
        status: "UNKNOWN",
        message: friendly,
        rawData: { awsCallFailed: true, error: raw },
      };
    }
  }

  if (control.id === "POLICY_SECURITY_DOC_PRESENT") {
    return evalSecurityPolicy(securityDoc);
  }
  if (control.id === "POLICY_IR_DOC_PRESENT") {
    return evalIrPolicy(irDoc);
  }

  return {
    controlId: control.id,
    status: "UNKNOWN",
    message: "Policy control not implemented.",
    rawData: {},
  };
}

async function evalGithubControl(id: string, g: GhCtx): Promise<EvalRow> {
  const token = g.token;
  const { owner, repo } = g;
  const branch = await getDefaultBranch(token, owner, repo);

  if (id === "GITHUB_BRANCH_PROTECTION") {
    const bp = await fetchBranchProtection(token, owner, repo, branch);
    const ok = bp.enabled && !bp.allowsForcePushes;
    return {
      controlId: id,
      status: ok ? "PASS" : "FAIL",
      message: ok
        ? `Branch ${branch} is protected; force pushes disabled.`
        : `Branch protection missing or allows force pushes on ${branch}.`,
      rawData: { branch, ...bp },
    };
  }

  if (id === "GITHUB_REQUIRED_REVIEWS") {
    const bp = await fetchBranchProtection(token, owner, repo, branch);
    const ok = bp.enabled && bp.requiredReviewCount >= 1;
    return {
      controlId: id,
      status: ok ? "PASS" : "FAIL",
      message: ok
        ? `At least one approving review required (${bp.requiredReviewCount}).`
        : `Required reviews not configured (count: ${bp.requiredReviewCount}).`,
      rawData: { branch, requiredReviewCount: bp.requiredReviewCount },
    };
  }

  if (id === "GITHUB_STATUS_CHECKS") {
    const bp = await fetchBranchProtection(token, owner, repo, branch);
    const ok = bp.enabled && bp.requiredStatusChecks.length >= 1;
    return {
      controlId: id,
      status: ok ? "PASS" : "FAIL",
      message: ok
        ? `Status checks required: ${bp.requiredStatusChecks.slice(0, 5).join(", ")}${bp.requiredStatusChecks.length > 5 ? "…" : ""}`
        : "No required status checks on the default branch.",
      rawData: { branch, checks: bp.requiredStatusChecks },
    };
  }

  if (id === "GITHUB_CODEOWNERS") {
    const co = await fetchCodeowners(token, owner, repo);
    return {
      controlId: id,
      status: co.exists ? "PASS" : "FAIL",
      message: co.exists ? "CODEOWNERS file found." : "No CODEOWNERS file in common locations.",
      rawData: { exists: co.exists },
    };
  }

  if (id === "GITHUB_SECRETS_SCAN") {
    const scan = await scanRepoForSecrets(token, owner, repo);
    const ok = scan.findings.length === 0;
    return {
      controlId: id,
      status: ok ? "PASS" : "FAIL",
      message: ok
        ? `Heuristic scan passed (${scan.filesScanned} files).`
        : `Possible secrets in: ${scan.findings.map((f) => f.path).join(", ")}`,
      rawData: { ...scan },
    };
  }

  return {
    controlId: id,
    status: "UNKNOWN",
    message: "Unknown GitHub control.",
    rawData: {},
  };
}

async function evalAwsControl(id: string, c: AwsCredentials): Promise<EvalRow> {
  if (id === "AWS_CLOUDTRAIL_ENABLED") {
    const ct = await checkCloudTrailEnabled(c);
    const ok = ct.loggingTrailCount >= 1;
    return {
      controlId: id,
      status: ok ? "PASS" : "FAIL",
      message: ok
        ? `${ct.loggingTrailCount} trail(s) logging; ${ct.multiRegionTrailCount} multi-region.`
        : "No active CloudTrail logging detected.",
      rawData: ct as unknown as Record<string, unknown>,
    };
  }

  if (id === "AWS_S3_ENCRYPTION") {
    const s3 = await checkS3EncryptionAndPublicAccess(c);
    const ok = s3.bucketCount === 0 || s3.bucketsWithoutEncryption.length === 0;
    return {
      controlId: id,
      status: ok ? "PASS" : "FAIL",
      message: ok
        ? "All buckets have default encryption or no buckets."
        : `Missing default encryption: ${s3.bucketsWithoutEncryption.join(", ")}`,
      rawData: s3 as unknown as Record<string, unknown>,
    };
  }

  if (id === "AWS_S3_PUBLIC_ACCESS") {
    const s3 = await checkS3EncryptionAndPublicAccess(c);
    const ok = s3.bucketsPublicOrRisky.length === 0;
    return {
      controlId: id,
      status: ok ? "PASS" : "FAIL",
      message: ok
        ? "No buckets flagged with public policy or weak public access block."
        : `Review public access: ${s3.bucketsPublicOrRisky.join(", ")}`,
      rawData: s3 as unknown as Record<string, unknown>,
    };
  }

  if (id === "AWS_ROOT_MFA") {
    const r = await checkRootMFAAndKeys(c);
    const ok = r.mfaActive && r.accessKeyCount === 0;
    return {
      controlId: id,
      status: ok ? "PASS" : "FAIL",
      message: ok
        ? "Root MFA enabled; no root access keys."
        : `MFA: ${r.mfaActive}, root access keys: ${r.accessKeyCount}`,
      rawData: r as unknown as Record<string, unknown>,
    };
  }

  if (id === "AWS_PASSWORD_POLICY") {
    const p = await checkPasswordPolicy(c);
    return {
      controlId: id,
      status: p.ok ? "PASS" : "FAIL",
      message: p.ok
        ? "Password policy meets minimum length and complexity."
        : `Password policy weak (min length ${p.minLength}, complexity: ${p.requiresComplexity}).`,
      rawData: p as unknown as Record<string, unknown>,
    };
  }

  return {
    controlId: id,
    status: "UNKNOWN",
    message: "Unknown AWS control.",
    rawData: {},
  };
}

function evalSecurityPolicy(doc: { textExtract: string | null } | undefined): EvalRow {
  if (!doc?.textExtract?.trim()) {
    return {
      controlId: "POLICY_SECURITY_DOC_PRESENT",
      status: "UNKNOWN",
      message: "No security policy document uploaded.",
      rawData: { reason: "missing" },
    };
  }
  const t = doc.textExtract.toLowerCase();
  const hasAccess = /access\s*control|least\s*privilege|authorization|authentication/.test(t);
  const hasIr = /incident|security\s*event|breach/.test(t);
  const ok = hasAccess && hasIr;
  return {
    controlId: "POLICY_SECURITY_DOC_PRESENT",
    status: ok ? "PASS" : "FAIL",
    message: ok
      ? "Document mentions access control and incident-related themes."
      : "Add explicit access control and incident response themes to the security policy.",
    rawData: { hasAccess, hasIr },
  };
}

function evalIrPolicy(doc: { textExtract: string | null } | undefined): EvalRow {
  if (!doc?.textExtract?.trim()) {
    return {
      controlId: "POLICY_IR_DOC_PRESENT",
      status: "UNKNOWN",
      message: "No incident response document uploaded.",
      rawData: { reason: "missing" },
    };
  }
  const t = doc.textExtract.toLowerCase();
  const detect = /detect|detection|monitor|alert/.test(t);
  const comm = /communicat|notif|stakeholder|customer/.test(t);
  const remed = /remediat|recover|eradicate|contain/.test(t);
  const ok = detect && comm && remed;
  return {
    controlId: "POLICY_IR_DOC_PRESENT",
    status: ok ? "PASS" : "FAIL",
    message: ok
      ? "IR plan references detection, communication, and remediation patterns."
      : "Strengthen IR plan with detection, communication, and remediation steps.",
    rawData: { detect, comm, remed },
  };
}
