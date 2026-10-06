"use client";

import { Check, FileSearch, Globe, Search } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";
import { ShimmerText } from "../ThinkingIndicator";
import type { WebSearchPartView } from "../types";
import { domainOf } from "../utils";

function describe(part: WebSearchPartView): { icon: typeof Search; verb: string; detail?: string } {
  const action = part.output?.action;
  // some providers put the query into the input instead
  const inputQuery =
    part.input && typeof part.input === "object" && "query" in part.input
      ? String((part.input as { query?: unknown }).query ?? "")
      : "";

  if (action?.type === "openPage") {
    return { icon: Globe, verb: "Seite geöffnet", detail: action.url ? domainOf(action.url) : undefined };
  }
  if (action?.type === "findInPage") {
    return {
      icon: FileSearch,
      verb: "Auf Seite gesucht",
      detail: [action.pattern ? `„${action.pattern}“` : null, action.url ? domainOf(action.url) : null]
        .filter(Boolean)
        .join(" · "),
    };
  }
  const queries =
    action?.type === "search" ? (action.queries?.length ? action.queries : action.query ? [action.query] : []) : [];
  const q = queries.length ? queries : inputQuery ? [inputQuery] : [];
  return { icon: Search, verb: "Websuche", detail: q.length ? q.map((x) => `„${x}“`).join(", ") : undefined };
}

/** Compact one-line row for an OpenAI web search call. */
export function WebSearchPart({ part }: { part: WebSearchPartView }) {
  const running = part.state === "input-streaming" || part.state === "input-available";
  const failed = part.state === "output-error";
  const { icon: Icon, verb, detail } = describe(part);
  const sourceCount = part.output?.sources?.filter((s) => s.type === "url").length ?? 0;

  return (
    <div className="my-1.5 flex min-w-0 items-center gap-2 text-[13px] text-ink-muted">
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-md border",
          running ? "border-accent/40 text-accent" : "border-line text-ink-faint",
        )}
      >
        <Icon className="size-3.5" aria-hidden />
      </span>
      {running ? (
        <>
          <ShimmerText className="text-[13px]">Durchsucht das Web…</ShimmerText>
          <Spinner className="size-3 text-ink-faint" />
        </>
      ) : (
        <>
          <span className="shrink-0 text-ink">{verb}</span>
          {detail && <span className="min-w-0 truncate text-ink-muted" title={detail}>{detail}</span>}
          {sourceCount > 0 && (
            <span className="shrink-0 font-mono text-[11px] text-ink-faint">· {sourceCount} Quellen</span>
          )}
          {failed ? (
            <span className="shrink-0 text-xs text-danger">fehlgeschlagen</span>
          ) : (
            <Check className="size-3.5 shrink-0 text-success" aria-label="abgeschlossen" />
          )}
        </>
      )}
    </div>
  );
}
