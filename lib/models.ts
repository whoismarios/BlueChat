/**
 * Curated OpenAI model catalogue (as of October 2026).
 * Client-safe: no server-only imports.
 */
import type { ModelInfo, ReasoningEffort } from "./types";

export const MODELS: ModelInfo[] = [
  {
    id: "gpt-6.1-sol",
    label: "GPT-6.1 Sol",
    description: "Nahezu Spitzenqualität zu deutlich geringeren Kosten – ideal für den Alltag.",
    reasoningEfforts: ["low", "medium", "high", "xhigh"],
    defaultReasoningEffort: "medium",
    supportsWebSearch: true,
    supportsTools: true,
  },
  {
    id: "gpt-6-astra",
    label: "GPT-6 Astra",
    description: "Das leistungsstärkste Modell für besonders anspruchsvolle Analysen und komplexen Code.",
    reasoningEfforts: ["low", "medium", "high", "xhigh"],
    defaultReasoningEffort: "medium",
    supportsWebSearch: true,
    supportsTools: true,
  },
  {
    id: "gpt-6-luna",
    label: "GPT-6 Luna",
    description: "Sehr schnell und günstig – für einfache Fragen und Routineaufgaben.",
    reasoningEfforts: ["none", "low", "medium", "high", "xhigh"],
    defaultReasoningEffort: "low",
    supportsWebSearch: true,
    supportsTools: true,
  },
  {
    id: "gpt-5.6-terra",
    label: "GPT-5.6 Terra",
    description: "Vorherige Generation mit ausgewogenem Verhältnis von Qualität und Kosten.",
    reasoningEfforts: ["none", "low", "medium", "high", "xhigh"],
    defaultReasoningEffort: "medium",
    supportsWebSearch: true,
    supportsTools: true,
  },
  {
    id: "gpt-5.5",
    label: "GPT-5.5",
    description: "Bewährtes Reasoning-Modell der GPT-5-Reihe.",
    reasoningEfforts: ["none", "low", "medium", "high", "xhigh"],
    defaultReasoningEffort: "medium",
    supportsWebSearch: true,
    supportsTools: true,
  },
  {
    id: "gpt-4.1",
    label: "GPT-4.1",
    description: "Klassisches Modell ohne Reasoning – antwortet sofort.",
    reasoningEfforts: null,
    defaultReasoningEffort: null,
    supportsWebSearch: true,
    supportsTools: true,
  },
];

/** Default model for new conversations (if app settings don't specify one). */
export const DEFAULT_MODEL_ID = "gpt-6.1-sol";

/** Cheap, fast model used to generate conversation titles. */
export const TITLE_MODEL_ID = "gpt-6-luna";

export function getModel(id: string | null | undefined): ModelInfo | undefined {
  if (!id) return undefined;
  return MODELS.find((m) => m.id === id);
}

/** German labels for reasoning efforts (handy for pickers). */
export const REASONING_EFFORT_LABELS: Record<ReasoningEffort, string> = {
  none: "Aus",
  minimal: "Minimal",
  low: "Niedrig",
  medium: "Mittel",
  high: "Hoch",
  xhigh: "Sehr hoch",
};

/**
 * Returns a reasoning effort that is valid for the given model:
 * the requested one if supported, otherwise the model's default.
 * Returns null for non-reasoning models. For unknown models the requested
 * value is passed through unchanged.
 */
export function normalizeReasoningEffort(
  modelId: string,
  effort: ReasoningEffort | null | undefined,
): ReasoningEffort | null {
  const model = getModel(modelId);
  if (!model) return effort ?? null;
  if (!model.reasoningEfforts) return null;
  if (effort && model.reasoningEfforts.includes(effort)) return effort;
  return model.defaultReasoningEffort;
}
