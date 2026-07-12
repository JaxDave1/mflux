export function SurfaceLoadingState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      <div className="h-9 w-9 animate-spin rounded-full border border-secondary/25 border-t-secondary" />
      <div className="font-label text-xs uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
        {label}
      </div>
    </div>
  );
}