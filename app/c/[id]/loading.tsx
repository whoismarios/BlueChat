export default function Loading() {
  return (
    <div className="flex h-full flex-col" aria-busy="true" aria-label="Chat wird geladen">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4">
        <div className="h-3.5 w-40 animate-pulse rounded bg-surface-sunken" />
        <div className="h-4 w-16 animate-pulse rounded-full bg-surface-sunken" />
      </div>
      <div className="mx-auto w-full max-w-chat flex-1 space-y-8 px-6 pt-10">
        <div className="ml-auto h-10 w-2/5 animate-pulse rounded-2xl bg-surface-sunken" />
        <div className="space-y-2.5">
          <div className="h-3 w-11/12 animate-pulse rounded bg-surface-sunken" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-surface-sunken [animation-delay:120ms]" />
          <div className="h-3 w-3/5 animate-pulse rounded bg-surface-sunken [animation-delay:240ms]" />
        </div>
        <div className="h-40 animate-pulse rounded-card bg-surface-sunken [animation-delay:300ms]" />
      </div>
    </div>
  );
}
