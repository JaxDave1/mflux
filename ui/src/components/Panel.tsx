import type { ReactNode } from "react";

export function Panel({
  title,
  children,
  className = "",
  scanline = false,
  neonBorder = "none"
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  scanline?: boolean;
  neonBorder?: "primary" | "secondary" | "none";
}) {
  const borderClass =
    neonBorder === "primary"
      ? "neon-border-primary"
      : neonBorder === "secondary"
        ? "neon-border-secondary"
        : "border border-outline-variant/60";
  return (
    <section
      className={`beveled rounded-panel bg-surface-container p-6 text-on-surface ${borderClass} ${scanline ? "scanline" : ""} ${className}`}
    >
      {title ? (
        <div className="mb-4 font-label text-xs tracking-[0.22em] text-on-surface-variant">
          {title}
        </div>
      ) : null}
      {children}
    </section>
  );
}
