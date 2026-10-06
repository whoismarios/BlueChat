"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Check, ChevronDown, RotateCcw, SlidersHorizontal, TriangleAlert } from "lucide-react";
import type { PythonOutputItem, PythonToolOutput, SandboxFile, WidgetControl, WidgetValue } from "@/lib/types";
import { cn } from "@/lib/utils";
import { focusRing } from "@/components/ui/Button";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { Spinner } from "@/components/ui/Spinner";
import { Switch } from "@/components/ui/Switch";
import { Tooltip } from "@/components/ui/Tooltip";
import { formatDuration } from "../utils";
import { PythonOutputs } from "./PythonOutputs";

export type WidgetItem = Extract<PythonOutputItem, { type: "widget" }>;
type Values = Record<string, WidgetValue>;

const DEBOUNCE_MS = 250;

interface WidgetOutputProps {
  widget: WidgetItem;
  /** Conversation id (= sandbox session). null → controls are disabled (read-only preview). */
  sessionId: string | null;
}

function defaultsOf(controls: WidgetControl[]): Values {
  const out: Values = {};
  for (const c of controls) out[c.name] = c.value;
  return out;
}

function sameValues(a: Values, b: Values): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k]);
}

/** Number of decimals implied by a slider step (0.05 → 2, 1 → 0). */
function decimalsOf(step: number): number {
  if (!Number.isFinite(step) || step <= 0 || Number.isInteger(step)) return 0;
  const s = String(step);
  if (s.includes("e-")) return Math.min(8, Number(s.split("e-")[1]));
  return Math.min(8, s.split(".")[1]?.length ?? 0);
}

function formatValue(v: number, decimals: number): string {
  return new Intl.NumberFormat("de-DE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v);
}

interface RunResult {
  outputs: PythonOutputItem[];
  files: SandboxFile[];
  durationMs: number | null;
}

/**
 * Interactive widget created in Python with `@interact(...)`: a control panel (sliders, selects,
 * switches) above the outputs. Changing a control re-runs the registered Python function in the
 * kernel (debounced) and swaps in the new outputs; the previous outputs stay visible (dimmed)
 * while the kernel computes.
 */
export function WidgetOutput({ widget, sessionId }: WidgetOutputProps) {
  const controls = useMemo(() => (Array.isArray(widget.controls) ? widget.controls : []), [widget.controls]);
  const defaults = useMemo(() => defaultsOf(controls), [controls]);
  const initial = useMemo<RunResult>(
    () => ({ outputs: widget.outputs ?? [], files: [], durationMs: null }),
    [widget.outputs],
  );

  const [values, setValues] = useState<Values>(defaults);
  const [result, setResult] = useState<RunResult>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState(0);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef(false);
  const pending = useRef<Values | null>(null);
  const generation = useRef(0);
  const latest = useRef<Values>(defaults);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const interactive = !!sessionId && controls.length > 0;
  const dirty = !sameValues(values, defaults);

  const run = useCallback(
    async (vals: Values) => {
      if (!sessionId) return;
      if (inflight.current) {
        // one request at a time (the kernel serialises anyway) – send the latest values afterwards
        pending.current = vals;
        return;
      }
      inflight.current = true;
      const gen = generation.current;
      setLoading(true);
      let next: Values | null = null;
      try {
        const res = await fetch(`/api/sandbox/${encodeURIComponent(sessionId)}/widget`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ widgetId: widget.id, values: vals }),
        });
        const data = (await res.json().catch(() => null)) as (PythonToolOutput & { error?: string }) | null;
        if (!mounted.current || gen !== generation.current) return;
        if (!res.ok || !data || !Array.isArray(data.outputs)) {
          setError(data?.error || `Neuberechnung fehlgeschlagen (HTTP ${res.status}).`);
        } else {
          const inactive = data.outputs.find((o) => o.type === "error" && o.ename === "WidgetInaktiv");
          if (inactive && inactive.type === "error") {
            setError(inactive.evalue);
          } else {
            setError(null);
            setResult({ outputs: data.outputs, files: data.files ?? [], durationMs: data.durationMs });
            setRuns((n) => n + 1);
          }
        }
      } catch {
        if (mounted.current && gen === generation.current) {
          setError("Die Neuberechnung konnte nicht gestartet werden. Bitte Verbindung prüfen.");
        }
      } finally {
        inflight.current = false;
        next = pending.current;
        pending.current = null;
        if (next && mounted.current && gen === generation.current) {
          void run(next);
        } else if (mounted.current) {
          setLoading(false);
        }
      }
    },
    [sessionId, widget.id],
  );

  const schedule = useCallback(
    (vals: Values, immediate = false) => {
      latest.current = vals;
      if (timer.current) clearTimeout(timer.current);
      if (immediate) {
        timer.current = null;
        void run(vals);
      } else {
        timer.current = setTimeout(() => {
          timer.current = null;
          void run(vals);
        }, DEBOUNCE_MS);
      }
    },
    [run],
  );

  const setValue = useCallback(
    (name: string, v: WidgetValue, immediate = false) => {
      const nextVals = { ...latest.current, [name]: v };
      if (latest.current[name] === v && !immediate) return;
      setValues(nextVals);
      schedule(nextVals, immediate);
    },
    [schedule],
  );

  /** Pointer released on a slider: compute now instead of waiting for the debounce. */
  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      void run(latest.current);
    }
  }, [run]);

  const reset = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    generation.current++;
    pending.current = null;
    latest.current = defaults;
    setValues(defaults);
    setResult(initial); // the original outputs belong to the default values
    setError(null);
    setLoading(false);
  }, [defaults, initial]);

  return (
    <div className="px-4 py-3">
      <div
        className={cn(
          "relative overflow-hidden rounded-[12px] border bg-surface transition-[border-color,box-shadow] duration-300",
          loading ? "border-brand-300/80 shadow-float dark:border-brand-700" : "border-line",
        )}
      >
        {loading && <div aria-hidden className="bc-progress absolute inset-x-0 top-0 z-10 h-[2px]" />}

        {/* Header */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line px-3.5 py-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand-600 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.15)] dark:bg-brand-500">
            <SlidersHorizontal className="size-3.5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[9.5px] uppercase leading-none tracking-[0.16em] text-accent">Interaktiv</p>
            <h4 className="mt-1 truncate font-display text-[17px] leading-tight text-ink" title={widget.title}>
              {widget.title || "Parameter anpassen"}
            </h4>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <RunStatus loading={loading} interactive={interactive} durationMs={runs > 0 ? result.durationMs : null} />
            {interactive && (
              <button
                type="button"
                onClick={reset}
                disabled={!dirty}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-ink-muted transition-[color,background-color,opacity] hover:bg-surface-sunken hover:text-ink disabled:pointer-events-none disabled:opacity-0",
                  focusRing,
                )}
              >
                <RotateCcw className="size-3.5" aria-hidden />
                Zurücksetzen
              </button>
            )}
          </div>
        </div>

        {/* Controls */}
        {controls.length > 0 && (
          <div
            role="group"
            aria-label={`Regler${widget.title ? ` für ${widget.title}` : ""}`}
            className="grid grid-cols-1 gap-x-8 gap-y-4 bg-surface-sunken/60 px-4 py-4 sm:grid-cols-2"
          >
            {controls.map((c) => (
              <ControlField
                key={c.name}
                control={c}
                value={values[c.name] ?? c.value}
                disabled={!interactive}
                onChange={(v, immediate) => setValue(c.name, v, immediate)}
                onCommit={flush}
              />
            ))}
          </div>
        )}

        {!sessionId && (
          <p className="border-t border-line bg-surface-sunken/60 px-4 py-2 font-mono text-[10.5px] text-ink-faint">
            Vorschau – Regler sind nur im Chat aktiv.
          </p>
        )}

        {error && (
          <div role="alert" className="flex items-start gap-2 border-t border-danger/20 bg-danger/[0.06] px-4 py-2.5">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-danger" aria-hidden />
            <p className="min-w-0 text-[12.5px] leading-snug text-ink">{error}</p>
          </div>
        )}

        {/* Outputs (previous ones stay visible, dimmed, while recomputing) */}
        <div
          aria-busy={loading || undefined}
          className={cn(
            "border-t border-line bg-surface-raised transition-[opacity,filter] duration-300",
            loading && "opacity-55 saturate-50",
          )}
        >
          {result.outputs.length > 0 || result.files.length > 0 ? (
            <PythonOutputs outputs={result.outputs} files={result.files} title={widget.title || "Widget"} />
          ) : (
            <p className="px-4 py-3 font-mono text-[11px] text-ink-faint">Keine Ausgabe</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function RunStatus({ loading, interactive, durationMs }: { loading: boolean; interactive: boolean; durationMs: number | null }) {
  if (loading) {
    return (
      <span role="status" className="inline-flex items-center gap-1.5 font-mono text-[11px] text-brand-600 dark:text-brand-300">
        <Spinner className="size-3" />
        rechnet…
      </span>
    );
  }
  if (!interactive) return null;
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-faint">
      <span aria-hidden className="relative flex size-1.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-50 [animation-duration:2.4s]" />
        <span className="relative inline-flex size-1.5 rounded-full bg-accent" />
      </span>
      {durationMs != null ? <>live · {formatDuration(durationMs)}</> : "live"}
    </span>
  );
}

interface ControlFieldProps {
  control: WidgetControl;
  value: WidgetValue;
  disabled: boolean;
  onChange: (value: WidgetValue, immediate?: boolean) => void;
  onCommit: () => void;
}

function ControlField({ control, value, disabled, onChange, onCommit }: ControlFieldProps) {
  switch (control.type) {
    case "slider":
      return <SliderField control={control} value={typeof value === "number" ? value : Number(value)} disabled={disabled} onChange={onChange} onCommit={onCommit} />;
    case "select":
      return <SelectField control={control} value={value as string | number} disabled={disabled} onChange={(v) => onChange(v, true)} />;
    case "checkbox":
      return (
        <div className="flex items-center justify-between gap-4 self-end rounded-lg border border-line bg-surface-raised px-3 py-2">
          <span className="text-[12.5px] font-medium text-ink-muted">{control.label}</span>
          <Switch
            checked={!!value}
            onCheckedChange={(v) => onChange(v, true)}
            disabled={disabled}
            aria-label={control.label}
          />
        </div>
      );
    default:
      return null;
  }
}

const rangeClass = cn(
  "relative h-5 w-full cursor-pointer appearance-none bg-transparent disabled:cursor-not-allowed",
  "focus-visible:outline-none",
  // track
  "[&::-webkit-slider-runnable-track]:h-[3px] [&::-webkit-slider-runnable-track]:rounded-full",
  "[&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,var(--color-brand-600)_var(--fill),var(--line-strong)_var(--fill))]",
  "dark:[&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,var(--color-brand-300)_var(--fill),var(--line-strong)_var(--fill))]",
  "[&::-moz-range-track]:h-[3px] [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-line-strong",
  "[&::-moz-range-progress]:h-[3px] [&::-moz-range-progress]:rounded-full [&::-moz-range-progress]:bg-brand-600 dark:[&::-moz-range-progress]:bg-brand-300",
  // thumb
  "[&::-webkit-slider-thumb]:mt-[-6.5px] [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full",
  "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-brand-600 [&::-webkit-slider-thumb]:bg-white",
  "[&::-webkit-slider-thumb]:shadow-[0_1px_3px_rgb(0_33_63/0.35)] [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-150",
  "hover:[&::-webkit-slider-thumb]:scale-110 active:[&::-webkit-slider-thumb]:scale-125",
  "focus-visible:[&::-webkit-slider-thumb]:ring-4 focus-visible:[&::-webkit-slider-thumb]:ring-accent/30",
  "dark:[&::-webkit-slider-thumb]:border-brand-300 dark:[&::-webkit-slider-thumb]:bg-brand-950",
  "[&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-brand-600",
  "[&::-moz-range-thumb]:bg-white dark:[&::-moz-range-thumb]:border-brand-300 dark:[&::-moz-range-thumb]:bg-brand-950",
  "disabled:[&::-webkit-slider-thumb]:border-line-strong disabled:[&::-moz-range-thumb]:border-line-strong",
);

function SliderField({
  control,
  value,
  disabled,
  onChange,
  onCommit,
}: {
  control: Extract<WidgetControl, { type: "slider" }>;
  value: number;
  disabled: boolean;
  onChange: (value: WidgetValue, immediate?: boolean) => void;
  onCommit: () => void;
}) {
  const { min, max, step, unit, label } = control;
  const decimals = decimalsOf(step);
  const span = max - min || 1;
  const pct = Math.min(100, Math.max(0, ((value - min) / span) * 100));
  const defaultPct = Math.min(100, Math.max(0, ((control.value - min) / span) * 100));
  const changed = value !== control.value;
  const shown = formatValue(value, decimals);

  return (
    <div className={cn("min-w-0", disabled && "opacity-70")}>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="truncate text-[12.5px] font-medium text-ink-muted">{label}</span>
        <span
          className={cn(
            "shrink-0 font-mono text-[13px] font-medium tabular-nums transition-colors",
            changed ? "text-brand-600 dark:text-brand-300" : "text-ink",
          )}
        >
          {shown}
          {unit && <span className="ml-1 text-[11px] font-normal text-ink-faint">{unit}</span>}
        </span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-label={label}
          aria-valuetext={`${shown}${unit ? ` ${unit}` : ""}`}
          onChange={(e) => onChange(Number(e.currentTarget.value))}
          onPointerUp={onCommit}
          onKeyUp={(e) => {
            if (e.key === "Home" || e.key === "End" || e.key === "PageUp" || e.key === "PageDown") onCommit();
          }}
          className={rangeClass}
          style={{ "--fill": `${pct}%` } as CSSProperties}
        />
        {/* start value marker */}
        <Tooltip content={`Startwert ${formatValue(control.value, decimals)}${unit ? ` ${unit}` : ""}`}>
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            aria-label="Auf Startwert setzen"
            onClick={() => onChange(control.value, true)}
            className="absolute top-[17px] h-2.5 w-2 -translate-x-1/2 cursor-pointer disabled:cursor-default"
            style={{ left: `calc(8px + (100% - 16px) * ${defaultPct / 100})` }}
          >
            <span aria-hidden className={cn("mx-auto block h-1.5 w-px", changed ? "bg-brand-400" : "bg-ink-faint/60")} />
          </button>
        </Tooltip>
      </div>
      <div className="mt-0.5 flex justify-between font-mono text-[10px] tabular-nums text-ink-faint">
        <span>{formatValue(min, decimals)}</span>
        <span>{formatValue(max, decimals)}</span>
      </div>
    </div>
  );
}

function SelectField({
  control,
  value,
  disabled,
  onChange,
}: {
  control: Extract<WidgetControl, { type: "select" }>;
  value: string | number;
  disabled: boolean;
  onChange: (value: WidgetValue) => void;
}) {
  const options = control.options;
  const segmented = options.length <= 4 && options.reduce<number>((n, o) => n + String(o).length, 0) <= 34;

  return (
    <div className={cn("min-w-0", disabled && "opacity-70")}>
      <span className="mb-1.5 block truncate text-[12.5px] font-medium text-ink-muted">{control.label}</span>
      {segmented ? (
        <div role="radiogroup" aria-label={control.label} className="flex rounded-lg border border-line bg-surface-raised p-0.5">
          {options.map((o) => {
            const active = o === value;
            return (
              <button
                key={String(o)}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={disabled}
                onClick={() => onChange(o)}
                className={cn(
                  "min-w-0 flex-1 truncate rounded-md px-2.5 py-1 text-[12.5px] transition-[background-color,color,box-shadow] duration-150 disabled:cursor-not-allowed",
                  focusRing,
                  active
                    ? "bg-brand-600 font-medium text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_1px_2px_rgb(0_33_63/0.25)] dark:bg-brand-500"
                    : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
                )}
              >
                {String(o)}
              </button>
            );
          })}
        </div>
      ) : (
        <DropdownMenu
          label={control.label}
          align="start"
          items={options.map((o) => ({
            key: String(o),
            label: String(o),
            checked: o === value,
            icon: o === value ? <Check className="size-4" aria-hidden /> : <span className="size-4" />,
            onSelect: () => onChange(o),
          }))}
          trigger={
            <button
              type="button"
              disabled={disabled}
              className={cn(
                "flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-line bg-surface-raised px-2.5 text-[12.5px] text-ink transition-colors hover:border-brand-300 disabled:cursor-not-allowed dark:hover:border-brand-700",
                focusRing,
              )}
            >
              <span className="truncate">{String(value)}</span>
              <ChevronDown className="size-3.5 shrink-0 text-ink-faint" aria-hidden />
            </button>
          }
        />
      )}
    </div>
  );
}
