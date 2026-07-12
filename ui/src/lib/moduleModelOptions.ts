import { isLocallyAvailable } from "./checkpointOptions";
import { formatModelLabel } from "./labels";
import type { ModelSummary, ModelsResponse } from "./types";

export type ModuleModelScope =
  | "txt2img"
  | "img2img"
  | "flux2_edit"
  | "fibo_edit"
  | "inpaint"
  | "kontext"
  | "controlnet"
  | "config";

export interface ModuleModelOption {
  value: string;
  label: string;
}

const MODULE_MODEL_ALLOWLISTS: Record<ModuleModelScope, readonly string[]> = {
  txt2img: [
    "dev",
    "schnell",
    "krea-dev",
    "z-image",
    "z-image-turbo",
    "qwen-image",
    "fibo",
    "fibo-lite",
    "flux2-klein-4b",
    "flux2-klein-9b",
    "flux2-klein-base-4b",
    "flux2-klein-base-9b"
  ],
  img2img: [
    "dev",
    "schnell",
    "krea-dev",
    "z-image",
    "z-image-turbo",
    "qwen-image",
    "qwen-image-edit",
    "fibo",
    "fibo-lite",
    "flux2-klein-4b",
    "flux2-klein-9b",
    "flux2-klein-base-4b",
    "flux2-klein-base-9b"
  ],
  flux2_edit: ["flux2-klein-4b", "flux2-klein-9b", "flux2-klein-base-4b", "flux2-klein-base-9b"],
  fibo_edit: ["fibo-edit", "fibo-edit-rmbg"],
  inpaint: ["dev-fill", "dev-fill-catvton"],
  kontext: ["dev-kontext"],
  controlnet: ["dev-controlnet-canny", "schnell-controlnet-canny"],
  config: [
    "dev",
    "schnell",
    "krea-dev",
    "z-image",
    "z-image-turbo",
    "qwen-image",
    "fibo",
    "fibo-lite",
    "flux2-klein-4b",
    "flux2-klein-9b",
    "flux2-klein-base-4b",
    "flux2-klein-base-9b"
  ]
};

function moduleOptionLabel(model: ModelSummary): string {
  if (model.active) {
    return `${model.name} (active)`;
  }
  if (!isLocallyAvailable(model)) {
    return `${model.name} (not downloaded)`;
  }
  return model.name;
}

function allowlistIndex(scope: ModuleModelScope, modelId: string): number {
  const allowlist = MODULE_MODEL_ALLOWLISTS[scope];
  const index = allowlist.indexOf(modelId);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

export function buildModuleModelOptions(
  data: ModelsResponse | null,
  scope: ModuleModelScope,
  selectedValue?: string | null
): ModuleModelOption[] {
  const allowlist = new Set(MODULE_MODEL_ALLOWLISTS[scope]);
  const builtin = (data?.builtin ?? []).filter((model) => allowlist.has(model.id));

  const downloaded = builtin
    .filter((model) => isLocallyAvailable(model))
    .sort(
      (left, right) =>
        allowlistIndex(scope, left.id) - allowlistIndex(scope, right.id) ||
        left.name.localeCompare(right.name)
    )
    .map((model) => ({
      value: model.id,
      label: moduleOptionLabel(model)
    }));

  if (downloaded.length) {
    return ensureSelectedOption(downloaded, selectedValue);
  }

  const fallback = builtin
    .sort(
      (left, right) =>
        allowlistIndex(scope, left.id) - allowlistIndex(scope, right.id) ||
        left.name.localeCompare(right.name)
    )
    .map((model) => ({
      value: model.id,
      label: moduleOptionLabel(model)
    }));

  return ensureSelectedOption(fallback, selectedValue);
}

function ensureSelectedOption(options: ModuleModelOption[], selectedValue?: string | null): ModuleModelOption[] {
  if (!selectedValue || options.some((option) => option.value === selectedValue)) {
    return options;
  }
  return [...options, { value: selectedValue, label: formatModelLabel(selectedValue) }];
}

export function resolveDefaultModuleModel(
  options: ModuleModelOption[],
  preferredModel?: string | null
): string {
  if (!options.length) {
    return preferredModel ?? "";
  }
  if (preferredModel && options.some((option) => option.value === preferredModel)) {
    return preferredModel;
  }
  const downloaded = options.find((option) => !option.label.includes("(not downloaded)"));
  return downloaded?.value ?? options[0].value;
}

export function moduleModelAllowlist(scope: ModuleModelScope): readonly string[] {
  return MODULE_MODEL_ALLOWLISTS[scope];
}