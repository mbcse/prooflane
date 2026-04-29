import type { ControlDef } from "../../domain/controlLibrary";

export type ResultStatus = "PASS" | "FAIL" | "UNKNOWN";

const UNKNOWN_WEIGHT_FACTOR = 0.5;

export function computeOverallScore(
  results: { controlId: string; status: ResultStatus }[],
  controls: ControlDef[],
): number {
  const byId = new Map(controls.map((c) => [c.id, c]));
  let earned = 0;
  let possible = 0;
  for (const r of results) {
    const def = byId.get(r.controlId);
    if (!def) continue;
    possible += def.weight;
    if (r.status === "PASS") earned += def.weight;
    else if (r.status === "UNKNOWN") earned += def.weight * UNKNOWN_WEIGHT_FACTOR;
  }
  if (possible === 0) return 0;
  return Math.round((earned / possible) * 100);
}
