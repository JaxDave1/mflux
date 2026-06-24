import { GenerateButton } from "./GenerateButton";
import { ToggleChip } from "./ToggleChip";
import { randomSeed, type SeedMode } from "../lib/seed";

export function SeedField({
  mode,
  onModeChange,
  value,
  onChange,
  variant = "integer",
  className = ""
}: {
  mode: SeedMode;
  onModeChange: (mode: SeedMode) => void;
  value: string;
  onChange: (value: string) => void;
  variant?: "integer" | "advanced";
  className?: string;
}) {
  const isAuto = mode === "auto";

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">SEED</span>
        <ToggleChip
          options={["AUTO", "MANUAL"]}
          value={isAuto ? "AUTO" : "MANUAL"}
          onChange={(next) => onModeChange(next === "AUTO" ? "auto" : "manual")}
        />
      </div>
      {isAuto ? (
        <div className="rounded-panel border border-outline-variant/60 bg-surface-container px-3 py-3 text-sm text-on-surface-variant">
          Random seed on each run
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            className="rounded-panel border border-outline-variant/60 bg-surface-container px-3 py-3 text-sm outline-none transition focus:border-secondary/60"
            type={variant === "integer" ? "number" : "text"}
            value={value}
            placeholder={variant === "advanced" ? "42, 1,2,3, or auto:4" : "42"}
            onChange={(event) => onChange(event.target.value)}
          />
          <GenerateButton
            onClick={() => onChange(String(randomSeed()))}
            label="RANDOM"
            icon="casino"
            variant="outline"
          />
        </div>
      )}
    </div>
  );
}