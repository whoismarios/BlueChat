import { isUuid } from "@/lib/server/conversations";
import { executePython } from "@/lib/server/sandbox";
import { PYTHON_TIMEOUT_SEC } from "@/lib/server/tools";
import { jsonError, readJson } from "@/lib/server/http";
import type { ExecuteCodeRequest } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CODE_CHARS = 200_000;

/** POST /api/sandbox/:sessionId/execute (ExecuteCodeRequest) → PythonToolOutput (user-edited cell) */
export async function POST(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  if (!isUuid(sessionId)) return jsonError(400, "Ungültige Sitzungs-ID.");

  const body = await readJson<Partial<ExecuteCodeRequest>>(req);
  if (!body || typeof body.code !== "string") return jsonError(400, "Es wurde kein Code übermittelt.");
  if (!body.code.trim()) return jsonError(400, "Der Code ist leer.");
  if (body.code.length > MAX_CODE_CHARS) return jsonError(413, "Der Code ist zu lang.");

  return Response.json(await executePython(sessionId, body.code, PYTHON_TIMEOUT_SEC, req.signal));
}
