"use client";

import { useId, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Content of the toggle button (label, meta …) */
  trigger: ReactNode;
  children: ReactNode;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  /** Extra controls rendered at the right of the trigger row (not part of the button) */
  aside?: ReactNode;
}

/**
 * Disclosure with a smooth height transition (CSS grid 0fr → 1fr trick).
 * Content stays mounted so iframes / scroll positions survive toggling.
 */
export function CollapsibleSection({
  open,
  onOpenChange,
  trigger,
  children,
  className,
  triggerClassName,
  contentClassName,
  aside,
}: CollapsibleProps) {
  const id = useId();
  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => onOpenChange(!open)}
          className={cn(
            "group/trigger flex min-w-0 flex-1 items-center gap-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 rounded-md",
            triggerClassName,
          )}
        >
          <ChevronRight
            aria-hidden
            className={cn(
              "size-3.5 shrink-0 text-ink-faint transition-transform duration-200 group-hover/trigger:text-ink-muted",
              open && "rotate-90",
            )}
          />
          {trigger}
        </button>
        {aside}
      </div>
      <div
        id={id}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.2,0.7,0.2,1)]",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
        inert={!open}
      >
        <div className={cn("min-h-0 overflow-hidden", contentClassName)}>{children}</div>
      </div>
    </div>
  );
}
