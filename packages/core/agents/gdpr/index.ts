import type { ComplianceAgent } from "../types";
import { SYSTEM_PROMPT_PREFIX } from "./prompt";

export const agent: ComplianceAgent = {
  id: "gdpr",
  label: "GDPR",
  description:
    "EU-focused narrative using GDPR-tagged controls — Article 32 security of processing and accountability themes.",
  appliesTo: (c) => c.frameworkTags.includes("GDPR"),
  systemPromptPrefix: SYSTEM_PROMPT_PREFIX,
  frameworkMappingLabel:
    "GDPR Articles 5, 32, 33–34 themes (technical measures & breach readiness — non-legal summary)",
};
