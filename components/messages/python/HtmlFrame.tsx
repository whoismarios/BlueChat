"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useThemeColors, type ThemeColors } from "../useThemeColors";
import { overlayActionClass } from "./CsvExportAction";

export type HtmlFrameKind = "table" | "plotly" | "generic";

const DEFAULT_HEIGHT: Record<HtmlFrameKind, number> = {
  table: 120,
  plotly: 520,
  generic: 140,
};
const MAX_HEIGHT: Record<HtmlFrameKind, number> = {
  table: 560,
  plotly: 900,
  generic: 640,
};

const SANS = `"Instrument Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
const MONO = `"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;

function baseCss(c: ThemeColors, kind: HtmlFrameKind): string {
  const shared = `
:root{color-scheme:${c.isDark ? "dark" : "light"}}
*{box-sizing:border-box}
html,body{margin:0;background:transparent;color:${c.ink};font:13px/1.5 ${SANS};-webkit-font-smoothing:antialiased}
a{color:${c.brand}}
::-webkit-scrollbar{width:8px;height:8px}::-webkit-scrollbar-thumb{background:${c.lineStrong};border-radius:8px}::-webkit-scrollbar-track{background:transparent}
html{scrollbar-width:thin;scrollbar-color:${c.lineStrong} transparent}`;

  if (kind === "plotly") {
    return `${shared}
html,body{height:100%}
body>div:first-child{height:100%}`;
  }

  if (kind === "generic") {
    return `${shared}
body{padding:12px 16px}
pre,code{font-family:${MONO};font-size:12px}
table{border-collapse:collapse;font-variant-numeric:tabular-nums}
th,td{border-bottom:1px solid ${c.line};padding:6px 10px;text-align:left}
th{color:${c.muted};font-weight:600}
img{max-width:100%}`;
  }

  // pandas DataFrame
  return `${shared}
body{padding:0}
table{border-collapse:separate;border-spacing:0;min-width:100%;width:max-content;font-variant-numeric:tabular-nums lining-nums;border:0!important}
table.dataframe{border:0}
thead th{position:sticky;top:0;z-index:2;background:${c.raised};color:${c.muted};font-weight:600;font-size:11.5px;letter-spacing:.02em;text-align:right;padding:9px 14px 8px;border-bottom:1px solid ${c.lineStrong}!important;white-space:nowrap;border-top:0;border-left:0;border-right:0}
thead tr:not(:first-child) th{position:static}
thead th:first-child{text-align:left}
tbody th{position:sticky;left:0;z-index:1;background:${c.raised};text-align:left;font-family:${MONO};font-size:11.5px;font-weight:500;color:${c.faint};padding:6px 14px;border-bottom:1px solid ${c.line};border-right:1px solid ${c.line};border-top:0;border-left:0;white-space:nowrap;vertical-align:top}
td{padding:6px 14px;text-align:right;border-bottom:1px solid ${c.line};white-space:nowrap;border-left:0;border-right:0;border-top:0}
tbody tr:last-child td,tbody tr:last-child th{border-bottom:0}
tbody tr:hover td,tbody tr:hover th{background:${c.sunken}}
p{margin:0;padding:8px 14px;font-family:${MONO};font-size:11px;color:${c.faint};border-top:1px solid ${c.line}}`;
}

function sizeScript(
  frameId: string,
  kind: HtmlFrameKind,
  c: ThemeColors,
): string {
  const measure =
    kind === "plotly"
      ? "Math.ceil(document.documentElement.scrollHeight)"
      : "Math.ceil(Math.max(document.body?document.body.scrollHeight:0, document.body?document.body.getBoundingClientRect().height:0))";
  const darkPlotly =
    kind === "plotly" && c.isDark
      ? `
function themePlots(){try{if(!window.Plotly)return;document.querySelectorAll(".js-plotly-plot").forEach(function(gd){var u={paper_bgcolor:"rgba(0,0,0,0)",plot_bgcolor:"rgba(0,0,0,0)","font.color":${JSON.stringify(c.muted)},"legend.bgcolor":"rgba(0,0,0,0)"};var L=gd._fullLayout||gd.layout||{};Object.keys(L).forEach(function(k){if(/^[xy]axis\\d*$/.test(k)){u[k+".gridcolor"]=${JSON.stringify(c.line)};u[k+".zerolinecolor"]=${JSON.stringify(c.lineStrong)};u[k+".linecolor"]=${JSON.stringify(c.lineStrong)};}});window.Plotly.relayout(gd,u);});}catch(e){}}
window.addEventListener("load",function(){setTimeout(themePlots,30);});`
      : "";
  return `(function(){var id=${JSON.stringify(frameId)};var last=0;
function post(){try{var h=${measure};if(h&&h!==last){last=h;parent.postMessage({__bcFrame:id,height:h},"*");}}catch(e){}}
window.addEventListener("load",post);
window.addEventListener("message",function(e){if(e.data&&e.data.__bcMeasure===id){last=0;post();}});
document.addEventListener("DOMContentLoaded",function(){post();if(window.ResizeObserver){new ResizeObserver(post).observe(document.body);}});
setTimeout(post,300);setTimeout(post,1200);${darkPlotly}
})();`;
}

function buildSrcDoc(
  html: string,
  kind: HtmlFrameKind,
  colors: ThemeColors,
  frameId: string | null,
): string {
  const head = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${baseCss(colors, kind)}</style>${
    frameId ? `<script>${sizeScript(frameId, kind, colors)}</script>` : ""
  }`;
  const isFullDoc = /<html[\s>]/i.test(html) || /<!doctype/i.test(html);
  if (!isFullDoc) {
    return `<!doctype html><html><head>${head}</head><body>${html}</body></html>`;
  }
  if (/<head[^>]*>/i.test(html))
    return html.replace(/<head[^>]*>/i, (m) => `${m}${head}`);
  return html.replace(/<html[^>]*>/i, (m) => `${m}<head>${head}</head>`);
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/** Open the HTML in a new tab — still wrapped in a sandboxed iframe (blob URLs inherit our origin!). */
export function openHtmlInNewTab(
  html: string,
  kind: HtmlFrameKind,
  colors: ThemeColors,
  title: string,
) {
  const inner = buildSrcDoc(html, kind, colors, null);
  const page = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${title.replace(/</g, "&lt;")} – blueChat</title><style>html,body{margin:0;height:100%;background:${colors.isDark ? colors.surface : "#fff"}}iframe{border:0;width:100%;height:100%;display:block}</style></head><body><iframe sandbox="allow-scripts allow-downloads" title="${escapeAttr(title)}" srcdoc="${escapeAttr(inner)}"></iframe></body></html>`;
  const url = URL.createObjectURL(new Blob([page], { type: "text/html" }));
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

interface HtmlFrameProps {
  html: string;
  kind: HtmlFrameKind;
  title: string;
  className?: string;
  /** Show the "Im neuen Tab öffnen" action (overlayed, top-right) */
  showOpenAction?: boolean;
  /** Extra overlay actions (e.g. CSV export), shown on hover next to "Im neuen Tab öffnen" */
  actions?: ReactNode;
}

/** "Im neuen Tab öffnen" button (still sandboxed in the new tab). */
export function OpenInTabAction({
  html,
  kind,
  title,
  className,
}: {
  html: string;
  kind: HtmlFrameKind;
  title: string;
  className?: string;
}) {
  const colors = useThemeColors();
  return (
    <button
      type="button"
      onClick={() => openHtmlInNewTab(html, kind, colors, title)}
      className={cn(overlayActionClass, className)}
    >
      <ExternalLink className="size-3.5" aria-hidden />
      Im neuen Tab öffnen
    </button>
  );
}

/**
 * Renders untrusted HTML (pandas tables, plotly pages) in a sandboxed iframe
 * (allow-scripts, NO allow-same-origin) with theme-aware CSS and auto height.
 */
export function HtmlFrame({
  html,
  kind,
  title,
  className,
  showOpenAction,
  actions,
}: HtmlFrameProps) {
  const colors = useThemeColors();
  const frameId = useId();
  const ref = useRef<HTMLIFrameElement>(null);
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  // Own lazy loading (native loading="lazy" is unreliable for srcdoc iframes in scroll containers).
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || near) return;
    if (typeof IntersectionObserver === "undefined") {
      const t = setTimeout(() => setNear(true), 0);
      return () => clearTimeout(t);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setNear(true);
      },
      { rootMargin: "1200px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  const requestMeasure = useCallback(() => {
    ref.current?.contentWindow?.postMessage({ __bcMeasure: frameId }, "*");
  }, [frameId]);

  const srcDoc = useMemo(
    () => buildSrcDoc(html, kind, colors, frameId),
    [html, kind, colors, frameId],
  );

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== ref.current?.contentWindow) return;
      const data = e.data as { __bcFrame?: string; height?: number } | null;
      if (
        !data ||
        data.__bcFrame !== frameId ||
        typeof data.height !== "number"
      )
        return;
      setContentHeight(data.height);
    }
    window.addEventListener("message", onMessage);
    // The frame may have loaded (and reported) before this listener existed (SSR/hydration) → ask again.
    requestMeasure();
    const t = setTimeout(requestMeasure, 400);
    return () => {
      window.removeEventListener("message", onMessage);
      clearTimeout(t);
    };
  }, [frameId, requestMeasure, near]);

  const min = kind === "plotly" ? DEFAULT_HEIGHT.plotly : 40;
  const height = Math.min(
    MAX_HEIGHT[kind],
    Math.max(min, contentHeight ?? DEFAULT_HEIGHT[kind]),
  );

  return (
    <div ref={wrapRef} className={cn("group/frame relative", className)}>
      {!near ? (
        <div aria-hidden style={{ height }} />
      ) : (
        <iframe
          ref={ref}
          title={title}
          sandbox="allow-scripts allow-downloads"
          srcDoc={srcDoc}
          onLoad={requestMeasure}
          referrerPolicy="no-referrer"
          className="block w-full border-0 bg-transparent transition-[height] duration-200"
          style={{ height, colorScheme: colors.isDark ? "dark" : "light" }}
        />
      )}
      {(showOpenAction || actions) && (
        <div className="absolute right-2 top-2 flex items-center gap-1.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/frame:opacity-100 [@media(hover:none)]:opacity-100">
          {actions}
          {showOpenAction && (
            <OpenInTabAction html={html} kind={kind} title={title} />
          )}
        </div>
      )}
    </div>
  );
}
