import { isUuid } from "@/lib/server/conversations";
import { fetchSandboxFile, SandboxRequestError } from "@/lib/server/sandbox";
import { jsonError } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PASS_HEADERS = ["content-type", "content-length", "content-disposition", "last-modified", "etag"];

/**
 * GET /api/sandbox/:sessionId/files/:path* → streams the file from the sandbox.
 * `?download=1` forces `Content-Disposition: attachment`.
 */
export async function GET(req: Request, { params }: { params: Promise<{ sessionId: string; path: string[] }> }) {
  const { sessionId, path } = await params;
  if (!isUuid(sessionId)) return jsonError(400, "Ungültige Sitzungs-ID.");
  const segments = (path ?? []).map((s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  });
  if (segments.length === 0 || segments.some((s) => s === ".." || s === "." || s === "")) {
    return jsonError(400, "Ungültiger Dateipfad.");
  }
  const download = ["1", "true"].includes(new URL(req.url).searchParams.get("download") ?? "");

  let upstream: Response;
  try {
    upstream = await fetchSandboxFile(sessionId, segments.join("/"), { download });
  } catch (err) {
    if (err instanceof SandboxRequestError) return jsonError(err.status, err.message);
    return jsonError(502, "Datei konnte nicht geladen werden.");
  }
  if (upstream.status === 404) return jsonError(404, "Datei nicht gefunden.");
  if (!upstream.ok || !upstream.body) {
    return jsonError(upstream.status >= 400 ? upstream.status : 502, "Datei konnte nicht geladen werden.");
  }

  const headers = new Headers();
  for (const h of PASS_HEADERS) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set("cache-control", "private, no-store");
  headers.set("x-content-type-options", "nosniff");
  // user-generated content: never execute scripts (e.g. inside SVG) on our origin
  headers.set("content-security-policy", "sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'");
  return new Response(upstream.body, { status: 200, headers });
}
