"use client";

import type { ReactNode } from "react";
import { CopyButton } from "../CopyButton";

const LANGUAGE_LABELS: Record<string, string> = {
  py: "Python",
  python: "Python",
  js: "JavaScript",
  javascript: "JavaScript",
  ts: "TypeScript",
  typescript: "TypeScript",
  tsx: "TSX",
  jsx: "JSX",
  sh: "Shell",
  bash: "Bash",
  zsh: "Shell",
  shell: "Shell",
  sql: "SQL",
  json: "JSON",
  yaml: "YAML",
  yml: "YAML",
  html: "HTML",
  css: "CSS",
  md: "Markdown",
  markdown: "Markdown",
  r: "R",
  java: "Java",
  csharp: "C#",
  cs: "C#",
  cpp: "C++",
  go: "Go",
  rust: "Rust",
  xml: "XML",
  text: "Text",
  plaintext: "Text",
};

export function languageLabel(lang: string | undefined): string {
  if (!lang) return "Code";
  return LANGUAGE_LABELS[lang.toLowerCase()] ?? lang;
}

interface CodeBlockProps {
  language?: string;
  /** Raw source (for copy) */
  code: string;
  /** Highlighted content (React nodes from rehype-highlight) */
  children: ReactNode;
}

/** Fenced code block inside markdown: dark cell, language label, copy button. */
export function CodeBlock({ language, code, children }: CodeBlockProps) {
  return (
    <div className="bc-code not-prose group/code my-4 overflow-hidden rounded-[10px] border border-white/5 bg-code-bg text-code-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3.5 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-code-ink/55">
          {languageLabel(language)}
        </span>
        <CopyButton text={code} tone="dark" showLabel label="Kopieren" />
      </div>
      <pre className="scrollbar-thin overflow-x-auto px-4 py-3.5 font-mono text-[13px] leading-[1.65]">
        <code className="hljs">{children}</code>
      </pre>
    </div>
  );
}
