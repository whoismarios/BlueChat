"use client";

import { useState } from "react";
import { Globe } from "lucide-react";
import { domainOf } from "../utils";

export interface SourceItem {
  url: string;
  title?: string;
}

/** Deduplicate sources by URL (ignoring hash / trailing slash). */
export function dedupeSources(sources: SourceItem[]): SourceItem[] {
  const seen = new Map<string, SourceItem>();
  for (const s of sources) {
    let key = s.url;
    try {
      const u = new URL(s.url);
      u.hash = "";
      // drop OpenAI tracking param
      u.searchParams.delete("utm_source");
      key = u.toString().replace(/\/$/, "");
    } catch {}
    const existing = seen.get(key);
    if (!existing) seen.set(key, s);
    else if (!existing.title && s.title) seen.set(key, { ...existing, title: s.title });
  }
  return [...seen.values()];
}

function Favicon({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  let origin = "";
  try {
    origin = new URL(url).origin;
  } catch {}
  if (failed || !origin) return <Globe className="size-3.5 text-ink-faint" aria-hidden />;
  return (
    // Load the favicon from the site itself (no third-party favicon service).
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${origin}/favicon.ico`}
      alt=""
      width={14}
      height={14}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="size-3.5 rounded-sm"
    />
  );
}

/** "Quellen" row: numbered favicon + domain chips. */
export function SourcesRow({ sources }: { sources: SourceItem[] }) {
  if (!sources.length) return null;
  return (
    <div className="mt-4 border-t border-line pt-3">
      <p className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-faint">
        Quellen · {sources.length}
      </p>
      <ol className="flex flex-wrap gap-1.5">
        {sources.map((s, i) => {
          const domain = domainOf(s.url);
          return (
            <li key={s.url}>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                title={s.title ? `${s.title}\n${s.url}` : s.url}
                className="group/src inline-flex max-w-[260px] items-center gap-1.5 rounded-full border border-line bg-surface-raised py-1 pl-1.5 pr-2.5 text-xs text-ink-muted transition-colors hover:border-brand-300 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 dark:hover:border-brand-600"
              >
                <span className="flex size-4 items-center justify-center rounded-full bg-surface-sunken font-mono text-[9.5px] tabular-nums text-ink-faint group-hover/src:text-brand-600 dark:group-hover/src:text-brand-300">
                  {i + 1}
                </span>
                <Favicon url={s.url} />
                <span className="truncate">{domain}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
