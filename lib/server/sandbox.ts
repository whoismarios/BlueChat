/**
 * HTTP client for the Python sandbox service (stateful Jupyter kernels).
 * The conversation uuid is used as sandbox session id.
 */
import type { PythonOutputItem, PythonToolOutput, SandboxFile, UploadedFile, WidgetValue } from "../types";

const DEFAULT_SANDBOX_URL = "http://localhost:8100";

export function sandboxBaseUrl(): string {
  return (process.env.SANDBOX_URL || DEFAULT_SANDBOX_URL).replace(/\/+$/, "");
}

const SANDBOX_DOWN_MESSAGE =
  "Die Python-Sandbox ist nicht erreichbar. Bitte starte sie mit `docker compose up sandbox` " +
  `(erwartet unter ${DEFAULT_SANDBOX_URL} bzw. SANDBOX_URL) und versuche es erneut.`;

/** Browser-usable URL for a file in the session workdir (proxied through Next). */
export function sandboxFileUrl(sessionId: string, path: string): string {
  const encoded = path
    .split("/")
    .filter((seg) => seg.length > 0)
    .map(encodeURIComponent)
    .join("/");
  return `/api/sandbox/${encodeURIComponent(sessionId)}/files/${encoded}`;
}

interface RawSandboxFile {
  name: string;
  path: string;
  size: number;
}

interface RawExecuteResponse {
  status: "ok" | "error" | "timeout";
  outputs?: PythonOutputItem[];
  files?: RawSandboxFile[];
  duration_ms?: number;
}

function toSandboxFile(sessionId: string, f: RawSandboxFile): SandboxFile {
  return { name: f.name, path: f.path, size: f.size, url: sandboxFileUrl(sessionId, f.path) };
}

/** Adds the proxied download URL to the CSV export attached to table/chart outputs (also inside widgets). */
function withExportUrl(sessionId: string, item: PythonOutputItem): PythonOutputItem {
  if (item.type === "widget") {
    return {
      ...item,
      outputs: Array.isArray(item.outputs) ? item.outputs.map((o) => withExportUrl(sessionId, o)) : [],
    };
  }
  if ((item.type === "image" || item.type === "html") && item.export?.path) {
    return { ...item, export: { ...item.export, url: sandboxFileUrl(sessionId, item.export.path) } };
  }
  return item;
}

function errorOutput(ename: string, evalue: string, durationMs = 0): PythonToolOutput {
  return {
    status: "error",
    outputs: [{ type: "error", ename, evalue, traceback: "" }],
    files: [],
    durationMs,
  };
}

function isConnectionError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const cause = (err as Error & { cause?: { code?: string } }).cause;
  const code = cause?.code ?? "";
  return (
    err.name === "TypeError" ||
    ["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ECONNRESET", "UND_ERR_CONNECT_TIMEOUT"].includes(code)
  );
}

async function readErrorDetail(res: Response): Promise<string> {
  try {
    const text = await res.text();
    try {
      const json = JSON.parse(text) as { detail?: unknown };
      if (json && json.detail != null) {
        return typeof json.detail === "string" ? json.detail : JSON.stringify(json.detail);
      }
    } catch {
      /* not json */
    }
    return text.slice(0, 500) || res.statusText;
  } catch {
    return res.statusText;
  }
}

/**
 * Executes Python code in the session's kernel. Never throws: sandbox
 * problems are reported as a PythonToolOutput with status "error".
 */
export async function executePython(
  sessionId: string,
  code: string,
  timeoutSec = 120,
  abortSignal?: AbortSignal,
): Promise<PythonToolOutput> {
  return runInSandbox(sessionId, "/execute", { code }, timeoutSec, abortSignal);
}

/**
 * Re-runs the Python function of an interactive widget (`interact`) with new control
 * values (validated/clamped in the kernel). Never throws, like executePython.
 */
export async function runWidget(
  sessionId: string,
  widgetId: string,
  values: Record<string, WidgetValue>,
  timeoutSec = 60,
  abortSignal?: AbortSignal,
): Promise<PythonToolOutput> {
  return runInSandbox(sessionId, "/widget", { widget_id: widgetId, values }, timeoutSec, abortSignal);
}

async function runInSandbox(
  sessionId: string,
  path: "/execute" | "/widget",
  payload: Record<string, unknown>,
  timeoutSec: number,
  abortSignal?: AbortSignal,
): Promise<PythonToolOutput> {
  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(`${sandboxBaseUrl()}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, ...payload, timeout: timeoutSec }),
      // generous client-side timeout: kernel timeout + interrupt grace + kernel restart
      signal: abortSignal
        ? AbortSignal.any([abortSignal, AbortSignal.timeout((timeoutSec + 90) * 1000)])
        : AbortSignal.timeout((timeoutSec + 90) * 1000),
    });
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      return {
        ...errorOutput(
          "TimeoutError",
          err.name === "AbortError"
            ? "Die Ausführung wurde abgebrochen."
            : "Die Sandbox hat nicht rechtzeitig geantwortet.",
          Date.now() - started,
        ),
        status: "timeout",
      };
    }
    if (isConnectionError(err)) {
      return errorOutput("SandboxUnavailable", SANDBOX_DOWN_MESSAGE, Date.now() - started);
    }
    return errorOutput(
      "SandboxError",
      `Fehler bei der Kommunikation mit der Sandbox: ${err instanceof Error ? err.message : String(err)}`,
      Date.now() - started,
    );
  }

  if (!res.ok) {
    const detail = await readErrorDetail(res);
    return errorOutput(
      "SandboxError",
      `Die Sandbox meldet einen Fehler (HTTP ${res.status}): ${detail}`,
      Date.now() - started,
    );
  }

  let raw: RawExecuteResponse;
  try {
    raw = (await res.json()) as RawExecuteResponse;
  } catch {
    return errorOutput("SandboxError", "Ungültige Antwort der Sandbox.", Date.now() - started);
  }

  return {
    status: raw.status ?? "error",
    outputs: Array.isArray(raw.outputs) ? raw.outputs.map((o) => withExportUrl(sessionId, o)) : [],
    files: Array.isArray(raw.files) ? raw.files.map((f) => toSandboxFile(sessionId, f)) : [],
    durationMs: typeof raw.duration_ms === "number" ? raw.duration_ms : Date.now() - started,
  };
}

export class SandboxRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "SandboxRequestError";
  }
}

async function sandboxFetch(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${sandboxBaseUrl()}${path}`, init);
  } catch (err) {
    if (isConnectionError(err)) throw new SandboxRequestError(SANDBOX_DOWN_MESSAGE, 503);
    throw new SandboxRequestError(
      `Fehler bei der Kommunikation mit der Sandbox: ${err instanceof Error ? err.message : String(err)}`,
      502,
    );
  }
}

/** Uploads a file into the session workdir. Throws SandboxRequestError on failure. */
export async function uploadToSandbox(sessionId: string, file: File | Blob, filename?: string): Promise<UploadedFile> {
  const form = new FormData();
  const name = filename ?? (file instanceof File ? file.name : "upload");
  form.append("file", file, name);
  const res = await sandboxFetch(`/sessions/${encodeURIComponent(sessionId)}/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw new SandboxRequestError(
      res.status === 413 ? "Die Datei ist zu groß (max. 50 MB)." : `Upload fehlgeschlagen: ${detail}`,
      res.status,
    );
  }
  const raw = (await res.json()) as RawSandboxFile;
  return toSandboxFile(sessionId, raw);
}

/** Lists all files in the session workdir. Throws SandboxRequestError on failure. */
export async function listSandboxFiles(sessionId: string): Promise<SandboxFile[]> {
  const res = await sandboxFetch(`/sessions/${encodeURIComponent(sessionId)}/files`, { cache: "no-store" });
  if (!res.ok) {
    throw new SandboxRequestError(`Dateiliste konnte nicht geladen werden: ${await readErrorDetail(res)}`, res.status);
  }
  const raw = (await res.json()) as RawSandboxFile[];
  return raw.map((f) => toSandboxFile(sessionId, f));
}

/**
 * Fetches a file from the session workdir and returns the raw upstream Response
 * (body is streamed; headers include content-type / content-disposition).
 * `path` is the decoded relative path (segments joined with "/").
 */
export async function fetchSandboxFile(
  sessionId: string,
  path: string,
  opts: { download?: boolean } = {},
): Promise<Response> {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  const qs = opts.download ? "?download=true" : "";
  return sandboxFetch(`/sessions/${encodeURIComponent(sessionId)}/files/${encoded}${qs}`, { cache: "no-store" });
}

/** Restarts the kernel of the session (variables are lost, files stay). */
export async function resetSandbox(sessionId: string): Promise<void> {
  const res = await sandboxFetch(`/sessions/${encodeURIComponent(sessionId)}/reset`, { method: "POST" });
  if (!res.ok) {
    throw new SandboxRequestError(`Kernel-Neustart fehlgeschlagen: ${await readErrorDetail(res)}`, res.status);
  }
}

/** Deletes kernel + workdir of the session. Best effort, never throws. */
export async function deleteSandboxSession(sessionId: string): Promise<void> {
  try {
    await fetch(`${sandboxBaseUrl()}/sessions/${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    /* sandbox not running – nothing to clean up */
  }
}

export async function sandboxHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${sandboxBaseUrl()}/health`, { signal: AbortSignal.timeout(3_000), cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}
