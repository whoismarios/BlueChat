"use client";

import { useCallback, useLayoutEffect, useRef, type ComponentProps, type Ref } from "react";
import { cn } from "@/lib/utils";
import { fieldBase } from "./Input";

export interface TextareaProps extends ComponentProps<"textarea"> {
  /** Grow with content (default true). */
  autoResize?: boolean;
  /** Max height in px before scrolling (default 320). */
  maxHeight?: number;
  /** Render without border/background (e.g. inside the composer). */
  bare?: boolean;
}

function assignRef<T>(ref: Ref<T> | undefined, value: T) {
  if (typeof ref === "function") ref(value);
  else if (ref && typeof ref === "object") (ref as { current: T }).current = value;
}

/** Auto-resizing textarea. Works controlled or uncontrolled. */
export function Textarea({
  autoResize = true,
  maxHeight = 320,
  bare = false,
  className,
  ref,
  onInput,
  value,
  rows = 1,
  style,
  ...props
}: TextareaProps) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);

  const resize = useCallback(() => {
    const el = innerRef.current;
    if (!el || !autoResize) return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [autoResize, maxHeight]);

  useLayoutEffect(() => {
    resize();
  }, [value, resize]);

  return (
    <textarea
      ref={(el) => {
        innerRef.current = el;
        assignRef(ref, el);
      }}
      rows={rows}
      value={value}
      onInput={(e) => {
        resize();
        onInput?.(e);
      }}
      style={style}
      className={cn(
        "scrollbar-thin block resize-none",
        bare
          ? "w-full border-0 bg-transparent text-ink outline-none placeholder:text-ink-faint focus:ring-0"
          : cn(fieldBase, "px-3 py-2.5 leading-relaxed"),
        className,
      )}
      {...props}
    />
  );
}
