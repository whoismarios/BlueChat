/** JSON error response: `{ error: string }` with a German message. */
export function jsonError(status: number, error: string): Response {
  return Response.json({ error }, { status });
}

export function dbErrorResponse(err: unknown): Response {
  console.error("[api] database error", err);
  const msg = err instanceof Error ? err.message : String(err);
  return jsonError(
    503,
    `Die Datenbank ist nicht erreichbar oder meldet einen Fehler (${msg}). Läuft der Postgres-Container (\`docker compose up db\`)?`,
  );
}

export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
