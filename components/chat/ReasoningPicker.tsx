"use client";

import { Brain, ChevronDown } from "lucide-react";
import type { ModelInfo, ReasoningEffort } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DropdownMenu } from "@/components/ui";
import { fieldTrigger, toolbarTrigger, type PickerProps } from "./ModelPicker";
import { REASONING_DESCRIPTIONS, REASONING_LABELS } from "./settings";

/** Signal-strength style indicator for the effort level. */
function EffortBars({ level, max }: { level: number; max: number }) {
  return (
    <span aria-hidden className="flex h-3 items-end gap-[2px]">
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={cn("w-[3px] rounded-[1px]", i < level ? "bg-brand-500 dark:bg-brand-300" : "bg-line-strong")}
          style={{ height: `${4 + (8 * (i + 1)) / max}px` }}
        />
      ))}
    </span>
  );
}

/** Renders nothing when the model has no reasoning efforts. */
export function ReasoningPicker({
  model,
  value,
  onChange,
  variant = "toolbar",
  disabled,
}: PickerProps & { model: ModelInfo; value: ReasoningEffort | null; onChange: (effort: ReasoningEffort) => void }) {
  const efforts = model.reasoningEfforts;
  if (!efforts || efforts.length === 0) return null;
  const current = value && efforts.includes(value) ? value : (model.defaultReasoningEffort ?? efforts[0]);
  const idx = efforts.indexOf(current);

  return (
    <DropdownMenu
      align="start"
      side={variant === "toolbar" ? "top" : "bottom"}
      width={variant === "toolbar" ? 270 : 300}
      label="Denkaufwand wählen"
      header={
        <div className="px-2.5 pt-1.5 pb-1 font-mono text-[10px] font-medium tracking-[0.12em] text-ink-faint uppercase">
          Denkaufwand
        </div>
      }
      trigger={
        <button
          type="button"
          disabled={disabled}
          className={variant === "toolbar" ? toolbarTrigger : fieldTrigger}
          aria-label={`Denkaufwand: ${REASONING_LABELS[current]}`}
        >
          {variant === "toolbar" ? <Brain /> : <EffortBars level={idx + 1} max={efforts.length} />}
          <span className={cn(variant === "field" && "flex-1")}>
            {variant === "toolbar" && <span className="hidden sm:inline">Denken: </span>}
            <span className={cn(variant === "toolbar" && "font-medium text-ink")}>{REASONING_LABELS[current]}</span>
          </span>
          <ChevronDown className="text-ink-faint" />
        </button>
      }
      items={efforts.map((e, i) => ({
        key: e,
        label: REASONING_LABELS[e],
        description: REASONING_DESCRIPTIONS[e],
        icon: <EffortBars level={i + 1} max={efforts.length} />,
        checked: e === current,
        onSelect: () => onChange(e),
      }))}
    />
  );
}
