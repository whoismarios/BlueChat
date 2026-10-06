import {
  convertToModelMessages,
  createIdGenerator,
  createUIMessageStreamResponse,
  isStepCount,
  safeValidateUIMessages,
  streamText,
  toUIMessageStream,
} from "ai";
import type { OpenAILanguageModelResponsesOptions } from "@ai-sdk/openai";
import type { AppSettings, BlueChatMessageMetadata, BlueChatUIMessage, ChatRequestBody, ChatSettings } from "@/lib/types";
import { getModel } from "@/lib/models";
import {
  getConversation,
  isUuid,
  loadMessages,
  sanitizeSettings,
  saveMessages,
  upsertConversation,
} from "@/lib/server/conversations";
import { getAppSettings } from "@/lib/server/settings";
import { buildTools } from "@/lib/server/tools";
import { buildSystemPrompt } from "@/lib/server/prompt";
import { describeError, getOpenAI, hasValidOpenAIKey, MISSING_KEY_MESSAGE } from "@/lib/server/openai";
import { maybeGenerateTitle } from "@/lib/server/title";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 900;

const MAX_STEPS = 12;

const generateMessageId = createIdGenerator({ prefix: "msg", size: 16 });

/** Errors before streaming are returned as plain text so useChat's `error.message` is readable. */
function textError(status: number, message: string): Response {
  return new Response(message, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
}

/**
 * Prepares stored UI messages for the model:
 * - reasoning parts from other models are dropped (encrypted reasoning is model-specific)
 * - user file parts with app-relative URLs are dropped (attachments live in the sandbox)
 * - attachments of user messages are mentioned as text
 */
function prepareForModel(messages: BlueChatUIMessage[], currentModel: string): BlueChatUIMessage[] {
  return messages.map((m) => {
    if (m.role === "assistant") {
      const sameModel = (m.metadata?.model ?? currentModel) === currentModel;
      if (sameModel) return m;
      return { ...m, parts: m.parts.filter((p) => p.type !== "reasoning") };
    }
    if (m.role === "user") {
      const parts = m.parts.filter(
        (p) => p.type !== "file" || /^(data:|https?:)/i.test(p.url),
      );
      const attachments = m.metadata?.attachments ?? [];
      if (attachments.length > 0) {
        parts.push({
          type: "text",
          text: `\n\n[Angehängte Dateien im Arbeitsverzeichnis der Python-Sandbox: ${attachments
            .map((a) => `\`${a.path}\``)
            .join(", ")}]`,
        });
      }
      return { ...m, parts };
    }
    return m;
  });
}

export async function POST(req: Request) {
  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return textError(400, "Ungültige Anfrage: Der Request-Body ist kein gültiges JSON.");
  }

  const { id, trigger } = body ?? ({} as ChatRequestBody);
  if (!isUuid(id)) return textError(400, "Ungültige Anfrage: Die Konversations-ID muss eine UUID sein.");
  if (trigger !== "submit-message" && trigger !== "regenerate-message") {
    return textError(400, `Ungültige Anfrage: Unbekannter Trigger „${String(trigger)}“.`);
  }
  if (!hasValidOpenAIKey()) return textError(400, MISSING_KEY_MESSAGE);

  /* ---------------------------------------------------------------- */
  /* Conversation + settings                                           */
  /* ---------------------------------------------------------------- */
  let appSettings: AppSettings;
  let settings: ChatSettings;
  let history: BlueChatUIMessage[];
  let isNewTitle = false;
  try {
    let existing;
    [appSettings, existing] = await Promise.all([getAppSettings(), getConversation(id)]);
    const fallback: ChatSettings = existing?.settings ?? {
      model: appSettings.defaultModel,
      reasoningEffort: appSettings.defaultReasoningEffort,
      tools: appSettings.defaultTools,
    };
    settings = sanitizeSettings(body.settings, fallback);
    const conversation = await upsertConversation(id, settings);
    isNewTitle = conversation.title === "Neuer Chat";
    history = await loadMessages(id);

    if (trigger === "submit-message") {
      const incoming = body.message;
      if (!incoming || typeof incoming !== "object" || !Array.isArray(incoming.parts)) {
        return textError(400, "Ungültige Anfrage: Es wurde keine Nachricht übermittelt.");
      }
      if (incoming.role !== "user") {
        return textError(400, "Ungültige Anfrage: Es können nur Nutzer-Nachrichten gesendet werden.");
      }
      const message: BlueChatUIMessage = {
        id: typeof incoming.id === "string" && incoming.id ? incoming.id : generateMessageId(),
        role: "user",
        parts: incoming.parts,
        metadata: {
          ...(incoming.metadata ?? {}),
          createdAt: incoming.metadata?.createdAt ?? new Date().toISOString(),
        },
      };
      // Editing an earlier message: drop it and everything after it.
      const editIdx = history.findIndex((m) => m.id === message.id || (body.messageId && m.id === body.messageId));
      if (editIdx >= 0) history = history.slice(0, editIdx);
      history = [...history, message];
    } else {
      if (body.messageId) {
        const idx = history.findIndex((m) => m.id === body.messageId);
        if (idx >= 0 && history[idx].role === "assistant") history = history.slice(0, idx);
      }
      while (history.length > 0 && history[history.length - 1].role === "assistant") history.pop();
      if (history.length === 0) {
        return textError(400, "Es gibt keine Nachricht, auf die neu geantwortet werden kann.");
      }
    }

    // Persist the user message right away (survives crashes / aborted streams).
    await saveMessages(id, history);
  } catch (err) {
    console.error("[api/chat] preparation failed", err);
    return textError(
      503,
      `Die Datenbank ist nicht erreichbar oder meldet einen Fehler: ${describeError(err)}. ` +
        "Läuft der Postgres-Container (`docker compose up db`)?",
    );
  }

  /* ---------------------------------------------------------------- */
  /* Tools, prompt, model messages                                     */
  /* ---------------------------------------------------------------- */
  const modelInfo = getModel(settings.model);
  const { tools, activeTools } = buildTools(id, settings);
  const instructions = buildSystemPrompt({
    appSettings,
    settings,
    messages: history,
    pythonEnabled: activeTools.includes("python"),
    webSearchEnabled: activeTools.includes("web_search"),
  });

  const validated = await safeValidateUIMessages<BlueChatUIMessage>({ messages: history, tools });
  if (!validated.success) {
    console.warn("[api/chat] message validation failed – continuing with stored messages", validated.error);
  }
  const uiMessages = validated.success ? validated.data : history;

  let modelMessages;
  try {
    modelMessages = await convertToModelMessages<BlueChatUIMessage>(prepareForModel(uiMessages, settings.model), {
      tools,
      ignoreIncompleteToolCalls: true,
    });
  } catch (err) {
    console.error("[api/chat] convertToModelMessages failed", err);
    return textError(400, `Die Nachrichten konnten nicht verarbeitet werden: ${describeError(err)}`);
  }

  const reasoningEffort = settings.reasoningEffort;
  const isReasoningModel = modelInfo ? modelInfo.reasoningEfforts != null : reasoningEffort != null;
  const openaiOptions: OpenAILanguageModelResponsesOptions = {
    // Stateless Responses API: full history is replayed each time; reasoning items are
    // sent back as encrypted content (the provider adds include: reasoning.encrypted_content).
    store: false,
    ...(isReasoningModel && reasoningEffort
      ? {
          reasoningEffort,
          reasoningSummary: reasoningEffort === "none" ? null : "auto",
        }
      : {}),
  };

  // Kick off title generation in parallel (only needs the first user message).
  const titlePromise = isNewTitle ? maybeGenerateTitle(id, history, settings.model) : Promise.resolve();

  const createdAt = new Date().toISOString();
  const baseMetadata: BlueChatMessageMetadata = {
    model: settings.model,
    reasoningEffort: isReasoningModel ? reasoningEffort : null,
    createdAt,
  };

  const result = streamText({
    model: getOpenAI()(settings.model),
    instructions,
    messages: modelMessages,
    tools,
    activeTools,
    stopWhen: isStepCount(MAX_STEPS),
    providerOptions: { openai: openaiOptions },
    onError: ({ error }) => {
      console.error("[api/chat] stream error", error);
    },
  });

  const uiStream = toUIMessageStream({
    stream: result.stream,
    tools,
    originalMessages: uiMessages,
    generateMessageId,
    sendReasoning: true,
    sendSources: true,
    onError: (error) => describeError(error),
    messageMetadata: ({ part }): BlueChatMessageMetadata | undefined => {
      if (part.type === "start") return baseMetadata;
      if (part.type === "finish") {
        return {
          ...baseMetadata,
          usage: {
            inputTokens: part.totalUsage.inputTokens,
            outputTokens: part.totalUsage.outputTokens,
            reasoningTokens: part.totalUsage.outputTokenDetails?.reasoningTokens,
          },
        };
      }
      return undefined;
    },
    onEnd: async ({ messages }) => {
      try {
        // Make sure the response message carries at least the base metadata.
        const finalMessages = messages
          .map((m, i) =>
            i === messages.length - 1 && m.role === "assistant"
              ? { ...m, metadata: { ...baseMetadata, ...(m.metadata ?? {}) } }
              : m,
          )
          // don't persist an empty assistant message (e.g. request failed before any output)
          .filter(
            (m, i, all) =>
              !(i === all.length - 1 && m.role === "assistant" && m.parts.every((p) => p.type === "step-start")),
          );
        await saveMessages(id, finalMessages);
      } catch (err) {
        console.error("[api/chat] saving messages failed", err);
      }
      // usually already done; bounded so the stream end isn't delayed noticeably
      await Promise.race([titlePromise, new Promise((r) => setTimeout(r, 3_000))]);
    },
  });

  return createUIMessageStreamResponse({
    stream: uiStream,
    // Drain a copy of the stream server-side so generation + persistence complete
    // even when the client disconnects.
    consumeSseStream: async ({ stream }) => {
      const reader = stream.getReader();
      try {
        while (!(await reader.read()).done) {
          /* drain */
        }
      } catch {
        /* ignore */
      }
    },
  });
}
