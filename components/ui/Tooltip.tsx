"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useFloating, useMounted, type Side } from "./floating";

export interface TooltipProps {
  content: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  /** Delay in ms before showing on hover (focus shows immediately). */
  delay?: number;
  /** Disable the tooltip (still renders children). */
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Hover/focus tooltip rendered in a portal (never clipped by overflow containers).
 * Wraps children in an inline-flex span.
 */
export function Tooltip({ content, side = "top", delay = 350, disabled, className, children }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const mounted = useMounted();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();
  const { pos } = useFloating(open, anchorRef, tipRef, side as Side, "center");

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const show = (immediate = false) => {
    if (disabled || content == null || content === "") return;
    if (timer.current) clearTimeout(timer.current);
    if (immediate) setOpen(true);
    else timer.current = setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
  };

  return (
    <span
      ref={anchorRef}
      className={cn("inline-flex", className)}
      onPointerEnter={(e) => e.pointerType === "mouse" && show()}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocus={(e) => {
        if ((e.target as HTMLElement).matches?.(":focus-visible")) show(true);
      }}
      onBlur={hide}
      aria-describedby={open ? id : undefined}
    >
      {children}
      {mounted &&
        open &&
        createPortal(
          <div
            ref={tipRef}
            id={id}
            role="tooltip"
            style={{ position: "fixed", top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
            className={cn(
              "pointer-events-none z-[100] max-w-64 rounded-md bg-brand-950 px-2 py-1 text-[12px] leading-snug font-medium text-white shadow-float dark:bg-[#dfe9f5] dark:text-brand-950",
              pos ? "animate-[tooltip-in_120ms_ease-out]" : "opacity-0",
            )}
          >
            {content}
          </div>,
          document.body,
        )}
    </span>
  );
}
