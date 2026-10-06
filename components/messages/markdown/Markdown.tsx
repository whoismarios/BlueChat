"use client";

import "katex/dist/katex.min.css";

import { memo, useMemo, useRef } from "react";
import { Download } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import type { Element, ElementContent } from "hast";
import { cn } from "@/lib/utils";
import { CodeBlock } from "./CodeBlock";
import { downloadCsv, tableElementToRows } from "../csv";

/* ------------------------------------------------------------------ */
/* Pre-processing                                                      */
/* ------------------------------------------------------------------ */

/**
 * OpenAI models like to emit LaTeX with \( … \) and \[ … \] delimiters, which remark-math
 * does not understand. Convert them to $$ … $$ (outside of code).
 * Single-dollar inline math is disabled on purpose (currency amounts like "$5 und $10").
 */
function normalizeMath(src: string): string {
  if (!src.includes("\\(") && !src.includes("\\[")) return src;
  const segments = src.split(/(```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)|`[^`\n]*`)/g);
  return segments
    .map((seg, i) =>
      i % 2 === 1
        ? seg
        : seg
            .replace(/\\\[([\s\S]*?)\\\]/g, (_m, body: string) => `\n$$\n${body.trim()}\n$$\n`)
            .replace(/\\\(([\s\S]*?)\\\)/g, (_m, body: string) => `$$${body.trim()}$$`),
    )
    .join("");
}

const LIST_ITEM = /^\s{0,3}(?:[-*+]|\d{1,9}[.)])\s/;

/**
 * Split markdown into top-level blocks at blank lines (never inside fences / math blocks /
 * indented continuations / lists) so that during streaming only the last block re-renders.
 */
function splitBlocks(src: string): string[] {
  if (src.includes("[^")) return [src]; // footnotes need the whole document
  const lines = src.split("\n");
  const blocks: string[] = [];
  let cur: string[] = [];
  let fence: string | null = null;
  let inMath = false;
  let pendingBreak = false;

  const flush = () => {
    if (cur.length) blocks.push(cur.join("\n"));
    cur = [];
  };

  for (const line of lines) {
    const t = line.trimStart();
    if (fence) {
      cur.push(line);
      if (t.startsWith(fence)) fence = null;
      continue;
    }
    if (line.trim() === "" && !inMath) {
      if (cur.length) pendingBreak = true;
      cur.push(line);
      continue;
    }
    if (pendingBreak) {
      pendingBreak = false;
      const indented = /^\s{2,}\S/.test(line) || line.startsWith("\t");
      const firstContent = cur.find((l) => l.trim() !== "") ?? "";
      const listContinues = LIST_ITEM.test(firstContent) && LIST_ITEM.test(line);
      if (!indented && !listContinues) flush();
    }
    const fenceMatch = /^(`{3,}|~{3,})/.exec(t);
    if (fenceMatch) fence = fenceMatch[1];
    else if (t.trim() === "$$") inMath = !inMath;
    cur.push(line);
  }
  flush();
  return blocks;
}

/* ------------------------------------------------------------------ */
/* Renderers                                                           */
/* ------------------------------------------------------------------ */

function hastText(node: ElementContent | Element): string {
  if (node.type === "text") return node.value;
  if (node.type === "element") return node.children.map((c) => hastText(c as ElementContent)).join("");
  return "";
}

/** Drop react-markdown's `node` prop before spreading onto DOM elements. */
function omitNode<T extends { node?: unknown }>(props: T): Omit<T, "node"> {
  const rest = { ...props };
  delete rest.node;
  return rest;
}

const components: Components = {
  a(props) {
    const { href, children, ...rest } = omitNode(props);
    const external = !!href && /^https?:\/\//.test(href);
    return (
      <a
        href={href}
        {...rest}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {children}
      </a>
    );
  },
  pre({ node, children }) {
    const codeEl = node?.children.find(
      (c): c is Element => c.type === "element" && c.tagName === "code",
    );
    const classes = (codeEl?.properties?.className as string[] | undefined) ?? [];
    const lang = classes.find((c) => c.startsWith("language-"))?.slice("language-".length);
    const raw = codeEl ? hastText(codeEl).replace(/\n$/, "") : "";
    // children = the rendered <code> element; unwrap its children for our own wrapper
    const inner =
      children && typeof children === "object" && "props" in children
        ? (children as React.ReactElement<{ children?: React.ReactNode }>).props.children
        : children;
    return (
      <CodeBlock language={lang} code={raw}>
        {inner}
      </CodeBlock>
    );
  },
  table(props) {
    const { children, ...rest } = omitNode(props);
    return <MarkdownTable {...rest}>{children}</MarkdownTable>;
  },
  img(props) {
    const { alt, ...rest } = omitNode(props);
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={alt ?? ""} loading="lazy" {...rest} />;
  },
};

/** GFM table with a ledger look and a hover "CSV" export (client-side, from the rendered cells). */
function MarkdownTable({ children, ...rest }: React.ComponentProps<"table">) {
  const ref = useRef<HTMLTableElement>(null);
  return (
    <div className="bc-table group/table relative">
      <div className="bc-table-wrap scrollbar-thin">
        <table ref={ref} {...rest}>
          {children}
        </table>
      </div>
      <button
        type="button"
        onClick={() => {
          if (!ref.current) return;
          const rows = tableElementToRows(ref.current);
          if (rows.length) downloadCsv("tabelle.csv", rows);
        }}
        aria-label="Tabelle als CSV herunterladen"
        title="Tabelle als CSV herunterladen"
        className="absolute -top-3 right-0 inline-flex h-6 items-center gap-1 rounded-md border border-line bg-surface-raised px-1.5 font-mono text-[10.5px] text-ink-muted opacity-0 shadow-float transition-opacity hover:text-ink focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 group-hover/table:opacity-100 [@media(hover:none)]:opacity-100"
      >
        <Download className="size-3" aria-hidden />
        CSV
      </button>
    </div>
  );
}

const remarkPlugins = [remarkGfm, [remarkMath, { singleDollarTextMath: false }]] as const;
const rehypePlugins = [
  [rehypeKatex, { throwOnError: false, strict: "ignore" }],
  [rehypeHighlight, { detect: false }],
] as const;

const MarkdownBlock = memo(function MarkdownBlock({ source }: { source: string }) {
  return (
    <ReactMarkdown
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      remarkPlugins={remarkPlugins as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rehypePlugins={rehypePlugins as any}
      components={components}
    >
      {source}
    </ReactMarkdown>
  );
});

interface MarkdownProps {
  text: string;
  /** Show the blinking caret after the last block */
  streaming?: boolean;
  className?: string;
  /** Visual variant: default body text or muted (reasoning) */
  variant?: "default" | "muted";
}

/** Streaming-friendly markdown renderer (GFM, math, highlighted code). */
export const Markdown = memo(function Markdown({ text, streaming, className, variant = "default" }: MarkdownProps) {
  const blocks = useMemo(() => splitBlocks(normalizeMath(text)), [text]);
  return (
    <div
      className={cn(
        "bc-md",
        variant === "muted" && "bc-md-muted",
        streaming && "bc-streaming",
        className,
      )}
    >
      {blocks.map((block, i) => (
        <MarkdownBlock key={i} source={block} />
      ))}
    </div>
  );
});
