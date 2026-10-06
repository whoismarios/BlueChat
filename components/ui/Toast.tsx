"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastTone = "info" | "success" | "danger";

interface ToastItem {
  id: number;
  title: ReactNode;
  description?: ReactNode;
  tone: ToastTone;
}

interface ToastContextValue {
  toast: (t: { title: ReactNode; description?: ReactNode; tone?: ToastTone; duration?: number }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** Lightweight toast notifications (bottom-right on desktop, top on mobile). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => setItems((all) => all.filter((t) => t.id !== id)), []);

  const toast = useCallback<ToastContextValue["toast"]>(
    ({ title, description, tone = "info", duration = 3800 }) => {
      const id = ++counter.current;
      setItems((all) => [...all.slice(-3), { id, title, description, tone }]);
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-3 z-[120] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:top-auto sm:right-5 sm:bottom-5 sm:items-end"
      >
        {items.map((t) => {
          const Icon = t.tone === "success" ? CheckCircle2 : t.tone === "danger" ? AlertTriangle : Info;
          return (
            <div
              key={t.id}
              role={t.tone === "danger" ? "alert" : "status"}
              className="pointer-events-auto flex w-full max-w-sm animate-fade-up items-start gap-3 rounded-xl border border-line bg-surface-raised py-3 pr-2 pl-3.5 shadow-float"
            >
              <Icon
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  t.tone === "success" && "text-success",
                  t.tone === "danger" && "text-danger",
                  t.tone === "info" && "text-accent",
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-medium text-ink">{t.title}</p>
                {t.description && <p className="mt-0.5 text-[12.5px] leading-snug text-ink-muted">{t.description}</p>}
              </div>
              <button
                type="button"
                aria-label="Hinweis schließen"
                onClick={() => dismiss(t.id)}
                className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-faint hover:bg-surface-sunken hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:outline-none"
              >
                <X className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) return { toast: () => {} } as ToastContextValue;
  return ctx;
}
