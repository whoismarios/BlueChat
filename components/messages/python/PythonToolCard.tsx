"use client";

import { useEffect, useState } from "react";
import { ChevronDown, CircleAlert, CircleCheck, Clock, Download, FileSpreadsheet, SquareTerminal } from "lucide-react";
import type { DataExport } from "@/lib/types";
import { DropdownMenu, type DropdownMenuEntry } from "@/components/ui/DropdownMenu";
import { describeExport, exportDownloadUrl, triggerDownload } from "../csv";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/Spinner";
import { CollapsibleSection } from "../CollapsibleSection";
import { CopyButton } from "../CopyButton";
import { ShimmerText } from "../ThinkingIndicator";
import type { PythonToolPartView } from "../types";
import { formatDuration } from "../utils";
import { PythonCode } from "./PythonCode";
import { PythonOutputs, ToolErrorText, collectExports, hasVisualOutput } from "./PythonOutputs";

type Phase = "writing" | "running" | "ok" | "error" | "timeout" | "denied";

function phaseOf(part: PythonToolPartView): Phase {
  switch (part.state) {
    case "input-streaming":
      return "writing";
    case "input-available":
    case "approval-requested":
    case "approval-responded":
      return "running";
    case "output-error":
      return "error";
    case "output-denied":
      return "denied";
    case "output-available":
      if (part.preliminary) return "running";
      return part.output?.status === "timeout" ? "timeout" : part.output?.status === "error" ? "error" : "ok";
    default:
      return "running";
  }
}

/** Live elapsed seconds while the cell is executing. */
function useElapsed(active: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active) return;
    const start = Date.now();
    const t = setInterval(() => setElapsed(Date.now() - start), 100);
    return () => clearInterval(t);
  }, [active]);
  return elapsed;
}

interface PythonToolCardProps {
  part: PythonToolPartView;
  /** 1-based execution number within the message ("Zelle 1") */
  index: number;
}

/** The code-interpreter cell: header, collapsible live code, rich outputs. */
export function PythonToolCard({ part, index }: PythonToolCardProps) {
  const phase = phaseOf(part);
  const busy = phase === "writing" || phase === "running";
  const code = part.input?.code ?? "";
  const title = part.input?.title?.trim() || (busy ? "Python-Code" : "Python ausgeführt");
  const output = part.state === "output-available" ? part.output : undefined;
  const visual = hasVisualOutput(output?.outputs);
  const exports = collectExports(output?.outputs);

  // Code: open while running; once finished collapsed if there are visual outputs.
  const defaultOpen = busy || !visual;
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const codeOpen = userOpen ?? defaultOpen;

  const elapsed = useElapsed(phase === "running");
  const lineCount = code ? code.replace(/\n$/, "").split("\n").length : 0;

  return (
    <section
      id={`cell-${part.toolCallId}`}
      aria-label={`Python-Zelle ${index}: ${title}`}
      className={cn(
        "relative my-4 overflow-hidden rounded-card border bg-surface-raised transition-[border-color,box-shadow] duration-300",
        busy ? "border-brand-300/70 shadow-float dark:border-brand-700" : "border-line",
        phase === "error" && "border-danger/35",
      )}
    >
      {busy && <div aria-hidden className="bc-progress absolute inset-x-0 top-0 h-[2px]" />}

      {/* Header */}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <span
          className={cn(
            "relative flex size-8 shrink-0 items-center justify-center rounded-lg border",
            busy
              ? "border-brand-200 bg-brand-50 text-brand-600 dark:border-brand-700 dark:bg-brand-900/50 dark:text-brand-300"
              : "border-line bg-surface-sunken text-ink-muted",
          )}
        >
          <SquareTerminal className="size-4" aria-hidden />
        </span>
        <div className="min-w-[10rem] flex-1">
          <h3 className="truncate text-[14px] font-medium leading-tight text-ink" title={title}>
            {title}
          </h3>
          <p className="mt-0.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-faint">
            Python · Zelle {index}
            {lineCount > 0 && <> · {lineCount} {lineCount === 1 ? "Zeile" : "Zeilen"}</>}
          </p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {exports.length > 0 && <ExportsMenu exports={exports} />}
          <StatusPill phase={phase} elapsed={elapsed} durationMs={output?.durationMs} />
        </div>
      </header>

      {/* Code */}
      <CollapsibleSection
        open={codeOpen}
        onOpenChange={setUserOpen}
        className="border-t border-line"
        triggerClassName="px-4 py-2"
        trigger={
          <span className="text-xs text-ink-muted">
            {phase === "writing" ? <ShimmerText className="text-xs">Schreibt Code…</ShimmerText> : codeOpen ? "Code ausblenden" : "Code anzeigen"}
          </span>
        }
        aside={code ? <CopyButton text={code} label="Code kopieren" className="mr-2" /> : null}
      >
        <div className="px-2 pb-2">
          <div className="overflow-hidden rounded-[10px] bg-code-bg">
            {code ? (
              <PythonCode code={code} streaming={phase === "writing"} className="max-h-[440px] overflow-y-auto" />
            ) : (
              <div className="px-4 py-3 font-mono text-[12.5px] text-code-ink/40">
                <span className="bc-caret" aria-hidden />
              </div>
            )}
          </div>
        </div>
      </CollapsibleSection>

      {/* Outputs */}
      {phase === "running" && (!output || output.outputs.length === 0) && (
        <div className="flex items-center gap-2 border-t border-line px-4 py-3">
          <ShimmerText className="text-xs">Wird im Python-Kernel ausgeführt…</ShimmerText>
        </div>
      )}
      {output && (output.outputs.length > 0 || output.files.length > 0) && (
        <div className="border-t border-line">
          <PythonOutputs outputs={output.outputs} files={output.files} title={title} />
        </div>
      )}
      {output && !busy && output.outputs.length === 0 && output.files.length === 0 && (
        <p className="border-t border-line px-4 py-2.5 font-mono text-[11px] text-ink-faint">Keine Ausgabe</p>
      )}
      {part.state === "output-error" && (
        <div className="border-t border-line">
          <ToolErrorText text={part.errorText || "Die Ausführung ist fehlgeschlagen."} />
        </div>
      )}
      {phase === "denied" && (
        <p className="border-t border-line px-4 py-2.5 text-xs text-ink-muted">Ausführung wurde abgelehnt.</p>
      )}
    </section>
  );
}

/** "Daten (CSV)" – all data exports of this cell in one menu. */
function ExportsMenu({ exports }: { exports: DataExport[] }) {
  const items: DropdownMenuEntry[] = exports.map((exp) => ({
    key: exp.path,
    label: <span className="font-mono text-[12px]">{exp.name}</span>,
    description: describeExport(exp),
    icon: <FileSpreadsheet className="size-4" aria-hidden />,
    onSelect: () => triggerDownload(exportDownloadUrl(exp), exp.name),
  }));
  if (exports.length > 1) {
    items.push({ type: "separator", key: "sep" });
    items.push({
      key: "all",
      label: `Alle ${exports.length} herunterladen`,
      icon: <Download className="size-4" aria-hidden />,
      // stagger so browsers don't drop parallel downloads
      onSelect: () =>
        exports.forEach((exp, i) => setTimeout(() => triggerDownload(exportDownloadUrl(exp), exp.name), i * 350)),
    });
  }
  return (
    <DropdownMenu
      label="Daten als CSV herunterladen"
      align="end"
      width={280}
      items={items}
      trigger={
        <button
          type="button"
          className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-line px-2.5 text-xs text-ink-muted transition-colors hover:border-brand-300 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 dark:hover:border-brand-600"
        >
          <FileSpreadsheet className="size-3.5" aria-hidden />
          <span className="hidden sm:inline">Daten (CSV)</span>
          <span className="font-mono text-[10.5px] tabular-nums text-ink-faint">{exports.length}</span>
          <ChevronDown className="size-3 text-ink-faint" aria-hidden />
        </button>
      }
    />
  );
}

function StatusPill({ phase, elapsed, durationMs }: { phase: Phase; elapsed: number; durationMs?: number }) {
  const base = "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs";
  switch (phase) {
    case "writing":
      return (
        <span className={cn(base, "border-line text-ink-muted")} role="status">
          <Spinner className="size-3" />
          Schreibt…
        </span>
      );
    case "running":
      return (
        <span className={cn(base, "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-900/40 dark:text-brand-200")} role="status">
          <Spinner className="size-3" />
          läuft…
          <span className="font-mono text-[11px] tabular-nums opacity-70">{formatDuration(elapsed)}</span>
        </span>
      );
    case "ok":
      return (
        <span className={cn(base, "border-success/25 bg-success/[0.07] text-success")}>
          <CircleCheck className="size-3.5" aria-hidden />
          Erfolgreich
          {typeof durationMs === "number" && (
            <span className="font-mono text-[11px] tabular-nums opacity-80">{formatDuration(durationMs)}</span>
          )}
        </span>
      );
    case "error":
      return (
        <span className={cn(base, "border-danger/25 bg-danger/[0.07] text-danger")}>
          <CircleAlert className="size-3.5" aria-hidden />
          Fehler
          {typeof durationMs === "number" && (
            <span className="font-mono text-[11px] tabular-nums opacity-80">{formatDuration(durationMs)}</span>
          )}
        </span>
      );
    case "timeout":
      return (
        <span className={cn(base, "border-warning/30 bg-warning/[0.08] text-warning")}>
          <Clock className="size-3.5" aria-hidden />
          Zeitüberschreitung
        </span>
      );
    case "denied":
      return <span className={cn(base, "border-line text-ink-faint")}>Abgelehnt</span>;
  }
}
