import { generateText } from "ai";
import type { BlueChatUIMessage } from "../types";
import { getModel, TITLE_MODEL_ID } from "../models";
import { DEFAULT_CONVERSATION_TITLE, getConversation, setConversationTitle } from "./conversations";
import { getOpenAI } from "./openai";

function firstUserText(messages: BlueChatUIMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "";
  const text = first.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join(" ")
    .trim();
  const files = (first.metadata?.attachments ?? []).map((a) => a.name);
  return files.length ? `${text}\n(Angehängte Dateien: ${files.join(", ")})` : text;
}

function cleanTitle(raw: string): string {
  let t = raw.split("\n").find((l) => l.trim())?.trim() ?? "";
  t = t.replace(/^(titel|title)\s*:\s*/i, "");
  t = t.replace(/^["'„“”‚‘’«»*#\s]+|["'„“”‚‘’«»*\s]+$/g, "");
  t = t.replace(/[.!?:;,]+$/, "").trim();
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > 6) t = words.slice(0, 6).join(" ");
  return t.slice(0, 80);
}

function fallbackTitle(text: string): string {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const t = words.slice(0, 6).join(" ");
  return t.length > 60 ? `${t.slice(0, 57)}…` : t;
}

async function generateWith(modelId: string, text: string): Promise<string> {
  const info = getModel(modelId);
  const efforts = info?.reasoningEfforts ?? null;
  const reasoningEffort = efforts ? (efforts.includes("none") ? "none" : efforts[0]) : undefined;
  const { text: out } = await generateText({
    model: getOpenAI()(modelId),
    instructions:
      "Du erzeugst kurze, prägnante Titel für Chat-Unterhaltungen. Antworte NUR mit dem Titel: " +
      "höchstens 6 Wörter, ohne Anführungszeichen, ohne Satzzeichen am Ende, ohne Emojis. " +
      "Verwende die Sprache der Nutzernachricht (meist Deutsch).",
    prompt: `Erste Nachricht des Nutzers:\n\n${text.slice(0, 2_000)}`,
    maxOutputTokens: reasoningEffort && reasoningEffort !== "none" ? 400 : 40,
    maxRetries: 1,
    timeout: 20_000,
    providerOptions: {
      openai: {
        store: false,
        ...(reasoningEffort ? { reasoningEffort, reasoningSummary: null } : {}),
      },
    },
  });
  return cleanTitle(out);
}

/**
 * Generates a short German title for a conversation that still has the default
 * title. Never throws.
 */
export async function maybeGenerateTitle(
  conversationId: string,
  messages: BlueChatUIMessage[],
  fallbackModelId: string,
): Promise<void> {
  try {
    const text = firstUserText(messages);
    if (!text) return;
    let title = "";
    for (const modelId of [TITLE_MODEL_ID, fallbackModelId]) {
      try {
        title = await generateWith(modelId, text);
        if (title) break;
      } catch (err) {
        console.warn(`[title] generation with ${modelId} failed`, err instanceof Error ? err.message : err);
      }
    }
    if (!title) title = fallbackTitle(text);
    if (!title) return;
    // don't overwrite a title the user set in the meantime
    const current = await getConversation(conversationId);
    if (current && current.title === DEFAULT_CONVERSATION_TITLE) {
      await setConversationTitle(conversationId, title);
    }
  } catch (err) {
    console.error("[title] failed", err);
  }
}
