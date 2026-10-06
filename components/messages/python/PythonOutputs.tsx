"use client";

import { useState } from "react";
import { CircleAlert, Table2, TriangleAlert } from "lucide-react";
import type { DataExport, PythonOutputItem, SandboxFile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CollapsibleSection } from "../CollapsibleSection";
import { CopyButton } from "../CopyButton";
import { FileChip } from "../FileChip";
import { htmlTableToRows } from "../csv";
import { cleanTerminalText, formatNumber, stripAnsi } from "../utils";
import { CsvExportAction } from "./CsvExportAction";
import { HtmlFrame, OpenInTabAction } from "./HtmlFrame";
import { ImageOutput } from "./ImageOutput";
import { WidgetOutput } from "./WidgetOutput";
import { useConversationId } from "../ConversationContext";

/** Merge consecutive stream chunks of the same channel (Jupyter splits them arbitrarily). */
function mergeStreams(items: PythonOutputItem[]): PythonOutputItem[] {
  const out: PythonOutputItem[] = [];
  for (const item of items) {
    const prev = out[out.length - 1];
    if (item.type === "stream" && prev?.type === "stream" && prev.name === item.name) {
      out[out.length - 1] = { ...prev, text: prev.text + item.text };
    } else {
      out.push(item);
    }
  }
  return out;
}

/** All data exports of a cell's outputs (deduplicated by path). */
export function collectExports(items: PythonOutputItem[] | undefined): DataExport[] {
  const seen = new Map<string, DataExport>();
  const visit = (list: PythonOutputItem[] | undefined) => {
    for (const o of list ?? []) {
      if (o.type === "widget") visit(o.outputs);
      else if ((o.type === "image" || o.type === "html") && o.export && !seen.has(o.export.path)) seen.set(o.export.path, o.export);
    }
  };
  visit(items);
  return [...seen.values()];
}

export function hasVisualOutput(items: PythonOutputItem[] | undefined): boolean {
  return !!items?.some((o) => o.type === "image" || o.type === "html" || (o.type === "widget" && (o.controls?.length > 0 || hasVisualOutput(o.outputs))));
}

interface PythonOutputsProps {
  outputs: PythonOutputItem[];
  files: SandboxFile[];
  title: string;
}

export function PythonOutputs({ outputs, files, title }: PythonOutputsProps) {
  const sessionId = useConversationId();
  const items = mergeStreams(outputs);
  let imageIndex = 0;
  let frameIndex = 0;

  return (
    <div className="divide-y divide-line">
      {items.map((item, i) => {
        switch (item.type) {
          case "stream":
            return <StreamOutput key={i} name={item.name} text={item.text} />;
          case "text":
            return <TextOutput key={i} text={item.text} />;
          case "image":
            imageIndex++;
            return (
              <div key={i} className="px-4 py-3">
                <ImageOutput mime={item.mime} data={item.data} text={item.text} index={imageIndex} exp={item.export} />
              </div>
            );
          case "html": {
            frameIndex++;
            return (
              <HtmlOutput key={i} kind={item.kind} html={item.html} exp={item.export} title={`${title} – Ausgabe ${frameIndex}`} />
            );
          }
          case "error":
            return <ErrorOutput key={i} ename={item.ename} evalue={item.evalue} traceback={item.traceback} />;
          case "widget":
            return <WidgetOutput key={item.id || i} widget={item} sessionId={sessionId} />;
          default:
            return null;
        }
      })}
      {files.length > 0 && <FilesOutput files={files} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function OutputLabel({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "warning" }) {
  return (
    <span
      className={cn(
        "font-mono text-[10px] uppercase tracking-[0.12em]",
        tone === "warning" ? "text-warning" : "text-ink-faint",
      )}
    >
      {children}
    </span>
  );
}

function StreamOutput({ name, text }: { name: "stdout" | "stderr"; text: string }) {
  const clean = cleanTerminalText(text).replace(/\n+$/, "");
  if (!clean) return null;
  const isErr = name === "stderr";
  return (
    <div className={cn("group/out relative px-4 py-2.5", isErr && "bg-warning/[0.06]")}>
      <div className="mb-1 flex items-center justify-between">
        <OutputLabel tone={isErr ? "warning" : "default"}>{isErr ? "stderr" : "stdout"}</OutputLabel>
        <CopyButton
          text={clean}
          label="Ausgabe kopieren"
          className="size-6 opacity-0 transition-opacity group-hover/out:opacity-100 focus-visible:opacity-100"
        />
      </div>
      <pre
        className={cn(
          "scrollbar-thin max-h-80 overflow-auto whitespace-pre-wrap break-words font-mono text-[12.5px] leading-[1.6]",
          isErr ? "text-warning" : "text-ink",
        )}
      >
        {clean}
      </pre>
    </div>
  );
}

function TextOutput({ text }: { text: string }) {
  const clean = stripAnsi(text);
  return (
    <div className="px-4 py-2.5">
      <div className="mb-1">
        <OutputLabel>Ergebnis</OutputLabel>
      </div>
      <pre className="scrollbar-thin max-h-80 overflow-auto whitespace-pre font-mono text-[12.5px] leading-[1.6] text-ink">
        {clean}
      </pre>
    </div>
  );
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "tabelle"
  );
}

function HtmlOutput({
  kind,
  html,
  title,
  exp,
}: {
  kind: "table" | "plotly" | "generic";
  html: string;
  title: string;
  exp?: DataExport;
}) {
  if (kind === "table") {
    return (
      <div className="py-1">
        <div className="flex min-h-9 flex-wrap items-center gap-x-2 gap-y-1 px-4 pb-1 pt-2">
          <Table2 className="size-3 text-ink-faint" aria-hidden />
          <OutputLabel>Tabelle</OutputLabel>
          {exp && (
            <span className="font-mono text-[10.5px] tabular-nums text-ink-faint">
              {formatNumber(exp.rows)} × {formatNumber(exp.columns)}
            </span>
          )}
          <span className="ml-auto flex items-center gap-1.5">
            <CsvExportAction
              exp={exp}
              getRows={() => htmlTableToRows(html)}
              filename={`${slugify(title)}.csv`}
              className="shadow-none"
            />
            <OpenInTabAction html={html} kind="table" title={title} className="shadow-none" />
          </span>
        </div>
        <HtmlFrame kind="table" html={html} title={title} />
      </div>
    );
  }
  return (
    <div className={cn(kind === "plotly" ? "p-2" : "py-1")}>
      <HtmlFrame
        kind={kind}
        html={html}
        title={title}
        showOpenAction
        actions={exp ? <CsvExportAction exp={exp} /> : undefined}
      />
    </div>
  );
}

function ErrorOutput({ ename, evalue, traceback }: { ename: string; evalue: string; traceback: string }) {
  const [open, setOpen] = useState(false);
  const tb = stripAnsi(traceback).trim();
  return (
    <div className="bg-danger/[0.06] px-4 py-3">
      <div className="flex items-start gap-2">
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
        <p className="min-w-0 break-words font-mono text-[12.5px] leading-relaxed text-ink">
          <span className="font-semibold text-danger">{ename}</span>
          {evalue && <span className="text-ink">: {evalue}</span>}
        </p>
      </div>
      {tb && (
        <CollapsibleSection
          open={open}
          onOpenChange={setOpen}
          className="mt-2 pl-6"
          trigger={<span className="text-xs text-ink-muted hover:text-ink">Traceback {open ? "ausblenden" : "anzeigen"}</span>}
          aside={
            <CopyButton text={tb} label="Traceback kopieren" className="size-6" />
          }
        >
          <pre className="scrollbar-thin mt-2 max-h-96 overflow-auto rounded-md border border-danger/20 bg-surface-raised p-3 font-mono text-[11.5px] leading-[1.6] text-ink-muted">
            {tb}
          </pre>
        </CollapsibleSection>
      )}
    </div>
  );
}

function FilesOutput({ files }: { files: SandboxFile[] }) {
  return (
    <div className="px-4 py-3">
      <div className="mb-2">
        <OutputLabel>
          {files.length === 1 ? "1 Datei erstellt" : `${files.length} Dateien erstellt`}
        </OutputLabel>
      </div>
      <div className="flex flex-wrap gap-2">
        {files.map((f) => (
          <FileChip key={f.path} name={f.name} size={f.size} url={f.url} hint={f.path} />
        ))}
      </div>
    </div>
  );
}

export function ToolErrorText({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 bg-danger/[0.06] px-4 py-3">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
      <p className="min-w-0 whitespace-pre-wrap break-words font-mono text-[12.5px] leading-relaxed text-ink">{text}</p>
    </div>
  );
}
