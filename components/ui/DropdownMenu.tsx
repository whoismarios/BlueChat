"use client";

import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFloating, useMounted, type Align } from "./floating";

export interface DropdownMenuItem {
  type?: "item";
  key?: string;
  label: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  /** When defined on any item, a check column is shown and items act as radio items. */
  checked?: boolean;
  disabled?: boolean;
  danger?: boolean;
  /** Right-aligned meta (e.g. a Badge or Kbd). */
  hint?: ReactNode;
  onSelect?: () => void;
}

export type DropdownMenuEntry =
  | DropdownMenuItem
  | { type: "separator"; key?: string }
  | { type: "label"; label: ReactNode; key?: string };

export interface DropdownMenuProps {
  /** A single button element. Receives aria-haspopup / aria-expanded. */
  trigger: ReactElement;
  items: DropdownMenuEntry[];
  align?: Align;
  side?: "top" | "bottom";
  /** Min width of the menu panel in px (default 220). */
  width?: number;
  /** Optional content rendered above the items (e.g. a heading). */
  header?: ReactNode;
  /** aria-label of the menu. */
  label?: string;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** Anchor wrapper + portal panel shared by DropdownMenu and Popover. */
function useDisclosure(controlled: boolean | undefined, onChange?: (open: boolean) => void) {
  const [inner, setInner] = useState(false);
  const open = controlled ?? inner;
  const setOpen = useCallback(
    (next: boolean) => {
      if (controlled === undefined) setInner(next);
      onChange?.(next);
    },
    [controlled, onChange],
  );
  return [open, setOpen] as const;
}

function useDismiss(
  open: boolean,
  close: () => void,
  anchorRef: React.RefObject<HTMLElement | null>,
  panelRef: React.RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      close();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open, close, anchorRef, panelRef]);
}

function focusTrigger(wrapper: HTMLElement | null) {
  wrapper?.querySelector<HTMLElement>("button, [tabindex], a[href]")?.focus();
}

export function DropdownMenu({
  trigger,
  items,
  align = "start",
  side = "bottom",
  width = 220,
  header,
  label,
  className,
  open: controlledOpen,
  onOpenChange,
}: DropdownMenuProps) {
  const [open, setOpen] = useDisclosure(controlledOpen, onOpenChange);
  const mounted = useMounted();
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const initialFocus = useRef<"first" | "last" | "panel">("panel");
  const menuId = useId();
  const { pos } = useFloating(open, wrapperRef, panelRef, side, align);


  const close = useCallback(() => setOpen(false), [setOpen]);
  useDismiss(open, close, wrapperRef, panelRef);

  const getItems = () =>
    Array.from(panelRef.current?.querySelectorAll<HTMLElement>('[data-menu-item]:not([aria-disabled="true"])') ?? []);

  useEffect(() => {
    if (!open || !pos) return;
    const list = getItems();
    if (initialFocus.current === "first") list[0]?.focus();
    else if (initialFocus.current === "last") list[list.length - 1]?.focus();
    else {
      const checked = panelRef.current?.querySelector<HTMLElement>('[data-menu-item][aria-checked="true"]');
      (checked ?? panelRef.current)?.focus();
    }
    // only on open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pos !== null]);

  const onPanelKeyDown = (e: ReactKeyboardEvent) => {
    const list = getItems();
    const idx = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      list[(idx + 1) % list.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      list[(idx - 1 + list.length) % list.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      list[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      list[list.length - 1]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
      focusTrigger(wrapperRef.current);
    } else if (e.key === "Tab") {
      close();
    } else if (e.key.length === 1 && /\S/.test(e.key)) {
      const ch = e.key.toLowerCase();
      const start = idx + 1;
      const ordered = [...list.slice(start), ...list.slice(0, start)];
      ordered.find((el) => el.textContent?.trim().toLowerCase().startsWith(ch))?.focus();
    }
  };

  const hasChecks = items.some((i) => (i.type === undefined || i.type === "item") && (i as DropdownMenuItem).checked !== undefined);

  const select = (item: DropdownMenuItem) => {
    if (item.disabled) return;
    close();
    focusTrigger(wrapperRef.current);
    item.onSelect?.();
  };

  const triggerEl = isValidElement(trigger)
    ? cloneElement(trigger as ReactElement<Record<string, unknown>>, {
        "aria-haspopup": "menu",
        "aria-expanded": open,
        "aria-controls": open ? menuId : undefined,
      })
    : trigger;

  return (
    <span
      ref={wrapperRef}
      className="inline-flex"
      onClick={(e) => {
        if (panelRef.current?.contains(e.target as Node)) return;
        initialFocus.current = e.detail === 0 ? "first" : "panel";
        setOpen(!open);
      }}
      onKeyDown={(e) => {
        if (open || (e.key !== "ArrowDown" && e.key !== "ArrowUp")) return;
        e.preventDefault();
        initialFocus.current = e.key === "ArrowDown" ? "first" : "last";
        setOpen(true);
      }}
    >
      {triggerEl}
      {mounted &&
        open &&
        createPortal(
          <div
            ref={panelRef}
            id={menuId}
            role="menu"
            aria-label={label}
            tabIndex={-1}
            onKeyDown={onPanelKeyDown}
            style={{ position: "fixed", top: pos?.top ?? -9999, left: pos?.left ?? -9999, minWidth: width }}
            className={cn(
              "scrollbar-thin z-[95] max-h-[min(70dvh,480px)] max-w-[min(92vw,360px)] overflow-y-auto rounded-xl border border-line bg-surface-raised p-1.5 text-ink shadow-float outline-none",
              pos ? (pos.side === "top" ? "animate-[menu-in-up_140ms_ease-out]" : "animate-[menu-in_140ms_ease-out]") : "opacity-0",
              className,
            )}
          >
            {header}
            {items.map((entry, i) => {
              if (entry.type === "separator") return <div key={entry.key ?? `sep-${i}`} role="separator" className="mx-1 my-1.5 h-px bg-line" />;
              if (entry.type === "label")
                return (
                  <div
                    key={entry.key ?? `label-${i}`}
                    className="px-2.5 pt-2 pb-1 font-mono text-[10px] font-medium tracking-[0.12em] text-ink-faint uppercase"
                  >
                    {entry.label}
                  </div>
                );
              const item = entry as DropdownMenuItem;
              return (
                <div
                  key={item.key ?? `item-${i}`}
                  data-menu-item
                  role={item.checked !== undefined ? "menuitemradio" : "menuitem"}
                  aria-checked={item.checked !== undefined ? item.checked : undefined}
                  aria-disabled={item.disabled || undefined}
                  tabIndex={-1}
                  onClick={() => select(item)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      select(item);
                    }
                  }}
                  onPointerMove={(e) => {
                    if (!item.disabled && document.activeElement !== e.currentTarget) e.currentTarget.focus();
                  }}
                  className={cn(
                    "group/item flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] outline-none select-none",
                    "focus:bg-surface-sunken",
                    item.danger ? "text-danger focus:bg-danger/10" : "text-ink",
                    item.disabled && "cursor-not-allowed opacity-45",
                  )}
                >
                  {item.icon && (
                    <span
                      className={cn(
                        "mt-px flex size-[18px] shrink-0 items-center justify-center [&_svg]:size-[16px]",
                        item.danger ? "text-danger" : "text-ink-muted group-focus/item:text-ink",
                      )}
                    >
                      {item.icon}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block leading-[18px] font-medium">{item.label}</span>
                    {item.description && (
                      <span className="mt-0.5 block text-[12px] leading-snug text-ink-muted">{item.description}</span>
                    )}
                  </span>
                  {item.hint && <span className="mt-px shrink-0">{item.hint}</span>}
                  {hasChecks && (
                    <span className="mt-px flex size-[18px] shrink-0 items-center justify-center text-brand-600 dark:text-brand-300">
                      {item.checked && <Check className="size-4" strokeWidth={2.5} />}
                    </span>
                  )}
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Popover                                                              */
/* ------------------------------------------------------------------ */

export interface PopoverProps {
  trigger: ReactElement;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: Align;
  side?: "top" | "bottom";
  width?: number;
  label?: string;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** Anchored, non-modal panel with arbitrary content. Esc / outside click closes. */
export function Popover({
  trigger,
  children,
  align = "start",
  side = "bottom",
  width = 280,
  label,
  className,
  open: controlledOpen,
  onOpenChange,
}: PopoverProps) {
  const [open, setOpen] = useDisclosure(controlledOpen, onOpenChange);
  const mounted = useMounted();
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const { pos } = useFloating(open, wrapperRef, panelRef, side, align);
  const close = useCallback(() => setOpen(false), [setOpen]);
  useDismiss(open, close, wrapperRef, panelRef);

  useEffect(() => {
    if (open && pos) panelRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pos !== null]);

  const triggerEl = isValidElement(trigger)
    ? cloneElement(trigger as ReactElement<Record<string, unknown>>, {
        "aria-haspopup": "dialog",
        "aria-expanded": open,
        "aria-controls": open ? id : undefined,
      })
    : trigger;

  return (
    <span
      ref={wrapperRef}
      className="inline-flex"
      onClick={(e) => {
        if (panelRef.current?.contains(e.target as Node)) return;
        setOpen(!open);
      }}
    >
      {triggerEl}
      {mounted &&
        open &&
        createPortal(
          <div
            ref={panelRef}
            id={id}
            role="dialog"
            aria-label={label}
            tabIndex={-1}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                close();
                focusTrigger(wrapperRef.current);
              }
            }}
            style={{ position: "fixed", top: pos?.top ?? -9999, left: pos?.left ?? -9999, width }}
            className={cn(
              "z-[95] max-w-[92vw] rounded-xl border border-line bg-surface-raised p-3 text-ink shadow-float outline-none",
              pos ? "animate-[menu-in_140ms_ease-out]" : "opacity-0",
              className,
            )}
          >
            {typeof children === "function" ? children(close) : children}
          </div>,
          document.body,
        )}
    </span>
  );
}
