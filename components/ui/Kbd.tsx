import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Keyboard key hint, e.g. <Kbd>⏎</Kbd>. */
export function Kbd({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] border border-line-strong border-b-2 bg-surface-raised px-1 font-mono text-[10px] font-medium leading-none text-ink-muted",
        className,
      )}
      {...props}
    />
  );
}
