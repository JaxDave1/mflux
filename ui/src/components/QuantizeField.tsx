import { ToggleChip } from "./ToggleChip";
import { normalizeQuantizeSelection, QUANTIZE_CHIP_OPTIONS, type QuantizeSelection } from "../lib/quantize";

export function QuantizeField({
  value,
  onChange
}: {
  value: QuantizeSelection;
  onChange: (value: QuantizeSelection) => void;
}) {
  return (
    <div>
      <div className="mb-2 font-label text-[10px] tracking-[0.18em] text-on-surface-variant">QUANTIZE</div>
      <ToggleChip
        options={[...QUANTIZE_CHIP_OPTIONS]}
        value={value}
        onChange={(next) => onChange(normalizeQuantizeSelection(next))}
      />
      <div className="mt-2 text-xs text-on-surface-variant">
        {value === "OFF"
          ? "Full precision — omits --quantize (higher RAM)."
          : "8-bit MLX quantization — recommended on Apple Silicon."}
      </div>
    </div>
  );
}