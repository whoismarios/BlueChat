"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "./IconButton";
import { useMounted } from "./floating";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** Tailwind max-width class for the panel (default "max-w-lg"). */
  size?: "sm" | "md" | "lg";
  className?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const sizes = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl" };

/** Modal dialog: portal, backdrop, Esc closes, focus is trapped and restored. */
export function Dialog({ open, onOpenChange, title, description, children, footer, size = "md", className }: DialogProps) {
  const mounted = useMounted();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const onOpenChangeRef = useRef(onOpenChange);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  });

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const preferred = panel.querySelector<HTMLElement>("[data-autofocus]");
      const first = preferred ?? panel.querySelector<HTMLElement>(FOCUSABLE.split(", ").map((sel) => `[data-dialog-body] ${sel}`).join(", ")) ?? panel;
      first.focus();
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onOpenChangeRef.current(false);
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus?.();
    };
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div
        aria-hidden
        className="absolute inset-0 animate-[overlay-in_160ms_ease-out] bg-brand-950/45 backdrop-blur-[3px] dark:bg-black/60"
        onMouseDown={() => onOpenChange(false)}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          "relative flex max-h-[min(88dvh,820px)] w-full flex-col overflow-hidden rounded-t-[18px] border border-line bg-surface-raised shadow-float outline-none sm:rounded-card",
          "animate-[dialog-in_220ms_cubic-bezier(0.2,0.7,0.2,1)]",
          sizes[size],
          className,
        )}
      >
        <div className="flex items-start gap-4 border-b border-line px-6 pt-5 pb-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-display text-[26px] leading-tight tracking-[-0.01em] text-ink">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-[13.5px] leading-relaxed text-ink-muted">
                {description}
              </p>
            )}
          </div>
          <IconButton label="Schließen" size="sm" onClick={() => onOpenChange(false)} className="-mr-2">
            <X />
          </IconButton>
        </div>
        {children != null && (
          <div data-dialog-body className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {children}
          </div>
        )}
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface px-6 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
