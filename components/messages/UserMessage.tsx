"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Pencil } from "lucide-react";
import type { BlueChatUIMessage } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { FileChip } from "./FileChip";
import { copyToClipboard, messageText } from "./utils";

interface UserMessageProps {
  message: BlueChatUIMessage;
  onEdit?: (messageId: string, text: string) => void;
  /** Disable editing while a response is streaming */
  busy?: boolean;
}

export function UserMessage({ message, onEdit, busy }: UserMessageProps) {
  const text = messageText(message);
  const attachments = message.metadata?.attachments ?? [];
  const imageParts = message.parts.filter(
    (p): p is Extract<typeof p, { type: "file" }> => p.type === "file" && p.mediaType.startsWith("image"),
  );
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (await copyToClipboard(text)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  }

  return (
    <div className="group/msg flex flex-col items-end animate-fade-up">
      {attachments.length > 0 && (
        <div className="mb-2 flex max-w-[88%] sm:max-w-[75%] flex-wrap justify-end gap-2">
          {attachments.map((a) => (
            <FileChip key={a.path} name={a.name} size={a.size} hint={a.path} variant="attachment" />
          ))}
        </div>
      )}
      {imageParts.length > 0 && (
        <div className="mb-2 flex max-w-[88%] sm:max-w-[75%] flex-wrap justify-end gap-2">
          {imageParts.map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={p.url}
              alt={p.filename ?? `Bild ${i + 1}`}
              className="max-h-48 rounded-xl border border-line object-cover"
            />
          ))}
        </div>
      )}

      {editing ? (
        <EditBox
          initial={text}
          onCancel={() => setEditing(false)}
          onSave={(value) => {
            setEditing(false);
            if (value.trim() && value !== text) onEdit?.(message.id, value);
          }}
        />
      ) : (
        text && (
          <div className="max-w-[88%] sm:max-w-[75%] whitespace-pre-wrap break-words rounded-[18px] rounded-br-md border border-brand-100 bg-brand-50 px-4 py-2.5 text-[15px] leading-relaxed text-ink dark:border-brand-800/70 dark:bg-brand-900/45">
            {text}
          </div>
        )
      )}

      {!editing && text && (
        <div className="mt-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/msg:opacity-100 focus-within:opacity-100">
          <IconButton label={copied ? "Kopiert" : "Nachricht kopieren"} size="sm" onClick={copy}>
            {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
          </IconButton>
          {onEdit && (
            <IconButton label="Nachricht bearbeiten" size="sm" onClick={() => setEditing(true)} disabled={busy}>
              <Pencil className="size-3.5" />
            </IconButton>
          )}
        </div>
      )}
    </div>
  );
}

function EditBox({ initial, onCancel, onSave }: { initial: string; onCancel: () => void; onSave: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 360)}px`;
  }, [value]);

  return (
    <div className="w-full max-w-[88%] sm:max-w-[75%] rounded-[18px] border border-brand-200 bg-surface-raised p-2 shadow-float dark:border-brand-700">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            onSave(value);
          }
        }}
        aria-label="Nachricht bearbeiten"
        rows={1}
        className="scrollbar-thin block w-full resize-none bg-transparent px-2 py-1.5 text-[15px] leading-relaxed text-ink outline-none"
      />
      <div className="mt-1 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Abbrechen
        </Button>
        <Button variant="primary" size="sm" onClick={() => onSave(value)} disabled={!value.trim()}>
          Senden
        </Button>
      </div>
    </div>
  );
}
