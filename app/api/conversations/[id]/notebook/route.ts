import { getConversationWithMessages, isUuid } from "@/lib/server/conversations";
import { dbErrorResponse, jsonError } from "@/lib/server/http";
import { buildNotebook, notebookFileName } from "@/lib/server/notebook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const NOT_FOUND = "Unterhaltung nicht gefunden.";

/** GET /api/conversations/:id/notebook → .ipynb download (nbformat 4.5) | 404 */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!isUuid(id)) return jsonError(404, NOT_FOUND);
  try {
    const conversation = await getConversationWithMessages(id);
    if (!conversation) return jsonError(404, NOT_FOUND);
    const { messages, ...meta } = conversation;
    const notebook = buildNotebook(meta, messages);
    const fileName = notebookFileName(meta.title);
    return new Response(JSON.stringify(notebook, null, 1) + "\n", {
      headers: {
        "content-type": "application/x-ipynb+json; charset=utf-8",
        "content-disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    return dbErrorResponse(err);
  }
}
