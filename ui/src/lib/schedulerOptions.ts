export type SchedulerId = "linear" | "flow_match_euler_discrete";

export interface SchedulerOption {
  value: SchedulerId;
  label: string;
  disabled?: boolean;
}

const ALL_SCHEDULER_IDS: SchedulerId[] = ["linear", "flow_match_euler_discrete"];

const SCHEDULER_LABELS: Record<SchedulerId, string> = {
  linear: "Linear",
  flow_match_euler_discrete: "Flow Match Euler"
};

const MODEL_ALIASES: Record<string, string> = {
  "dev-fill": "fill-dev",
  "dev-fill-catvton": "fill-dev",
  "dev-depth": "depth-dev",
  "dev-controlnet-canny": "controlnet-dev",
  "schnell-controlnet-canny": "controlnet-dev"
};

const MODEL_SCHEDULER_DEFAULTS: Record<string, SchedulerId> = {
  schnell: "linear",
  dev: "linear",
  "krea-dev": "linear",
  "z-image": "flow_match_euler_discrete",
  "z-image-turbo": "linear",
  "qwen-image": "linear",
  "qwen-image-edit": "linear",
  fibo: "flow_match_euler_discrete",
  "fibo-lite": "flow_match_euler_discrete",
  "dev-kontext": "linear",
  "fill-dev": "linear",
  "depth-dev": "linear",
  "controlnet-dev": "linear",
  "flux2-klein-4b": "flow_match_euler_discrete",
  "flux2-klein-9b": "flow_match_euler_discrete",
  "flux2-klein-base-4b": "flow_match_euler_discrete",
  "flux2-klein-base-9b": "flow_match_euler_discrete"
};

const MODEL_COMPATIBLE_SCHEDULERS: Partial<Record<string, SchedulerId[]>> = {
  "z-image": ["flow_match_euler_discrete", "linear"]
};

function canonicalModelId(modelId: string): string {
  return MODEL_ALIASES[modelId] ?? modelId;
}

function compatibleSchedulersForModel(modelId: string): SchedulerId[] {
  const canonical = canonicalModelId(modelId);
  return MODEL_COMPATIBLE_SCHEDULERS[canonical] ?? [defaultSchedulerForModel(modelId)];
}

export function defaultSchedulerForModel(modelId: string): SchedulerId {
  return MODEL_SCHEDULER_DEFAULTS[canonicalModelId(modelId)] ?? "linear";
}

export function isSchedulerCompatible(modelId: string, scheduler: SchedulerId): boolean {
  return compatibleSchedulersForModel(modelId).includes(scheduler);
}

export function schedulerOptionsForModel(modelId: string): SchedulerOption[] {
  const compatible = new Set(compatibleSchedulersForModel(modelId));
  return ALL_SCHEDULER_IDS.map((value) => ({
    value,
    label: SCHEDULER_LABELS[value],
    disabled: !compatible.has(value)
  }));
}

export function normalizeSchedulerForModel(modelId: string, scheduler: string): SchedulerId {
  const candidate = scheduler as SchedulerId;
  if (isSchedulerCompatible(modelId, candidate)) {
    return candidate;
  }
  return defaultSchedulerForModel(modelId);
}