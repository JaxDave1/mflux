export type QuantizeSelection = "8" | "OFF";

export const QUANTIZE_CHIP_OPTIONS: QuantizeSelection[] = ["8", "OFF"];

export function normalizeQuantizeSelection(value: string): QuantizeSelection {
  return value === "OFF" ? "OFF" : "8";
}

export function quantizeSelectionFromApi(value: number | null | undefined): QuantizeSelection {
  if (value === null || value === undefined) {
    return "OFF";
  }
  return "8";
}

export function quantizeApiValue(selection: QuantizeSelection): number | null {
  return selection === "OFF" ? null : 8;
}