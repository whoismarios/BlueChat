"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ConversationSummary } from "@/lib/types";
import { deleteConversation, fetchConversations, patchConversation } from "./api";

interface ConversationsContextValue {
  conversations: ConversationSummary[];
  loading: boolean;
  error: string | null;
  /** Id of the conversation shown in the main area (derived from the URL). */
  activeId: string | null;
  refresh: () => Promise<void>;
  /** Refresh now and again after each delay (ms). Used while titles are generated server-side. */
  refreshSoon: (delays?: number[]) => void;
  rename: (id: string, title: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Insert an optimistic entry (e.g. on first send in a new chat) until the server returns it. */
  addPending: (c: ConversationSummary) => void;
  /** Bumped by startNewChat so the new-chat page remounts even if the route does not change. */
  newChatNonce: number;
  startNewChat: () => void;
}

const ConversationsContext = createContext<ConversationsContextValue | null>(null);

function sortByUpdated(list: ConversationSummary[]) {
  return [...list].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export function ConversationsProvider({
  initialConversations,
  children,
}: {
  initialConversations: ConversationSummary[] | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [conversations, setConversations] = useState<ConversationSummary[]>(initialConversations ?? []);
  const [loading, setLoading] = useState(initialConversations === null);
  const [error, setError] = useState<string | null>(null);
  const [newChatNonce, setNonce] = useState(0);
  const pending = useRef(new Map<string, ConversationSummary>());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const activeId = useMemo(() => {
    const m = pathname?.match(/^\/c\/([^/?#]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }, [pathname]);

  const refresh = useCallback(async () => {
    try {
      const list = await fetchConversations();
      const ids = new Set(list.map((c) => c.id));
      for (const id of pending.current.keys()) if (ids.has(id)) pending.current.delete(id);
      setConversations(sortByUpdated([...pending.current.values(), ...list]));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chats konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshSoon = useCallback(
    (delays: number[] = [0]) => {
      for (const d of delays) timers.current.push(setTimeout(() => void refresh(), d));
    },
    [refresh],
  );

  useEffect(() => {
    if (initialConversations === null) void refresh();
    const t = timers.current;
    return () => t.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rename = useCallback(
    async (id: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      let previous: string | undefined;
      setConversations((all) =>
        all.map((c) => {
          if (c.id !== id) return c;
          previous = c.title;
          return { ...c, title: trimmed };
        }),
      );
      try {
        await patchConversation(id, { title: trimmed });
      } catch (e) {
        setConversations((all) => all.map((c) => (c.id === id && previous !== undefined ? { ...c, title: previous } : c)));
        throw e;
      }
    },
    [],
  );

  const remove = useCallback(
    async (id: string) => {
      const snapshot = conversations;
      pending.current.delete(id);
      setConversations((all) => all.filter((c) => c.id !== id));
      try {
        await deleteConversation(id);
      } catch (e) {
        setConversations(snapshot);
        throw e;
      }
    },
    [conversations],
  );

  const addPending = useCallback((c: ConversationSummary) => {
    pending.current.set(c.id, c);
    setConversations((all) => (all.some((x) => x.id === c.id) ? all : sortByUpdated([c, ...all])));
  }, []);

  const startNewChat = useCallback(() => {
    setNonce((n) => n + 1);
    router.push("/");
  }, [router]);

  const value = useMemo<ConversationsContextValue>(
    () => ({
      conversations,
      loading,
      error,
      activeId,
      refresh,
      refreshSoon,
      rename,
      remove,
      addPending,
      newChatNonce,
      startNewChat,
    }),
    [conversations, loading, error, activeId, refresh, refreshSoon, rename, remove, addPending, newChatNonce, startNewChat],
  );

  return <ConversationsContext.Provider value={value}>{children}</ConversationsContext.Provider>;
}

export function useConversations() {
  const ctx = useContext(ConversationsContext);
  if (!ctx) throw new Error("useConversations must be used inside <ConversationsProvider>");
  return ctx;
}
