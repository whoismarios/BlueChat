import type { ModelInfo } from "@/lib/types";
import { MODELS } from "@/lib/models";
import { getOpenAIKey } from "@/lib/server/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_MS = 10 * 60 * 1000;

type GlobalWithModelCache = typeof globalThis & {
  __bluechatModelCache?: { key: string; at: number; ids: Set<string> };
};
const g = globalThis as GlobalWithModelCache;

async function fetchAvailableIds(key: string): Promise<Set<string> | null> {
  const cached = g.__bluechatModelCache;
  if (cached && cached.key === key && Date.now() - cached.at < CACHE_MS) return cached.ids;
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { id: string }[] };
    const ids = new Set((json.data ?? []).map((m) => m.id));
    g.__bluechatModelCache = { key, at: Date.now(), ids };
    return ids;
  } catch {
    return null;
  }
}

/**
 * GET /api/models → ModelInfo[]
 * Curated list; if a real API key is configured, filtered to models the key can access.
 * Falls back to the full curated list on any error.
 */
export async function GET() {
  const key = getOpenAIKey();
  let models: ModelInfo[] = MODELS;
  if (key) {
    const ids = await fetchAvailableIds(key);
    if (ids && ids.size > 0) {
      const filtered = MODELS.filter((m) => ids.has(m.id));
      if (filtered.length > 0) models = filtered;
    }
  }
  return Response.json(models);
}
