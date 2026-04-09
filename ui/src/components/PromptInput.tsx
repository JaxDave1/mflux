export function PromptInput({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
  variant = "default",
  className = ""
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  variant?: "primary" | "secondary" | "default";
  className?: string;
}) {
  const labelColor =
    variant === "primary"
      ? "text-primary"
      : variant === "secondary"
        ? "text-secondary"
        : "text-on-surface-variant";
  return (
    <label className={`flex flex-col gap-2 ${className}`}>
      <span className={`font-label text-xs tracking-[0.18em] ${labelColor}`}>{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="rounded-panel border border-outline-variant/60 bg-surface-container px-4 py-3 text-sm outline-none transition focus:border-secondary/60 focus:shadow-glow-secondary"
      />
    </label>
  );
}
