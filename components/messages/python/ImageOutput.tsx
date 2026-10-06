"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Maximize2, X } from "lucide-react";
import type { DataExport } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CsvExportAction } from "./CsvExportAction";

type ImageMime = "image/png" | "image/jpeg" | "image/svg+xml";

export function imageDataUri(mime: ImageMime, data: string): string {
  if (data.startsWith("data:")) return data;
  if (mime === "image/svg+xml") {
    // raw SVG markup (per contract); tolerate base64 too
    if (data.trimStart().startsWith("<")) return `data:image/svg+xml;utf8,${encodeURIComponent(data)}`;
    return `data:image/svg+xml;base64,${data}`;
  }
  return `data:${mime};base64,${data.replace(/\s/g, "")}`;
}

const EXT: Record<ImageMime, string> = { "image/png": "png", "image/jpeg": "jpg", "image/svg+xml": "svg" };

interface ImageOutputProps {
  mime: ImageMime;
  data: string;
  /** text/plain repr, e.g. "<Figure size 640x480 with 1 Axes>" */
  text?: string;
  index: number;
  /** CSV of the data behind the figure */
  exp?: DataExport;
}

function altFrom(text: string | undefined, index: number): string {
  const t = text?.trim();
  if (t && !/^<Figure size/i.test(t)) return t.slice(0, 200);
  return `Abbildung ${index}${t ? ` (${t.replace(/[<>]/g, "")})` : ""}`;
}

/** Plot / image output with click-to-zoom lightbox and download. */
export function ImageOutput({ mime, data, text, index, exp }: ImageOutputProps) {
  const [zoomed, setZoomed] = useState(false);
  const src = imageDataUri(mime, data);
  const alt = altFrom(text, index);
  const filename = `abbildung-${index}.${EXT[mime]}`;

  return (
    <figure className="group/img relative m-0">
      <button
        type="button"
        onClick={() => setZoomed(true)}
        className="block w-full cursor-zoom-in rounded-lg bg-white p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 dark:bg-[#f4f7fb]"
        aria-label={`${alt} vergrößern`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="mx-auto block h-auto max-h-[560px] max-w-full object-contain" />
      </button>
      <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-hover/img:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
        {exp && <CsvExportAction exp={exp} className="mr-0.5" />}
        <ImageAction href={src} download={filename} label="Bild herunterladen">
          <Download className="size-3.5" aria-hidden />
        </ImageAction>
        <ImageAction onClick={() => setZoomed(true)} label="Vergrößern">
          <Maximize2 className="size-3.5" aria-hidden />
        </ImageAction>
      </div>
      {zoomed && <Lightbox src={src} alt={alt} filename={filename} onClose={() => setZoomed(false)} />}
    </figure>
  );
}

function ImageAction({
  children,
  label,
  href,
  download,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  href?: string;
  download?: string;
  onClick?: () => void;
}) {
  const cls =
    "inline-flex size-7 items-center justify-center rounded-md border border-line bg-surface-raised/95 text-ink-muted shadow-float backdrop-blur hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60";
  if (href) {
    return (
      <a href={href} download={download} aria-label={label} title={label} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={cls}>
      {children}
    </button>
  );
}

function Lightbox({ src, alt, filename, onClose }: { src: string; alt: string; filename: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-950/80 p-6 backdrop-blur-sm animate-fade-up"
      onClick={onClose}
    >
      <div className="absolute right-4 top-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
        <a
          href={src}
          download={filename}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-white/10 px-3 text-sm text-white hover:bg-white/20"
        >
          <Download className="size-4" aria-hidden />
          Herunterladen
        </a>
        <button
          type="button"
          onClick={onClose}
          aria-label="Schließen"
          className="inline-flex size-9 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20"
          autoFocus
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className={cn("max-h-full max-w-full cursor-default rounded-lg bg-white object-contain p-3 shadow-2xl")}
      />
    </div>,
    document.body,
  );
}
