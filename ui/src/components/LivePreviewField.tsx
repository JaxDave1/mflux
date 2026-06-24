import { ToggleChip } from "./ToggleChip";

export function LivePreviewField({
  value,
  onChange
}: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div>
      <div className="mb-2 font-label text-[10px] tracking-[0.18em] text-on-surface-variant">LIVE PREVIEW</div>
      <ToggleChip
        options={["OFF", "ON"]}
        value={value ? "ON" : "OFF"}
        onChange={(next) => onChange(next === "ON")}
      />
    </div>
  );
}