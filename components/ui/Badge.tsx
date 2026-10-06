import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "brand" | "success" | "danger" | "warning";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const tones: Record<BadgeTone, string> = {
  neutral: "border-line bg-surface-sunken text-ink-muted",
  brand: "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-700/60 dark:bg-brand-900/50 dark:text-brand-200",
  success: "border-success/25 bg-success/10 text-success",
  danger: "border-danger/25 bg-danger/10 text-danger",
  warning: "border-warning/30 bg-warning/10 text-warning",
};

/** Small mono pill for meta information (model ids, status, counts). */
export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-full border px-2 font-mono text-[10.5px] font-medium leading-none tracking-tight whitespace-nowrap",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
