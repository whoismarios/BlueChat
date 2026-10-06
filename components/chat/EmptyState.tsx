"use client";

import { useSyncExternalStore } from "react";
import { ArrowUpRight, ChartSpline, Globe, Sheet, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Suggestion {
  tag: string;
  text: string;
  icon: React.ReactNode;
  /** Enable web search before sending */
  webSearch?: boolean;
}

export const SUGGESTIONS: Suggestion[] = [
  { tag: "Simulation", text: "Simuliere 1.000 Aktienkurspfade mit GBM und plotte sie", icon: <TrendingUp /> },
  { tag: "Datenanalyse", text: "Analysiere einen Beispiel-Datensatz mit pandas und zeige eine Tabelle", icon: <Sheet /> },
  { tag: "Visualisierung", text: "Erstelle ein interaktives Plotly-Diagramm zur Zinsstrukturkurve", icon: <ChartSpline /> },
  { tag: "Websuche", text: "Was gibt es Neues bei der EZB?", icon: <Globe />, webSearch: true },
];

function greeting(hour: number) {
  if (hour < 5) return "Gute Nacht";
  if (hour < 11) return "Guten Morgen";
  if (hour < 18) return "Guten Tag";
  return "Guten Abend";
}

const noop = () => () => {};
/** Minute-stable client snapshot of "now" (null during SSR to avoid timezone mismatches). */
function useClientNow() {
  return useSyncExternalStore(
    noop,
    () => Math.floor(Date.now() / 60_000),
    () => null,
  );
}

export function EmptyState({
  onSuggestion,
  webSearchAvailable,
}: {
  onSuggestion: (s: Suggestion) => void;
  webSearchAvailable: boolean;
}) {
  const minute = useClientNow();
  const now = minute === null ? null : new Date(minute * 60_000);
  const hello = now ? greeting(now.getHours()) : "Guten Tag";
  const dateLabel = now
    ? now.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })
    : " ";

  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-chat flex-col justify-center px-5 pt-8 pb-10 sm:px-6">
        <div className="flex animate-fade-up items-center gap-3 font-mono text-[10.5px] tracking-[0.16em] text-ink-faint uppercase">
          <span className="tabular-nums">{dateLabel}</span>
          <span aria-hidden className="h-px flex-1 origin-left animate-[rule-draw_900ms_cubic-bezier(0.2,0.7,0.2,1)_both] bg-line-strong" />
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-success shadow-[0_0_0_3px_color-mix(in_srgb,var(--success)_18%,transparent)]" />
            Python-Kernel bereit
          </span>
        </div>

        <h1
          className={cn(
            "mt-6 font-display text-[clamp(44px,7vw,72px)] leading-[0.98] tracking-[-0.02em] text-ink",
            now ? "animate-fade-up [animation-delay:60ms]" : "invisible",
          )}
        >
          {hello}, <em className="text-brand-600 italic dark:text-brand-300">Marios.</em>
        </h1>
        <p className="mt-4 max-w-[54ch] animate-fade-up text-[15px] leading-relaxed text-ink-muted [animation-delay:120ms]">
          Womit kann ich helfen? Ich beantworte Fragen, recherchiere im Web und führe Python-Code in einer eigenen Sandbox aus –
          inklusive Diagrammen, Tabellen und Dateien.
        </p>

        <div className="mt-10 grid animate-fade-up overflow-hidden rounded-card border border-line bg-line [animation-delay:180ms] sm:grid-cols-2 gap-px">
          {SUGGESTIONS.map((s, i) => {
            const disabled = s.webSearch && !webSearchAvailable;
            return (
              <button
                key={s.text}
                type="button"
                disabled={disabled}
                onClick={() => onSuggestion(s)}
                className="group relative flex min-h-[112px] cursor-pointer flex-col bg-surface-raised p-4 text-left transition-colors outline-none hover:bg-surface-sunken focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-accent/70 disabled:cursor-not-allowed disabled:opacity-50 sm:p-5"
              >
                <span className="flex items-center gap-2 font-mono text-[10.5px] tracking-[0.08em] text-ink-faint uppercase">
                  <span className="tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  <span aria-hidden className="h-px w-3 bg-line-strong" />
                  {s.tag}
                  <span className="ml-auto text-brand-500 transition-colors group-hover:text-brand-600 dark:text-brand-300 [&_svg]:size-4">
                    {s.icon}
                  </span>
                </span>
                <span className="mt-3 pr-6 text-[14.5px] leading-snug text-ink">{s.text}</span>
                <ArrowUpRight
                  aria-hidden
                  className="absolute right-4 bottom-4 size-4 translate-x-[-3px] translate-y-[3px] text-ink-faint opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:text-brand-600 group-hover:opacity-100 dark:group-hover:text-brand-300"
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
