import type { ComplianceAgent } from "../types";
import { SYSTEM_PROMPT_PREFIX } from "./prompt";

export const agent: ComplianceAgent = {
  id: "soc2",
  label: "SOC 2",
  description:
    "Trust Services Criteria–oriented narrative across the full technical control set (GitHub, AWS, policies).",
  appliesTo: () => true,
  systemPromptPrefix: SYSTEM_PROMPT_PREFIX,
  frameworkMappingLabel:
    "SOC 2 Trust Services Criteria — Common Criteria themes (CC6/CC7/CC8 emphasis; informal mapping)",
};
