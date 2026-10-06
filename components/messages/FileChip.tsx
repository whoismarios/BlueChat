import {
  Download,
  File,
  FileArchive,
  FileBraces,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  Paperclip,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fileExtension, formatBytes } from "./utils";

const ICONS: Array<[LucideIcon, string[]]> = [
  [FileSpreadsheet, ["csv", "tsv", "xlsx", "xls", "xlsm", "ods", "parquet", "feather"]],
  [FileImage, ["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "tif", "tiff"]],
  [FileBraces, ["json", "jsonl", "ndjson", "geojson"]],
  [FileCode, ["py", "ipynb", "js", "ts", "sql", "html", "htm", "xml", "yaml", "yml", "r", "sh"]],
  [FileArchive, ["zip", "gz", "tar", "tgz", "bz2", "7z", "rar", "pkl", "pickle"]],
  [FileText, ["txt", "md", "pdf", "doc", "docx", "rtf", "log", "pptx"]],
];

export function iconForFile(name: string): LucideIcon {
  const ext = fileExtension(name);
  for (const [Icon, exts] of ICONS) if (exts.includes(ext)) return Icon;
  return File;
}

/** Icon matching the file type (by extension). */
export function FileTypeIcon({ name, fallback, className }: { name: string; fallback?: "paperclip"; className?: string }) {
  const ext = fileExtension(name);
  if (!ext && fallback === "paperclip") return <Paperclip className={className} aria-hidden />;
  const found = ICONS.find(([, exts]) => exts.includes(ext));
  const props = { className, "aria-hidden": true as const };
  switch (found?.[0]) {
    case FileSpreadsheet:
      return <FileSpreadsheet {...props} />;
    case FileImage:
      return <FileImage {...props} />;
    case FileBraces:
      return <FileBraces {...props} />;
    case FileCode:
      return <FileCode {...props} />;
    case FileArchive:
      return <FileArchive {...props} />;
    case FileText:
      return <FileText {...props} />;
    default:
      return <File {...props} />;
  }
}

interface FileChipProps {
  name: string;
  size?: number;
  /** When set the chip is a download link */
  url?: string;
  /** Secondary text (e.g. path) */
  hint?: string;
  variant?: "default" | "attachment";
  className?: string;
}

/** File pill: icon by extension, name, human size. Download link when `url` is given. */
export function FileChip({ name, size, url, hint, variant = "default", className }: FileChipProps) {
  const ext = fileExtension(name);

  const body = (
    <>
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md border",
          variant === "attachment"
            ? "border-brand-200/70 bg-surface-raised text-brand-600 dark:border-brand-700/60 dark:text-brand-300"
            : "border-line bg-surface-sunken text-brand-600 dark:text-brand-300",
        )}
      >
        <FileTypeIcon name={name} fallback={variant === "attachment" ? "paperclip" : undefined} className="size-4" />
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-[13px] font-medium text-ink" title={hint ?? name}>
          {name}
        </span>
        <span className="mt-0.5 block font-mono text-[10.5px] uppercase tracking-wide text-ink-faint">
          {ext || "Datei"}
          {typeof size === "number" && <> · {formatBytes(size)}</>}
        </span>
      </span>
      {url && (
        <Download
          className="size-4 shrink-0 text-ink-faint transition-colors group-hover/file:text-brand-600 dark:group-hover/file:text-brand-300"
          aria-hidden
        />
      )}
    </>
  );

  const cls = cn(
    "group/file flex max-w-[280px] min-w-[180px] items-center gap-2.5 rounded-[10px] border border-line bg-surface-raised py-1.5 pl-1.5 pr-3 text-left",
    url &&
      "transition-[border-color,box-shadow] hover:border-brand-300 hover:shadow-float focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 dark:hover:border-brand-600",
    className,
  );

  if (url) {
    return (
      <a href={url} download={name} className={cls} aria-label={`${name} herunterladen${typeof size === "number" ? ` (${formatBytes(size)})` : ""}`}>
        {body}
      </a>
    );
  }
  return <div className={cls}>{body}</div>;
}
