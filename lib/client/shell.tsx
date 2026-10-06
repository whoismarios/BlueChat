"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

interface ShellContextValue {
  /** Mobile off-canvas drawer */
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  /** Desktop sidebar collapsed */
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  /** Opens the drawer on mobile, expands the sidebar on desktop. */
  showSidebar: () => void;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
}

const ShellContext = createContext<ShellContextValue | null>(null);
const COLLAPSE_KEY = "bluechat-sidebar-collapsed";

export function ShellProvider({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsedState] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsedState(true);
    } catch {
      /* ignore */
    }
  }, []);

  const setCollapsed = useCallback((c: boolean) => {
    setCollapsedState(c);
    try {
      localStorage.setItem(COLLAPSE_KEY, c ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const showSidebar = useCallback(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) setCollapsed(false);
    else setDrawerOpen(true);
  }, [setCollapsed]);

  const value = useMemo(
    () => ({ drawerOpen, setDrawerOpen, collapsed, setCollapsed, showSidebar, settingsOpen, setSettingsOpen }),
    [drawerOpen, collapsed, setCollapsed, showSidebar, settingsOpen],
  );
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell() {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell must be used inside <ShellProvider>");
  return ctx;
}
