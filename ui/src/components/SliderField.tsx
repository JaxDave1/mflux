import type { CSSProperties } from "react";

export function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  color = "secondary",
  className = ""
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  color?: "primary" | "secondary";
  className?: string;
}) {
  const percent = ((value - min) / (max - min)) * 100;

  return (
    <label className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">
          {label}
        </span>
        <span className={`font-mono text-xs ${color === "primary" ? "text-primary" : "text-secondary"}`}>
          {value}
          {unit ?? ""}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={
          { "--slider-percent": `${Math.max(0, Math.min(100, percent))}%` } as CSSProperties &
            Record<"--slider-percent", string>
        }
        className="mflux-slider accent-secondary"
      />
    </label>
  );
}
