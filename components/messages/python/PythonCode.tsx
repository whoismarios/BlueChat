"use client";

import { memo, useMemo } from "react";
import hljs from "highlight.js/lib/core";
import python from "highlight.js/lib/languages/python";
import { cn } from "@/lib/utils";

if (!hljs.getLanguage("python")) hljs.registerLanguage("python", python);

function highlightPython(code: string): string {
  try {
    return hljs.highlight(code, { language: "python", ignoreIllegals: true }).value;
  } catch {
    return code.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
  }
}

interface PythonCodeProps {
  code: string;
  /** Show a blinking caret at the end (live streaming input) */
  streaming?: boolean;
  className?: string;
}

/**
 * Dark Python cell with line-number gutter. Gutter and code are separate columns
 * (no wrapping), so multi-line tokens (docstrings) highlight correctly.
 */
export const PythonCode = memo(function PythonCode({ code, streaming, className }: PythonCodeProps) {
  const html = useMemo(() => highlightPython(code), [code]);
  const lineCount = Math.max(1, code.split("\n").length);
  const gutter = useMemo(
    () => Array.from({ length: lineCount }, (_, i) => i + 1).join("\n"),
    [lineCount],
  );

  return (
    <div className={cn("bc-code scrollbar-thin flex overflow-x-auto font-mono text-[12.5px] leading-[1.7]", className)}>
      <pre
        aria-hidden
        className="sticky left-0 select-none border-r border-white/[0.06] bg-code-bg py-3 pl-3.5 pr-3 text-right text-code-ink/30 tabular-nums"
      >
        {gutter}
      </pre>
      <pre className="min-w-0 flex-1 py-3 pl-4 pr-6">
        <code className="hljs language-python" dangerouslySetInnerHTML={{ __html: html }} />
        {streaming && <span aria-hidden className="bc-caret" />}
      </pre>
    </div>
  );
});
