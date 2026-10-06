"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { ArrowUp, FileText, Paperclip, RotateCw, Square, TriangleAlert, X } from "lucide-react";
import type { ChatSettings, SandboxFile, UploadedFile } from "@/lib/types";
import { cn, formatBytes, uuid } from "@/lib/utils";
import { uploadSandboxFile } from "@/lib/client/api";
import { IconButton, Kbd, Spinner, Textarea, Tooltip, focusRing } from "@/components/ui";
import { ModelPicker } from "./ModelPicker";
import { ReasoningPicker } from "./ReasoningPicker";
import { ToolToggles } from "./ToolToggles";
import { resolveModel, withModel } from "./settings";
import { useVoiceRecorder } from "./useVoiceRecorder";
import { VoiceInputButton, VoiceRecordingBar } from "./VoiceInputButton";

export type Attachment = Omit<SandboxFile, "url">;

interface UploadItem {
  localId: string;
  file: File;
  progress: number;
  status: "uploading" | "done" | "error";
  result?: UploadedFile;
  error?: string;
  abort?: () => void;
}

export interface ComposerHandle {
  focus: () => void;
  setText: (text: string) => void;
}

export interface ComposerProps {
  conversationId: string;
  busy: boolean;
  settings: ChatSettings;
  onSettingsChange: (next: ChatSettings) => void;
  onSend: (text: string, attachments: Attachment[]) => void;
  onStop: () => void;
  ref?: Ref<ComposerHandle>;
}

export function Composer({ conversationId, busy, settings, onSettingsChange, onSend, onStop, ref }: ComposerProps) {
  const [text, setText] = useState("");
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const model = resolveModel(settings.model);

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    setText: (t: string) => {
      setText(t);
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(t.length, t.length);
      });
    },
  }));

  /** Insert dictated text at the cursor (with separating spaces) and focus the textarea. */
  const insertTranscript = (transcript: string) => {
    const el = textareaRef.current;
    const start = el ? el.selectionStart : text.length;
    const end = el ? el.selectionEnd : text.length;
    const before = text.slice(0, start);
    const after = text.slice(end);
    const head = before + (before && !/\s$/.test(before) ? " " : "") + transcript;
    const next = head + (after && !/^\s/.test(after) ? " " : "") + after;
    setText(next);
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(head.length, head.length);
    });
  };
  const voice = useVoiceRecorder({ onTranscript: insertTranscript });
  const voiceActive = voice.status === "recording" || voice.status === "transcribing";

  // Autofocus on devices with a fine pointer (avoid popping the keyboard on phones).
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) textareaRef.current?.focus();
  }, []);

  const startUpload = useCallback(
    (file: File) => {
      const localId = uuid();
      const { promise, abort } = uploadSandboxFile(conversationId, file, (p) =>
        setUploads((all) => all.map((u) => (u.localId === localId ? { ...u, progress: p } : u))),
      );
      setUploads((all) => [...all, { localId, file, progress: 0, status: "uploading", abort }]);
      promise
        .then((result) =>
          setUploads((all) => all.map((u) => (u.localId === localId ? { ...u, status: "done", progress: 1, result } : u))),
        )
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setUploads((all) =>
            all.map((u) =>
              u.localId === localId
                ? { ...u, status: "error", error: err instanceof Error ? err.message : "Upload fehlgeschlagen" }
                : u,
            ),
          );
        });
    },
    [conversationId],
  );

  const addFiles = (files: FileList | File[] | null) => {
    if (!files) return;
    Array.from(files).forEach(startUpload);
  };

  const removeUpload = (localId: string) => {
    setUploads((all) => {
      all.find((u) => u.localId === localId)?.abort?.();
      return all.filter((u) => u.localId !== localId);
    });
  };

  const retryUpload = (item: UploadItem) => {
    removeUpload(item.localId);
    startUpload(item.file);
  };

  const uploading = uploads.some((u) => u.status === "uploading");
  const ready = uploads.filter((u) => u.status === "done" && u.result);
  const canSend = !busy && !uploading && (text.trim().length > 0 || ready.length > 0);

  const submit = () => {
    if (!canSend) return;
    const attachments: Attachment[] = ready.map((u) => ({ name: u.result!.name, path: u.result!.path, size: u.result!.size }));
    const body =
      text.trim() ||
      (attachments.length === 1
        ? `Ich habe die Datei „${attachments[0].name}“ hochgeladen.`
        : `Ich habe ${attachments.length} Dateien hochgeladen.`);
    onSend(body, attachments);
    setText("");
    setUploads([]);
  };

  return (
    <form
      className="mx-auto w-full max-w-chat"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div
        onDragEnter={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          dragDepth.current++;
          setDragging(true);
        }}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) e.preventDefault();
        }}
        onDragLeave={() => {
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDragging(false);
        }}
        onDrop={(e) => {
          if (!e.dataTransfer.files.length) return;
          e.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "relative rounded-[20px] border bg-surface-raised shadow-composer transition-[border-color,box-shadow] duration-200",
          "border-line focus-within:border-brand-300 focus-within:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-brand-500)_9%,transparent),var(--shadow-composer)] dark:focus-within:border-brand-700",
          dragging && "border-accent border-dashed",
        )}
      >
        {dragging && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[20px] bg-accent-soft/80 text-[13.5px] font-medium text-brand-700 backdrop-blur-[1px] dark:bg-brand-950/80 dark:text-brand-200">
            Dateien hier ablegen – sie landen im Arbeitsverzeichnis der Python-Sandbox
          </div>
        )}

        {uploads.length > 0 && (
          <ul className="flex flex-wrap gap-2 px-3 pt-3" aria-label="Anhänge">
            {uploads.map((u) => (
              <UploadChip key={u.localId} item={u} onRemove={() => removeUpload(u.localId)} onRetry={() => retryUpload(u)} />
            ))}
          </ul>
        )}

        <Textarea
          ref={textareaRef}
          bare
          value={text}
          maxHeight={260}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          onPaste={(e) => {
            if (e.clipboardData.files.length > 0) {
              e.preventDefault();
              addFiles(e.clipboardData.files);
            }
          }}
          placeholder="Frag blueChat – oder lass Python für dich rechnen …"
          aria-label="Nachricht an blueChat"
          className="min-h-[56px] px-4 pt-4 pb-1 text-[15px] leading-6"
        />

        <div className="flex items-center gap-2 px-2 pt-1 pb-2">
          {voiceActive ? (
            <VoiceRecordingBar recorder={voice} />
          ) : (
            <>
              <div className="-my-1 flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto px-0.5 py-1 [scrollbar-width:none]">
                <IconButton
                  label="Datei anhängen"
                  size="md"
                  onClick={() => fileInputRef.current?.click()}
                  className="size-8 rounded-lg"
                >
                  <Paperclip />
                </IconButton>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  hidden
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <ModelPicker value={settings.model} onChange={(id) => onSettingsChange(withModel(settings, id))} />
                <ReasoningPicker
                  model={model}
                  value={settings.reasoningEffort}
                  onChange={(effort) => onSettingsChange({ ...settings, reasoningEffort: effort })}
                />
                <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-line" />
                <ToolToggles
                  model={model}
                  value={settings.tools}
                  onChange={(tools) => onSettingsChange({ ...settings, tools })}
                />
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className="hidden items-center gap-1 font-mono text-[10.5px] text-ink-faint md:flex">
                  <Kbd>⇧</Kbd>
                  <Kbd>⏎</Kbd> Zeile
                </span>
                <VoiceInputButton recorder={voice} className="size-9 rounded-full" />
                {busy ? (
                  <Tooltip content="Antwort stoppen">
                    <button
                      type="button"
                      onClick={onStop}
                      aria-label="Antwort stoppen"
                      className={cn(
                        "group flex size-9 cursor-pointer items-center justify-center rounded-full bg-ink text-surface transition-transform hover:scale-[1.04] active:scale-95",
                        focusRing,
                      )}
                    >
                      <Square className="size-3.5 fill-current" />
                    </button>
                  </Tooltip>
                ) : (
                  <Tooltip content={uploading ? "Warte auf Upload …" : "Senden (⏎)"}>
                    <button
                      type="submit"
                      aria-label="Nachricht senden"
                      aria-disabled={!canSend || undefined}
                      className={cn(
                        "flex size-9 cursor-pointer items-center justify-center rounded-full transition-[background-color,transform,color] duration-150",
                        focusRing,
                        canSend
                          ? "bg-brand-600 text-white shadow-[0_4px_12px_-4px_rgb(0_80_160/0.6)] hover:bg-brand-700 active:scale-95 dark:bg-brand-500 dark:hover:bg-brand-400"
                          : "cursor-default bg-surface-sunken text-ink-faint",
                      )}
                    >
                      {uploading ? <Spinner className="size-4" /> : <ArrowUp className="size-[18px]" strokeWidth={2.4} />}
                    </button>
                  </Tooltip>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </form>
  );
}

function UploadChip({ item, onRemove, onRetry }: { item: UploadItem; onRemove: () => void; onRetry: () => void }) {
  const pct = Math.round(item.progress * 100);
  const ext = item.file.name.includes(".") ? item.file.name.split(".").pop()!.slice(0, 4).toUpperCase() : "DATEI";
  return (
    <li
      className={cn(
        "group flex h-12 max-w-[260px] animate-fade-up items-center gap-2.5 rounded-xl border bg-surface py-1.5 pr-1.5 pl-1.5",
        item.status === "error" ? "border-danger/40" : "border-line",
      )}
    >
      <span
        className={cn(
          "relative flex size-9 shrink-0 items-center justify-center rounded-lg font-mono text-[9px] font-semibold tracking-wide",
          item.status === "error"
            ? "bg-danger/10 text-danger"
            : "bg-brand-50 text-brand-700 dark:bg-brand-900/50 dark:text-brand-200",
        )}
      >
        {item.status === "uploading" ? (
          <>
            <span
              aria-hidden
              className="ring-progress absolute inset-0.5 rounded-full"
              style={{ ["--progress" as string]: pct }}
            />
            <span className="tabular-nums">{pct}%</span>
          </>
        ) : item.status === "error" ? (
          <TriangleAlert className="size-4" />
        ) : ext.length <= 4 ? (
          ext
        ) : (
          <FileText className="size-4" />
        )}
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-[13px] font-medium text-ink" title={item.file.name}>
          {item.file.name}
        </span>
        <span
          className={cn("block truncate font-mono text-[10.5px]", item.status === "error" ? "text-danger" : "text-ink-faint")}
        >
          {item.status === "error"
            ? item.error
            : item.status === "uploading"
              ? "Wird hochgeladen …"
              : formatBytes(item.file.size)}
        </span>
      </span>
      {item.status === "error" && (
        <IconButton label="Erneut hochladen" size="sm" onClick={onRetry}>
          <RotateCw />
        </IconButton>
      )}
      <IconButton label={item.status === "uploading" ? "Upload abbrechen" : "Anhang entfernen"} size="sm" onClick={onRemove}>
        <X />
      </IconButton>
    </li>
  );
}
