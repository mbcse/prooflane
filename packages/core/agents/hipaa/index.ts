import type { ComplianceAgent } from "../types";
import { SYSTEM_PROMPT_PREFIX } from "./prompt";

export const agent: ComplianceAgent = {
  id: "hipaa",
  label: "HIPAA Security Rule",
  description:
    "US healthcare-oriented narrative — Administrative / Technical safeguard themes from HIPAA-tagged controls.",
  appliesTo: (c) => c.frameworkTags.includes("HIPAA"),
  systemPromptPrefix: SYSTEM_PROMPT_PREFIX,
  frameworkMappingLabel:
    "HIPAA Security Rule safeguards (45 CFR Part 164 Subpart C — informal technical mapping; not OCR)",
};
