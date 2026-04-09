export function ToggleChip({
  options,
  value,
  onChange,
  color = "secondary",
  className = ""
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  color?: "primary" | "secondary";
  className?: string;
}) {
  const activeClass =
    color === "primary"
      ? "border-primary/60 bg-primary/10 text-primary"
      : "border-secondary/60 bg-secondary/10 text-secondary";
  return (
    <div className={`flex rounded-panel border border-outline-variant/60 bg-surface-container-low p-1 ${className}`}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`flex-1 rounded px-2 py-2 font-label text-[10px] tracking-[0.18em] transition ${
            value === option ? activeClass : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
