import type { ComplianceAgent } from "../types";
import { SYSTEM_PROMPT_PREFIX } from "./prompt";

export const agent: ComplianceAgent = {
  id: "pci",
  label: "PCI DSS",
  description:
    "Payment-card readiness narrative using PCI-tagged controls — maps to DSS goals, not a ROC or SAQ.",
  appliesTo: (c) => c.frameworkTags.includes("PCI"),
  systemPromptPrefix: SYSTEM_PROMPT_PREFIX,
  frameworkMappingLabel:
    "PCI DSS v4 goal areas & requirement themes (readiness snapshot — not PCI SSC validation)",
};
