/**
 * Export of a conversation as Jupyter notebook (nbformat 4.5).
 *
 * User messages → markdown cells, assistant text → markdown cells, executed `python` tool calls →
 * code cells with their outputs converted to Jupyter output objects.
 */
import type {
  BlueChatUIMessage,
  Conversation,
  PlanToolInput,
  PythonOutputItem,
  PythonToolInput,
  PythonToolOutput,
  WidgetControl,
} from "../types";
import { getModel } from "../models";

const USER_NAME = "Marios";

/* ------------------------------------------------------------------ */
/* nbformat types (subset)                                             */
/* ------------------------------------------------------------------ */

type MimeBundle = Record<string, string | string[]>;

type NbOutput =
  | { output_type: "stream"; name: "stdout" | "stderr"; text: string[] }
  | { output_type: "execute_result"; execution_count: number; data: MimeBundle; metadata: Record<string, unknown> }
  | { output_type: "display_data"; data: MimeBundle; metadata: Record<string, unknown> }
  | { output_type: "error"; ename: string; evalue: string; traceback: string[] };

type NbCell =
  | { cell_type: "markdown"; id: string; metadata: Record<string, unknown>; source: string[] }
  | {
      cell_type: "code";
      id: string;
      metadata: Record<string, unknown>;
      source: string[];
      execution_count: number | null;
      outputs: NbOutput[];
    };

export interface Notebook {
  nbformat: 4;
  nbformat_minor: 5;
  metadata: Record<string, unknown>;
  cells: NbCell[];
}

type Part = BlueChatUIMessage["parts"][number];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Jupyter multiline string: array of lines, each keeping its trailing "\n" (except the last). */
function lines(text: string): string[] {
  if (!text) return [];
  const parts = text.split(/(?<=\n)/);
  return parts;
}

function formatBerlin(date: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

function escapeMd(text: string): string {
  return text.replace(/([\\`*_[\]<>])/g, "\\$1");
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace(".", ",")} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

function describeControl(c: WidgetControl): string {
  if (c.type === "slider") return `${c.label} = ${c.value}${c.unit ? ` ${c.unit}` : ""}`;
  if (c.type === "checkbox") return `${c.label} = ${c.value ? "an" : "aus"}`;
  return `${c.label} = ${c.value}`;
}

function webSearchQuery(part: { input?: unknown; output?: unknown }): string | null {
  const action = (part.output as { action?: { type?: string; query?: string; queries?: string[]; url?: string | null } })?.action;
  if (action?.type === "search") {
    const qs = action.queries?.length ? action.queries : action.query ? [action.query] : [];
    if (qs.length) return qs.map((q) => `„${q}“`).join(", ");
  }
  if (action?.type === "openPage" && action.url) return `Seite geöffnet: ${action.url}`;
  const input = part.input as { query?: unknown } | undefined;
  if (input && typeof input === "object" && typeof input.query === "string" && input.query) return `„${input.query}“`;
  return null;
}

/* ------------------------------------------------------------------ */
/* Builder                                                             */
/* ------------------------------------------------------------------ */

class NotebookBuilder {
  cells: NbCell[] = [];
  private counter = 0;
  private executionCount = 0;

  private nextId(prefix: string): string {
    return `${prefix}-${String(++this.counter).padStart(4, "0")}`;
  }

  markdown(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    this.cells.push({ cell_type: "markdown", id: this.nextId("md"), metadata: {}, source: lines(trimmed) });
  }

  code(code: string, outputs: (count: number) => NbOutput[], metadata: Record<string, unknown> = {}) {
    const count = ++this.executionCount;
    this.cells.push({
      cell_type: "code",
      id: this.nextId("code"),
      metadata,
      source: lines(code.replace(/\s+$/, "")),
      execution_count: count,
      outputs: outputs(count),
    });
  }
}

function convertOutput(item: PythonOutputItem, count: number): NbOutput[] {
  switch (item.type) {
    case "stream":
      return [{ output_type: "stream", name: item.name, text: lines(item.text) }];
    case "text":
      return [{ output_type: "execute_result", execution_count: count, data: { "text/plain": lines(item.text) }, metadata: {} }];
    case "image": {
      const data: MimeBundle = item.mime === "image/svg+xml" ? { "image/svg+xml": lines(item.data) } : { [item.mime]: item.data };
      data["text/plain"] = lines(item.text ?? (item.mime === "image/svg+xml" ? "<SVG-Grafik>" : "<Abbildung>"));
      return [{ output_type: "display_data", data, metadata: {} }];
    }
    case "html": {
      const data: MimeBundle = { "text/html": lines(item.html) };
      data["text/plain"] = lines(
        item.text ?? (item.kind === "plotly" ? "<Plotly-Diagramm>" : item.kind === "table" ? "<Tabelle>" : "<HTML-Ausgabe>"),
      );
      return [{ output_type: "display_data", data, metadata: {} }];
    }
    case "error":
      return [
        {
          output_type: "error",
          ename: item.ename || "Error",
          evalue: item.evalue ?? "",
          traceback: (item.traceback || `${item.ename}: ${item.evalue}`).split("\n"),
        },
      ];
    case "widget": {
      const controls = item.controls?.length ? ` (Regler: ${item.controls.map(describeControl).join(", ")})` : "";
      const note = `Interaktives Widget „${item.title || "Widget"}“${controls} – in blueChat interaktiv`;
      return [
        {
          output_type: "display_data",
          data: { "text/markdown": lines(`*${escapeMd(note)}*`), "text/plain": lines(note) },
          metadata: {},
        },
        ...(item.outputs ?? []).flatMap((o) => convertOutput(o, count)),
      ];
    }
    default:
      return [];
  }
}

function planChecklist(plan: PlanToolInput): string {
  const head = `**${escapeMd(plan.title?.trim() || "Analyseplan")}**`;
  const steps = (plan.steps ?? []).map((s) => {
    const mark = s.status === "done" ? "x" : " ";
    const suffix = s.status === "in_progress" ? " *(in Arbeit)*" : "";
    return `- [${mark}] ${escapeMd(s.title)}${suffix}`;
  });
  return [head, "", ...steps].join("\n");
}

function addUserMessage(nb: NotebookBuilder, msg: BlueChatUIMessage) {
  const text = msg.parts
    .filter((p): p is Extract<Part, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("\n\n")
    .trim();
  const attachments = msg.metadata?.attachments ?? [];
  const files = msg.parts.filter((p): p is Extract<Part, { type: "file" }> => p.type === "file");
  const out = [`**${USER_NAME}:**`, "", text];
  if (attachments.length || files.length) {
    out.push("", "*Anhänge:*");
    for (const a of attachments) out.push(`- \`${a.path || a.name}\` (${formatSize(a.size)})`);
    for (const f of files) out.push(`- ${escapeMd(f.filename ?? f.mediaType)}`);
  }
  nb.markdown(out.join("\n"));
}

function addAssistantMessage(nb: NotebookBuilder, msg: BlueChatUIMessage) {
  let textBuffer: string[] = [];
  const sources = new Map<string, string>();
  const flushText = () => {
    if (textBuffer.length) nb.markdown(textBuffer.join("\n\n"));
    textBuffer = [];
  };

  const planParts = msg.parts.filter((p) => p.type === "tool-plan");
  const lastPlan = [...planParts]
    .reverse()
    .map((p) => (p as { input?: PlanToolInput }).input)
    .find((input) => input && Array.isArray(input.steps));
  let planEmitted = false;

  for (const part of msg.parts) {
    switch (part.type) {
      case "text":
        if (part.text.trim()) textBuffer.push(part.text.trim());
        break;
      case "reasoning":
      case "step-start":
        break;
      case "source-url":
        if (!sources.has(part.url)) sources.set(part.url, part.title || part.url);
        break;
      case "tool-web_search": {
        flushText();
        const q = webSearchQuery(part as { input?: unknown; output?: unknown });
        nb.markdown(`> 🔎 Websuche${q ? `: ${q}` : ""}`);
        const out = (part as { output?: { sources?: { type: string; url?: string }[] } }).output;
        for (const s of out?.sources ?? []) if (s.type === "url" && s.url && !sources.has(s.url)) sources.set(s.url, s.url);
        break;
      }
      case "tool-plan":
        if (!planEmitted && lastPlan) {
          flushText();
          nb.markdown(planChecklist(lastPlan));
          planEmitted = true;
        }
        break;
      case "tool-python": {
        const p = part as { state: string; input?: Partial<PythonToolInput>; output?: PythonToolOutput; errorText?: string };
        const code = p.input?.code;
        if (!code) break;
        flushText();
        if (p.state === "output-available" && p.output) {
          const output = p.output;
          nb.code(
            code,
            (count) => {
              const outs = (output.outputs ?? []).flatMap((o) => convertOutput(o, count));
              if (output.status === "timeout") {
                outs.push({
                  output_type: "stream",
                  name: "stderr",
                  text: ["Zeitlimit überschritten – Ausführung abgebrochen.\n"],
                });
              }
              return outs;
            },
            p.input?.title ? { bluechat: { title: p.input.title } } : {},
          );
        } else if (p.state === "output-error") {
          nb.code(code, () => [
            {
              output_type: "stream",
              name: "stderr",
              text: lines(`Ausführung fehlgeschlagen: ${p.errorText ?? "unbekannter Fehler"}`),
            },
          ]);
        }
        break;
      }
      default:
        break;
    }
  }
  flushText();

  if (sources.size) {
    const list = [...sources].map(([url, title]) => `- [${escapeMd(title)}](${url})`);
    nb.markdown(["**Quellen**", "", ...list].join("\n"));
  }
}

/** Builds a valid nbformat 4.5 notebook from a conversation and its messages. */
export function buildNotebook(conversation: Conversation, messages: BlueChatUIMessage[]): Notebook {
  const nb = new NotebookBuilder();
  const model = getModel(conversation.settings.model);
  const modelLabel = model?.label ?? conversation.settings.model;

  nb.markdown(
    [`# ${conversation.title}`, "", `Exportiert aus blueChat am ${formatBerlin(new Date())}  `, `Modell: ${modelLabel}`].join(
      "\n",
    ),
  );

  // Files uploaded into the sandbox that are referenced by any executed Python code.
  const attachments = new Map<string, { name: string; path: string; size: number }>();
  for (const m of messages) for (const a of m.metadata?.attachments ?? []) attachments.set(a.path || a.name, a);
  const allCode = messages
    .flatMap((m) => m.parts)
    .filter((p) => p.type === "tool-python")
    .map((p) => (p as { input?: Partial<PythonToolInput> }).input?.code ?? "")
    .join("\n");
  const usedFiles = [...attachments.values()].filter((a) => allCode.includes(a.name) || (a.path && allCode.includes(a.path)));
  if (usedFiles.length) {
    nb.markdown(
      [
        "> **Hinweis:** Der Code in diesem Notebook liest Dateien, die im Chat hochgeladen wurden. " +
          "Lege sie (mit derselben relativen Pfadangabe) neben dieses Notebook, bevor du es ausführst:",
        ">",
        ...usedFiles.map((a) => `> - \`${a.path || a.name}\` (${formatSize(a.size)})`),
      ].join("\n"),
    );
  }

  for (const msg of messages) {
    if (msg.role === "user") addUserMessage(nb, msg);
    else if (msg.role === "assistant") addAssistantMessage(nb, msg);
  }

  return {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {
      kernelspec: { name: "python3", display_name: "Python 3 (ipykernel)", language: "python" },
      language_info: { name: "python", file_extension: ".py", mimetype: "text/x-python", pygments_lexer: "ipython3" },
      bluechat: { conversationId: conversation.id, model: conversation.settings.model, exportedAt: new Date().toISOString() },
    },
    cells: nb.cells,
  };
}

/** File-name friendly slug of a conversation title (ASCII, max. 80 chars). */
export function notebookFileName(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return `${slug || "bluechat-export"}.ipynb`;
}
