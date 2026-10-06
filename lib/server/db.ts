import { Pool, type PoolClient } from "pg";

const DEFAULT_DATABASE_URL = "postgres://bluechat:bluechat@localhost:5432/bluechat";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Neuer Chat',
  model TEXT NOT NULL,
  reasoning_effort TEXT,
  tools JSONB NOT NULL DEFAULT '{"webSearch": false, "python": true}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  parts JSONB NOT NULL,
  metadata JSONB,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages(conversation_id, position);
CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  system_prompt TEXT NOT NULL DEFAULT '',
  default_model TEXT NOT NULL DEFAULT '',
  default_reasoning_effort TEXT,
  default_tools JSONB NOT NULL DEFAULT '{"webSearch": false, "python": true}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

type GlobalWithPg = typeof globalThis & {
  __bluechatPgPool?: Pool;
  __bluechatSchemaPromise?: Promise<void>;
};

const g = globalThis as GlobalWithPg;

/** Shared pg Pool (cached on globalThis so dev HMR doesn't leak connections). */
export function getPool(): Pool {
  if (!g.__bluechatPgPool) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    pool.on("error", (err) => {
      console.error("[db] idle client error", err);
    });
    g.__bluechatPgPool = pool;
  }
  return g.__bluechatPgPool;
}

/** Runs the idempotent schema SQL once per process. Retries on the next call after a failure. */
export function ensureSchema(): Promise<void> {
  if (!g.__bluechatSchemaPromise) {
    g.__bluechatSchemaPromise = getPool()
      .query(SCHEMA_SQL)
      .then(() => undefined)
      .catch((err) => {
        g.__bluechatSchemaPromise = undefined;
        throw err;
      });
  }
  return g.__bluechatSchemaPromise;
}

/** Convenience query helper that makes sure the schema exists first. */
export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  await ensureSchema();
  const res = await getPool().query<T>(text, params);
  return res.rows;
}

/** Runs `fn` inside a transaction. */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Cheap DB health probe. */
export async function dbHealthy(): Promise<boolean> {
  try {
    await getPool().query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
