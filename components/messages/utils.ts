import type { BlueChatUIMessage, ReasoningEffort } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Formatting helpers (German locale)                                  */
/* ------------------------------------------------------------------ */

const numberDe = new Intl.NumberFormat("de-DE");

export function formatNumber(n: number): string {
  return numberDe.format(n);
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "–";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  const fmt = new Intl.NumberFormat("de-DE", { maximumFractionDigits: value < 10 ? 1 : 0 });
  return `${fmt.format(value)} ${units[i]}`;
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "–";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = ms / 1000;
  if (s < 60) {
    return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: s < 10 ? 2 : 1 }).format(s)} s`;
  }
  const m = Math.floor(s / 60);
  const rest = Math.round(s % 60);
  return `${m} min ${rest} s`;
}

export const REASONING_EFFORT_LABEL: Record<ReasoningEffort, string> = {
  none: "ohne",
  minimal: "minimal",
  low: "niedrig",
  medium: "mittel",
  high: "hoch",
  xhigh: "sehr hoch",
};

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/* ------------------------------------------------------------------ */
/* Terminal output cleanup                                             */
/* ------------------------------------------------------------------ */

const ANSI_RE = /\x1b\[[0-9;?]*[ -/]*[@-~]/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, "");
}

/** Strip ANSI codes and emulate carriage returns (progress bars) like a terminal would. */
export function cleanTerminalText(text: string): string {
  return stripAnsi(text)
    .split("\n")
    .map((line) => {
      if (!line.includes("\r")) return line;
      const segments = line.split("\r").filter((s) => s.length > 0);
      return segments.length ? segments[segments.length - 1] : "";
    })
    .join("\n");
}

/* ------------------------------------------------------------------ */
/* Message helpers                                                     */
/* ------------------------------------------------------------------ */

type Part = BlueChatUIMessage["parts"][number];

export function messageText(message: BlueChatUIMessage): string {
  return message.parts
    .filter((p): p is Extract<Part, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("\n\n")
    .trim();
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function fileExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toLowerCase() : "";
}
