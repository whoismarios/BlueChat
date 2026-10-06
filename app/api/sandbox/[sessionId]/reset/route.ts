import { isUuid } from "@/lib/server/conversations";
import { resetSandbox, SandboxRequestError } from "@/lib/server/sandbox";
import { jsonError } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/sandbox/:sessionId/reset → { ok: true } (restarts the kernel; files stay) */
export async function POST(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  if (!isUuid(sessionId)) return jsonError(400, "Ungültige Sitzungs-ID.");
  try {
    await resetSandbox(sessionId);
    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof SandboxRequestError) return jsonError(err.status, err.message);
    return jsonError(500, "Kernel-Neustart fehlgeschlagen.");
  }
}
