"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { transcribeAudio } from "@/lib/client/api";
import { useToast } from "@/components/ui";
import { useMounted } from "@/components/ui/floating";

export type VoiceStatus = "idle" | "requesting" | "recording" | "transcribing";

export interface VoiceRecorder {
  /** MediaRecorder + getUserMedia available (false during SSR / before hydration). */
  supported: boolean;
  status: VoiceStatus;
  elapsedMs: number;
  maxDurationMs: number;
  /** Rolling history of input levels (0..1), newest last. */
  levels: number[];
  start: () => void;
  /** Stop recording and transcribe. */
  stop: () => void;
  /** Discard the recording (or abort a running transcription). */
  cancel: () => void;
}

export interface UseVoiceRecorderOptions {
  onTranscript: (text: string) => void;
  maxDurationMs?: number;
  /** Number of level bars kept in `levels`. */
  barCount?: number;
}

const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
const MIN_DURATION_MS = 600;

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return undefined;
  return MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t));
}

function isSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof window.MediaRecorder !== "undefined"
  );
}

function describeMicError(err: unknown): { title: string; description?: string } {
  const name = err instanceof DOMException ? err.name : (err as { name?: string })?.name;
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return {
        title: "Kein Zugriff aufs Mikrofon",
        description: "Bitte erlaube den Mikrofonzugriff für diese Seite in den Browser-Einstellungen.",
      };
    case "NotFoundError":
    case "OverconstrainedError":
      return { title: "Kein Mikrofon gefunden", description: "Schließe ein Mikrofon an und versuche es erneut." };
    case "NotReadableError":
    case "AbortError":
      return {
        title: "Mikrofon ist nicht verfügbar",
        description: "Es wird eventuell gerade von einer anderen Anwendung verwendet.",
      };
    default:
      return { title: "Aufnahme konnte nicht gestartet werden", description: err instanceof Error ? err.message : undefined };
  }
}

/**
 * Records audio from the microphone (MediaRecorder, webm/opus or mp4 on Safari), exposes a live
 * level history for a waveform and transcribes the result via POST /api/transcribe.
 */
export function useVoiceRecorder({
  onTranscript,
  maxDurationMs = 120_000,
  barCount = 28,
}: UseVoiceRecorderOptions): VoiceRecorder {
  const { toast } = useToast();
  // Feature detection only after hydration (server render + first client render: false).
  const mounted = useMounted();
  const supported = mounted && isSupported();
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array(barCount).fill(0));

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const discardRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  const stopRef = useRef<() => void>(() => {});

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const teardown = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }, []);

  const transcribe = useCallback(
    async (blob: Blob) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setStatus("transcribing");
      try {
        const text = await transcribeAudio(blob, controller.signal);
        if (controller.signal.aborted) return;
        if (text.trim()) onTranscriptRef.current(text.trim());
        else
          toast({
            title: "Keine Sprache erkannt",
            description: "Bitte sprich etwas lauter oder näher am Mikrofon.",
            tone: "info",
          });
      } catch (err) {
        if (controller.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) return;
        toast({
          title: "Transkription fehlgeschlagen",
          description: err instanceof Error ? err.message : undefined,
          tone: "danger",
          duration: 6000,
        });
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setStatus("idle");
      }
    },
    [toast],
  );

  const start = useCallback(async () => {
    if (status !== "idle" || !isSupported()) return;
    setStatus("requesting");
    discardRef.current = false;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (err) {
      setStatus("idle");
      toast({ ...describeMicError(err), tone: "danger", duration: 6000 });
      return;
    }
    streamRef.current = stream;

    let recorder: MediaRecorder;
    try {
      const mimeType = pickMimeType();
      recorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 64_000 } : undefined);
    } catch (err) {
      teardown();
      setStatus("idle");
      toast({ ...describeMicError(err), tone: "danger" });
      return;
    }
    recorderRef.current = recorder;
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const duration = Date.now() - startedAtRef.current;
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      chunksRef.current = [];
      recorderRef.current = null;
      teardown();
      if (discardRef.current) {
        setStatus("idle");
        return;
      }
      if (duration < MIN_DURATION_MS || blob.size === 0) {
        setStatus("idle");
        toast({
          title: "Aufnahme zu kurz",
          description: "Halte die Aufnahme etwas länger und sprich deine Frage ein.",
          tone: "info",
        });
        return;
      }
      void transcribe(blob);
    };

    // Live level meter
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.6;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);
      let last = 0;
      const loop = (t: number) => {
        rafRef.current = requestAnimationFrame(loop);
        if (t - last < 70) return;
        last = t;
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        const level = Math.min(1, Math.sqrt(rms * 5));
        setLevels((prev) => [...prev.slice(1), level]);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch {
      /* level meter is optional */
    }

    startedAtRef.current = Date.now();
    setElapsedMs(0);
    setLevels(Array(barCount).fill(0));
    tickRef.current = setInterval(() => {
      const ms = Date.now() - startedAtRef.current;
      setElapsedMs(ms);
      if (ms >= maxDurationMs) {
        toast({ title: "Maximale Aufnahmedauer erreicht", description: "Die Aufnahme wird jetzt transkribiert.", tone: "info" });
        stopRef.current();
      }
    }, 200);
    recorder.start(250);
    setStatus("recording");
  }, [status, toast, teardown, transcribe, maxDurationMs, barCount]);

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      discardRef.current = false;
      rec.stop();
    }
  }, []);

  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      discardRef.current = true;
      rec.stop();
    } else {
      teardown();
      setStatus("idle");
    }
  }, [teardown]);

  // Esc cancels a running recording.
  useEffect(() => {
    if (status !== "recording") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        cancel();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [status, cancel]);

  // Release the microphone on unmount.
  useEffect(
    () => () => {
      discardRef.current = true;
      abortRef.current?.abort();
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") rec.stop();
      teardown();
    },
    [teardown],
  );

  return { supported, status, elapsedMs, maxDurationMs, levels, start: () => void start(), stop, cancel };
}
