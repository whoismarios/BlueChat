import type { ChatSettings } from "@/lib/types";
import { isUuid, listConversations, sanitizeSettings, upsertConversation } from "@/lib/server/conversations";
import { getAppSettings } from "@/lib/server/settings";
import { dbErrorResponse, jsonError, readJson } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/conversations → ConversationSummary[] (newest updated first) */
export async function GET() {
  try {
    return Response.json(await listConversations());
  } catch (err) {
    return dbErrorResponse(err);
  }
}

/** POST /api/conversations { id?: uuid, settings?: Partial<ChatSettings> } → Conversation (201) */
export async function POST(req: Request) {
  const body = (await readJson<{ id?: string; settings?: Partial<ChatSettings> }>(req)) ?? {};
  const id = body.id ?? crypto.randomUUID();
  if (!isUuid(id)) return jsonError(400, "Die Konversations-ID muss eine UUID sein.");
  try {
    const app = await getAppSettings();
    const settings = sanitizeSettings(body.settings, {
      model: app.defaultModel,
      reasoningEffort: app.defaultReasoningEffort,
      tools: app.defaultTools,
    });
    return Response.json(await upsertConversation(id, settings), { status: 201 });
  } catch (err) {
    return dbErrorResponse(err);
  }
}
