import { agent as gdpr } from "./gdpr";
import { agent as hipaa } from "./hipaa";
import { agent as pci } from "./pci";
import { agent as soc2 } from "./soc2";
import type { ComplianceAgent } from "./types";

export const AGENTS: ComplianceAgent[] = [soc2, gdpr, pci, hipaa];

export function getAgent(id: string): ComplianceAgent | undefined {
  return AGENTS.find((a) => a.id === id);
}

export function defaultAgent(): ComplianceAgent {
  return soc2;
}
