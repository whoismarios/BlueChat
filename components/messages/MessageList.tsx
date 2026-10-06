"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, RotateCcw, TriangleAlert } from "lucide-react";
import type { BlueChatUIMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { AssistantFrame, AssistantMessage } from "./AssistantMessage";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { UserMessage } from "./UserMessage";

export interface MessageListProps {
  messages: BlueChatUIMessage[];
  status: "submitted" | "streaming" | "ready" | "error";
  error?: Error;
  onRegenerate: () => void;
  onRetry?: () => void;
  onEditUserMessage?: (messageId: string, text: string) => void;
  className?: string;
}

/** Distance (px) from the bottom within which we consider the user "at the bottom". */
const STICKY_THRESHOLD = 96;

export function MessageList({
  messages,
  status,
  error,
  onRegenerate,
  onRetry,
  onEditUserMessage,
  className,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

  const busy = status === "submitted" || status === "streaming";
  const last = messages[messages.length - 1];
  const showPlaceholder = busy && last?.role !== "assistant";

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const lastTopRef = useRef(0);
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distance < STICKY_THRESHOLD) stickRef.current = true;
    // Only an upward movement un-sticks (programmatic scrolls only ever go down).
    else if (el.scrollTop < lastTopRef.current - 2) stickRef.current = false;
    lastTopRef.current = el.scrollTop;
    setShowJump(!stickRef.current && distance > 200);
  }, []);

  // Detect deliberate upward scrolling immediately (wheel/touch) so streaming doesn't fight the user.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY < 0) stickRef.current = false;
    };
    let touchY = 0;
    const onTouchStart = (e: TouchEvent) => (touchY = e.touches[0]?.clientY ?? 0);
    const onTouchMove = (e: TouchEvent) => {
      if ((e.touches[0]?.clientY ?? 0) > touchY) stickRef.current = false;
    };
    el.addEventListener("wheel", onWheel, { passive: true });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  // New user message → always jump to the bottom.
  const lastUserId = [...messages].reverse().find((m) => m.role === "user")?.id;
  useLayoutEffect(() => {
    stickRef.current = true;
    scrollToBottom();
  }, [lastUserId, scrollToBottom]);

  // Keep pinned to the bottom while content grows (streaming text, iframes resizing, images loading).
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const ro = new ResizeObserver(() => {
      if (stickRef.current) scrollToBottom();
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, [scrollToBottom]);

  return (
    <div className={cn("relative min-h-0 flex-1", className)}>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="scrollbar-thin h-full overflow-y-auto overscroll-contain"
        role="log"
        aria-live="off"
        aria-label="Nachrichtenverlauf"
      >
        <div ref={contentRef} className="mx-auto flex w-full max-w-chat flex-col gap-8 px-4 pb-40 pt-8 sm:px-6">
          {messages.map((m, i) => {
            const isLast = i === messages.length - 1;
            if (m.role === "user") {
              return <UserMessage key={m.id} message={m} onEdit={onEditUserMessage} busy={busy} />;
            }
            if (m.role === "assistant") {
              return (
                <AssistantMessage
                  key={m.id}
                  message={m}
                  isLast={isLast}
                  streaming={isLast && busy}
                  onRegenerate={onRegenerate}
                  busy={busy}
                />
              );
            }
            return null;
          })}

          {showPlaceholder && (
            <AssistantFrame>
              <ThinkingIndicator />
            </AssistantFrame>
          )}

          {status === "error" && <ErrorCard error={error} onRetry={onRetry} />}
        </div>
      </div>

      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-4 flex justify-center transition-all duration-200",
          showJump ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
        )}
      >
        <button
          type="button"
          tabIndex={showJump ? 0 : -1}
          onClick={() => {
            stickRef.current = true;
            scrollToBottom("smooth");
          }}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-raised/95 px-3 py-1.5 text-xs text-ink-muted shadow-float backdrop-blur hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
            showJump && "pointer-events-auto",
          )}
          aria-label="Nach unten scrollen"
        >
          <ArrowDown className="size-3.5" aria-hidden />
          nach unten
        </button>
      </div>
    </div>
  );
}

function ErrorCard({ error, onRetry }: { error?: Error; onRetry?: () => void }) {
  return (
    <AssistantFrame>
      <div role="alert" className="rounded-card border border-danger/30 bg-danger/[0.05] px-4 py-3.5">
        <div className="flex items-start gap-3">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">Die Antwort konnte nicht erstellt werden.</p>
            {error?.message && (
              <p className="mt-1 break-words font-mono text-[12px] leading-relaxed text-ink-muted">{error.message}</p>
            )}
            {onRetry && (
              <Button variant="secondary" size="sm" onClick={onRetry} className="mt-3">
                <RotateCcw className="size-3.5" aria-hidden />
                Erneut versuchen
              </Button>
            )}
          </div>
        </div>
      </div>
    </AssistantFrame>
  );
}
