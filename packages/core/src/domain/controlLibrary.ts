export type ControlCategory = "GITHUB" | "AWS" | "POLICY";

export type ControlDef = {
  id: string;
  category: ControlCategory;
  title: string;
  description: string;
  weight: number;
  frameworkTags: string[];
};

export const CONTROLS: ControlDef[] = [
  {
    id: "GITHUB_BRANCH_PROTECTION",
    category: "GITHUB",
    title: "Branch protection on default branch",
    description:
      "Default branch (main/master) has branch protection and disallows direct pushes.",
    weight: 8,
    frameworkTags: ["SOC2", "ISO27001"],
  },
  {
    id: "GITHUB_REQUIRED_REVIEWS",
    category: "GITHUB",
    title: "Required pull request reviews",
    description: "At least one approving review is required before merging to the default branch.",
    weight: 8,
    frameworkTags: ["SOC2", "ISO27001"],
  },
  {
    id: "GITHUB_STATUS_CHECKS",
    category: "GITHUB",
    title: "Required status checks",
    description: "CI/status checks must pass before merge to the default branch.",
    weight: 7,
    frameworkTags: ["SOC2", "ISO27001"],
  },
  {
    id: "GITHUB_CODEOWNERS",
    category: "GITHUB",
    title: "CODEOWNERS file present",
    description: "Repository defines .github/CODEOWNERS for sensitive paths.",
    weight: 5,
    frameworkTags: ["SOC2", "ISO27001"],
  },
  {
    id: "GITHUB_SECRETS_SCAN",
    category: "GITHUB",
    title: "No obvious committed secrets (heuristic)",
    description: "Shallow scan did not find typical secret patterns in tracked text files.",
    weight: 9,
    frameworkTags: ["SOC2", "ISO27001", "PCI", "HIPAA"],
  },
  {
    id: "AWS_CLOUDTRAIL_ENABLED",
    category: "AWS",
    title: "CloudTrail logging enabled",
    description: "At least one multi-region trail is recording management events.",
    weight: 9,
    frameworkTags: ["SOC2", "ISO27001", "HIPAA"],
  },
  {
    id: "AWS_S3_ENCRYPTION",
    category: "AWS",
    title: "S3 default encryption",
    description: "All buckets have default encryption (AES256 or KMS).",
    weight: 7,
    frameworkTags: ["SOC2", "ISO27001", "GDPR"],
  },
  {
    id: "AWS_S3_PUBLIC_ACCESS",
    category: "AWS",
    title: "S3 public access posture",
    description: "No buckets allow public ACLs/policies, or prod/PII-tagged buckets are not public.",
    weight: 10,
    frameworkTags: ["SOC2", "ISO27001", "PCI", "HIPAA"],
  },
  {
    id: "AWS_ROOT_MFA",
    category: "AWS",
    title: "Root account hardening",
    description: "Root account has MFA enabled and no active access keys.",
    weight: 10,
    frameworkTags: ["SOC2", "ISO27001", "PCI", "HIPAA"],
  },
  {
    id: "AWS_PASSWORD_POLICY",
    category: "AWS",
    title: "IAM password policy",
    description: "Minimum length ≥ 12 with complexity requirements enabled.",
    weight: 6,
    frameworkTags: ["SOC2", "ISO27001", "HIPAA"],
  },
  {
    id: "POLICY_SECURITY_DOC_PRESENT",
    category: "POLICY",
    title: "Security policy document",
    description:
      "Uploaded security policy mentions access control and incident response (AI-assisted check).",
    weight: 6,
    frameworkTags: ["SOC2", "ISO27001", "GDPR", "HIPAA"],
  },
  {
    id: "POLICY_IR_DOC_PRESENT",
    category: "POLICY",
    title: "Incident response plan",
    description:
      "Uploaded IR plan covers detection, communication, and remediation (AI-assisted check).",
    weight: 6,
    frameworkTags: ["SOC2", "ISO27001", "HIPAA"],
  },
];

const byId = new Map(CONTROLS.map((c) => [c.id, c]));

export function getControlById(id: string): ControlDef | undefined {
  return byId.get(id);
}

export function controlsByCategory(category: ControlCategory): ControlDef[] {
  return CONTROLS.filter((c) => c.category === category);
}
