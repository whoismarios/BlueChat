import type {
  BlueChatUIMessage,
  ChatSettings,
  Conversation,
  ConversationSummary,
  ConversationWithMessages,
  ReasoningEffort,
  ToolToggles,
} from "../types";
import { normalizeReasoningEffort } from "../models";
import { query, withTransaction } from "./db";
import { deleteSandboxSession } from "./sandbox";

export const DEFAULT_CONVERSATION_TITLE = "Neuer Chat";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(id: unknown): id is string {
  return typeof id === "string" && UUID_RE.test(id);
}

interface ConversationRow extends Record<string, unknown> {
  id: string;
  title: string;
  model: string;
  reasoning_effort: string | null;
  tools: Partial<ToolToggles> | null;
  created_at: Date;
  updated_at: Date;
}

interface MessageRow extends Record<string, unknown> {
  id: string;
  role: BlueChatUIMessage["role"];
  parts: BlueChatUIMessage["parts"];
  metadata: BlueChatUIMessage["metadata"] | null;
}

const CONVERSATION_COLUMNS = "id, title, model, reasoning_effort, tools, created_at, updated_at";

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function rowToSummary(row: ConversationRow): ConversationSummary {
  return {
    id: row.id,
    title: row.title,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function rowToConversation(row: ConversationRow): Conversation {
  return {
    ...rowToSummary(row),
    settings: {
      model: row.model,
      reasoningEffort: (row.reasoning_effort as ReasoningEffort | null) ?? null,
      tools: { webSearch: false, python: true, ...(row.tools ?? {}) },
    },
  };
}

function rowToMessage(row: MessageRow): BlueChatUIMessage {
  const msg: BlueChatUIMessage = { id: row.id, role: row.role, parts: row.parts ?? [] };
  if (row.metadata != null) msg.metadata = row.metadata;
  return msg;
}

/** Normalizes settings coming from the client (valid effort for the model, boolean toggles). */
export function sanitizeSettings(settings: Partial<ChatSettings> | undefined, fallback: ChatSettings): ChatSettings {
  const model = typeof settings?.model === "string" && settings.model.trim() ? settings.model.trim() : fallback.model;
  const effort = settings?.reasoningEffort !== undefined ? settings.reasoningEffort : fallback.reasoningEffort;
  return {
    model,
    reasoningEffort: normalizeReasoningEffort(model, effort),
    tools: {
      webSearch: typeof settings?.tools?.webSearch === "boolean" ? settings.tools.webSearch : fallback.tools.webSearch,
      python: typeof settings?.tools?.python === "boolean" ? settings.tools.python : fallback.tools.python,
    },
  };
}

/* ------------------------------------------------------------------ */

export async function listConversations(): Promise<ConversationSummary[]> {
  const rows = await query<ConversationRow>(
    `SELECT ${CONVERSATION_COLUMNS} FROM conversations ORDER BY updated_at DESC, created_at DESC`,
  );
  return rows.map(rowToSummary);
}

export async function getConversation(id: string): Promise<Conversation | null> {
  if (!isUuid(id)) return null;
  const rows = await query<ConversationRow>(`SELECT ${CONVERSATION_COLUMNS} FROM conversations WHERE id = $1`, [id]);
  return rows[0] ? rowToConversation(rows[0]) : null;
}

export async function loadMessages(id: string): Promise<BlueChatUIMessage[]> {
  if (!isUuid(id)) return [];
  const rows = await query<MessageRow>(
    `SELECT id, role, parts, metadata FROM messages WHERE conversation_id = $1 ORDER BY position ASC`,
    [id],
  );
  return rows.map(rowToMessage);
}

export async function getConversationWithMessages(id: string): Promise<ConversationWithMessages | null> {
  const conversation = await getConversation(id);
  if (!conversation) return null;
  const messages = await loadMessages(id);
  return { ...conversation, messages };
}

/** Creates the conversation if it doesn't exist, otherwise updates its settings. */
export async function upsertConversation(id: string, settings: ChatSettings): Promise<Conversation> {
  if (!isUuid(id)) throw new Error(`Ungültige Konversations-ID: ${id}`);
  const rows = await query<ConversationRow>(
    `INSERT INTO conversations (id, model, reasoning_effort, tools)
     VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT (id) DO UPDATE
       SET model = EXCLUDED.model,
           reasoning_effort = EXCLUDED.reasoning_effort,
           tools = EXCLUDED.tools,
           updated_at = now()
     RETURNING ${CONVERSATION_COLUMNS}`,
    [id, settings.model, settings.reasoningEffort, JSON.stringify(settings.tools)],
  );
  return rowToConversation(rows[0]);
}

export async function updateConversation(
  id: string,
  patch: { title?: string; settings?: Partial<ChatSettings> },
): Promise<Conversation | null> {
  const current = await getConversation(id);
  if (!current) return null;
  const title =
    typeof patch.title === "string" && patch.title.trim() ? patch.title.trim().slice(0, 200) : current.title;
  const settings = patch.settings ? sanitizeSettings(patch.settings, current.settings) : current.settings;
  const rows = await query<ConversationRow>(
    `UPDATE conversations
        SET title = $2, model = $3, reasoning_effort = $4, tools = $5::jsonb, updated_at = now()
      WHERE id = $1
      RETURNING ${CONVERSATION_COLUMNS}`,
    [id, title, settings.model, settings.reasoningEffort, JSON.stringify(settings.tools)],
  );
  return rows[0] ? rowToConversation(rows[0]) : null;
}

/** Only sets the title (without touching updated_at, so the sidebar order stays stable). */
export async function setConversationTitle(id: string, title: string): Promise<void> {
  await query(`UPDATE conversations SET title = $2 WHERE id = $1`, [id, title.slice(0, 200)]);
}

export async function deleteConversation(id: string): Promise<void> {
  if (!isUuid(id)) return;
  await query(`DELETE FROM conversations WHERE id = $1`, [id]);
  await deleteSandboxSession(id);
}

/** Replaces all messages of the conversation (position = array index) and bumps updated_at. */
export async function saveMessages(conversationId: string, messages: BlueChatUIMessage[]): Promise<void> {
  if (!isUuid(conversationId)) throw new Error(`Ungültige Konversations-ID: ${conversationId}`);
  const records = messages.map((m, position) => ({
    id: m.id,
    role: m.role,
    parts: m.parts ?? [],
    metadata: m.metadata ?? null,
    position,
    created_at: m.metadata?.createdAt ?? null,
  }));
  await withTransaction(async (client) => {
    await client.query(`DELETE FROM messages WHERE conversation_id = $1`, [conversationId]);
    if (records.length > 0) {
      await client.query(
        `INSERT INTO messages (id, conversation_id, role, parts, metadata, position, created_at)
         SELECT x.id, $1::uuid, x.role, x.parts, x.metadata, x.position, COALESCE(x.created_at, now())
           FROM jsonb_to_recordset($2::jsonb)
             AS x(id text, role text, parts jsonb, metadata jsonb, position int, created_at timestamptz)
         ON CONFLICT (id) DO UPDATE
           SET conversation_id = EXCLUDED.conversation_id, role = EXCLUDED.role, parts = EXCLUDED.parts,
               metadata = EXCLUDED.metadata, position = EXCLUDED.position`,
        [conversationId, JSON.stringify(records)],
      );
    }
    await client.query(`UPDATE conversations SET updated_at = now() WHERE id = $1`, [conversationId]);
  });
}
