import { cn } from "@/lib/utils";

/** Geometric "b" mark: a stem and a bowl on a blue tile, with a cyan signal dot. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7 shrink-0", className)}>
      <rect x="1" y="1" width="30" height="30" rx="8" fill="#0060ab" />
      <path d="M1 17 L17 1 H23 A8 8 0 0 1 31 9 V9 L9 31 H9 A8 8 0 0 1 1 23 Z" fill="#fff" fillOpacity="0.06" />
      <rect x="1.5" y="1.5" width="29" height="29" rx="7.5" fill="none" stroke="#fff" strokeOpacity="0.14" />
      <path d="M10.5 7.5v16" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="16.25" cy="18" r="5.6" fill="none" stroke="#fff" strokeWidth="2.6" />
      <circle cx="23.6" cy="8.6" r="2.1" fill="#00a3e0" />
    </svg>
  );
}

/** "blueChat" wordmark: sans "blue" + serif-italic "Chat". */
export function Wordmark({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <BrandMark className={markClassName} />
      <span className="flex items-baseline text-[19px] leading-none tracking-[-0.01em]">
        <span className="font-semibold">blue</span>
        <span className="font-display text-[22px] italic">Chat</span>
      </span>
    </span>
  );
}
