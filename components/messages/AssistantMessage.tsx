"use client";

import { memo, type ReactNode } from "react";
import type { BlueChatUIMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Markdown } from "./markdown/Markdown";
import { MessageActions } from "./MessageActions";
import { PlanCard } from "./parts/PlanCard";
import { ReasoningBlock } from "./parts/ReasoningBlock";
import { SourcesRow, dedupeSources, type SourceItem } from "./parts/SourcesRow";
import { WebSearchPart } from "./parts/WebSearchPart";
import { PythonToolCard } from "./python/PythonToolCard";
import { ThinkingIndicator } from "./ThinkingIndicator";
import type { MessagePart, PlanToolPartView, PythonToolPartView, WebSearchPartView } from "./types";
import { messageText } from "./utils";

/** Monogram mark used as the assistant avatar. */
export function AssistantAvatar({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-7 shrink-0 select-none items-center justify-center rounded-lg bg-brand-800 font-display text-[17px] italic leading-none text-white shadow-[inset_0_-1px_0_rgb(0_0_0/0.25),0_1px_2px_rgb(0_33_63/0.2)] ring-1 ring-brand-900/10 dark:bg-brand-600",
        className,
      )}
    >
      <span className="-mt-0.5">b</span>
    </span>
  );
}

/** Frame with avatar gutter shared by assistant message and placeholders. */
export function AssistantFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("group/msg grid grid-cols-[28px_minmax(0,1fr)] gap-x-4 animate-fade-up", className)}>
      <AssistantAvatar className="mt-0.5" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/**
 * A message may call `plan` several times (each call = full updated step list).
 * Only ONE card is rendered (at the first plan part) showing the latest settled state.
 */
function latestPlan(parts: MessagePart[]): { first: MessagePart | undefined; latest: PlanToolPartView | undefined } {
  const plans = parts.filter((p) => p.type === "tool-plan") as unknown as PlanToolPartView[];
  if (plans.length === 0) return { first: undefined, latest: undefined };
  // Prefer the newest call whose input is complete – a still-streaming input would flicker partial lists.
  const settled = [...plans].reverse().find((p) => p.state !== "input-streaming");
  return { first: plans[0] as unknown as MessagePart, latest: settled ?? plans[plans.length - 1] };
}

function isRenderable(part: MessagePart): boolean {
  switch (part.type) {
    case "text":
      return part.text.trim().length > 0;
    case "reasoning":
    case "tool-python":
    case "tool-web_search":
    case "tool-plan":
      return true;
    case "file":
      return part.mediaType.startsWith("image");
    default:
      return false;
  }
}

interface AssistantMessageProps {
  message: BlueChatUIMessage;
  /** This message is currently being streamed */
  streaming: boolean;
  isLast: boolean;
  onRegenerate?: () => void;
  /** A request is in flight (disables regenerate) */
  busy?: boolean;
}

export const AssistantMessage = memo(function AssistantMessage({
  message,
  streaming,
  isLast,
  onRegenerate,
  busy,
}: AssistantMessageProps) {
  const parts = message.parts;
  const renderable = parts.filter(isRenderable);
  const lastRenderable = renderable[renderable.length - 1];
  const lastPart = parts[parts.length - 1];

  // Between steps (tool finished, next step not yet producing output) → show the thinking indicator.
  const waiting =
    streaming &&
    (!lastRenderable ||
      lastPart?.type === "step-start" ||
      ((lastRenderable.type === "tool-python" || lastRenderable.type === "tool-web_search") &&
        (lastRenderable as { state: string }).state === "output-available") ||
      // plan updates are instant bookkeeping – keep the indicator visible while the model works on
      lastRenderable.type === "tool-plan");

  const sources: SourceItem[] = dedupeSources(
    parts
      .filter((p): p is Extract<MessagePart, { type: "source-url" }> => p.type === "source-url")
      .map((p) => ({ url: p.url, title: p.title })),
  );

  const plan = latestPlan(parts);
  let pythonIndex = 0;
  const text = messageText(message);

  return (
    <AssistantFrame>
      <div className="text-[15px] leading-[1.7] text-ink">
        {parts.map((part, i) => {
          switch (part.type) {
            case "text": {
              if (!part.text.trim()) return null;
              const caret = streaming && part === lastRenderable && !waiting;
              return <Markdown key={i} text={part.text} streaming={caret} />;
            }
            case "reasoning":
              return (
                <ReasoningBlock
                  key={i}
                  text={part.text}
                  streaming={streaming && (part.state === "streaming" || (part.state === undefined && part === lastPart))}
                />
              );
            case "tool-python":
              pythonIndex++;
              return <PythonToolCard key={(part as PythonToolPartView).toolCallId ?? i} part={part as unknown as PythonToolPartView} index={pythonIndex} />;
            case "tool-plan":
              if (part !== plan.first || !plan.latest) return null;
              return <PlanCard key="plan" part={plan.latest} streaming={streaming} />;
            case "tool-web_search":
              return <WebSearchPart key={(part as WebSearchPartView).toolCallId ?? i} part={part as unknown as WebSearchPartView} />;
            case "file":
              if (!part.mediaType.startsWith("image")) return null;
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={part.url} alt={part.filename ?? "Bild"} className="my-3 max-h-[480px] rounded-lg border border-line" />
              );
            default:
              return null; // step-start, source-*, data-*, unknown → ignore
          }
        })}
        {waiting && <ThinkingIndicator className={renderable.length ? "mt-2" : undefined} />}
      </div>

      {sources.length > 0 && !streaming && <SourcesRow sources={sources} />}

      {!streaming && renderable.length > 0 && (
        <MessageActions
          text={text}
          metadata={message.metadata}
          visible={isLast}
          onRegenerate={isLast ? onRegenerate : undefined}
          disabled={busy}
        />
      )}
    </AssistantFrame>
  );
});
