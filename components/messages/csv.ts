/**
 * Client-side CSV helpers (no execution of untrusted HTML: DOMParser documents are inert).
 */
import type { DataExport } from "@/lib/types";
import { formatBytes, formatNumber } from "./utils";

/* ------------------------------------------------------------------ */
/* Serialisation                                                       */
/* ------------------------------------------------------------------ */

function quoteCell(value: string): string {
  // RFC 4180: quote when containing delimiter, quote, CR/LF or leading/trailing spaces
  if (/[",;\r\n]/.test(value) || /^\s|\s$/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function rowsToCsv(rows: string[][], delimiter = ","): string {
  return rows.map((r) => r.map(quoteCell).join(delimiter)).join("\r\n");
}

function ensureCsvName(filename: string): string {
  const safe = filename.replace(/[\\/:*?"<>|]+/g, "_").trim() || "daten";
  return /\.csv$/i.test(safe) ? safe : `${safe}.csv`;
}

/** Trigger a browser download for an URL (same-tab, uses the download attribute). */
export function triggerDownload(url: string, filename?: string) {
  const a = document.createElement("a");
  a.href = url;
  if (filename) a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Download rows as UTF-8 CSV (with BOM so Excel detects the encoding) via a Blob URL. */
export function downloadCsv(filename: string, rows: string[][]) {
  const blob = new Blob(["﻿", rowsToCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, ensureCsvName(filename));
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/* ------------------------------------------------------------------ */
/* HTML table → rows                                                   */
/* ------------------------------------------------------------------ */

function cellText(cell: Element): string {
  return (cell.textContent ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Convert an HTML <table> element into a 2-D array, expanding colspan/rowspan
 * (pandas MultiIndex headers & index use them).
 */
export function tableElementToRows(table: HTMLTableElement): string[][] {
  const grid: string[][] = [];
  const trs = Array.from(table.querySelectorAll(":scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr, :scope > tr"));
  trs.forEach((tr, r) => {
    grid[r] ??= [];
    let c = 0;
    for (const cell of Array.from(tr.children)) {
      if (cell.tagName !== "TD" && cell.tagName !== "TH") continue;
      while (grid[r][c] !== undefined) c++;
      const text = cellText(cell);
      const colspan = Math.max(1, Math.min(1000, Number(cell.getAttribute("colspan")) || 1));
      const rowspan = Math.max(1, Math.min(10000, Number(cell.getAttribute("rowspan")) || 1));
      for (let dr = 0; dr < rowspan; dr++) {
        const row = (grid[r + dr] ??= []);
        // repeat spanned values (MultiIndex labels stay attached to every row/column)
        for (let dc = 0; dc < colspan; dc++) row[c + dc] = text;
      }
      c += colspan;
    }
  });
  const width = Math.max(0, ...grid.map((r) => r.length));
  return grid
    .filter(Boolean)
    .map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ""))
    .filter((r) => r.some((v) => v !== ""));
}

/** Parse HTML (inert, scripts never run) and return the rows of the first <table>. */
export function htmlTableToRows(html: string): string[][] {
  if (typeof DOMParser === "undefined") return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  const table = doc.querySelector("table");
  return table ? tableElementToRows(table as HTMLTableElement) : [];
}

/* ------------------------------------------------------------------ */
/* DataExport helpers                                                  */
/* ------------------------------------------------------------------ */

export function exportDownloadUrl(exp: DataExport): string {
  if (/^(data|blob):/i.test(exp.url)) return exp.url;
  return `${exp.url}${exp.url.includes("?") ? "&" : "?"}download=1`;
}

export function describeExport(exp: Pick<DataExport, "rows" | "columns" | "size">): string {
  return `${formatNumber(exp.rows)} Zeilen × ${formatNumber(exp.columns)} Spalten · ${formatBytes(exp.size)}`;
}
