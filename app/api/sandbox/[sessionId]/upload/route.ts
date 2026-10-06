import { isUuid } from "@/lib/server/conversations";
import { SandboxRequestError, uploadToSandbox } from "@/lib/server/sandbox";
import { jsonError } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/sandbox/:sessionId/upload (multipart, field `file`) → UploadedFile */
export async function POST(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  if (!isUuid(sessionId)) return jsonError(400, "Ungültige Sitzungs-ID.");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError(400, "Erwarte multipart/form-data mit dem Feld „file“.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError(400, "Es wurde keine Datei im Feld „file“ übermittelt.");

  try {
    return Response.json(await uploadToSandbox(sessionId, file, file.name));
  } catch (err) {
    if (err instanceof SandboxRequestError) return jsonError(err.status, err.message);
    console.error("[api/sandbox/upload]", err);
    return jsonError(500, "Upload fehlgeschlagen.");
  }
}
