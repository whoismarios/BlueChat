import type { ConversationSummary } from "@/lib/types";

export interface ConversationGroup {
  key: string;
  label: string;
  items: ConversationSummary[];
}

/** Groups conversations (already sorted by updatedAt desc) into Heute / Gestern / Letzte 7 Tage / Älter. */
export function groupConversations(list: ConversationSummary[], now = new Date()): ConversationGroup[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 86_400_000;
  const groups: ConversationGroup[] = [
    { key: "today", label: "Heute", items: [] },
    { key: "yesterday", label: "Gestern", items: [] },
    { key: "week", label: "Letzte 7 Tage", items: [] },
    { key: "older", label: "Älter", items: [] },
  ];
  for (const c of list) {
    const t = Date.parse(c.updatedAt || c.createdAt);
    if (t >= startOfToday) groups[0].items.push(c);
    else if (t >= startOfToday - day) groups[1].items.push(c);
    else if (t >= startOfToday - 7 * day) groups[2].items.push(c);
    else groups[3].items.push(c);
  }
  return groups.filter((g) => g.items.length > 0);
}
