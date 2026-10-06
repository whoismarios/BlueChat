"use client";

import { memo } from "react";
import { ChartColumnBig, Image as ImageIcon, LocateFixed, SlidersHorizontal, Table2, Code2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { HtmlFrame } from "@/components/messages/python/HtmlFrame";
import { ImageOutput } from "@/components/messages/python/ImageOutput";
import { WidgetOutput } from "@/components/messages/python/WidgetOutput";
import type { DashboardItem, DashboardKind } from "./collect";

const KIND_META: Record<DashboardKind, { label: string; icon: typeof Table2 }> = {
  plotly: { label: "Diagramm", icon: ChartColumnBig },
  image: { label: "Grafik", icon: ImageIcon },
  table: { label: "Tabelle", icon: Table2 },
  html: { label: "HTML", icon: Code2 },
  widget: { label: "Interaktiv", icon: SlidersHorizontal },
};

interface DashboardCardProps {
  entry: DashboardItem;
  index: number;
  sessionId: string | null;
  /** grid mode: wide items span both columns */
  grid: boolean;
  onLocate: (toolCallId: string) => void;
}

/** One visual output of the conversation as a dashboard tile. */
export const DashboardCard = memo(function DashboardCard({ entry, index, sessionId, grid, onLocate }: DashboardCardProps) {
  const { kind, item, title } = entry;
  const meta = KIND_META[kind];
  const Icon = meta.icon;
  const wide = kind === "table" || kind === "widget" || kind === "html";

  return (
    <article
      className={cn(
        "group/card flex min-w-0 animate-fade-up flex-col overflow-hidden rounded-card border border-line bg-surface-raised shadow-[0_1px_0_rgb(0_33_63/0.03)] transition-[border-color,box-shadow] duration-200 hover:border-line-strong hover:shadow-float",
        grid && wide && "@3xl:col-span-2",
      )}
    >
      <header className="flex min-h-11 items-center gap-2.5 border-b border-line px-3.5 py-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-line bg-surface-sunken text-brand-600 dark:text-brand-300">
          <Icon className="size-3.5" aria-hidden />
        </span>
        <button
          type="button"
          onClick={() => onLocate(entry.toolCallId)}
          className="min-w-0 flex-1 cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 rounded-sm"
          title="Im Chat anzeigen"
        >
          <h3 className="truncate text-[13px] font-medium leading-tight text-ink">{title}</h3>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
            <span className="tabular-nums">{String(index).padStart(2, "0")}</span> · {meta.label}
          </p>
        </button>
        <button
          type="button"
          onClick={() => onLocate(entry.toolCallId)}
          aria-label="Im Chat anzeigen"
          title="Im Chat anzeigen"
          className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-faint opacity-60 transition-[opacity,color,background-color] hover:bg-surface-sunken hover:text-ink group-hover/card:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <LocateFixed className="size-3.5" aria-hidden />
        </button>
      </header>
      <div className={cn("min-w-0 flex-1", kind === "plotly" ? "p-1.5" : kind === "image" ? "p-2.5" : kind === "widget" ? "" : "py-1")}>
        {item.type === "image" && (
          <ImageOutput mime={item.mime} data={item.data} text={item.text} index={index} exp={item.export} />
        )}
        {item.type === "html" && (
          <HtmlFrame
            kind={item.kind}
            html={item.html}
            title={title}
            showOpenAction={item.kind !== "table"}
          />
        )}
        {item.type === "widget" && <WidgetOutput widget={item} sessionId={sessionId} />}
      </div>
    </article>
  );
});
