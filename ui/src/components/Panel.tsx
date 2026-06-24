import type { ReactNode } from "react";

export function Panel({
  title,
  children,
  className = "",
  scanline = false,
  neonBorder = "none",
  variant = "glass"
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  scanline?: boolean;
  neonBorder?: "primary" | "secondary" | "none";
  variant?: "glass" | "composite";
}) {
  const accentClass =
    neonBorder === "primary"
      ? "border-[rgba(124,140,255,0.28)]"
      : neonBorder === "secondary"
        ? "border-[rgba(0,212,200,0.28)]"
        : "";

  const surfaceClass =
    variant === "composite" ? "panel-composite scan-grid rounded-xl" : "mirror-panel rounded-xl";

  return (
    <section
      className={`${surfaceClass} p-5 text-on-surface transition duration-150 ${accentClass} ${scanline ? "scanline" : ""} ${className}`}
    >
      {title ? <h2 className="panel-title titanium-text mb-4">{title}</h2> : null}
      {children}
    </section>
  );
}