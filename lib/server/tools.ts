import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { ChatSettings, PlanToolInput, PythonOutputItem, PythonToolInput, PythonToolOutput } from "../types";
import { TOOL_NAMES } from "../types";
import { getModel } from "../models";
import { executePython } from "./sandbox";
import { getOpenAI } from "./openai";

/** Seconds a single python execution may run before the kernel is interrupted. */
export const PYTHON_TIMEOUT_SEC = 180;

const MAX_STREAM_CHARS = 8_000;
const MAX_TEXT_RESULT_CHARS = 3_000;
const MAX_TRACEBACK_CHARS = 3_000;
const MAX_SUMMARY_CHARS = 16_000;

/** Keeps head and tail of a long text. */
function truncateMiddle(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const head = Math.floor(limit * 0.6);
  const tail = limit - head;
  const omitted = text.length - head - tail;
  return `${text.slice(0, head)}\n... [${omitted} Zeichen ausgelassen] ...\n${text.slice(-tail)}`;
}

function truncateTail(text: string, limit: number): string {
  if (text.length <= limit) return text;
  return `... [${text.length - limit} Zeichen ausgelassen] ...\n${text.slice(-limit)}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function mergeStreamItems(items: PythonOutputItem[]): PythonOutputItem[] {
  const merged: PythonOutputItem[] = [];
  for (const item of items) {
    const prev = merged[merged.length - 1];
    if (item.type === "stream" && prev?.type === "stream" && prev.name === item.name) {
      merged[merged.length - 1] = { ...prev, text: prev.text + item.text };
    } else {
      merged.push(item);
    }
  }
  return merged;
}

function describeWidgetControl(c: WidgetControl): string {
  switch (c.type) {
    case "slider":
      return `${c.name} (${c.min}–${c.max}${c.unit ? ` ${c.unit}` : ""}, Start ${c.value})`;
    case "select":
      return `${c.name} (Auswahl: ${c.options.join(" | ")}, Start ${c.value})`;
    case "checkbox":
      return `${c.name} (an/aus, Start ${c.value ? "an" : "aus"})`;
  }
}

/** Appends the model-facing summary of one output item to `lines`. */
function summarizeItem(item: PythonOutputItem, lines: string[]): void {
  if ((item.type === "image" || item.type === "html") && item.export) {
    lines.push(
      `[CSV-Export der zugrunde liegenden Daten steht dem Nutzer per Button bereit: ${item.export.path} (${item.export.rows} Zeilen × ${item.export.columns} Spalten)]`,
    );
  }
  switch (item.type) {
    case "stream":
      lines.push(`[${item.name}]\n${truncateMiddle(item.text.replace(/\s+$/, ""), MAX_STREAM_CHARS)}`);
      break;
    case "text":
      lines.push(`[result]\n${truncateMiddle(item.text, MAX_TEXT_RESULT_CHARS)}`);
      break;
    case "image":
      lines.push(
        `[Plot wurde dem Nutzer angezeigt]${item.text ? ` ${truncateMiddle(item.text, 300)}` : ""}`,
      );
      break;
    case "html":
      if (item.kind === "table") {
        lines.push(
          `[Tabelle wurde dem Nutzer angezeigt]${item.text ? `\n${truncateMiddle(item.text, MAX_TEXT_RESULT_CHARS)}` : ""}`,
        );
      } else if (item.kind === "plotly") {
        lines.push(`[Interaktive Plotly-Grafik wurde dem Nutzer angezeigt]${item.text ? ` ${item.text}` : ""}`);
      } else {
        lines.push(
          `[HTML-Ausgabe wurde dem Nutzer angezeigt]${item.text ? `\n${truncateMiddle(item.text, 1_000)}` : ""}`,
        );
      }
      break;
    case "widget": {
      const controls = (item.controls ?? []).map(describeWidgetControl).join("; ");
      const nested: string[] = [];
      for (const o of mergeStreamItems(item.outputs ?? [])) summarizeItem(o, nested);
      lines.push(
        `[Interaktives Widget${item.title ? ` „${item.title}“` : ""} mit Reglern: ${controls || "–"} wurde dem Nutzer angezeigt. ` +
          "Der Nutzer kann die Regler selbst verschieben; die Funktion wird dann im Kernel neu ausgeführt.]" +
          (nested.length ? `\nAusgabe mit Startwerten:\n${nested.join("\n")}` : ""),
      );
      break;
    }
    case "error":
      lines.push(
        `[error] ${item.ename}: ${item.evalue}${item.traceback ? `\n${truncateTail(item.traceback, MAX_TRACEBACK_CHARS)}` : ""}`,
      );
      break;
  }
}

/**
 * Compact text representation of a python execution for the MODEL
 * (never contains base64 images or full HTML).
 */
export function summarizePythonOutput(output: PythonToolOutput): string {
  const lines: string[] = [];
  lines.push(`status: ${output.status} (${(output.durationMs / 1000).toFixed(1)} s)`);

  // merge consecutive stream chunks of the same name
  const merged = mergeStreamItems(output.outputs ?? []);

  for (const item of merged) summarizeItem(item, lines);

  if (merged.length === 0) lines.push("(keine Ausgabe)");

  if (output.files?.length) {
    lines.push(
      "[Erstellte/geänderte Dateien – werden dem Nutzer automatisch als Download angezeigt]\n" +
        output.files.map((f) => `- ${f.path} (${formatSize(f.size)}) – Link: ${f.url}`).join("\n"),
    );
  }

  return truncateMiddle(lines.join("\n\n"), MAX_SUMMARY_CHARS);
}

const pythonInputSchema = z.object({
  code: z
    .string()
    .describe(
      "Python source code to execute in the persistent Jupyter kernel. State (variables, imports) persists between calls.",
    ),
  title: z
    .string()
    .optional()
    .describe("Very short German description of what the code does (max. 6 words), shown to the user as header."),
});

export function createPythonTool(conversationId: string) {
  return tool({
    description:
      "Execute Python code in a stateful, sandboxed Jupyter kernel that belongs to this conversation. " +
      "Use it for calculations, data analysis, reading user-uploaded files, creating charts (matplotlib/plotly) " +
      "and generating downloadable files. Returns stdout/stderr, results, errors and created files.",
    inputSchema: pythonInputSchema,
    execute: async ({ code }: PythonToolInput, { abortSignal }): Promise<PythonToolOutput> =>
      executePython(conversationId, code, PYTHON_TIMEOUT_SEC, abortSignal),
    toModelOutput: ({ output }) => ({
      type: "text",
      value: summarizePythonOutput(output as PythonToolOutput),
    }),
  });
}

const planInputSchema = z.object({
  title: z
    .string()
    .optional()
    .describe("Kurzer deutscher Titel des Plans (z. B. „Analyse Kreditportfolio“)."),
  steps: z
    .array(
      z.object({
        title: z.string().describe("Kurze deutsche Beschreibung des Schritts (max. 8 Wörter)."),
        status: z
          .enum(["pending", "in_progress", "done"])
          .describe("pending = offen, in_progress = wird gerade bearbeitet, done = erledigt"),
      }),
    )
    .min(1)
    .max(10)
    .describe("ALLE Schritte des Plans in Reihenfolge – bei jedem Aufruf die vollständige Liste mit aktuellem Status."),
});

/**
 * `plan`: the model publishes / updates its analysis plan. Purely presentational –
 * the UI renders the latest call of a message as a checklist.
 */
export function createPlanTool() {
  return tool({
    description:
      "Veröffentlicht oder aktualisiert den sichtbaren Arbeitsplan für mehrstufige Analysen (Checkliste für den Nutzer). " +
      "Zu Beginn mit allen Schritten (Status pending, erster ggf. in_progress) aufrufen, danach bei jedem Fortschritt erneut " +
      "mit der VOLLSTÄNDIGEN Liste und aktualisierten Status aufrufen.",
    inputSchema: planInputSchema,
    execute: async ({ steps }: PlanToolInput) => ({
      ok: true,
      done: steps.filter((s) => s.status === "done").length,
      total: steps.length,
    }),
    toModelOutput: ({ output }) => {
      const o = output as { done?: number; total?: number } | undefined;
      return { type: "text", value: `Plan aktualisiert (${o?.done ?? 0}/${o?.total ?? 0} erledigt).` };
    },
  });
}

/**
 * Builds the tools for a request. The ToolSet always has the same shape for
 * history conversion (convertToModelMessages needs `python` for toModelOutput),
 * `activeTools` controls which ones the model may call in this request.
 */
export function buildTools(conversationId: string, settings: ChatSettings) {
  const model = getModel(settings.model);
  const supportsTools = model?.supportsTools ?? true;
  const supportsWebSearch = model?.supportsWebSearch ?? true;

  const tools = {
    [TOOL_NAMES.python]: createPythonTool(conversationId),
    [TOOL_NAMES.plan]: createPlanTool(),
    [TOOL_NAMES.webSearch]: getOpenAI().tools.webSearch({
      searchContextSize: "medium",
      userLocation: {
        type: "approximate",
        country: "DE",
        region: "Baden-Württemberg",
        city: "Stuttgart",
        timezone: "Europe/Berlin",
      },
    }),
  } satisfies ToolSet;

  const activeTools: (keyof typeof tools)[] = [];
  if (supportsTools && settings.tools.python) activeTools.push(TOOL_NAMES.python, TOOL_NAMES.plan);
  if (supportsWebSearch && settings.tools.webSearch) activeTools.push(TOOL_NAMES.webSearch);

  return { tools, activeTools };
}

/** Tools used only for converting stored history to model messages. */
export function buildHistoryTools(conversationId: string) {
  return {
    [TOOL_NAMES.python]: createPythonTool(conversationId),
    [TOOL_NAMES.plan]: createPlanTool(),
  } satisfies ToolSet;
}
