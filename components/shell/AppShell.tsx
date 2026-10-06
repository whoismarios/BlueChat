"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ConversationsProvider, useConversations } from "@/lib/client/conversations";
import { ShellProvider, useShell } from "@/lib/client/shell";
import { ToastProvider } from "@/components/ui";
import { Sidebar } from "./Sidebar";
import { SettingsDialog } from "./SettingsDialog";
import { HealthBanner } from "./HealthBanner";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ShellProvider>
        <ConversationsProvider initialConversations={null}>
          <ShellLayout>{children}</ShellLayout>
          <SettingsDialog />
        </ConversationsProvider>
      </ShellProvider>
    </ToastProvider>
  );
}

function ShellLayout({ children }: { children: ReactNode }) {
  const { collapsed, drawerOpen, setDrawerOpen } = useShell();
  const { startNewChat } = useConversations();
  const pathname = usePathname();
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname, setDrawerOpen]);

  // Global shortcut: ⌘/Strg + ⇧ + O → new chat
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        startNewChat();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [startNewChat]);

  // Drawer: Esc closes, focus moves into it.
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => drawerRef.current?.querySelector<HTMLElement>("[data-drawer-close]")?.focus());
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [drawerOpen, setDrawerOpen]);

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      {/* Desktop sidebar */}
      <aside
        aria-label="Seitenleiste"
        inert={collapsed}
        className={cn(
          "hidden shrink-0 overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.2,0.7,0.2,1)] lg:block",
          collapsed ? "w-0" : "w-[280px]",
        )}
      >
        <div className="h-full w-[280px]">
          <Sidebar variant="desktop" />
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <div
            aria-hidden
            className="absolute inset-0 animate-[overlay-in_180ms_ease-out] bg-brand-950/50 backdrop-blur-[2px]"
            onClick={() => setDrawerOpen(false)}
          />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Seitenleiste"
            className="absolute inset-y-0 left-0 w-[min(86vw,300px)] animate-[drawer-in_260ms_cubic-bezier(0.2,0.7,0.2,1)] shadow-2xl"
          >
            <Sidebar variant="drawer" />
          </div>
        </div>
      )}

      <main className="relative flex min-w-0 flex-1 flex-col bg-surface">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-grain" />
        <HealthBanner />
        <div className="relative min-h-0 flex-1">{children}</div>
      </main>
    </div>
  );
}
