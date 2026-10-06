"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Ellipsis, Moon, PanelLeftClose, Pencil, Search, Settings2, SquarePen, Sun, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConversationSummary } from "@/lib/types";
import { useConversations } from "@/lib/client/conversations";
import { useShell } from "@/lib/client/shell";
import { useTheme } from "@/lib/client/theme";
import { Button, Dialog, DropdownMenu, IconButton, Kbd, useToast } from "@/components/ui";
import { useMounted } from "@/components/ui/floating";
import { Wordmark } from "./Wordmark";
import { groupConversations } from "./groupConversations";

/** IconButton overrides for the navy sidebar. */
export const sidebarIconButton =
  "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-ink aria-expanded:bg-sidebar-hover aria-expanded:text-sidebar-ink focus-visible:ring-offset-sidebar";

export function Sidebar({ variant }: { variant: "desktop" | "drawer" }) {
  const { conversations, loading, error, activeId, rename, remove, startNewChat, refresh } = useConversations();
  const { setCollapsed, setDrawerOpen, setSettingsOpen } = useShell();
  const { resolved, toggle } = useTheme();
  const { toast } = useToast();
  const mounted = useMounted();

  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ConversationSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isMac, setIsMac] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? conversations.filter((c) => c.title.toLowerCase().includes(q)) : conversations;
  }, [conversations, query]);
  const groups = useMemo(() => (mounted ? groupConversations(filtered) : []), [filtered, mounted]);

  const closeDrawer = () => variant === "drawer" && setDrawerOpen(false);

  const onNewChat = () => {
    closeDrawer();
    startNewChat();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const wasActive = deleteTarget.id === activeId;
    try {
      await remove(deleteTarget.id);
      setDeleteTarget(null);
      toast({ title: "Chat gelöscht", tone: "success" });
      if (wasActive) startNewChat();
    } catch (e) {
      toast({ title: "Löschen fehlgeschlagen", description: e instanceof Error ? e.message : undefined, tone: "danger" });
    } finally {
      setDeleting(false);
    }
  };

  const showSkeleton = !mounted || (loading && conversations.length === 0);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-sidebar text-sidebar-ink">
      {/* blueprint grid, fading towards the bottom */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-blueprint [mask-image:linear-gradient(to_bottom,#000,transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-16 size-72 rounded-full bg-brand-500/20 blur-3xl"
      />

      {/* Header */}
      <div className="relative flex h-14 shrink-0 items-center justify-between pr-2 pl-4">
        <Link
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onNewChat();
          }}
          className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
          aria-label="blueChat – neuer Chat"
        >
          <Wordmark className="text-white" />
        </Link>
        {variant === "desktop" ? (
          <IconButton label="Seitenleiste einklappen" tooltipSide="right" onClick={() => setCollapsed(true)} className={sidebarIconButton}>
            <PanelLeftClose />
          </IconButton>
        ) : (
          <IconButton label="Menü schließen" data-drawer-close onClick={() => setDrawerOpen(false)} className={sidebarIconButton}>
            <X />
          </IconButton>
        )}
      </div>

      {/* New chat + search */}
      <div className="relative space-y-2 px-3 pt-1">
        <button
          type="button"
          onClick={onNewChat}
          className="group flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-[10px] border border-white/10 bg-white/[0.045] px-3 text-[13.5px] font-medium text-sidebar-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.05)] transition-colors hover:border-white/20 hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:outline-none"
        >
          <SquarePen className="size-4 text-accent" />
          Neuer Chat
          <span className="ml-auto flex items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
            {[isMac ? "⌘" : "Strg", "⇧", "O"].map((k) => (
              <Kbd key={k} className="border-white/15 bg-white/5 text-sidebar-muted">
                {k}
              </Kbd>
            ))}
          </span>
        </button>
        <label className="relative block">
          <span className="sr-only">Chats durchsuchen</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-sidebar-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setQuery("")}
            placeholder="Chats durchsuchen"
            className="h-9 w-full rounded-[10px] border border-transparent bg-transparent pr-3 pl-8 text-[13px] text-sidebar-ink placeholder:text-sidebar-muted/80 transition-colors outline-none hover:bg-white/[0.04] focus:border-white/15 focus:bg-white/[0.06] [&::-webkit-search-cancel-button]:hidden"
          />
        </label>
      </div>

      {/* Conversation list */}
      <nav aria-label="Chatverlauf" className="scrollbar-thin relative mt-2 min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {showSkeleton ? (
          <div className="space-y-1.5 px-2 pt-5" aria-hidden>
            <div className="mb-3 h-2 w-14 rounded bg-white/10" />
            {[72, 58, 84, 64, 46, 76].map((w, i) => (
              <div key={i} className="h-7 animate-pulse rounded-md bg-white/[0.05]" style={{ width: `${w}%`, animationDelay: `${i * 90}ms` }} />
            ))}
          </div>
        ) : error && conversations.length === 0 ? (
          <div className="mx-2 mt-5 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-[12.5px] text-sidebar-muted">
            <p>Chats konnten nicht geladen werden.</p>
            <button type="button" onClick={() => void refresh()} className="mt-2 cursor-pointer font-medium text-accent hover:underline">
              Erneut versuchen
            </button>
          </div>
        ) : groups.length === 0 ? (
          <p className="px-3 pt-6 text-[12.5px] leading-relaxed text-sidebar-muted">
            {query ? (
              <>Keine Treffer für „{query}“.</>
            ) : (
              <>
                Noch keine Chats.
                <br />
                Deine Unterhaltungen erscheinen hier.
              </>
            )}
          </p>
        ) : (
          groups.map((group) => (
            <section key={group.key} aria-labelledby={`grp-${variant}-${group.key}`} className="pt-4 first:pt-3">
              <h2
                id={`grp-${variant}-${group.key}`}
                className="flex items-center gap-2 px-2.5 pb-1.5 font-mono text-[10px] font-medium tracking-[0.14em] text-sidebar-muted uppercase"
              >
                {group.label}
                <span aria-hidden className="h-px flex-1 bg-white/[0.07]" />
                <span aria-hidden className="tabular-nums opacity-70">
                  {String(group.items.length).padStart(2, "0")}
                </span>
              </h2>
              <ul className="space-y-px">
                {group.items.map((c) => (
                  <ConversationItem
                    key={c.id}
                    conversation={c}
                    active={c.id === activeId}
                    editing={editingId === c.id}
                    onNavigate={closeDrawer}
                    onStartRename={() => setEditingId(c.id)}
                    onFinishRename={async (title) => {
                      setEditingId(null);
                      if (title.trim() && title.trim() !== c.title) {
                        try {
                          await rename(c.id, title);
                        } catch (e) {
                          toast({
                            title: "Umbenennen fehlgeschlagen",
                            description: e instanceof Error ? e.message : undefined,
                            tone: "danger",
                          });
                        }
                      }
                    }}
                    onCancelRename={() => setEditingId(null)}
                    onDelete={() => setDeleteTarget(c)}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
      </nav>

      {/* Footer */}
      <div className="relative flex shrink-0 items-center gap-2.5 border-t border-white/[0.07] px-3 py-3">
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-brand-400 to-brand-700 font-display text-[17px] text-white italic ring-1 ring-white/20"
        >
          M
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[13.5px] font-medium">Marios</p>
          <p className="truncate font-mono text-[10.5px] text-sidebar-muted">Persönlicher Bereich</p>
        </div>
        <IconButton
          label={resolved === "dark" ? "Helles Design" : "Dunkles Design"}
          onClick={toggle}
          className={sidebarIconButton}
        >
          {resolved === "dark" ? <Sun /> : <Moon />}
        </IconButton>
        <IconButton
          label="Einstellungen"
          onClick={() => {
            closeDrawer();
            setSettingsOpen(true);
          }}
          className={sidebarIconButton}
        >
          <Settings2 />
        </IconButton>
      </div>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && !deleting && setDeleteTarget(null)}
        title="Chat löschen?"
        size="sm"
        description={
          <>
            „{deleteTarget?.title}“ wird dauerhaft gelöscht – inklusive aller Nachrichten und der Dateien im Python-Kernel. Das
            lässt sich nicht rückgängig machen.
          </>
        }
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)} disabled={deleting} data-autofocus>
              Abbrechen
            </Button>
            <Button variant="danger" size="sm" onClick={confirmDelete} loading={deleting}>
              <Trash2 />
              Löschen
            </Button>
          </>
        }
      />
    </div>
  );
}

function ConversationItem({
  conversation,
  active,
  editing,
  onNavigate,
  onStartRename,
  onFinishRename,
  onCancelRename,
  onDelete,
}: {
  conversation: ConversationSummary;
  active: boolean;
  editing: boolean;
  onNavigate: () => void;
  onStartRename: () => void;
  onFinishRename: (title: string) => void;
  onCancelRename: () => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(conversation.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const done = useRef(false);

  useEffect(() => {
    if (!editing) return;
    done.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(conversation.title);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [editing, conversation.title]);

  if (editing) {
    return (
      <li className="relative">
        <input
          ref={inputRef}
          value={draft}
          aria-label="Neuer Titel"
          maxLength={120}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              done.current = true;
              onFinishRename(draft);
            } else if (e.key === "Escape") {
              e.preventDefault();
              done.current = true;
              onCancelRename();
            }
          }}
          onBlur={() => {
            if (!done.current) onFinishRename(draft);
          }}
          className="h-9 w-full rounded-lg border border-accent/60 bg-white/[0.07] px-3 text-[13.5px] text-white ring-3 ring-accent/15 outline-none"
        />
      </li>
    );
  }

  return (
    <li className="group/item relative">
      <Link
        href={`/c/${conversation.id}`}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        title={conversation.title}
        className={cn(
          "relative flex h-9 items-center rounded-lg pr-9 pl-3 text-[13.5px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent/70",
          active
            ? "bg-sidebar-active text-white before:absolute before:top-2 before:bottom-2 before:left-0 before:w-[2px] before:rounded-full before:bg-accent"
            : "text-sidebar-ink/80 hover:bg-sidebar-hover hover:text-sidebar-ink",
        )}
      >
        <span className="truncate">{conversation.title || "Neuer Chat"}</span>
      </Link>
      <div
        className={cn(
          "absolute top-1/2 right-1 -translate-y-1/2 transition-opacity",
          "opacity-0 group-hover/item:opacity-100 focus-within:opacity-100 has-[[aria-expanded=true]]:opacity-100",
          active && "opacity-100",
          "max-lg:opacity-100",
        )}
      >
        <DropdownMenu
          align="start"
          width={190}
          label="Chat-Aktionen"
          trigger={
            <IconButton label="Chat-Aktionen" size="sm" showTooltip={false} className={sidebarIconButton}>
              <Ellipsis />
            </IconButton>
          }
          items={[
            { key: "rename", label: "Umbenennen", icon: <Pencil />, onSelect: onStartRename },
            { type: "separator" },
            { key: "delete", label: "Löschen", icon: <Trash2 />, danger: true, onSelect: onDelete },
          ]}
        />
      </div>
    </li>
  );
}
