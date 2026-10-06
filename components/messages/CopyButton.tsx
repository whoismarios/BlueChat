"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { copyToClipboard } from "./utils";

interface CopyButtonProps {
  /** Text to copy, or a function producing it lazily */
  text: string | (() => string);
  label?: string;
  copiedLabel?: string;
  /** Show the label text next to the icon */
  showLabel?: boolean;
  className?: string;
  /** "dark" for usage on code cells (always dark background) */
  tone?: "default" | "dark";
}

export function CopyButton({
  text,
  label = "Kopieren",
  copiedLabel = "Kopiert",
  showLabel = false,
  className,
  tone = "default",
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function onClick() {
    const value = typeof text === "function" ? text() : text;
    const ok = await copyToClipboard(value);
    if (!ok) return;
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1600);
  }

  const Icon = copied ? Check : Copy;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={copied ? copiedLabel : label}
      title={copied ? copiedLabel : label}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
        showLabel ? "h-7 px-2" : "size-7 justify-center",
        tone === "dark"
          ? "text-code-ink/60 hover:bg-white/10 hover:text-code-ink"
          : "text-ink-faint hover:bg-surface-sunken hover:text-ink",
        copied && (tone === "dark" ? "text-[#3ccf91]" : "text-success"),
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {showLabel && <span className="font-mono tracking-tight">{copied ? copiedLabel : label}</span>}
    </button>
  );
}
