import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const fieldBase =
  "w-full rounded-[10px] border border-line-strong bg-surface-raised text-sm text-ink placeholder:text-ink-faint transition-[border-color,box-shadow] duration-150 outline-none hover:border-brand-300 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:border-brand-700 dark:focus:border-brand-400 dark:focus:ring-brand-400/20";

export function Input({ className, type = "text", ...props }: ComponentProps<"input">) {
  return <input type={type} className={cn(fieldBase, "h-10 px-3", className)} {...props} />;
}
