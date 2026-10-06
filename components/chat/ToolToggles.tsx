"use client";

import { Globe, SquareTerminal } from "lucide-react";
import type { ModelInfo, ToolToggles as ToolTogglesValue } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Tooltip, focusRing } from "@/components/ui";

function Chip({
  active,
  disabled,
  onClick,
  icon,
  label,
  tooltip,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  tooltip: string;
}) {
  return (
    <Tooltip content={tooltip}>
      <button
        type="button"
        aria-pressed={active}
        aria-label={label}
        aria-disabled={disabled || undefined}
        onClick={() => !disabled && onClick()}
        className={cn(
          "inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] font-medium transition-colors [&_svg]:size-[14px]",
          focusRing,
          active
            ? "border-brand-200 bg-brand-50 text-brand-700 hover:border-brand-300 dark:border-brand-700/70 dark:bg-brand-900/45 dark:text-brand-200"
            : "border-transparent text-ink-muted hover:border-line hover:bg-surface-sunken hover:text-ink",
          disabled && "cursor-not-allowed opacity-45 hover:border-transparent hover:bg-transparent hover:text-ink-muted",
        )}
      >
        {icon}
        <span className="hidden sm:inline">{label}</span>
        <span
          aria-hidden
          className={cn(
            "size-1.5 rounded-full transition-colors",
            active ? "bg-accent shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-accent)_20%,transparent)]" : "bg-line-strong",
          )}
        />
      </button>
    </Tooltip>
  );
}

export function ToolToggles({
  model,
  value,
  onChange,
}: {
  model: ModelInfo;
  value: ToolTogglesValue;
  onChange: (next: ToolTogglesValue) => void;
}) {
  const pythonDisabled = !model.supportsTools;
  const webDisabled = !model.supportsWebSearch;
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Werkzeuge">
      <Chip
        active={value.python && !pythonDisabled}
        disabled={pythonDisabled}
        onClick={() => onChange({ ...value, python: !value.python })}
        icon={<SquareTerminal />}
        label="Python"
        tooltip={
          pythonDisabled
            ? `${model.label} unterstützt keine Werkzeuge`
            : value.python
              ? "Python-Codeausführung aktiv – klicken zum Deaktivieren"
              : "Python-Codeausführung aktivieren"
        }
      />
      <Chip
        active={value.webSearch && !webDisabled}
        disabled={webDisabled}
        onClick={() => onChange({ ...value, webSearch: !value.webSearch })}
        icon={<Globe />}
        label="Websuche"
        tooltip={
          webDisabled
            ? `${model.label} unterstützt keine Websuche`
            : value.webSearch
              ? "Websuche aktiv – klicken zum Deaktivieren"
              : "Websuche aktivieren"
        }
      />
    </div>
  );
}
