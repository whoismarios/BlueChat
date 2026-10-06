"use client";

/**
 * DEV ONLY – visual check harness for the message components.
 * Open /dev/messages. Not linked from the app; safe to delete before production.
 */
import { useEffect, useMemo, useState } from "react";
import { MessageList } from "@/components/messages";
import type { BlueChatUIMessage } from "@/lib/types";
import { BASE_MESSAGES, PENDING_USER, streamingMessage } from "./mocks";

type Status = "submitted" | "streaming" | "ready" | "error";

export default function DevMessagesPage() {
  const [status, setStatus] = useState<Status>("ready");
  const [dark, setDark] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  // Simulate live code streaming in "streaming" mode
  useEffect(() => {
    if (status !== "streaming") return;
    const t = setInterval(() => setProgress((p) => (p > 400 ? p : p + 6)), 60);
    return () => clearInterval(t);
  }, [status]);

  const messages = useMemo<BlueChatUIMessage[]>(() => {
    switch (status) {
      case "submitted":
      case "error":
        return [...BASE_MESSAGES, PENDING_USER];
      case "streaming":
        return [...BASE_MESSAGES, PENDING_USER, streamingMessage(progress)];
      default:
        return BASE_MESSAGES;
    }
  }, [status, progress]);

  return (
    <div className="flex h-dvh flex-col bg-surface text-ink">
      <header className="flex flex-wrap items-center gap-3 border-b border-line bg-surface-raised px-4 py-2 text-sm">
        <span className="rounded bg-warning/15 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-warning">
          Dev · Nachrichten-Vorschau
        </span>
        <label className="flex items-center gap-2">
          Status
          <select
            value={status}
            onChange={(e) => {
              setProgress(0);
              setStatus(e.target.value as Status);
            }}
            className="rounded-md border border-line bg-surface px-2 py-1"
          >
            <option value="ready">ready</option>
            <option value="submitted">submitted</option>
            <option value="streaming">streaming</option>
            <option value="error">error</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={dark} onChange={(e) => setDark(e.target.checked)} />
          Dunkel
        </label>
      </header>
      <MessageList
        messages={messages}
        status={status}
        error={status === "error" ? new Error("OpenAI API: 429 – Rate limit erreicht. Bitte später erneut versuchen.") : undefined}
        onRegenerate={() => console.log("[dev] regenerate")}
        onRetry={() => setStatus("ready")}
        onEditUserMessage={(id, text) => console.log("[dev] edit", id, text)}
      />
    </div>
  );
}
