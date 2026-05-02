/** Display metadata for controls (kept in the UI package; backend owns evaluation). */

export type ControlCategory = "GITHUB" | "AWS" | "POLICY";

export type ControlMeta = {
  title: string;
  frameworkTags: string[];
  category: ControlCategory;
};

const MAP: Record<string, ControlMeta> = {
  GITHUB_BRANCH_PROTECTION: {
    title: "Branch protection on default branch",
    frameworkTags: ["SOC2", "ISO27001"],
    category: "GITHUB",
  },
  GITHUB_REQUIRED_REVIEWS: {
    title: "Required pull request reviews",
    frameworkTags: ["SOC2", "ISO27001"],
    category: "GITHUB",
  },
  GITHUB_STATUS_CHECKS: {
    title: "Required status checks",
    frameworkTags: ["SOC2", "ISO27001"],
    category: "GITHUB",
  },
  GITHUB_CODEOWNERS: {
    title: "CODEOWNERS file present",
    frameworkTags: ["SOC2", "ISO27001"],
    category: "GITHUB",
  },
  GITHUB_SECRETS_SCAN: {
    title: "No obvious committed secrets (heuristic)",
    frameworkTags: ["SOC2", "ISO27001", "PCI", "HIPAA"],
    category: "GITHUB",
  },
  AWS_CLOUDTRAIL_ENABLED: {
    title: "CloudTrail logging enabled",
    frameworkTags: ["SOC2", "ISO27001", "HIPAA"],
    category: "AWS",
  },
  AWS_S3_ENCRYPTION: {
    title: "S3 default encryption",
    frameworkTags: ["SOC2", "ISO27001", "GDPR"],
    category: "AWS",
  },
  AWS_S3_PUBLIC_ACCESS: {
    title: "S3 public access posture",
    frameworkTags: ["SOC2", "ISO27001", "PCI", "HIPAA"],
    category: "AWS",
  },
  AWS_ROOT_MFA: {
    title: "Root account hardening",
    frameworkTags: ["SOC2", "ISO27001", "PCI", "HIPAA"],
    category: "AWS",
  },
  AWS_PASSWORD_POLICY: {
    title: "IAM password policy",
    frameworkTags: ["SOC2", "ISO27001", "HIPAA"],
    category: "AWS",
  },
  POLICY_SECURITY_DOC_PRESENT: {
    title: "Security policy document",
    frameworkTags: ["SOC2", "ISO27001", "GDPR", "HIPAA"],
    category: "POLICY",
  },
  POLICY_IR_DOC_PRESENT: {
    title: "Incident response plan",
    frameworkTags: ["SOC2", "ISO27001", "HIPAA"],
    category: "POLICY",
  },
};

export function getControlMeta(controlId: string): ControlMeta | undefined {
  return MAP[controlId];
}
