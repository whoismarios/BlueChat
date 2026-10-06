@AGENTS.md

# blueChat – Hinweise für Claude

ChatGPT-ähnliche Chat-App (Deutsch) mit Python-Code-Interpreter. UI-Texte, Prompts und Fehlermeldungen sind **deutsch**.

## Stack
- Next.js 16 (App Router), React 19, Tailwind CSS v4, AI SDK + OpenAI (Responses API, Streaming)
- PostgreSQL 17 (`db/init.sql`), Python-Sandbox: FastAPI + Jupyter-Kernel pro Chat (`sandbox/`)
- Start: `docker compose up` (oder `docker compose up -d db sandbox` + `npm run dev`). Lint: `npm run lint`.

## Struktur
- `app/api/*` – Route-Handler (Chat-Stream, Unterhaltungen, Notebook-Export, Sandbox-Proxy, Transkription)
- `lib/server/*` – Server-Logik (DB, OpenAI, Tools, Systemprompt, Sandbox-Client, Notebook-Builder)
- `lib/types.ts` – gemeinsame Typen für Client und Server (Request-/Response-Formen hier pflegen)
- `components/ui` – UI-Primitive; `components/chat` – Chat, Composer, Spracheingabe; `components/messages` – Nachrichten inkl. Python-Zellen und Widgets; `components/dashboard` – Ergebnis-Panel
- `sandbox/app` – `kernels.py` (Kernel-Verwaltung), `outputs.py` (Ausgabe-Konvertierung), `kernel_widgets.py` (Regler-Widgets), `kernel_export.py` (CSV-Exporte)

## Features (Überblick)
- Python-Tool + `plan`-Tool (Analyse-Modus mit Checkliste), Websuche
- Dashboard-Panel: sammelt alle visuellen Ausgaben (`components/dashboard/collect.ts`)
- Interaktive Regler: Modell erzeugt Widgets, Re-Run über `POST /api/sandbox/:id/widget`
- Code in der Karte bearbeiten: Re-Run über `POST /api/sandbox/:id/execute` (nur lokal, nicht persistiert)
- Spracheingabe (`/api/transcribe`), Export als Jupyter-Notebook (`/api/conversations/:id/notebook`)

## Konventionen
- Bestehenden Stil übernehmen (Kommentardichte, Benennung, Tailwind-Design-Tokens wie `text-ink`, `bg-surface`, `brand-*`).
- Next.js-API-Änderungen vor dem Schreiben in `node_modules/next/dist/docs/` nachlesen (siehe AGENTS.md).
- Keine `__pycache__`/`.pyc`-Dateien committen.
