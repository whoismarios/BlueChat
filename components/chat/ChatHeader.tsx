"use client";

import { useState } from "react";
import { Ellipsis, LayoutDashboard, NotebookPen, RotateCcw, Trash2 } from "lucide-react";
import type { ModelInfo } from "@/lib/types";
import { cn } from "@/lib/utils";
import { resetSandbox } from "@/lib/client/api";
import { useConversations } from "@/lib/client/conversations";
import { Badge, Button, Dialog, DropdownMenu, IconButton, useToast } from "@/components/ui";
import { SidebarToggle } from "@/components/shell/SidebarToggle";
import { triggerDownload } from "@/components/messages/csv";

export function ChatHeader({
  conversationId,
  title,
  model,
  persisted,
  hasMessages,
  busy,
  dashboard,
}: {
  conversationId: string;
  title: string;
  model: ModelInfo;
  persisted: boolean;
  hasMessages: boolean;
  busy: boolean;
  /** Toggle for the "Dashboard" results panel */
  dashboard?: { open: boolean; count: number; onToggle: () => void };
}) {
  const { remove, startNewChat } = useConversations();
  const { toast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [resetting, setResetting] = useState(false);

  const doReset = async () => {
    setResetting(true);
    try {
      await resetSandbox(conversationId);
      toast({ title: "Python-Kernel zurückgesetzt", description: "Alle Variablen und Importe wurden verworfen.", tone: "success" });
    } catch (e) {
      toast({ title: "Zurücksetzen fehlgeschlagen", description: e instanceof Error ? e.message : undefined, tone: "danger" });
    } finally {
      setResetting(false);
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await remove(conversationId);
      setConfirmDelete(false);
      toast({ title: "Chat gelöscht", tone: "success" });
      startNewChat();
    } catch (e) {
      toast({ title: "Löschen fehlgeschlagen", description: e instanceof Error ? e.message : undefined, tone: "danger" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <header
      className={cn(
        "relative z-10 flex h-14 shrink-0 items-center gap-2 px-2 transition-colors sm:px-4",
        hasMessages ? "border-b border-line bg-surface/80 backdrop-blur-md" : "border-b border-transparent",
      )}
    >
      <SidebarToggle />
      <div className="flex min-w-0 flex-1 items-center gap-2.5 pl-1">
        <h1 className={cn("truncate text-[14.5px] font-medium", hasMessages ? "text-ink" : "text-ink-muted")}>{title}</h1>
        <Badge tone="brand" className="hidden sm:inline-flex" title={model.description}>
          {model.label}
        </Badge>
        {busy && (
          <span className="flex items-center gap-1" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-1 animate-pulse-dot rounded-full bg-accent" style={{ animationDelay: `${i * 160}ms` }} />
            ))}
          </span>
        )}
      </div>
      {dashboard && (
        <span className="relative">
          <IconButton
            label={dashboard.open ? "Dashboard ausblenden" : "Dashboard anzeigen"}
            tooltipSide="bottom"
            aria-pressed={dashboard.open}
            onClick={dashboard.onToggle}
            className={cn(dashboard.open && "bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-900/50 dark:text-brand-200")}
          >
            <LayoutDashboard />
          </IconButton>
          {dashboard.count > 0 && (
            <span
              aria-hidden
              className="pointer-events-none absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 font-mono text-[9.5px] font-semibold tabular-nums leading-none text-white ring-2 ring-surface dark:bg-brand-400 dark:text-brand-950"
            >
              {dashboard.count > 99 ? "99+" : dashboard.count}
            </span>
          )}
        </span>
      )}
      <DropdownMenu
        align="end"
        width={240}
        label="Chat-Optionen"
        trigger={
          <IconButton label="Chat-Optionen" tooltipSide="bottom" disabled={resetting}>
            <Ellipsis />
          </IconButton>
        }
        items={[
          {
            key: "reset",
            label: "Kernel zurücksetzen",
            description: "Startet die Python-Sitzung neu. Variablen gehen verloren.",
            icon: <RotateCcw />,
            onSelect: () => void doReset(),
          },
          {
            key: "notebook",
            label: "Als Jupyter-Notebook exportieren",
            description: "Code, Ausgaben und Text als .ipynb",
            icon: <NotebookPen />,
            disabled: !persisted || !hasMessages,
            onSelect: () => triggerDownload(`/api/conversations/${conversationId}/notebook`),
          },
          { type: "separator" },
          {
            key: "delete",
            label: "Chat löschen",
            icon: <Trash2 />,
            danger: true,
            disabled: !persisted,
            onSelect: () => setConfirmDelete(true),
          },
        ]}
      />

      <Dialog
        open={confirmDelete}
        onOpenChange={(o) => !deleting && setConfirmDelete(o)}
        title="Chat löschen?"
        size="sm"
        description={
          <>
            „{title}“ wird dauerhaft gelöscht – inklusive aller Nachrichten und der Dateien im Python-Kernel. Das lässt sich nicht
            rückgängig machen.
          </>
        }
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)} disabled={deleting} data-autofocus>
              Abbrechen
            </Button>
            <Button variant="danger" size="sm" onClick={doDelete} loading={deleting}>
              <Trash2 />
              Löschen
            </Button>
          </>
        }
      />
    </header>
  );
}
