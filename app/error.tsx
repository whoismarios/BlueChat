"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const router = useRouter();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="max-w-md animate-fade-up">
        <p className="font-mono text-[11px] tracking-[0.16em] text-danger uppercase">Unerwarteter Fehler</p>
        <h1 className="mt-3 font-display text-5xl leading-none tracking-[-0.02em] text-ink">
          Da ist etwas <em className="italic">schiefgelaufen.</em>
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-muted">
          Möglicherweise ist die Datenbank nicht erreichbar. Details stehen in der Server-Konsole.
        </p>
        {error.digest && <p className="mt-2 font-mono text-[11px] text-ink-faint">Referenz: {error.digest}</p>}
        <div className="mt-6 flex gap-2">
          <Button variant="primary" onClick={() => retry()}>
            Erneut versuchen
          </Button>
          <Button variant="secondary" onClick={() => router.push("/")}>
            Neuer Chat
          </Button>
        </div>
      </div>
    </div>
  );
}
