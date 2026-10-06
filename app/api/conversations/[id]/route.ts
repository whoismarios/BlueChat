import type { ChatSettings } from "@/lib/types";
import {
  deleteConversation,
  getConversationWithMessages,
  isUuid,
  updateConversation,
} from "@/lib/server/conversations";
import { dbErrorResponse, jsonError, readJson } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const NOT_FOUND = "Unterhaltung nicht gefunden.";

/** GET /api/conversations/:id → ConversationWithMessages | 404 */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!isUuid(id)) return jsonError(404, NOT_FOUND);
  try {
    const conversation = await getConversationWithMessages(id);
    return conversation ? Response.json(conversation) : jsonError(404, NOT_FOUND);
  } catch (err) {
    return dbErrorResponse(err);
  }
}

/** PATCH /api/conversations/:id { title?, settings? } → Conversation | 404 */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!isUuid(id)) return jsonError(404, NOT_FOUND);
  const body = await readJson<{ title?: string; settings?: Partial<ChatSettings> }>(req);
  if (!body) return jsonError(400, "Ungültiger Request-Body.");
  try {
    const updated = await updateConversation(id, { title: body.title, settings: body.settings });
    return updated ? Response.json(updated) : jsonError(404, NOT_FOUND);
  } catch (err) {
    return dbErrorResponse(err);
  }
}

/** DELETE /api/conversations/:id → 204 (also deletes the sandbox session, best effort) */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!isUuid(id)) return jsonError(404, NOT_FOUND);
  try {
    await deleteConversation(id);
    return new Response(null, { status: 204 });
  } catch (err) {
    return dbErrorResponse(err);
  }
}
