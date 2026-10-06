import type { AppSettings, BlueChatUIMessage, ChatSettings, SandboxFile } from "../types";
import { getModel } from "../models";
import { DEFAULT_SYSTEM_PROMPT } from "./settings";

export const USER_NAME = "Marios";

function formatBerlinNow(now = new Date()): string {
  const date = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);
  const time = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);
  return `${date}, ${time} Uhr (Europe/Berlin)`;
}

/** All attachments of all user messages, de-duplicated by path (latest wins). */
export function collectAttachments(messages: BlueChatUIMessage[]): Omit<SandboxFile, "url">[] {
  const byPath = new Map<string, Omit<SandboxFile, "url">>();
  for (const m of messages) {
    if (m.role !== "user") continue;
    for (const a of m.metadata?.attachments ?? []) {
      if (a && typeof a.path === "string") byPath.set(a.path, a);
    }
  }
  return [...byPath.values()];
}

const DATA_FILE_RE = /\.(csv|tsv|xlsx|xlsm|xls)$/i;

/** Last message is a user message that only uploads data file(s) (no real question). */
function isBareDataUpload(messages: BlueChatUIMessage[]): boolean {
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") return false;
  const attachments = last.metadata?.attachments ?? [];
  if (attachments.length === 0 || !attachments.some((a) => DATA_FILE_RE.test(a.name ?? a.path))) return false;
  const text = last.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join(" ")
    .trim();
  // Composer sends "Ich habe die Datei „x“ hochgeladen." when the user typed nothing.
  return text.length === 0 || /^Ich habe (die Datei .*|\d+ Dateien) hochgeladen\.?$/.test(text);
}

const PYTHON_INSTRUCTIONS = `## Python-Tool (\`python\`)
Du hast Zugriff auf einen Python-Interpreter (Tool \`python\`). Nutze ihn aktiv:
- Wenn der Nutzer Berechnungen, Datenanalysen, Statistiken, Diagramme, Auswertungen von Dateien, Simulationen oder Code/Skripte möchte, **führe den Code tatsächlich aus**, statt nur Code zu zeigen oder Ergebnisse zu schätzen. Rechne nie „im Kopf“, wenn Genauigkeit wichtig ist.
- Umgebung: zustandsbehafteter Jupyter-Kernel (IPython) – Variablen, Importe und geladene Daten bleiben zwischen Aufrufen erhalten. Baue auf früheren Ergebnissen auf, statt alles neu zu laden.
- Arbeitsverzeichnis (cwd) ist der Sitzungsordner dieser Unterhaltung; vom Nutzer hochgeladene Dateien liegen dort und werden mit ihrem relativen Pfad geöffnet (z. B. \`pd.read_csv("daten.csv")\`).
- Verfügbare Pakete: numpy, pandas, matplotlib, seaborn, scipy, scikit-learn, statsmodels, plotly, sympy, openpyxl, xlrd, pyarrow, tabulate, pillow (plus Python-Standardbibliothek). Installiere keine Pakete (kein pip).
- Gehe davon aus, dass die Sandbox **keinen Internetzugang** hat.
- Diagramme: matplotlib (\`plt.show()\`) oder plotly (\`fig.show()\`) – sie werden dem Nutzer automatisch angezeigt. Gib niemals Bilddaten/Base64 aus. Beschrifte Achsen und Titel auf Deutsch. Für interaktive Grafiken bevorzuge plotly.
- Tabellen: Zeige DataFrames, indem du sie zum letzten Ausdruck einer Zelle machst oder \`display(df)\` verwendest – sie werden als Tabelle gerendert. Zeige bei großen Daten nur einen Ausschnitt (\`df.head(20)\`, Aggregationen) statt alles zu printen.
- Dateien zum Herunterladen: Speichere sie im Arbeitsverzeichnis (z. B. \`df.to_excel("ergebnis.xlsx", index=False)\`). Neue/geänderte Dateien werden dem Nutzer automatisch als Download angeboten; nenne den Dateinamen in deiner Antwort.
- Bei Fehlern: Analysiere den Traceback, korrigiere den Code und führe ihn erneut aus (höchstens wenige Versuche).
- Jede Ausführung ist auf ca. 3 Minuten begrenzt; teile sehr lange Berechnungen auf.
- Der Nutzer sieht Code und Ausgaben bereits. Fasse nach der Ausführung die Ergebnisse verständlich zusammen und interpretiere sie, statt die komplette Ausgabe oder den Code zu wiederholen.
- Gib im Parameter \`title\` eine sehr kurze deutsche Beschreibung des Codes an (z. B. „Umsatz pro Monat plotten“).

### Interaktive Regler (\`interact\`)
Wenn Parameter sinnvoll variierbar sind (Simulationen, Szenarien, Sensitivitäten, Zins-/Laufzeit-/Volatilitätsannahmen, Parameter-Exploration), biete interaktive Regler an. Der Nutzer verschiebt die Regler und die Funktion wird im Kernel neu ausgeführt – die Grafik aktualisiert sich direkt, ohne neue Nachricht. \`interact\`, \`slider\`, \`select\` und \`checkbox\` sind ohne Import verfügbar:
\`\`\`python
@interact(
    vol=slider(0.05, 0.8, 0.05, 0.2, label="Volatilität"),        # slider(min, max, schritt, startwert, label=, unit=)
    jahre=slider(1, 30, 1, 10, label="Laufzeit", unit="Jahre"),
    modell=select(["GBM", "Merton"], label="Modell"),             # select(optionen, startwert, label=)
    log=checkbox(False, label="Log-Skala"),                        # checkbox(start, label=)
    title="Monte-Carlo-Simulation",
)
def simulation(vol, jahre, modell, log):
    pfade = ...                       # alles Benötigte hier berechnen
    fig, ax = plt.subplots()
    ax.plot(pfade)
    ax.set_yscale("log" if log else "linear")
    plt.show()                        # oder fig.show() (plotly) / display(df) / print(...)
\`\`\`
- Die Funktion wird sofort einmal mit den Startwerten ausgeführt; ihre Parameternamen müssen den Reglernamen entsprechen.
- Der Funktionskörper muss die Grafik/Tabelle **selbst erzeugen und anzeigen** (bei jeder Ausführung neu); nutze darin nur Variablen, die im Kernel dauerhaft existieren.
- Halte jeden Durchlauf schnell (< 1–2 s, z. B. weniger Simulationspfade), max. ca. 5 Regler mit sinnvollen Grenzen, Schrittweiten und deutschen Labels.
- Erwähne in deiner Antwort kurz, dass der Nutzer die Regler verschieben kann.`;

const ANALYSIS_INSTRUCTIONS = `## Analyse-Modus / Plan (\`plan\`)
Für mehrstufige Datenanalysen (insbesondere „analysiere die Datei“, hochgeladene CSV-/Excel-Dateien, „erstelle ein Dashboard“) arbeitest du sichtbar und autonom im Analyse-Modus:
1. Rufe **zuerst** das Tool \`plan\` mit 4–7 konkreten, kurzen deutschen Schritten auf (z. B. „Daten laden & prüfen“, „Kennzahlen berechnen“, „Risikoverteilung visualisieren“, „Auffälligkeiten identifizieren“, „Management-Summary“). Der erste Schritt hat den Status \`in_progress\`, alle anderen \`pending\`.
2. Arbeite die Schritte nacheinander mit dem Python-Tool ab. Rufe \`plan\` nach jedem abgeschlossenen Schritt erneut mit der **vollständigen** Liste auf (erledigte Schritte \`done\`, den nächsten \`in_progress\`). Formuliere Schritte nicht um und füge nur in Ausnahmefällen welche hinzu. Schreibe zwischen den Schritten keinen langen Text – höchstens einen kurzen Satz.
3. Erzeuge ein **Dashboard** (alle Grafiken erscheinen automatisch im Ergebnis-Panel):
   - 1 KPI-Übersicht mit den wichtigsten Kennzahlen (z. B. eine kompakte plotly-Figur mit mehreren \`go.Indicator\`-Kacheln in einer Zeile, Höhe ca. 220–260 px, oder eine übersichtlich formatierte Tabelle).
   - 3–6 aussagekräftige, interaktive plotly-Diagramme mit deutschen Titeln und Achsenbeschriftungen (jeweils eine Grafik pro Zelle bzw. \`fig.show()\`, sinnvolle Diagrammtypen: Balken, Histogramm, Heatmap, Streudiagramm, Box-Plot, Zeitreihe). Nutze eine ruhige Blau-Palette (z. B. #0050a0, #0066b3, #3d8fd1, #7fb6e6, #00a3e0) und \`template="plotly_white"\`.
   - Gib jeder Python-Zelle einen prägnanten \`title\` – er wird als Kartentitel im Dashboard verwendet.
   - Fasse mehrere Teilschritte in einer Zelle zusammen, statt viele kleine Zellen zu erzeugen.
4. Schließe mit einer prägnanten **Management-Summary** ab: zentrale Kennzahlen, 3–5 wichtigste Erkenntnisse (mit konkreten Zahlen), Risiken/Auffälligkeiten und 2–4 Handlungsempfehlungen. Markiere vorher alle Plan-Schritte als \`done\`.
Lädt der Nutzer nur eine CSV-/Excel-Datei ohne konkrete Frage hoch, starte direkt diesen Analyse-Modus. Für einfache Einzelfragen (eine Berechnung, ein Diagramm) brauchst du keinen Plan.`;

const WEB_SEARCH_INSTRUCTIONS = `## Websuche (\`web_search\`)
Du kannst im Internet suchen. Nutze die Websuche für aktuelle Ereignisse, Preise, Kurse, Nachrichten oder Fakten, die sich seit deinem Trainingsstand geändert haben könnten. Belege Aussagen aus der Websuche mit Quellen (Markdown-Links) und nenne bei Bedarf das Datum der Information.`;

export function buildSystemPrompt(opts: {
  appSettings: AppSettings;
  settings: ChatSettings;
  messages: BlueChatUIMessage[];
  pythonEnabled: boolean;
  webSearchEnabled: boolean;
}): string {
  const { appSettings, settings, messages, pythonEnabled, webSearchEnabled } = opts;
  const sections: string[] = [];

  sections.push((appSettings.systemPrompt || DEFAULT_SYSTEM_PROMPT).trim());

  const model = getModel(settings.model);
  sections.push(
    [
      "## Kontext",
      `- Aktuelles Datum und Uhrzeit: ${formatBerlinNow()}`,
      `- Name des Nutzers: ${USER_NAME}`,
      `- Du läufst in der Anwendung „blueChat“ mit dem Modell ${model?.label ?? settings.model}.`,
      "- Antworten werden als Markdown gerendert (inkl. GFM-Tabellen, Codeblöcken und LaTeX-Formeln: inline \\( … \\), abgesetzt $$ … $$ – niemals einfaches $ für Formeln, da $ als Währungszeichen gilt).",
    ].join("\n"),
  );

  if (pythonEnabled) {
    sections.push(PYTHON_INSTRUCTIONS);
    sections.push(ANALYSIS_INSTRUCTIONS);
    const attachments = collectAttachments(messages);
    if (attachments.length > 0) {
      sections.push(
        "## Vom Nutzer hochgeladene Dateien (im Arbeitsverzeichnis)\n" +
          attachments.map((a) => `- \`${a.path}\` (${a.size} Bytes)`).join("\n") +
          "\nWenn der Nutzer sich auf diese Dateien bezieht, lies sie mit dem Python-Tool ein (zuerst Struktur prüfen, z. B. `df.info()`, `df.head()`).",
      );
    }
    if (isBareDataUpload(messages)) {
      sections.push(
        "## Aktuelle Anfrage\nDer Nutzer hat gerade eine Datendatei (CSV/Excel) ohne konkrete Frage hochgeladen. " +
          "Starte direkt den Analyse-Modus: `plan` aufrufen, Daten prüfen, Dashboard erstellen, Management-Summary.",
      );
    }
  } else {
    const attachments = collectAttachments(messages);
    if (attachments.length > 0) {
      sections.push(
        "## Hinweis\nDer Nutzer hat Dateien hochgeladen (" +
          attachments.map((a) => a.name).join(", ") +
          "), aber das Python-Tool ist deaktiviert. Du kannst die Dateien nicht lesen – bitte den Nutzer ggf., das Python-Tool zu aktivieren.",
      );
    }
  }

  if (webSearchEnabled) sections.push(WEB_SEARCH_INSTRUCTIONS);

  return sections.join("\n\n");
}
