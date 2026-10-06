import type { AppSettings, ReasoningEffort, ToolToggles } from "../types";
import { DEFAULT_MODEL_ID, getModel, normalizeReasoningEffort } from "../models";
import { query } from "./db";

export const DEFAULT_SYSTEM_PROMPT = `Du bist blueChat, ein freundlicher, kompetenter KI-Assistent.
Der Nutzer heißt Marios. Sprich ihn gerne mit seinem Namen an, aber nicht in jeder Nachricht.

Richtlinien:
- Antworte immer in der Sprache, in der der Nutzer schreibt (standardmäßig Deutsch, in Deutsch duzt du den Nutzer).
- Sei präzise, hilfsbereit und ehrlich. Wenn du etwas nicht weißt oder unsicher bist, sag es offen.
- Formatiere Antworten mit Markdown: Überschriften, Listen und Tabellen, wo sie die Lesbarkeit verbessern; Code immer in Codeblöcken mit Sprachangabe; Formeln in LaTeX: inline mit \\( … \\), abgesetzt mit $$ … $$ (kein einfaches $ für Mathe, da $ auch Währung ist).
- Halte kurze Fragen kurz und gehe bei komplexen Themen strukturiert in die Tiefe.
- Stelle eine kurze Rückfrage, wenn eine Anfrage wirklich mehrdeutig ist.`;

export const DEFAULT_TOOLS: ToolToggles = { webSearch: false, python: true };

interface SettingsRow extends Record<string, unknown> {
  system_prompt: string;
  default_model: string;
  default_reasoning_effort: string | null;
  default_tools: Partial<ToolToggles> | null;
}

function rowToSettings(row: SettingsRow): AppSettings {
  const defaultModel = row.default_model || DEFAULT_MODEL_ID;
  return {
    systemPrompt: row.system_prompt,
    defaultModel,
    defaultReasoningEffort: normalizeReasoningEffort(
      defaultModel,
      (row.default_reasoning_effort as ReasoningEffort | null) ?? null,
    ),
    defaultTools: { ...DEFAULT_TOOLS, ...(row.default_tools ?? {}) },
  };
}

/** Returns the singleton settings row, inserting defaults if it doesn't exist yet. */
export async function getAppSettings(): Promise<AppSettings> {
  const defaultModel = DEFAULT_MODEL_ID;
  await query(
    `INSERT INTO app_settings (id, system_prompt, default_model, default_reasoning_effort, default_tools)
     VALUES (1, $1, $2, $3, $4::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [
      DEFAULT_SYSTEM_PROMPT,
      defaultModel,
      getModel(defaultModel)?.defaultReasoningEffort ?? null,
      JSON.stringify(DEFAULT_TOOLS),
    ],
  );
  const rows = await query<SettingsRow>(
    `SELECT system_prompt, default_model, default_reasoning_effort, default_tools FROM app_settings WHERE id = 1`,
  );
  return rowToSettings(rows[0]);
}

export async function updateAppSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getAppSettings();
  const defaultModel = patch.defaultModel?.trim() || current.defaultModel;
  const next: AppSettings = {
    systemPrompt: typeof patch.systemPrompt === "string" ? patch.systemPrompt : current.systemPrompt,
    defaultModel,
    defaultReasoningEffort: normalizeReasoningEffort(
      defaultModel,
      patch.defaultReasoningEffort !== undefined ? patch.defaultReasoningEffort : current.defaultReasoningEffort,
    ),
    defaultTools: {
      webSearch: patch.defaultTools?.webSearch ?? current.defaultTools.webSearch,
      python: patch.defaultTools?.python ?? current.defaultTools.python,
    },
  };
  const rows = await query<SettingsRow>(
    `UPDATE app_settings
        SET system_prompt = $1, default_model = $2, default_reasoning_effort = $3,
            default_tools = $4::jsonb, updated_at = now()
      WHERE id = 1
      RETURNING system_prompt, default_model, default_reasoning_effort, default_tools`,
    [next.systemPrompt, next.defaultModel, next.defaultReasoningEffort, JSON.stringify(next.defaultTools)],
  );
  return rowToSettings(rows[0]);
}
