/* DEV ONLY – mock messages for the visual check harness at /dev/messages. */
import type { BlueChatUIMessage, DataExport, PythonToolOutput } from "@/lib/types";

/** Builds a mock export pointing at a client-side CSV (data URL) so downloads work in the harness. */
function mockExport(name: string, csv: string): DataExport {
  const lines = csv.trim().split("\n");
  return {
    name,
    path: `exports/${name}`,
    rows: lines.length - 1,
    columns: lines[0].split(",").length,
    size: new TextEncoder().encode(csv).length,
    url: `data:text/csv;charset=utf-8,${encodeURIComponent("\uFEFF" + csv)}`,
  };
}

const UMSATZ_CSV = `Quartal,Umsatz (Mio. €),Kosten (Mio. €),Marge
Q1 2024,62.4,48.1,0.229
Q2 2024,78.2,57.9,0.260
Q3 2024,71.0,55.2,0.223
Q4 2024,95.3,70.4,0.261
Q1 2025,88.1,64.0,0.274
Q2 2025,112.6,79.8,0.291
Q3 2025,104.2,75.3,0.277
Q4 2025,131.0,90.2,0.311`;

const TABLE_EXPORT = mockExport("tabelle-3f9a.csv", UMSATZ_CSV);
const FIGURE_EXPORT = mockExport("abbildung-8c21.csv", UMSATZ_CSV.split("\n").map((l) => l.split(",").slice(0, 2).join(",")).join("\n"));
const PLOTLY_EXPORT = mockExport("plotly-d07e.csv", UMSATZ_CSV.split("\n").map((l) => l.split(",").slice(0, 3).join(",")).join("\n"));

const CHART_PNG = "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";

const SVG_CHART = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="160" viewBox="0 0 420 160"><rect width="420" height="160" fill="#fff"/><g stroke="#dde5ef">${[30, 60, 90, 120]
  .map((y) => `<line x1="30" x2="410" y1="${y}" y2="${y}"/>`)
  .join("")}</g><polyline fill="none" stroke="#0050a0" stroke-width="2.5" points="30,120 90,104 150,110 210,80 270,86 330,52 390,40"/><polyline fill="none" stroke="#00a3e0" stroke-width="2" stroke-dasharray="5 4" points="30,128 90,118 150,112 210,98 270,92 330,76 390,66"/><text x="30" y="18" font-family="sans-serif" font-size="12" fill="#4a5a6e">Zinsstrukturkurve (SVG)</text></svg>`;

const DF_HTML = `<div>
<style scoped>
    .dataframe tbody tr th:only-of-type { vertical-align: middle; }
    .dataframe tbody tr th { vertical-align: top; }
    .dataframe thead th { text-align: right; }
</style>
<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;"><th></th><th>Quartal</th><th>Umsatz (Mio. €)</th><th>Kosten (Mio. €)</th><th>Marge</th><th>Δ Vorquartal</th></tr>
  </thead>
  <tbody>
${[
  ["Q1 2024", 62.4, 48.1, "22,9 %", "–"],
  ["Q2 2024", 78.2, 57.9, "26,0 %", "+25,3 %"],
  ["Q3 2024", 71.0, 55.2, "22,3 %", "−9,2 %"],
  ["Q4 2024", 95.3, 70.4, "26,1 %", "+34,2 %"],
  ["Q1 2025", 88.1, 64.0, "27,4 %", "−7,6 %"],
  ["Q2 2025", 112.6, 79.8, "29,1 %", "+27,8 %"],
  ["Q3 2025", 104.2, 75.3, "27,7 %", "−7,5 %"],
  ["Q4 2025", 131.0, 90.2, "31,1 %", "+25,7 %"],
]
  .map(
    (r, i) =>
      `    <tr><th>${i}</th><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td></tr>`,
  )
  .join("\n")}
  </tbody>
</table>
<p>8 rows × 5 columns</p>
</div>`;

const PLOTLY_HTML = `<html>
<head><meta charset="utf-8" /></head>
<body>
  <div>
    <script type="text/javascript">window.PlotlyConfig = {MathJaxConfig: 'local'};</script>
    <script charset="utf-8" src="https://cdn.plot.ly/plotly-2.35.2.min.js"></script>
    <div id="plot" class="plotly-graph-div" style="height:100%; width:100%;"></div>
    <script type="text/javascript">
      window.PLOTLYENV = window.PLOTLYENV || {};
      if (document.getElementById("plot")) {
        Plotly.newPlot("plot",
          [
            {type: "scatter", mode: "lines+markers", name: "Umsatz", x: ["Q1 24","Q2 24","Q3 24","Q4 24","Q1 25","Q2 25","Q3 25","Q4 25"], y: [62.4,78.2,71.0,95.3,88.1,112.6,104.2,131.0], line: {color: "#0050a0", width: 3}},
            {type: "bar", name: "Kosten", x: ["Q1 24","Q2 24","Q3 24","Q4 24","Q1 25","Q2 25","Q3 25","Q4 25"], y: [48.1,57.9,55.2,70.4,64.0,79.8,75.3,90.2], marker: {color: "#7fb6e6"}}
          ],
          {template: {layout: {}}, title: {text: "Umsatz vs. Kosten (interaktiv)"}, margin: {t: 50, r: 20, b: 40, l: 50}, legend: {orientation: "h"}},
          {responsive: true}
        );
      }
    </script>
  </div>
</body>
</html>`;

const TRACEBACK =
  "\u001b[0;31m---------------------------------------------------------------------------\u001b[0m\n" +
  "\u001b[0;31mKeyError\u001b[0m                                  Traceback (most recent call last)\n" +
  "Cell \u001b[0;32mIn[3], line 2\u001b[0m\n" +
  "\u001b[1;32m      1\u001b[0m df \u001b[38;5;241m=\u001b[39m pd\u001b[38;5;241m.\u001b[39mread_excel(\u001b[38;5;124m\"\u001b[39m\u001b[38;5;124mumsatz.xlsx\u001b[39m\u001b[38;5;124m\"\u001b[39m)\n" +
  "\u001b[0;32m----> 2\u001b[0m df[\u001b[38;5;124m\"\u001b[39m\u001b[38;5;124mRegion\u001b[39m\u001b[38;5;124m\"\u001b[39m]\u001b[38;5;241m.\u001b[39mvalue_counts()\n\n" +
  "File \u001b[0;32m/usr/local/lib/python3.12/site-packages/pandas/core/frame.py:4102\u001b[0m, in \u001b[0;36mDataFrame.__getitem__\u001b[0;34m(self, key)\u001b[0m\n" +
  "\u001b[0;31mKeyError\u001b[0m: 'Region'";

const okRun: PythonToolOutput = {
  status: "ok",
  durationMs: 1843,
  outputs: [
    { type: "stream", name: "stdout", text: "Datei geladen: umsatz.xlsx\n" },
    { type: "stream", name: "stdout", text: "8 Zeilen, 5 Spalten\nZeitraum: Q1 2024 – Q4 2025\n" },
    { type: "stream", name: "stderr", text: "FutureWarning: The default of observed=False is deprecated and will be changed to True in a future version of pandas.\n" },
    { type: "html", kind: "table", html: DF_HTML, text: "   Quartal  Umsatz ...", export: TABLE_EXPORT },
    { type: "image", mime: "image/png", data: CHART_PNG, text: "<Figure size 960x520 with 1 Axes>", export: FIGURE_EXPORT },
    { type: "text", text: "CAGR (8 Quartale): 11,2 %" },
  ],
  files: [
    { name: "umsatz_bereinigt.csv", path: "out/umsatz_bereinigt.csv", size: 18342, url: "#umsatz_bereinigt.csv" },
    { name: "quartalsbericht.xlsx", path: "out/quartalsbericht.xlsx", size: 734_221, url: "#quartalsbericht.xlsx" },
    { name: "trend.png", path: "out/trend.png", size: 1995, url: "#trend.png" },
  ],
};

const plotlyRun: PythonToolOutput = {
  status: "ok",
  durationMs: 612,
  outputs: [
    { type: "html", kind: "plotly", html: PLOTLY_HTML, text: "Figure()", export: PLOTLY_EXPORT },
    // older message style: table without server export → client-side CSV fallback
    { type: "html", kind: "table", html: DF_HTML, text: "fallback table" },
    { type: "image", mime: "image/svg+xml", data: SVG_CHART, text: "Zinsstrukturkurve" },
  ],
  files: [],
};

const errorRun: PythonToolOutput = {
  status: "error",
  durationMs: 94,
  outputs: [{ type: "error", ename: "KeyError", evalue: "'Region'", traceback: TRACEBACK }],
  files: [],
};

const timeoutRun: PythonToolOutput = {
  status: "timeout",
  durationMs: 60000,
  outputs: [{ type: "stream", name: "stdout", text: "Simulation 1/1000\rSimulation 250/1000\rSimulation 512/1000\n" }],
  files: [],
};

const MARKDOWN = `## Ergebnis der Analyse

Der Umsatz ist über die **acht Quartale** deutlich gestiegen – mit einem klaren saisonalen Muster: Q4 ist jeweils das stärkste Quartal.

| Kennzahl | 2024 | 2025 | Veränderung |
|:--|--:|--:|--:|
| Umsatz | 306,9 Mio. € | 435,9 Mio. € | +42,0 % |
| Kosten | 231,6 Mio. € | 309,3 Mio. € | +33,5 % |
| Ø Marge | 24,3 % | 28,8 % | +4,5 pp |

Die durchschnittliche Wachstumsrate pro Quartal ergibt sich aus
\\[ \\text{CAGR} = \\left(\\frac{U_{\\text{Q4 2025}}}{U_{\\text{Q1 2024}}}\\right)^{1/7} - 1 \\approx 11{,}2\\,\\% \\]
und liegt damit über dem Branchenschnitt von \\( 6\\,\\% \\). Preise wie $5 oder $10 bleiben übrigens Text.

### Nächste Schritte

1. Saisonbereinigung (z. B. \`statsmodels.tsa.seasonal_decompose\`)
2. Prognose für 2026 mit einem einfachen Modell
3. Abgleich mit den Planzahlen

- Datenqualität: keine fehlenden Werte
- Ausreißer: keine auffälligen

> Hinweis: Die Spalte „Region“ existiert in der Datei nicht – siehe Fehler unten.

\`\`\`python
import pandas as pd
df = pd.read_excel("umsatz.xlsx")
df["Marge"] = 1 - df["Kosten"] / df["Umsatz"]
print(df.describe())
\`\`\`

Mehr dazu in der [pandas-Dokumentation](https://pandas.pydata.org/docs/).`;

const t0 = "2026-10-06T09:14:00.000Z";

export const BASE_MESSAGES: BlueChatUIMessage[] = [
  {
    id: "u1",
    role: "user",
    metadata: {
      createdAt: t0,
      attachments: [
        { name: "umsatz.xlsx", path: "umsatz.xlsx", size: 48213 },
        { name: "notizen_vorstand.txt", path: "notizen_vorstand.txt", size: 2210 },
      ],
    },
    parts: [{ type: "text", text: "Analysiere bitte die Quartalsumsätze in umsatz.xlsx.\nZeig mir den Trend und eine Tabelle mit den Margen." }],
  },
  {
    id: "a1",
    role: "assistant",
    metadata: { model: "gpt-5.5", reasoningEffort: "medium", createdAt: t0, usage: { inputTokens: 12873, outputTokens: 1840, reasoningTokens: 612 } },
    parts: [
      { type: "step-start" },
      {
        type: "reasoning",
        state: "done",
        text: "Der Nutzer möchte eine **Trendanalyse**. Ich lade die Excel-Datei mit pandas, berechne die Marge je Quartal und erstelle ein Balkendiagramm mit gleitendem Durchschnitt.\n\nDanach exportiere ich die bereinigten Daten als CSV und XLSX.",
      },
      { type: "text", state: "done", text: "Ich lade zuerst die Datei und verschaffe mir einen Überblick über die Daten." },
      {
        type: "tool-python",
        toolCallId: "call_1",
        state: "output-available",
        input: {
          title: "Umsatzdaten laden und Margen berechnen",
          code: `import pandas as pd
import matplotlib.pyplot as plt

df = pd.read_excel("umsatz.xlsx")
print(f"Datei geladen: umsatz.xlsx")
print(f"{len(df)} Zeilen, {df.shape[1]} Spalten")

df["Marge"] = 1 - df["Kosten"] / df["Umsatz"]
display(df)

fig, ax = plt.subplots(figsize=(9.6, 5.2))
ax.bar(df["Quartal"], df["Umsatz"], color="#0050a0")
ax.plot(df["Quartal"], df["Umsatz"].rolling(3, min_periods=1).mean(), color="#c2372f")
plt.show()

"""Export für das Controlling"""
df.to_csv("out/umsatz_bereinigt.csv", index=False)`,
        },
        output: okRun,
      },
      { type: "step-start" },
      { type: "text", state: "done", text: "Zur interaktiven Betrachtung hier noch ein Plotly-Diagramm:" },
      {
        type: "tool-python",
        toolCallId: "call_2",
        state: "output-available",
        input: {
          title: "Interaktives Diagramm erstellen",
          code: `import plotly.graph_objects as go
fig = go.Figure()
fig.add_scatter(x=df["Quartal"], y=df["Umsatz"], name="Umsatz")
fig.add_bar(x=df["Quartal"], y=df["Kosten"], name="Kosten")
fig.show()`,
        },
        output: plotlyRun,
      },
      {
        type: "tool-python",
        toolCallId: "call_3",
        state: "output-available",
        input: { code: `df["Region"].value_counts()` },
        output: errorRun,
      },
      { type: "step-start" },
      { type: "text", state: "done", text: MARKDOWN },
    ],
  } as BlueChatUIMessage,
  {
    id: "u2",
    role: "user",
    metadata: { createdAt: t0 },
    parts: [{ type: "text", text: "Was sagen aktuelle Quellen zur EZB-Zinsentwicklung? Und lass eine Monte-Carlo-Simulation laufen." }],
  },
  {
    id: "a2",
    role: "assistant",
    metadata: { model: "gpt-5.5", reasoningEffort: "high", createdAt: t0, usage: { inputTokens: 20311, outputTokens: 954 } },
    parts: [
      { type: "step-start" },
      { type: "reasoning", state: "done", text: "" },
      {
        type: "tool-web_search",
        toolCallId: "ws_1",
        state: "output-available",
        providerExecuted: true,
        input: {},
        output: { action: { type: "search", query: "EZB Leitzins Entscheidung Oktober 2026" }, sources: [{ type: "url", url: "https://www.ecb.europa.eu/press" }, { type: "url", url: "https://www.bundesbank.de" }] },
      },
      {
        type: "tool-web_search",
        toolCallId: "ws_2",
        state: "output-available",
        providerExecuted: true,
        input: {},
        output: { action: { type: "openPage", url: "https://www.handelsblatt.com/finanzen/geldpolitik" } },
      },
      {
        type: "tool-python",
        toolCallId: "call_4",
        state: "output-available",
        input: { title: "Monte-Carlo-Simulation der Zinspfade", code: "import numpy as np\nfor i in range(1000):\n    simulate_path(i)  # sehr langsam" },
        output: timeoutRun,
      },
      {
        type: "tool-python",
        toolCallId: "call_5",
        state: "output-error",
        input: { title: "Simulation mit reduziertem Umfang", code: "simulate(n=100)" },
        errorText: "Sandbox nicht erreichbar (ECONNREFUSED 127.0.0.1:8888).",
      },
      { type: "step-start" },
      {
        type: "text",
        state: "done",
        text: "Laut den aktuellen Meldungen hat die EZB den Einlagensatz zuletzt **unverändert** gelassen [1]. Die Bundesbank erwartet eine Seitwärtsbewegung bis Mitte 2027 [2].\n\nDie Simulation hat das Zeitlimit überschritten – ich kann sie mit weniger Pfaden erneut starten.",
      },
      { type: "source-url", sourceId: "s1", url: "https://www.ecb.europa.eu/press/pr/date/2026/html/index.en.html", title: "EZB Pressemitteilung" },
      { type: "source-url", sourceId: "s2", url: "https://www.bundesbank.de/de/presse", title: "Bundesbank Presse" },
      { type: "source-url", sourceId: "s3", url: "https://www.handelsblatt.com/finanzen/geldpolitik/", title: "Handelsblatt Geldpolitik" },
      { type: "source-url", sourceId: "s1b", url: "https://www.ecb.europa.eu/press/pr/date/2026/html/index.en.html#top", title: "EZB Pressemitteilung" },
    ],
  } as BlueChatUIMessage,
];

/** Assistant message caught mid-stream: reasoning streaming + python input streaming. */
export function streamingMessage(codeProgress: number): BlueChatUIMessage {
  const code = `import numpy as np
import pandas as pd

rng = np.random.default_rng(42)
pfade = rng.normal(0.0, 0.25, size=(100, 12)).cumsum(axis=1) + 3.0
df = pd.DataFrame(pfade.T)
print(df.describe().T.head())`;
  const partial = code.slice(0, Math.max(0, Math.min(code.length, codeProgress)));
  const done = codeProgress >= code.length;
  return {
    id: "a3",
    role: "assistant",
    metadata: { model: "gpt-5.5", reasoningEffort: "low" },
    parts: [
      { type: "step-start" },
      { type: "reasoning", state: "done", text: "Ich reduziere die Anzahl der Pfade auf 100, damit das Zeitlimit eingehalten wird." },
      { type: "text", state: "done", text: "Ich starte die Simulation mit **100 Pfaden** neu:" },
      done
        ? {
            type: "tool-python",
            toolCallId: "call_6",
            state: "input-available",
            input: { title: "Monte-Carlo mit 100 Pfaden", code },
          }
        : {
            type: "tool-python",
            toolCallId: "call_6",
            state: "input-streaming",
            input: { title: "Monte-Carlo mit 100 Pfaden", code: partial },
          },
    ],
  } as BlueChatUIMessage;
}

export const PENDING_USER: BlueChatUIMessage = {
  id: "u3",
  role: "user",
  parts: [{ type: "text", text: "Bitte nochmal mit 100 Pfaden." }],
};
