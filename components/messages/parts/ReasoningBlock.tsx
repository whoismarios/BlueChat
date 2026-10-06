"use client";

import { useEffect, useRef, useState } from "react";
import { Lightbulb } from "lucide-react";
import { CollapsibleSection } from "../CollapsibleSection";
import { Markdown } from "../markdown/Markdown";
import { ShimmerText } from "../ThinkingIndicator";

interface ReasoningBlockProps {
  text: string;
  streaming: boolean;
}

/** "Gedankengang" – collapsible model reasoning. Auto-open while streaming, collapses when done. */
export function ReasoningBlock({ text, streaming }: ReasoningBlockProps) {
  const [open, setOpen] = useState(streaming);
  const startedAt = useRef<number | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const wasStreaming = useRef(streaming);

  useEffect(() => {
    if (streaming && startedAt.current === null) startedAt.current = Date.now();
    if (streaming && !wasStreaming.current) setOpen(true);
    if (!streaming && wasStreaming.current) {
      // finished: collapse and remember how long it took (only measurable live)
      if (startedAt.current !== null) setDurationMs(Date.now() - startedAt.current);
      setOpen(false);
    }
    wasStreaming.current = streaming;
  }, [streaming]);

  const hasText = text.trim().length > 0;
  const seconds = durationMs !== null ? Math.max(1, Math.round(durationMs / 1000)) : null;

  const label = streaming ? (
    <ShimmerText>Denkt nach…</ShimmerText>
  ) : (
    <span className="text-sm text-ink-muted">
      Gedankengang
      {seconds !== null && (
        <span className="ml-2 font-mono text-[11px] text-ink-faint">
          {seconds} s
        </span>
      )}
    </span>
  );

  const icon = <Lightbulb aria-hidden className="size-3.5 shrink-0 text-ink-faint" />;

  if (!hasText) {
    // Reasoning without a visible summary (encrypted) → just a quiet label
    return (
      <div className="my-2 flex items-center gap-1.5 pl-5">
        {icon}
        {streaming ? <ShimmerText>Denkt nach…</ShimmerText> : <span className="text-sm text-ink-faint">Nachgedacht{seconds !== null ? ` · ${seconds} s` : ""}</span>}
      </div>
    );
  }

  return (
    <CollapsibleSection
      open={open}
      onOpenChange={setOpen}
      className="my-2"
      triggerClassName="py-1"
      trigger={
        <span className="flex items-center gap-1.5">
          {icon}
          {label}
        </span>
      }
    >
      <div className="ml-[7px] mt-1 border-l border-line pl-4 pb-1">
        <Markdown text={text} variant="muted" className="text-[13.5px]" />
      </div>
    </CollapsibleSection>
  );
}
