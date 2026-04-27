/**
 * Compliance agents live in `agents/<name>/` — one folder per framework / lens.
 * They filter which technical controls apply and shape the LLM system prompt.
 */

export type ControlLike = {
  id: string;
  frameworkTags: readonly string[];
  category: string;
};

export type ComplianceAgent = {
  id: string;
  label: string;
  description: string;
  /** Whether this control is in scope for this agent’s run. */
  appliesTo: (control: ControlLike) => boolean;
  /** Prepended to the base system prompt for the report LLM. */
  systemPromptPrefix: string;
  /** Shown in the JSON “frameworkMapping” instruction. */
  frameworkMappingLabel: string;
};
