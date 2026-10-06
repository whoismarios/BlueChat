"use client";

import { useEffect, useState } from "react";
import { TriangleAlert, X } from "lucide-react";
import type { HealthStatus } from "@/lib/types";
import { fetchHealth } from "@/lib/client/api";

const DISMISS_KEY = "bluechat-health-dismissed";

/** Slim warning strip shown when the OpenAI key, the database or the Python sandbox is unavailable. */
export function HealthBanner() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetchHealth()
        .then((h) => {
          if (cancelled) return;
          setHealth(h);
          try {
            const sig = JSON.stringify(h);
            setDismissed(sessionStorage.getItem(DISMISS_KEY) === sig);
          } catch {
            /* ignore */
          }
        })
        .catch(() => {
          /* health endpoint unreachable – do not nag */
        });
    void load();
    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (!health || dismissed) return null;
  const issues: { key: string; title: string; text: React.ReactNode }[] = [];
  if (!health.openaiKey)
    issues.push({
      key: "openai",
      title: "Kein OpenAI-API-Schlüssel",
      text: (
        <>
          Trage <code className="rounded bg-warning/15 px-1 font-mono text-[11.5px]">OPENAI_API_KEY</code> in{" "}
          <code className="rounded bg-warning/15 px-1 font-mono text-[11.5px]">.env.local</code> ein und starte den Server neu.
        </>
      ),
    });
  if (!health.db)
    issues.push({ key: "db", title: "Datenbank nicht erreichbar", text: "Chats können nicht geladen oder gespeichert werden." });
  if (!health.sandbox)
    issues.push({
      key: "sandbox",
      title: "Python-Sandbox nicht erreichbar",
      text: "Codeausführung und Datei-Uploads sind derzeit nicht verfügbar.",
    });
  if (issues.length === 0) return null;

  return (
    <div
      role="status"
      className="relative z-10 flex shrink-0 animate-fade-up items-start gap-3 border-b border-warning/25 bg-[color-mix(in_srgb,var(--warning)_9%,var(--surface))] px-4 py-2.5 text-[13px] text-ink sm:px-6"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
      <ul className="min-w-0 flex-1 space-y-0.5">
        {issues.map((i) => (
          <li key={i.key} className="leading-snug">
            <span className="font-medium">{i.title}.</span> <span className="text-ink-muted">{i.text}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        aria-label="Hinweis ausblenden"
        onClick={() => {
          setDismissed(true);
          try {
            sessionStorage.setItem(DISMISS_KEY, JSON.stringify(health));
          } catch {
            /* ignore */
          }
        }}
        className="-my-0.5 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-muted hover:bg-warning/15 hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:outline-none"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
