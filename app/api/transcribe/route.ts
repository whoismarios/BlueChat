import { transcribe } from "ai";
import type { OpenAITranscriptionModelOptions } from "@ai-sdk/openai";
import { describeError, getOpenAI, hasValidOpenAIKey, MISSING_KEY_MESSAGE } from "@/lib/server/openai";
import { jsonError } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** OpenAI's limit for audio uploads. */
const MAX_BYTES = 25 * 1024 * 1024;
const PRIMARY_MODEL = "gpt-4o-transcribe";
const FALLBACK_MODEL = "whisper-1";

/** Domain vocabulary to bias the transcription (must be in the audio language). */
const PROMPT_HINT =
  "Gespräch mit blueChat, dem KI-Assistenten der LBBW. Begriffe: LBBW, blueChat, Python, pandas, NumPy, " +
  "Matplotlib, Plotly, DataFrame, CSV, Excel, Monte-Carlo-Simulation, Volatilität, Kreditportfolio, " +
  "Value at Risk, Zinsstrukturkurve, EZB, DAX, Rendite, Korrelation, Regression.";

/** True for errors that indicate the model itself is unavailable (→ try the fallback model). */
function isModelError(err: unknown): boolean {
  const e = err as { statusCode?: number; message?: string; lastError?: unknown; name?: string };
  if (e?.name === "AI_RetryError" && e.lastError) return isModelError(e.lastError);
  if (e?.statusCode === 404) return true;
  const msg = (e?.message ?? "").toLowerCase();
  return msg.includes("model") && (msg.includes("not found") || msg.includes("does not exist") || msg.includes("access"));
}

async function run(model: string, audio: Uint8Array, signal: AbortSignal) {
  return transcribe({
    model: getOpenAI().transcription(model),
    audio,
    abortSignal: signal,
    providerOptions: {
      openai: { language: "de", prompt: PROMPT_HINT, temperature: 0 } satisfies OpenAITranscriptionModelOptions,
    },
  });
}

/** POST /api/transcribe (multipart, field `audio`) → { text } */
export async function POST(req: Request) {
  if (!hasValidOpenAIKey()) return jsonError(400, MISSING_KEY_MESSAGE);

  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_BYTES + 64 * 1024) return jsonError(413, "Die Aufnahme ist zu groß (max. 25 MB).");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError(400, "Erwarte multipart/form-data mit dem Feld „audio“.");
  }
  const file = form.get("audio");
  if (!(file instanceof Blob)) return jsonError(400, "Es wurde keine Audiodatei im Feld „audio“ übermittelt.");
  if (file.size === 0) return jsonError(400, "Die Aufnahme ist leer.");
  if (file.size > MAX_BYTES) return jsonError(413, "Die Aufnahme ist zu groß (max. 25 MB).");

  const audio = new Uint8Array(await file.arrayBuffer());
  try {
    let result;
    try {
      result = await run(PRIMARY_MODEL, audio, req.signal);
    } catch (err) {
      if (!isModelError(err)) throw err;
      console.warn(`[api/transcribe] ${PRIMARY_MODEL} nicht verfügbar, nutze ${FALLBACK_MODEL}`);
      result = await run(FALLBACK_MODEL, audio, req.signal);
    }
    return Response.json({ text: result.text.trim() });
  } catch (err) {
    if (req.signal.aborted) return jsonError(499, "Abgebrochen.");
    console.error("[api/transcribe]", err);
    const e = err as { name?: string };
    if (e?.name === "AI_NoTranscriptGeneratedError") {
      return jsonError(422, "In der Aufnahme wurde keine Sprache erkannt.");
    }
    return jsonError(502, `Transkription fehlgeschlagen: ${describeError(err)}`);
  }
}
