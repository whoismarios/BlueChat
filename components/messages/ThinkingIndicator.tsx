import { cn } from "@/lib/utils";

/** Three pulsing dots + shimmering label, used while the model has not produced output yet. */
export function ThinkingIndicator({ label = "Denkt nach…", className }: { label?: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn("flex items-center gap-2.5 py-1", className)}>
      <span className="flex items-center gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 rounded-full bg-brand-500 dark:bg-brand-300 animate-pulse-dot"
            style={{ animationDelay: `${i * 160}ms` }}
          />
        ))}
      </span>
      <ShimmerText>{label}</ShimmerText>
    </div>
  );
}

export function ShimmerText({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("bc-shimmer text-sm", className)}>{children}</span>;
}
