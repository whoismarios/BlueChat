"use client";

import { Download } from "lucide-react";
import type { DataExport } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/Tooltip";
import { describeExport, downloadCsv, exportDownloadUrl } from "../csv";

/** Shared look for small overlay actions on outputs (images, frames, tables). */
export const overlayActionClass =
  "inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-line bg-surface-raised/95 px-2 text-xs text-ink-muted shadow-float backdrop-blur transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60";

interface CsvExportActionProps {
  /** Server-side export (preferred) */
  exp?: DataExport;
  /** Client-side fallback: rows derived lazily at click time */
  getRows?: () => string[][];
  /** Filename for the client-side fallback */
  filename?: string;
  label?: string;
  className?: string;
}

/** "CSV exportieren" – downloads the data behind an output. Renders nothing if no data source. */
export function CsvExportAction({ exp, getRows, filename = "daten.csv", label = "CSV exportieren", className }: CsvExportActionProps) {
  if (exp) {
    return (
      <Tooltip content={describeExport(exp)}>
        <a
          href={exportDownloadUrl(exp)}
          download={exp.name}
          className={cn(overlayActionClass, className)}
          aria-label={`${label}: ${exp.name} (${describeExport(exp)})`}
        >
          <Download className="size-3.5" aria-hidden />
          {label}
        </a>
      </Tooltip>
    );
  }
  if (!getRows) return null;
  return (
    <Tooltip content="Aus der angezeigten Tabelle erzeugt">
      <button
        type="button"
        onClick={() => {
          const rows = getRows();
          if (rows.length) downloadCsv(filename, rows);
        }}
        className={cn(overlayActionClass, className)}
      >
        <Download className="size-3.5" aria-hidden />
        {label}
      </button>
    </Tooltip>
  );
}
