"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import type { BlueChatUIMessage } from "@/lib/types";
import { visualItemsOf } from "./collect";

const STORAGE_KEY = "bluechat:dashboard-open";
const WIDTH_KEY = "bluechat:dashboard-width";
const CHANGE_EVENT = "bluechat:dashboard-pref";
/** xl breakpoint: side-by-side panel. Below that the panel is an overlay drawer. */
const WIDE_QUERY = "(min-width: 1280px)";

export const DEFAULT_PANEL_WIDTH = 46; // % of the chat area
export const MIN_PANEL_WIDTH = 30;
export const MAX_PANEL_WIDTH = 68;

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode / blocked storage */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribePref(cb: () => void) {
  window.addEventListener(CHANGE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CHANGE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function subscribeWide(cb: () => void) {
  const mq = window.matchMedia(WIDE_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** true on xl screens (false during SSR). */
export function useIsWide(): boolean {
  return useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => false,
  );
}

/** Persisted panel width in % (side-by-side mode). */
export function usePanelWidth(): [number, (w: number) => void] {
  const raw = useSyncExternalStore(
    subscribePref,
    () => readStorage(WIDTH_KEY),
    () => null,
  );
  const parsed = raw ? Number(raw) : NaN;
  const width = Number.isFinite(parsed)
    ? Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, parsed))
    : DEFAULT_PANEL_WIDTH;
  const setWidth = useCallback((w: number) => {
    writeStorage(WIDTH_KEY, String(Math.round(Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, w)) * 10) / 10));
  }, []);
  return [width, setWidth];
}

/**
 * Open state of the "Ergebnisse" panel.
 * - explicit user choices are remembered in localStorage (applied on xl screens only)
 * - auto-opens once per assistant message when it produces its 2nd visual output while streaming,
 *   unless the user closed the panel during that message
 */
export function useDashboardPanel(messages: BlueChatUIMessage[], busy: boolean, hasOutputs: boolean) {
  const wide = useIsWide();
  const stored = useSyncExternalStore(
    subscribePref,
    () => readStorage(STORAGE_KEY),
    () => null,
  );
  /** Choice made in this session (overrides the stored preference). */
  const [sessionOpen, setSessionOpen] = useState<boolean | null>(null);
  const [autoHandled, setAutoHandled] = useState<string | null>(null);
  const [closedDuring, setClosedDuring] = useState<string | null>(null);

  const last = messages[messages.length - 1];

  // Auto-open (state adjustment during render – no effect needed).
  const autoCandidate =
    busy && last?.role === "assistant" && visualItemsOf(last).length >= 2 ? last.id : null;
  if (autoCandidate && autoCandidate !== autoHandled) {
    setAutoHandled(autoCandidate);
    if (closedDuring !== autoCandidate && wide) setSessionOpen(true);
  }

  const open = sessionOpen ?? (wide && stored === "open" && hasOutputs);

  const setOpen = useCallback(
    (next: boolean) => {
      setSessionOpen(next);
      writeStorage(STORAGE_KEY, next ? "open" : "closed");
      if (!next && busy && last) setClosedDuring(last.id);
    },
    [busy, last],
  );

  /** Open without persisting (e.g. demo start). */
  const reveal = useCallback(() => setSessionOpen(true), []);

  return { open, setOpen, reveal, wide };
}
