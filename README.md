# blueChat

ChatGPT-ähnliches Chat-Interface – mit **Python-Code-Interpreter**, Websuche, Modell- und Denkstufen-Auswahl.

- **Frontend & Backend:** Next.js 16 (App Router, Dev-Modus auf Port 3000), Tailwind CSS v4, AI SDK v7 + OpenAI (Responses API, Streaming)
- **Datenbank:** PostgreSQL 17 (Docker) – Chats, Nachrichten, Einstellungen
- **Python-Sandbox:** FastAPI + Jupyter-Kernel pro Chat (Docker) mit numpy, pandas, matplotlib, seaborn, scipy, scikit-learn, statsmodels, plotly, sympy, openpyxl …

## Schnellstart

1. OpenAI-Key in `.env` eintragen (Vorlage: `.env.example`):
   ```
   OPENAI_API_KEY=sk-...
   ```
2. Alles starten (DB, Python-Sandbox und Next.js im Dev-Modus):
   ```bash
   docker compose up
   ```
3. Öffnen: http://localhost:3000

### Alternative: Frontend lokal, Infrastruktur in Docker

```bash
docker compose up -d db sandbox
```

```bash
npm install
```

```bash
npm run dev
```

## Funktionen

- **Chat mit Streaming**, Markdown, Code-Highlighting, LaTeX, Chatverlauf in der Sidebar (Umbenennen, Löschen, Suche), automatische Titel
- **Modellauswahl** und **Denkstufe** (Reasoning Effort, nur bei Reasoning-Modellen) pro Chat; der Gedankengang wird als Zusammenfassung angezeigt
- **Systemprompt** und Standardwerte unter *Einstellungen* (Zahnrad unten links)
- **Tools pro Chat ein-/ausschaltbar:**
  - **Python:** Das Modell schreibt Code, der in einem zustandsbehafteten Jupyter-Kernel läuft (Variablen bleiben pro Chat erhalten). Ausgaben: stdout/stderr, matplotlib-Plots, pandas-Tabellen, interaktive Plotly-Charts, Fehler mit Traceback und erzeugte Dateien zum Download.
  - **CSV-Export:** Die Daten hinter jeder Tabelle und jedem Diagramm lassen sich als CSV herunterladen. Das geht auch für Markdown-Tabellen in Antworten.
  - **Websuche:** OpenAI-Websuche mit Quellenangaben
- **Datei-Upload** (Büroklammer, Drag & Drop): Dateien landen im Arbeitsverzeichnis des Chats und können direkt mit pandas gelesen werden
- **Analyse-Modus & Dashboard:** Bei Datei-Analysen veröffentlicht das Modell einen Arbeitsplan mit Häkchen; alle Diagramme, Tabellen und Widgets erscheinen zusätzlich im **Dashboard-Panel** rechts (Raster-/Listenansicht, Breite verstellbar)
- **Interaktive Regler:** Simulationen können Regler anbieten – Verschieben rechnet den Code im Kernel sofort neu, ohne neue Chat-Nachricht
- **Code bearbeiten:** Code jeder Python-Zelle direkt in der Karte ändern und neu ausführen (Strg/⌘ + Enter)
- **Spracheingabe** per Mikrofon (OpenAI-Transkription)
- **Export als Jupyter-Notebook** (`.ipynb`) über das Menü oben rechts
- **Kernel zurücksetzen** über das Menü oben rechts im Chat
- Hell/Dunkel-Modus

## Projektstruktur

```
app/                 Seiten (/, /c/[id]) und API-Routen (app/api/*)
components/ui        wiederverwendbare UI-Primitive (Button, Dialog, DropdownMenu, Switch …)
components/shell     Sidebar, Einstellungen, Health-Banner
components/chat      Chat, Composer, Modell-/Denkstufen-/Tool-Auswahl
components/messages  Nachrichtendarstellung inkl. Python-Ergebnissen
lib/                 Typen (types.ts), Modellkatalog (models.ts), Server-Logik (lib/server)
sandbox/             Python-Sandbox (FastAPI + Jupyter-Kernel)
db/init.sql          Datenbankschema
```

Die Modellliste steht in `lib/models.ts`. `/api/models` zeigt nur die Modelle, die mit dem hinterlegten Key verfügbar sind.

`/dev/messages` zeigt eine Vorschau aller Nachrichtentypen mit Mock-Daten.

## Hinweise

- Es gibt keine Benutzerverwaltung; der Nutzer ist fest „Marios“.
- Die Sandbox ist für die lokale Nutzung gedacht: Alle Kernel laufen als derselbe Nutzer im Container, und der Container hat Internetzugang.
- Daten zurücksetzen:
  ```bash
  docker compose down -v
  ```
