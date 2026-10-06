import type { AppSettings, ChatSettings, ModelInfo, ReasoningEffort } from "@/lib/types";
import { DEFAULT_MODEL_ID, MODELS, getModel, normalizeReasoningEffort } from "@/lib/models";

export const REASONING_LABELS: Record<ReasoningEffort, string> = {
  none: "Aus",
  minimal: "Minimal",
  low: "Niedrig",
  medium: "Mittel",
  high: "Hoch",
  xhigh: "Maximal",
};

export const REASONING_DESCRIPTIONS: Record<ReasoningEffort, string> = {
  none: "Antwortet sofort, ohne Denkphase",
  minimal: "Nur ein kurzer Gedankengang",
  low: "Schnell, für einfache Aufgaben",
  medium: "Ausgewogen – empfohlen",
  high: "Gründlicher, dauert länger",
  xhigh: "Maximale Denktiefe für harte Probleme",
};

export function resolveModel(id: string | null | undefined): ModelInfo {
  return getModel(id) ?? getModel(DEFAULT_MODEL_ID) ?? MODELS[0];
}

/** Applies a model switch: keeps the reasoning effort when supported, disables unsupported tools. */
export function withModel(settings: ChatSettings, modelId: string): ChatSettings {
  const model = resolveModel(modelId);
  return {
    model: model.id,
    reasoningEffort: normalizeReasoningEffort(model.id, settings.reasoningEffort),
    tools: {
      python: model.supportsTools ? settings.tools.python : false,
      webSearch: model.supportsWebSearch ? settings.tools.webSearch : false,
    },
  };
}

/** Chat defaults for a new conversation derived from the global app settings. */
export function chatSettingsFromApp(app: AppSettings | null): ChatSettings {
  const model = resolveModel(app?.defaultModel);
  return withModel(
    {
      model: model.id,
      reasoningEffort: app ? app.defaultReasoningEffort : model.defaultReasoningEffort,
      tools: app?.defaultTools ?? { python: true, webSearch: false },
    },
    model.id,
  );
}
