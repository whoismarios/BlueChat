import type { AppSettings } from "@/lib/types";
import { getAppSettings, updateAppSettings } from "@/lib/server/settings";
import { dbErrorResponse, jsonError, readJson } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/settings → AppSettings */
export async function GET() {
  try {
    return Response.json(await getAppSettings());
  } catch (err) {
    return dbErrorResponse(err);
  }
}

/** PUT /api/settings (Partial<AppSettings>) → AppSettings */
export async function PUT(req: Request) {
  const body = await readJson<Partial<AppSettings>>(req);
  if (!body || typeof body !== "object") return jsonError(400, "Ungültiger Request-Body.");
  try {
    return Response.json(await updateAppSettings(body));
  } catch (err) {
    return dbErrorResponse(err);
  }
}
