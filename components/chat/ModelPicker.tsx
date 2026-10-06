"use client";

import { ChevronDown, Sparkles } from "lucide-react";
import { MODELS } from "@/lib/models";
import { cn } from "@/lib/utils";
import { Badge, DropdownMenu, focusRing } from "@/components/ui";
import { resolveModel } from "./settings";

export interface PickerProps {
  /** "toolbar": compact ghost button inside the composer; "field": full-width form control. */
  variant?: "toolbar" | "field";
  disabled?: boolean;
}

export const toolbarTrigger = cn(
  "inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink aria-expanded:bg-surface-sunken aria-expanded:text-ink disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-[15px] [&_svg]:shrink-0",
  focusRing,
);

export const fieldTrigger = cn(
  "flex h-10 w-full cursor-pointer items-center gap-2 rounded-[10px] border border-line-strong bg-surface-raised px-3 text-left text-sm text-ink transition-colors hover:border-brand-300 aria-expanded:border-brand-500 dark:hover:border-brand-700 [&_svg]:size-4 [&_svg]:shrink-0",
  focusRing,
);

export function ModelPicker({ value, onChange, variant = "toolbar", disabled }: PickerProps & { value: string; onChange: (id: string) => void }) {
  const current = resolveModel(value);
  return (
    <DropdownMenu
      align="start"
      side={variant === "toolbar" ? "top" : "bottom"}
      width={variant === "toolbar" ? 320 : 340}
      label="Modell wählen"
      header={
        <div className="px-2.5 pt-1.5 pb-1 font-mono text-[10px] font-medium tracking-[0.12em] text-ink-faint uppercase">Modell</div>
      }
      trigger={
        <button type="button" disabled={disabled} className={variant === "toolbar" ? toolbarTrigger : fieldTrigger}>
          {variant === "toolbar" && <Sparkles className="text-brand-500 dark:text-brand-300" />}
          <span className={cn("truncate font-medium", variant === "toolbar" ? "text-ink" : "flex-1")}>{current.label}</span>
          <ChevronDown className="text-ink-faint" />
        </button>
      }
      items={MODELS.map((m) => ({
        key: m.id,
        label: m.label,
        description: m.description,
        checked: m.id === current.id,
        hint: m.reasoningEfforts ? undefined : <Badge>schnell</Badge>,
        onSelect: () => onChange(m.id),
      }))}
    />
  );
}
