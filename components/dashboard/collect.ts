import type { BlueChatUIMessage, PythonOutputItem } from "@/lib/types";
import type { MessagePart, PythonToolPartView } from "@/components/messages/types";

export type DashboardKind = "image" | "plotly" | "table" | "html" | "widget";

type VisualItem = Extract<PythonOutputItem, { type: "image" | "html" | "widget" }>;

export interface DashboardItem {
  key: string;
  toolCallId: string;
  /** Title of the python cell (`input.title`), numbered when a cell has several visuals */
  title: string;
  kind: DashboardKind;
  item: VisualItem;
}

export interface DashboardGroup {
  /** Assistant message id */
  id: string;
  /** Text of the user message that triggered the answer (shortened) */
  prompt: string;
  items: DashboardItem[];
}

function kindOf(item: VisualItem): DashboardKind {
  if (item.type === "image") return "image";
  if (item.type === "widget") return "widget";
  return item.kind === "plotly" ? "plotly" : item.kind === "table" ? "table" : "html";
}

function isVisual(o: PythonOutputItem): o is VisualItem {
  return o.type === "image" || o.type === "html" || o.type === "widget";
}

/** Visual outputs of one assistant message, in order. */
export function visualItemsOf(message: BlueChatUIMessage): DashboardItem[] {
  const items: DashboardItem[] = [];
  for (const raw of message.parts as MessagePart[]) {
    if (raw.type !== "tool-python") continue;
    const part = raw as unknown as PythonToolPartView;
    if (part.state !== "output-available" || !part.output?.outputs) continue;
    const visuals = part.output.outputs.filter(isVisual);
    const base = part.input?.title?.trim() || "Python-Ausgabe";
    visuals.forEach((item, i) => {
      items.push({
        key: `${part.toolCallId}-${i}`,
        toolCallId: part.toolCallId,
        title: item.type === "widget" && item.title ? item.title : visuals.length > 1 ? `${base} · ${i + 1}` : base,
        kind: kindOf(item),
        item,
      });
    });
  }
  return items;
}

function userText(message: BlueChatUIMessage | undefined): string {
  if (!message) return "";
  const text = message.parts
    .filter((p): p is Extract<MessagePart, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 90 ? `${text.slice(0, 88)}…` : text;
}

/** All visual outputs of the conversation, grouped by assistant message. */
export function collectDashboard(messages: BlueChatUIMessage[]): { groups: DashboardGroup[]; count: number } {
  const groups: DashboardGroup[] = [];
  let count = 0;
  let lastUser: BlueChatUIMessage | undefined;
  for (const m of messages) {
    if (m.role === "user") {
      lastUser = m;
      continue;
    }
    if (m.role !== "assistant") continue;
    const items = visualItemsOf(m);
    if (items.length === 0) continue;
    groups.push({ id: m.id, prompt: userText(lastUser), items });
    count += items.length;
  }
  return { groups, count };
}
