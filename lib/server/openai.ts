import { createOpenAI, type OpenAIProvider } from "@ai-sdk/openai";

export const PLACEHOLDER_OPENAI_KEY = "sk-your-openai-api-key-here";

export function getOpenAIKey(): string | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key || key === PLACEHOLDER_OPENAI_KEY) return null;
  return key;
}

export function hasValidOpenAIKey(): boolean {
  return getOpenAIKey() != null;
}

export const MISSING_KEY_MESSAGE =
  "Kein OpenAI-API-Key konfiguriert. Bitte trage deinen Key als OPENAI_API_KEY in die Datei .env ein " +
  "(der Platzhalter „sk-your-openai-api-key-here“ funktioniert nicht) und starte den Server neu.";

type GlobalWithOpenAI = typeof globalThis & { __bluechatOpenAI?: { key: string; provider: OpenAIProvider } };
const g = globalThis as GlobalWithOpenAI;

/** OpenAI provider bound to the current OPENAI_API_KEY (re-created if the key changes). */
export function getOpenAI(): OpenAIProvider {
  const key = getOpenAIKey() ?? "";
  if (!g.__bluechatOpenAI || g.__bluechatOpenAI.key !== key) {
    g.__bluechatOpenAI = { key, provider: createOpenAI({ apiKey: key }) };
  }
  return g.__bluechatOpenAI.provider;
}

/** Turns OpenAI / SDK errors into a readable German message for the UI. */
export function describeError(error: unknown): string {
  if (error == null) return "Unbekannter Fehler.";
  if (typeof error === "string") return error;
  const err = error as {
    name?: string;
    message?: string;
    statusCode?: number;
    responseBody?: string;
    data?: { error?: { message?: string; code?: string } };
    lastError?: unknown;
  };
  // RetryError wraps the last error
  if (err.name === "AI_RetryError" && err.lastError) return describeError(err.lastError);

  const status = err.statusCode;
  const apiMessage = err.data?.error?.message ?? err.message ?? String(error);
  if (status === 401) {
    return "OpenAI hat den API-Key abgelehnt (401). Bitte prüfe OPENAI_API_KEY in der .env.";
  }
  if (status === 403) return `Zugriff verweigert (403): ${apiMessage}`;
  if (status === 404) return `Modell oder Ressource nicht gefunden (404): ${apiMessage}`;
  if (status === 429) {
    return `Rate-Limit bzw. Kontingent bei OpenAI erreicht (429): ${apiMessage}`;
  }
  if (status != null && status >= 500) return `OpenAI-Serverfehler (${status}): ${apiMessage}`;
  if (status != null) return `OpenAI-Fehler (${status}): ${apiMessage}`;
  if (err.name === "AI_LoadAPIKeyError") return MISSING_KEY_MESSAGE;
  return apiMessage;
}
