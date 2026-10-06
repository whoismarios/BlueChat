"use client";

import { Check, Mic, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton, Kbd, Spinner, Tooltip, focusRing } from "@/components/ui";
import { ShimmerText } from "@/components/messages/ThinkingIndicator";
import type { VoiceRecorder } from "./useVoiceRecorder";

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Mic button that starts a recording. Renders nothing if the browser can't record audio. */
export function VoiceInputButton({
  recorder,
  disabled,
  className,
}: {
  recorder: VoiceRecorder;
  disabled?: boolean;
  className?: string;
}) {
  if (!recorder.supported) return null;
  const pending = recorder.status === "requesting" || recorder.status === "transcribing";
  return (
    <IconButton
      label={recorder.status === "transcribing" ? "Transkribiere …" : "Spracheingabe"}
      size="md"
      onClick={recorder.start}
      disabled={disabled || recorder.status !== "idle"}
      aria-busy={pending || undefined}
      className={cn("size-8 rounded-lg", className)}
    >
      {pending ? <Spinner className="size-4" /> : <Mic />}
    </IconButton>
  );
}

/**
 * Recording state: pulsing red dot, live level waveform, elapsed time and cancel / confirm buttons.
 * While transcribing it shows a spinner with an abort button.
 */
export function VoiceRecordingBar({ recorder, className }: { recorder: VoiceRecorder; className?: string }) {
  const transcribing = recorder.status === "transcribing";
  const remaining = recorder.maxDurationMs - recorder.elapsedMs;
  const nearLimit = remaining <= 15_000;

  return (
    <div
      role="group"
      aria-label={transcribing ? "Transkription läuft" : "Sprachaufnahme läuft"}
      className={cn("flex min-w-0 flex-1 animate-fade-up items-center gap-2 py-0.5 pl-0.5", className)}
    >
      <IconButton
        label={transcribing ? "Transkription abbrechen" : "Aufnahme verwerfen (Esc)"}
        onClick={recorder.cancel}
        className="size-8 rounded-lg"
      >
        <X />
      </IconButton>

      {transcribing ? (
        <div className="flex min-w-0 flex-1 items-center gap-2.5 pl-1 text-[13.5px] text-ink-muted" aria-live="polite">
          <Spinner className="size-4 text-accent" />
          <ShimmerText className="truncate text-[13.5px]">Transkribiere …</ShimmerText>
        </div>
      ) : (
        <div className="flex h-9 min-w-0 flex-1 items-center gap-3 rounded-full border border-danger/25 bg-danger/[0.06] pr-3 pl-3 dark:border-danger/35 dark:bg-danger/10">
          <span className="relative flex size-2.5 shrink-0" aria-hidden>
            <span className="absolute inset-0 animate-ping rounded-full bg-danger opacity-60" />
            <span className="relative size-2.5 rounded-full bg-danger" />
          </span>
          <Waveform levels={recorder.levels} />
          <span
            className={cn("shrink-0 font-mono text-[12.5px] tabular-nums", nearLimit ? "text-danger" : "text-ink-muted")}
            aria-label={`Aufnahmedauer ${formatElapsed(recorder.elapsedMs)}`}
          >
            {formatElapsed(recorder.elapsedMs)}
            <span className="hidden text-ink-faint sm:inline"> / {formatElapsed(recorder.maxDurationMs)}</span>
          </span>
          <span className="hidden shrink-0 items-center gap-1 font-mono text-[10.5px] text-ink-faint md:flex">
            <Kbd>Esc</Kbd> verwerfen
          </span>
        </div>
      )}

      {!transcribing && (
        <Tooltip content="Aufnahme beenden und transkribieren">
          <button
            type="button"
            onClick={recorder.stop}
            aria-label="Aufnahme beenden und transkribieren"
            className={cn(
              "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-brand-600 text-white shadow-[0_4px_12px_-4px_rgb(0_80_160/0.6)] transition-[background-color,transform] duration-150 hover:bg-brand-700 active:scale-95 dark:bg-brand-500 dark:hover:bg-brand-400",
              focusRing,
            )}
          >
            <Check className="size-[18px]" strokeWidth={2.6} />
          </button>
        </Tooltip>
      )}
    </div>
  );
}

/** Scrolling bar waveform of recent input levels (newest on the right). */
function Waveform({ levels }: { levels: number[] }) {
  return (
    <div className="flex h-6 min-w-0 flex-1 items-center justify-end gap-[3px] overflow-hidden" aria-hidden>
      {levels.map((level, i) => {
        const recent = i >= levels.length - 3;
        return (
          <span
            key={i}
            className={cn(
              "w-[3px] shrink-0 rounded-full transition-[height] duration-75 ease-out",
              recent ? "bg-accent" : "bg-brand-500/80 dark:bg-brand-300/80",
            )}
            style={{ height: `${Math.max(3, Math.round(3 + level * 21))}px`, opacity: 0.35 + 0.65 * ((i + 1) / levels.length) }}
          />
        );
      })}
    </div>
  );
}
