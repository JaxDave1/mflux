export type SeedMode = "auto" | "manual";

export function randomSeed(): number {
  return Math.floor(Math.random() * 2_147_483_647);
}

export function resolveIntegerSeed(mode: SeedMode, manualValue: string): number | null {
  if (mode === "auto") {
    return randomSeed();
  }
  const trimmed = manualValue.trim();
  if (!trimmed) {
    return null;
  }
  const seed = Number(trimmed);
  return Number.isInteger(seed) ? seed : null;
}

export function parseSeedInput(value: string): { seed?: number | number[] | null; autoSeeds?: number | null } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { seed: null };
  }

  const autoMatch = /^auto:(\d+)$/i.exec(trimmed);
  if (autoMatch) {
    return { autoSeeds: Number(autoMatch[1]), seed: null };
  }

  if (trimmed.includes(",")) {
    const seeds = trimmed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map(Number);
    if (!seeds.length || seeds.some((seed) => !Number.isInteger(seed))) {
      throw new Error("Seed list must contain comma-separated integers.");
    }
    return { seed: seeds };
  }

  const seed = Number(trimmed);
  if (!Number.isInteger(seed)) {
    throw new Error("Seed must be an integer, a comma list, or auto:N.");
  }
  return { seed };
}

export function resolveTxt2ImgSeed(
  mode: SeedMode,
  manualValue: string
): { seed?: number | number[] | null; autoSeeds?: number | null; displaySeed?: string } {
  if (mode === "auto") {
    const seed = randomSeed();
    return { seed, displaySeed: String(seed) };
  }
  return { ...parseSeedInput(manualValue) };
}