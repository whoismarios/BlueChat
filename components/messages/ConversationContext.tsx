"use client";

import { createContext, useContext } from "react";

/** Conversation id (= Python sandbox session id) of the chat the messages belong to. */
const ConversationIdContext = createContext<string | null>(null);

export const ConversationIdProvider = ConversationIdContext.Provider;

/** null outside a chat (e.g. /dev/messages preview) – interactive features are disabled then. */
export function useConversationId(): string | null {
  return useContext(ConversationIdContext);
}
