import type { HealthStatus } from "@/lib/types";
import { dbHealthy, ensureSchema } from "@/lib/server/db";
import { sandboxHealthy } from "@/lib/server/sandbox";
import { hasValidOpenAIKey } from "@/lib/server/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/health → HealthStatus */
export async function GET() {
  const [db, sandbox] = await Promise.all([
    dbHealthy().then(async (ok) => {
      if (!ok) return false;
      try {
        await ensureSchema();
        return true;
      } catch {
        return false;
      }
    }),
    sandboxHealthy(),
  ]);
  const status: HealthStatus = { db, sandbox, openaiKey: hasValidOpenAIKey() };
  return Response.json(status);
}
