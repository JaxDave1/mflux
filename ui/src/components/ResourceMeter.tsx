export function ResourceMeter({
  label,
  value,
  max,
  unit = "",
  className = ""
}: {
  label: string;
  value: number;
  max: number;
  unit?: string;
  className?: string;
}) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="font-label text-[10px] tracking-[0.18em] text-on-surface">
          {label}
        </span>
        <span className="font-mono text-xs text-on-surface-variant">
          {value} / {max} {unit}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full border border-white/5 bg-surface-container-highest">
        <div className="h-full bg-secondary shadow-glow-secondary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
