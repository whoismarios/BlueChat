"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { focusRing } from "./Button";

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
  /** Used as aria-label when no visible label is given. */
  "aria-label"?: string;
}

export function Switch({ checked, onCheckedChange, label, description, disabled, className, ...rest }: SwitchProps) {
  const id = useId();
  const control = (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label ? undefined : rest["aria-label"]}
      aria-describedby={description ? `${id}-desc` : undefined}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-[22px] w-[38px] shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50",
        focusRing,
        checked ? "border-brand-600 bg-brand-600 dark:border-brand-500 dark:bg-brand-500" : "border-line-strong bg-surface-sunken",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-1/2 size-4 -translate-y-1/2 rounded-full bg-white shadow-[0_1px_2px_rgb(0_33_63/0.3)] transition-[left] duration-200 ease-[cubic-bezier(0.2,0.7,0.2,1)]",
          checked ? "left-[18px]" : "left-[2px]",
        )}
      />
    </button>
  );

  if (!label && !description) return <span className={className}>{control}</span>;

  return (
    <div className={cn("flex items-start justify-between gap-4", disabled && "opacity-70", className)}>
      <div className="min-w-0">
        {label && (
          <label htmlFor={id} className="block cursor-pointer text-sm font-medium text-ink">
            {label}
          </label>
        )}
        {description && (
          <p id={`${id}-desc`} className="mt-0.5 text-[13px] leading-snug text-ink-muted">
            {description}
          </p>
        )}
      </div>
      <div className="pt-0.5">{control}</div>
    </div>
  );
}
