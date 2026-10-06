"use client";

import { useState } from "react";
import type { ChatSettings } from "@/lib/types";
import { uuid } from "@/lib/utils";
import { useConversations } from "@/lib/client/conversations";
import { Chat } from "./Chat";

/** New, not yet persisted conversation. Remounts (fresh id) whenever "Neuer Chat" is triggered. */
export function NewChat({ initialSettings }: { initialSettings: ChatSettings }) {
  const { newChatNonce } = useConversations();
  return <FreshChat key={newChatNonce} initialSettings={initialSettings} />;
}

function FreshChat({ initialSettings }: { initialSettings: ChatSettings }) {
  // Generated at mount so uploads into the sandbox work before the first message is sent.
  const [id] = useState(uuid);
  return <Chat id={id} initialMessages={[]} initialSettings={initialSettings} persisted={false} />;
}
