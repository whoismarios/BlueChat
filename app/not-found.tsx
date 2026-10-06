import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="max-w-md animate-fade-up">
        <p className="font-mono text-[11px] tracking-[0.16em] text-ink-faint uppercase">Fehler 404</p>
        <h1 className="mt-3 font-display text-5xl leading-none tracking-[-0.02em] text-ink">
          Dieser Chat <em className="text-brand-600 italic dark:text-brand-300">existiert nicht.</em>
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-muted">
          Vielleicht wurde er gelöscht oder der Link ist unvollständig.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-10 items-center rounded-[10px] bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700 focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:outline-none dark:bg-brand-500 dark:hover:bg-brand-400"
        >
          Neuen Chat beginnen
        </Link>
      </div>
    </div>
  );
}
