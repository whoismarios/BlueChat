-- blueChat schema. Executed once by the postgres image on first start of an empty volume.
-- The backend runs the same idempotent SQL on startup – keep both in sync.
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
