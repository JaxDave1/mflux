import { Panel } from "./Panel";

export function StatCard({
  icon,
  label,
  value,
  subtitle,
  className = ""
}: {
  icon: string;
  label: string;
  value: string | number;
  subtitle?: string;
  className?: string;
}) {
  return (
    <Panel
      className={`transition hover:scale-[1.02] hover:shadow-glow-secondary ${className}`}
      scanline
      neonBorder="secondary"
    >
      <div className="mb-2 flex items-center gap-3">
        <span className="material-symbols-outlined text-secondary">{icon}</span>
        <span className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">
          {label}
        </span>
      </div>
      <div className="font-headline text-xl font-bold text-on-surface">{value}</div>
      {subtitle ? (
        <div className="mt-1 font-label text-[10px] tracking-[0.18em] text-secondary">
          {subtitle}
        </div>
      ) : null}
    </Panel>
  );
}
