"use client";

import { ListChecks } from "lucide-react";
import type { PlanStepStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ShimmerText } from "../ThinkingIndicator";
import type { PlanToolPartView } from "../types";

interface PlanStep {
  title: string;
  status: PlanStepStatus;
}

/** Defensive normalisation – the input may be partial while it is still streaming. */
function stepsOf(part: PlanToolPartView): PlanStep[] {
  const raw = part.input?.steps;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is PlanStep => !!s && typeof s.title === "string" && s.title.trim().length > 0)
    .map((s) => ({
      title: s.title.trim(),
      status: s.status === "done" || s.status === "in_progress" ? s.status : "pending",
    }));
}

interface PlanCardProps {
  /** The LATEST plan part of the message (its input holds the current state). */
  part: PlanToolPartView;
  /** The message is still being generated (in-progress steps animate). */
  streaming: boolean;
}

/** Checklist card for the model's analysis plan (`plan` tool). */
export function PlanCard({ part, streaming }: PlanCardProps) {
  const steps = stepsOf(part);
  const total = steps.length;
  const done = steps.filter((s) => s.status === "done").length;
  const complete = total > 0 && done === total;
  const title = part.input?.title?.trim() || "Analyseplan";
  const pct = total ? (done / total) * 100 : 0;

  return (
    <section
      aria-label={`${title}: ${done} von ${total} Schritten erledigt`}
      className="relative my-4 overflow-hidden rounded-card border border-line bg-surface-raised"
    >
      <header className="flex items-center gap-3 px-4 pt-3.5 pb-3">
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors duration-500",
            complete
              ? "border-success/30 bg-success/[0.08] text-success"
              : "border-brand-200 bg-brand-50 text-brand-600 dark:border-brand-700 dark:bg-brand-900/50 dark:text-brand-300",
          )}
        >
          <ListChecks className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[14px] font-medium leading-tight text-ink" title={title}>
            {title}
          </h3>
          <p className="mt-0.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-faint">
            {complete ? "Abgeschlossen" : streaming ? "In Arbeit" : "Plan"}
          </p>
        </div>
        <span className="shrink-0 font-mono text-[12px] tabular-nums text-ink-muted">
          <span className={cn("font-semibold", complete ? "text-success" : "text-ink")}>{done}</span>
          <span className="text-ink-faint">/{total || "–"}</span>
        </span>
      </header>

      {/* progress */}
      <div className="mx-4 h-[3px] overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
        <div
          className={cn(
            "h-full rounded-full transition-[width,background-color] duration-700 ease-[cubic-bezier(0.2,0.7,0.2,1)]",
            complete ? "bg-success" : "bg-linear-to-r from-brand-500 to-accent",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      <ol className="px-2 pt-2 pb-2.5">
        {steps.length === 0 && (
          <li className="px-2 py-2">
            <ShimmerText className="text-[13px]">Plan wird erstellt…</ShimmerText>
          </li>
        )}
        {steps.map((step, i) => (
          <PlanStepRow key={i} index={i + 1} step={step} live={streaming} />
        ))}
      </ol>
    </section>
  );
}

function PlanStepRow({ index, step, live }: { index: number; step: PlanStep; live: boolean }) {
  const isDone = step.status === "done";
  const active = step.status === "in_progress";

  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-[10px] px-2 py-[7px] transition-colors duration-300",
        active && "bg-brand-50/70 dark:bg-brand-900/30",
      )}
    >
      <span className="relative flex size-[22px] shrink-0 items-center justify-center">
        {/* pulse halo for the active step */}
        {active && live && (
          <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-accent/25 [animation-duration:1.6s]" />
        )}
        <span
          className={cn(
            "relative flex size-[22px] items-center justify-center rounded-full border font-mono text-[10.5px] tabular-nums transition-all duration-500",
            isDone
              ? "border-success bg-success text-white"
              : active
                ? "border-accent bg-surface-raised text-accent"
                : "border-line-strong bg-surface-raised text-ink-faint",
          )}
        >
          {/* number (pending / active) */}
          <span className={cn("transition-opacity duration-200", isDone ? "opacity-0" : "opacity-100")}>{index}</span>
          {/* animated check – always mounted so the stroke can draw in */}
          <svg viewBox="0 0 16 16" fill="none" aria-hidden className="absolute size-3">
            <path
              d="M3.2 8.4 6.5 11.5 12.8 4.8"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={isDone ? 0 : 1}
              className="transition-[stroke-dashoffset] delay-150 duration-500 ease-out"
            />
          </svg>
        </span>
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 text-[13.5px] leading-snug transition-colors duration-300",
          isDone ? "text-ink-muted" : active ? "font-medium text-ink" : "text-ink-faint",
        )}
      >
        {active && live ? <ShimmerText className="text-[13.5px]">{step.title}</ShimmerText> : step.title}
      </span>
      <span className="sr-only">{isDone ? "erledigt" : active ? "in Arbeit" : "offen"}</span>
    </li>
  );
}
