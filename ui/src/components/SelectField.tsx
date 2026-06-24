export function SelectField({
  label,
  value,
  onChange,
  options,
  className = ""
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-2 ${className}`}>
      <span className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-panel border border-outline-variant/60 bg-surface-container px-3 py-3 text-sm outline-none transition focus:border-secondary/60 focus:shadow-glow-secondary"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
            {option.disabled ? " (incompatible)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
