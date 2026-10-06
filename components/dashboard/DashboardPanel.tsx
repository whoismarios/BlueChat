"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ChartNoAxesCombined, LayoutGrid, PanelRightClose, Rows3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "@/components/ui";
import { useConversationId } from "@/components/messages/ConversationContext";
import type { DashboardGroup } from "./collect";
import { DashboardCard } from "./DashboardCard";
import { MAX_PANEL_WIDTH, MIN_PANEL_WIDTH } from "./useDashboardPanel";

type ViewMode = "grid" | "list";

interface DashboardPanelProps {
  open: boolean;
  onClose: () => void;
  groups: DashboardGroup[];
  count: number;
  /** side-by-side (xl) vs. overlay drawer */
  wide: boolean;
  /** panel width in % of the chat area (side-by-side mode) */
  width: number;
  onWidthChange: (width: number) => void;
  /** an answer is being generated */
  streaming: boolean;
}

/** Scroll the python cell of a dashboard item into view and flash it. */
function locateCell(toolCallId: string): boolean {
  const el = document.getElementById(`cell-${toolCallId}`);
  if (!el) return false;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  el.animate?.(
    [
      { boxShadow: "0 0 0 3px color-mix(in srgb, #00a3e0 55%, transparent)" },
      { boxShadow: "0 0 0 3px color-mix(in srgb, #00a3e0 55%, transparent)", offset: 0.5 },
      { boxShadow: "0 0 0 0 transparent" },
    ],
    { duration: 1800, easing: "ease-out" },
  );
  return true;
}

/** "Ergebnisse" panel: all visual outputs of the conversation as a dashboard grid. */
export function DashboardPanel({ open, onClose, groups, count, wide, width, onWidthChange, streaming }: DashboardPanelProps) {
  const sessionId = useConversationId();
  const [mode, setMode] = useState<ViewMode>("grid");
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const asideRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  // Mount the (iframe-heavy) content only once the panel has been opened.
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);

  const onLocate = useCallback(
    (toolCallId: string) => {
      if (locateCell(toolCallId) && !wide) onClose();
    },
    [wide, onClose],
  );

  // Esc closes the drawer on small screens.
  useEffect(() => {
    if (!open || wide) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, wide, onClose]);

  // Follow new results while the user is at the bottom of the panel.
  const prevCount = useRef(count);
  useEffect(() => {
    const el = scrollRef.current;
    if (el && open && count > prevCount.current && nearBottomRef.current && prevCount.current > 0) {
      requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }));
    }
    prevCount.current = count;
  }, [count, open]);

  /* ---------------- resize (side-by-side) ---------------- */
  const startResize = (e: ReactPointerEvent<HTMLDivElement>) => {
    const container = asideRef.current?.parentElement;
    if (!container) return;
    e.preventDefault();
    const rect = container.getBoundingClientRect();
    const calc = (x: number) =>
      Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, ((rect.right - x) / rect.width) * 100));
    let current = width;
    const move = (ev: PointerEvent) => {
      current = calc(ev.clientX);
      setDragWidth(current);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      onWidthChange(current);
      setDragWidth(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    setDragWidth(width);
  };

  const onResizeKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") onWidthChange(width + 2);
    if (e.key === "ArrowRight") onWidthChange(width - 2);
  };

  const content = (
    <div className="flex h-full min-w-0 flex-col bg-surface">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface/80 px-3 backdrop-blur-md sm:px-4">
        <div className="flex min-w-0 flex-1 items-baseline gap-2.5">
          <h2 className="font-display text-[22px] leading-none tracking-[-0.01em] text-ink">Dashboard</h2>
          <span className="font-mono text-[11px] tabular-nums text-ink-faint">
            {count} {count === 1 ? "Ergebnis" : "Ergebnisse"}
          </span>
          {streaming && (
            <span className="ml-1 inline-flex items-center gap-1.5 self-center font-mono text-[10px] uppercase tracking-[0.12em] text-accent">
              <span className="size-1.5 animate-pulse-dot rounded-full bg-accent" aria-hidden />
              live
            </span>
          )}
        </div>
        <div role="group" aria-label="Ansicht" className="flex items-center rounded-[10px] border border-line bg-surface-sunken p-0.5">
          <IconButton
            label="Rasteransicht"
            size="sm"
            tooltipSide="bottom"
            aria-pressed={mode === "grid"}
            onClick={() => setMode("grid")}
            className={cn(mode === "grid" && "bg-surface-raised text-ink shadow-[0_1px_2px_rgb(0_33_63/0.08)]")}
          >
            <LayoutGrid />
          </IconButton>
          <IconButton
            label="Listenansicht"
            size="sm"
            tooltipSide="bottom"
            aria-pressed={mode === "list"}
            onClick={() => setMode("list")}
            className={cn(mode === "list" && "bg-surface-raised text-ink shadow-[0_1px_2px_rgb(0_33_63/0.08)]")}
          >
            <Rows3 />
          </IconButton>
        </div>
        <IconButton label="Dashboard schließen" tooltipSide="bottom" onClick={onClose}>
          <PanelRightClose />
        </IconButton>
      </header>

      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 240;
        }}
        className="scrollbar-thin @container min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        {!mounted ? null : count === 0 ? (
          <EmptyDashboard />
        ) : (
          <div className="flex flex-col gap-7 px-3 pt-4 pb-10 sm:px-4">
            {groups.map((g, gi) => {
              const offset = groups.slice(0, gi).reduce((n, x) => n + x.items.length, 0);
              return (
                <section key={g.id} aria-label={`Analyse ${gi + 1}`}>
                  <div className="mb-3 flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-faint">
                    <span className="shrink-0 tabular-nums">Analyse {String(gi + 1).padStart(2, "0")}</span>
                    <span aria-hidden className="h-px flex-1 bg-line" />
                    <span className="shrink-0 tabular-nums">{g.items.length}</span>
                  </div>
                  {g.prompt && (
                    <p className="-mt-1 mb-3 truncate text-[12.5px] text-ink-muted" title={g.prompt}>
                      {g.prompt}
                    </p>
                  )}
                  <div className={cn("grid grid-cols-1 gap-3", mode === "grid" && "@3xl:grid-cols-2")}>
                    {g.items.map((entry, i) => (
                      <DashboardCard
                        key={entry.key}
                        entry={entry}
                        index={offset + i + 1}
                        sessionId={sessionId}
                        grid={mode === "grid"}
                        onLocate={onLocate}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  if (wide) {
    const w = dragWidth ?? width;
    return (
      <aside
        ref={asideRef}
        aria-label="Dashboard"
        aria-hidden={!open}
        inert={!open}
        style={{ width: open ? `${w}%` : 0 }}
        className={cn(
          "relative h-full shrink-0 overflow-hidden border-line",
          open && "border-l",
          dragWidth === null && "transition-[width] duration-300 ease-[cubic-bezier(0.2,0.7,0.2,1)]",
        )}
      >
        {/* resize handle */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Breite des Dashboards ändern"
          aria-valuenow={Math.round(w)}
          aria-valuemin={MIN_PANEL_WIDTH}
          aria-valuemax={MAX_PANEL_WIDTH}
          tabIndex={open ? 0 : -1}
          onPointerDown={startResize}
          onKeyDown={onResizeKey}
          onDoubleClick={() => onWidthChange(46)}
          className="group/handle absolute inset-y-0 left-0 z-20 w-2 -translate-x-1/2 cursor-col-resize focus-visible:outline-none"
        >
          <span
            aria-hidden
            className={cn(
              "absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors group-hover/handle:bg-accent/70 group-focus-visible/handle:bg-accent",
              dragWidth !== null && "bg-accent",
            )}
          />
        </div>
        <div className="h-full min-w-[380px]">{content}</div>
        {/* iframes swallow pointer events – shield them while dragging */}
        {dragWidth !== null && <div className="fixed inset-0 z-[60] cursor-col-resize" />}
      </aside>
    );
  }

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-[70] bg-brand-950/40 backdrop-blur-[2px] transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        aria-label="Dashboard"
        aria-hidden={!open}
        inert={!open}
        className={cn(
          "fixed inset-y-0 right-0 z-[71] w-full shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.2,0.7,0.2,1)] sm:w-[min(680px,92vw)] sm:border-l sm:border-line",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {content}
      </aside>
    </>
  );
}

function EmptyDashboard() {
  return (
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center px-8 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl border border-line bg-surface-raised text-brand-500 shadow-[0_1px_0_rgb(0_33_63/0.04)] dark:text-brand-300">
        <ChartNoAxesCombined className="size-5" aria-hidden />
      </span>
      <h3 className="mt-4 font-display text-[22px] leading-tight text-ink">Noch keine Ergebnisse</h3>
      <p className="mt-2 max-w-[36ch] text-[13.5px] leading-relaxed text-ink-muted">
        Diagramme, Tabellen und interaktive Auswertungen aus dem Python-Kernel erscheinen hier automatisch als Dashboard.
      </p>
    </div>
  );
}
