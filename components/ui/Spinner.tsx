import { cn } from "@/lib/utils";

export interface SpinnerProps {
  className?: string;
  /** Accessible label; omit when the spinner is decorative next to text. */
  label?: string;
}

/** Thin ring spinner; inherits `currentColor`. Size via className (default 16px). */
export function Spinner({ className, label }: SpinnerProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("size-4 shrink-0 animate-spin", className)}
    >
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.25" />
      <path d="M21.5 12A9.5 9.5 0 0 0 12 2.5" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
    </svg>
  );
}
