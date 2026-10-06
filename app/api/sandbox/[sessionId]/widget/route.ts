import { isUuid } from "@/lib/server/conversations";
import { runWidget } from "@/lib/server/sandbox";
import { jsonError, readJson } from "@/lib/server/http";
import type { WidgetRunRequest, WidgetValue } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Seconds a single widget re-run may take (widgets should be fast). */
const WIDGET_TIMEOUT_SEC = 60;
const WIDGET_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_VALUES = 50;

function parseValues(raw: unknown): Record<string, WidgetValue> | null {
  if (raw == null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length > MAX_VALUES) return null;
  const out: Record<string, WidgetValue> = {};
  for (const [key, value] of entries) {
    if (typeof value === "boolean" || typeof value === "string" || (typeof value === "number" && Number.isFinite(value))) {
      out[key] = value;
    } else {
      return null;
    }
  }
  return out;
}

/** POST /api/sandbox/:sessionId/widget (WidgetRunRequest) → PythonToolOutput of the re-run */
export async function POST(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  if (!isUuid(sessionId)) return jsonError(400, "Ungültige Sitzungs-ID.");

  const body = await readJson<Partial<WidgetRunRequest>>(req);
  if (!body || typeof body.widgetId !== "string" || !WIDGET_ID_RE.test(body.widgetId)) {
    return jsonError(400, "Ungültige Widget-ID.");
  }
  const values = parseValues(body.values);
  if (!values) return jsonError(400, "Ungültige Reglerwerte.");

  return Response.json(await runWidget(sessionId, body.widgetId, values, WIDGET_TIMEOUT_SEC, req.signal));
}
