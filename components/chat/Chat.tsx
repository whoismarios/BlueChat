"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { BlueChatUIMessage, ChatRequestBody, ChatSettings } from "@/lib/types";
import { patchConversation } from "@/lib/client/api";
import { useConversations } from "@/lib/client/conversations";
import { useToast } from "@/components/ui";
import { MessageList } from "@/components/messages/MessageList";
import { ConversationIdProvider } from "@/components/messages/ConversationContext";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { collectDashboard } from "@/components/dashboard/collect";
import { useDashboardPanel, usePanelWidth } from "@/components/dashboard/useDashboardPanel";
import { ChatHeader } from "./ChatHeader";
import { Composer, type Attachment, type ComposerHandle } from "./Composer";
import { EmptyState, type Suggestion } from "./EmptyState";
import { resolveModel } from "./settings";

export interface ChatProps {
  /** Conversation id (uuid). For new chats generated on the client. */
  id: string;
  initialMessages: BlueChatUIMessage[];
  initialSettings: ChatSettings;
  /** true when the conversation already exists in the database */
  persisted: boolean;
  initialTitle?: string;
}

/**
 * Sends only the last message plus the current per-chat settings (read at request time).
 * See ChatRequestBody in lib/types.ts.
 */
function createTransport(settingsRef: RefObject<ChatSettings>) {
  return new DefaultChatTransport<BlueChatUIMessage>({
    api: "/api/chat",
    prepareSendMessagesRequest: ({ id, messages, trigger, messageId }) => {
      const body: ChatRequestBody = {
        id,
        message: trigger === "submit-message" ? messages.at(-1) : undefined,
        trigger,
        messageId,
        settings: settingsRef.current,
      };
      return { body };
    },
  });
}

function textOf(message: BlueChatUIMessage | undefined) {
  return (
    message?.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("\n") ?? ""
  );
}

export function Chat({ id, initialMessages, initialSettings, persisted: initiallyPersisted, initialTitle }: ChatProps) {
  const { conversations, addPending, refreshSoon } = useConversations();
  const { toast } = useToast();
  const composerRef = useRef<ComposerHandle>(null);

  /* ---------------- settings ---------------- */
  const [settings, setSettingsState] = useState<ChatSettings>(initialSettings);
  const settingsRef = useRef(settings);
  const [persisted, setPersisted] = useState(initiallyPersisted);
  const persistedRef = useRef(initiallyPersisted);

  // The ref is only dereferenced when a request is prepared, never during render.
  // eslint-disable-next-line react-hooks/refs
  const [transport] = useState(() => createTransport(settingsRef));

  const { messages, status, error, sendMessage, regenerate, stop, clearError } = useChat<BlueChatUIMessage>({
    id,
    messages: initialMessages,
    transport,
    onFinish: ({ isAbort }) => {
      // Title is generated server-side shortly after the first answer – refetch a few times.
      refreshSoon(isAbort ? [300] : [0, 1500, 4000]);
    },
  });

  // New-chat defaults may change (settings dialog → router.refresh()). Adopt them while the chat is still empty.
  const initialKey = JSON.stringify(initialSettings);
  const [prevInitialKey, setPrevInitialKey] = useState(initialKey);
  if (initialKey !== prevInitialKey) {
    setPrevInitialKey(initialKey);
    if (!persisted && messages.length === 0) setSettingsState(initialSettings);
  }
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const updateSettings = useCallback(
    (next: ChatSettings) => {
      const prev = settingsRef.current;
      settingsRef.current = next;
      setSettingsState(next);
      if (!persistedRef.current) return;
      const patch: Partial<ChatSettings> = {};
      if (prev.model !== next.model) patch.model = next.model;
      if (prev.reasoningEffort !== next.reasoningEffort) patch.reasoningEffort = next.reasoningEffort;
      if (JSON.stringify(prev.tools) !== JSON.stringify(next.tools)) patch.tools = next.tools;
      if (Object.keys(patch).length === 0) return;
      patchConversation(id, { settings: patch }).catch((e: unknown) => {
        // A 404 right after the first message just means the row isn't created yet – the next request carries the settings anyway.
        if (e instanceof Error && /404|nicht gefunden|not found/i.test(e.message)) return;
        toast({ title: "Einstellungen nicht gespeichert", description: e instanceof Error ? e.message : undefined, tone: "danger" });
      });
    },
    [id, toast],
  );

  /* ---------------- sending ---------------- */
  const markPersisted = useCallback(() => {
    if (persistedRef.current) return;
    persistedRef.current = true;
    setPersisted(true);
    // Keep this component mounted – just reflect the conversation in the URL.
    window.history.replaceState(null, "", `/c/${id}`);
    const now = new Date().toISOString();
    addPending({ id, title: "Neuer Chat", createdAt: now, updatedAt: now });
    refreshSoon([1200]);
  }, [id, addPending, refreshSoon]);

  const send = useCallback(
    (text: string, attachments: Attachment[] = []) => {
      if (status === "error") clearError();
      markPersisted();
      void sendMessage({
        text,
        metadata: {
          createdAt: new Date().toISOString(),
          ...(attachments.length > 0 ? { attachments } : {}),
        },
      });
      // Move the conversation to the top of the sidebar.
      refreshSoon([1200]);
    },
    [status, clearError, markPersisted, sendMessage, refreshSoon],
  );

  const onSuggestion = (s: Suggestion) => {
    if (s.webSearch && !settingsRef.current.tools.webSearch && resolveModel(settingsRef.current.model).supportsWebSearch) {
      updateSettings({ ...settingsRef.current, tools: { ...settingsRef.current.tools, webSearch: true } });
    }
    send(s.text);
  };

  const onRegenerate = useCallback(() => {
    if (status === "error") clearError();
    void regenerate();
  }, [status, clearError, regenerate]);

  const onRetry = useCallback(() => {
    clearError();
    const last = messages.at(-1);
    if (last?.role === "user") {
      // The request failed before an answer arrived: re-submit the same user message.
      void sendMessage({ text: textOf(last), metadata: last.metadata, messageId: last.id });
    } else {
      void regenerate();
    }
  }, [messages, clearError, sendMessage, regenerate]);

  const onEditUserMessage = useCallback(
    (messageId: string, text: string) => {
      const original = messages.find((m) => m.id === messageId);
      if (!original || !text.trim()) return;
      if (status === "error") clearError();
      void sendMessage({ text: text.trim(), metadata: original.metadata, messageId });
    },
    [messages, status, clearError, sendMessage],
  );

  // Surface transport errors that MessageList might not show (e.g. while the list is empty).
  const lastErrorRef = useRef<Error | undefined>(undefined);
  useEffect(() => {
    if (error && error !== lastErrorRef.current && messages.length === 0) {
      toast({ title: "Anfrage fehlgeschlagen", description: error.message, tone: "danger" });
    }
    lastErrorRef.current = error;
  }, [error, messages.length, toast]);

  /* ---------------- render ---------------- */
  const model = resolveModel(settings.model);
  const busy = status === "submitted" || status === "streaming";
  const summary = conversations.find((c) => c.id === id);
  const title = summary?.title || initialTitle || "Neuer Chat";
  const hasMessages = messages.length > 0;

  /* ---------------- dashboard ---------------- */
  const dashboardData = useMemo(() => collectDashboard(messages), [messages]);
  const dashboard = useDashboardPanel(messages, busy, dashboardData.count > 0);
  const [panelWidth, setPanelWidth] = usePanelWidth();
  const setDashboardOpen = dashboard.setOpen;
  const closeDashboard = useCallback(() => setDashboardOpen(false), [setDashboardOpen]);

  useEffect(() => {
    document.title = hasMessages && title !== "Neuer Chat" ? `${title} · blueChat` : "blueChat";
  }, [title, hasMessages]);

  return (
    <ConversationIdProvider value={id}>
    <div className="flex h-full flex-col">
      <ChatHeader
        conversationId={id}
        title={title}
        model={model}
        persisted={persisted}
        hasMessages={hasMessages}
        busy={busy}
        dashboard={
          hasMessages
            ? { open: dashboard.open, count: dashboardData.count, onToggle: () => setDashboardOpen(!dashboard.open) }
            : undefined
        }
      />
      <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
      <div className="relative flex min-h-0 flex-1 flex-col">
        {hasMessages ? (
          <MessageList
            messages={messages}
            status={status}
            error={error}
            onRegenerate={onRegenerate}
            onRetry={onRetry}
            onEditUserMessage={onEditUserMessage}
          />
        ) : (
          <EmptyState onSuggestion={onSuggestion} webSearchAvailable={model.supportsWebSearch} />
        )}
      </div>
      <div className="relative shrink-0 px-3 pb-3 sm:px-6 sm:pb-4">
        {/* fade the scrolling content out behind the composer */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-linear-to-t from-surface to-transparent" />
        <Composer
          ref={composerRef}
          conversationId={id}
          busy={busy}
          settings={settings}
          onSettingsChange={updateSettings}
          onSend={send}
          onStop={stop}
        />
        <p className="mt-2 text-center text-[11px] text-ink-faint">
          blueChat kann Fehler machen. Code läuft isoliert in einer Python-Sandbox.
        </p>
      </div>
      </div>
      <DashboardPanel
        open={dashboard.open}
        onClose={closeDashboard}
        groups={dashboardData.groups}
        count={dashboardData.count}
        wide={dashboard.wide}
        width={panelWidth}
        onWidthChange={setPanelWidth}
        streaming={busy}
      />
      </div>
    </div>
    </ConversationIdProvider>
  );
}
