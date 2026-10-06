"use client";

import { useState } from "react";
import { Check, Copy, Gauge, RefreshCw } from "lucide-react";
import type { BlueChatMessageMetadata } from "@/lib/types";
import { cn } from "@/lib/utils";
import { IconButton } from "@/components/ui/IconButton";
import { Tooltip } from "@/components/ui/Tooltip";
import { Badge } from "@/components/ui/Badge";
import { useMounted } from "@/components/ui/floating";
import { REASONING_EFFORT_LABEL, copyToClipboard, formatNumber } from "./utils";

interface MessageActionsProps {
  text: string;
  metadata?: BlueChatMessageMetadata;
  /** Always visible (last message) instead of on hover */
  visible: boolean;
  onRegenerate?: () => void;
  disabled?: boolean;
}

export function MessageActions({ text, metadata, visible, onRegenerate, disabled }: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const usage = metadata?.usage;
  const hasUsage = !!usage && (usage.inputTokens != null || usage.outputTokens != null);
  const effort = metadata?.reasoningEffort ? REASONING_EFFORT_LABEL[metadata.reasoningEffort] : null;
  // Local time only after hydration – server (e.g. Docker, UTC) and browser time zones differ.
  const mounted = useMounted();
  const time = mounted && metadata?.createdAt ? formatTime(metadata.createdAt) : null;

  async function copy() {
    if (await copyToClipboard(text)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  }

  return (
    <div
      className={cn(
        "mt-2 flex flex-wrap items-center gap-1 transition-opacity duration-200",
        visible ? "opacity-100" : "opacity-0 group-hover/msg:opacity-100 focus-within:opacity-100",
      )}
    >
      {text && (
        <IconButton label={copied ? "Kopiert" : "Antwort kopieren"} size="sm" onClick={copy}>
          {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
        </IconButton>
      )}
      {onRegenerate && (
        <IconButton label="Antwort neu generieren" size="sm" onClick={onRegenerate} disabled={disabled}>
          <RefreshCw className="size-3.5" />
        </IconButton>
      )}
      {metadata?.model && (
        <span className="ml-1.5 flex items-center gap-1.5">
          <Badge tone="neutral">
            <span className="font-mono text-[10.5px] tracking-tight">
              {metadata.model}
              {effort && <span className="text-ink-faint"> · {effort}</span>}
            </span>
          </Badge>
        </span>
      )}
      {hasUsage && (
        <Tooltip
          content={
            <span className="font-mono text-[11px] tabular-nums">
              {usage?.inputTokens != null && <>Eingabe {formatNumber(usage.inputTokens)}</>}
              {usage?.outputTokens != null && <> · Ausgabe {formatNumber(usage.outputTokens)}</>}
              {usage?.reasoningTokens ? <> · davon Reasoning {formatNumber(usage.reasoningTokens)}</> : null} Tokens
            </span>
          }
        >
          <span
            tabIndex={0}
            className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 font-mono text-[10.5px] text-ink-faint hover:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            aria-label="Token-Verbrauch"
          >
            <Gauge className="size-3" aria-hidden />
            {formatNumber((usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0))}
          </span>
        </Tooltip>
      )}
      {time && <span className="ml-1 font-mono text-[10.5px] text-ink-faint">{time}</span>}
    </div>
  );
}

function formatTime(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}
