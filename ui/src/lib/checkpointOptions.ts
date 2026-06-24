import { formatModelLabel } from "./labels";
import type { LoraSummary, ModelSummary, ModelsResponse } from "./types";

export interface CheckpointOption {
  value: string;
  label: string;
}

export function isLocallyAvailable(model: ModelSummary): boolean {
  if (model.source === "custom" || model.source === "lora") {
    return true;
  }
  return Boolean(model.metadata.cached || model.metadata.installed);
}

export function downloadedModels(data: ModelsResponse): ModelSummary[] {
  const builtins = data.builtin.filter((model) => isLocallyAvailable(model));
  return [...builtins, ...data.custom, ...data.loras];
}

export function checkpointCompatId(model: ModelSummary): string {
  if (model.source === "custom") {
    const filename = model.path.split("/").pop() ?? model.name;
    return filename.replace(/\.[^.]+$/, "");
  }
  return model.id;
}

function checkpointOptionLabel(model: ModelSummary): string {
  if (model.active) {
    return `${model.name} (active)`;
  }
  if (model.source === "custom") {
    return `${model.name} (local)`;
  }
  if (model.type !== "checkpoint") {
    return `${model.name} (${model.type})`;
  }
  return model.name;
}

export function buildCheckpointOptions(data: ModelsResponse | null): CheckpointOption[] {
  if (!data) {
    return [];
  }

  const available: Array<CheckpointOption & { rank: number }> = [];

  data.builtin.forEach((model) => {
    if (!isLocallyAvailable(model)) {
      return;
    }
    available.push({
      value: model.id,
      label: checkpointOptionLabel(model),
      rank: model.active ? 0 : model.type === "checkpoint" ? 1 : 2
    });
  });

  data.custom.forEach((model) => {
    available.push({
      value: model.id,
      label: checkpointOptionLabel(model),
      rank: 3
    });
  });

  if (available.length) {
    return available
      .sort((left, right) => left.rank - right.rank || left.label.localeCompare(right.label))
      .map(({ value, label }) => ({ value, label }));
  }

  return data.builtin
    .map((model) => ({
      value: model.id,
      label: isLocallyAvailable(model) ? checkpointOptionLabel(model) : `${model.name} (not downloaded)`
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function resolveDefaultCheckpoint(
  data: ModelsResponse | null,
  options: CheckpointOption[],
  preferredModel?: string | null
): string {
  if (!options.length) {
    return "";
  }
  if (preferredModel && options.some((option) => option.value === preferredModel)) {
    return preferredModel;
  }
  const active = data?.builtin.find((model) => model.active && isLocallyAvailable(model));
  if (active && options.some((option) => option.value === active.id)) {
    return active.id;
  }
  return options[0].value;
}

export function resolveCheckpointModel(
  data: ModelsResponse | null,
  checkpointId: string
): ModelSummary | undefined {
  if (!data || !checkpointId) {
    return undefined;
  }
  return data.builtin.find((model) => model.id === checkpointId) ?? data.custom.find((model) => model.id === checkpointId);
}

export function loraSummaryToModelSummary(lora: LoraSummary): ModelSummary {
  return {
    id: `lora-${lora.path}`,
    name: lora.name,
    type: "lora",
    architecture: lora.architecture,
    size: `${lora.size_mb}MB`,
    path: lora.path,
    active: false,
    source: "lora",
    repoId: null,
    metadata: {
      notes:
        lora.compat === "compatible"
          ? "Compatible with the selected checkpoint."
          : lora.compat === "unknown"
            ? "Architecture not detected. Compatibility cannot be verified."
            : "Incompatible with the selected checkpoint.",
      installed: true,
      detectedFiles: 1,
      cached: true,
      triggerWords: lora.trigger_words ?? [],
      loraArchitecture: lora.architecture,
      loraCompat: lora.compat
    }
  };
}

export function formatCheckpointLabel(checkpointId: string) {
  return formatModelLabel(checkpointId);
}