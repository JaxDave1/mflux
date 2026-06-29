export interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: string;
  };
}

export interface HealthResponse {
  status: "healthy" | "degraded";
  version: string;
  runtimeReady: boolean;
  runtimeMessage?: string | null;
}

export interface SystemStatus {
  platform: string;
  memory: { used: number; total: number; unit: string };
  mlxCache: { used: number; total: number; unit: string };
  modelDiskCache: { used: number; total: number; unit: string };
  cachedModelCount: number;
  diskSpace: { used: number; total: number; unit: string };
  diskPath?: string | null;
  neuralEngine: { active: boolean; load: number; status: string };
  temperature: number;
  activeJobs: number;
  loadedModel: { name: string; quantize: string } | null;
}

export interface RuntimeSummary {
  validatedCount: number;
  modules: Array<{
    id: string;
    validated: boolean;
    evidencePath?: string | null;
    metadataPath?: string | null;
  }>;
}

export interface ModelSummary {
  id: string;
  name: string;
  type: "checkpoint" | "lora" | "vae" | "upscaler" | "depth";
  architecture: string;
  size: string;
  path: string;
  active: boolean;
  source: "builtin" | "custom" | "lora";
  repoId?: string | null;
  metadata: {
    minVram?: string;
    inferenceSpeed?: string;
    precision?: string;
    triggerWords?: string[];
    notes?: string;
    installed?: boolean;
    detectedFiles?: number;
    cached?: boolean;
    downloadable?: boolean;
    exportable?: boolean;
    loraArchitecture?: string | null;
    loraCompat?: "compatible" | "unknown" | "incompatible";
  };
}

export interface ModelsResponse {
  builtin: ModelSummary[];
  custom: ModelSummary[];
  loras: ModelSummary[];
  total: number;
  cacheRoots: {
    hfHub: string;
    mflux: string;
    loras: string;
    customModels: string;
  };
}

export interface CacheDeleteResponse {
  id: string;
  deleted_paths: string[];
}

export interface ModelDefaultsResponse {
  steps: number | null;
  guidance: number | null;
  quantize: number | null;
  scheduler: string;
  supports_negative_prompt: boolean;
}

export interface ModuleDefaultsResponse extends ModelDefaultsResponse {
  model: string;
  width: number;
  height: number;
}

export interface SecretStatus {
  key: "hf" | "civitai";
  is_set: boolean;
}

export interface SecretsResponse {
  tokens: SecretStatus[];
}

export interface TempUploadResponse {
  path: string;
}

export interface AppConfig {
  paths: {
    hfHome: string;
    modelDir: string;
    outputDir: string;
    loraDir: string;
  };
  generation: {
    defaultModel: string;
    defaultQuantize: number;
    defaultSteps: number;
    outputFormat: "png";
    quality: number;
    autoSeeds: boolean;
    saveMetadataSidecar: boolean;
  };
  system: {
    cacheLimit: number;
    lowRamMode: boolean;
    livePreview: boolean;
  };
  backend: {
    serverUrl: string;
    port: number;
    autoOpenBrowser: boolean;
  };
}

export type ModuleName =
  | "txt2img"
  | "img2img"
  | "inpaint"
  | "controlnet"
  | "kontext"
  | "upscaler"
  | "depth_pro"
  | "model_download"
  | "civitai_download"
  | "model_export";

export type JobState = "queued" | "running" | "succeeded" | "failed" | "cancelled" | "timed_out";

export interface JobProgress {
  step: number | null;
  total_steps: number | null;
  percent: number | null;
  elapsed_ms: number;
  eta_ms: number | null;
  source: "step_parser" | "baseline" | "indeterminate";
  last_stdout_line: string | null;
}

export interface JobOutput {
  output_path: string;
  output_url: string | null;
  metadata: Record<string, unknown>;
}

export interface JobError {
  type: string;
  message: string;
  exit_code: number | null;
  stderr_tail: string | null;
}

export interface Job {
  id: string;
  module: ModuleName;
  state: JobState;
  command: string[];
  params: Record<string, unknown>;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  progress: JobProgress;
  output: JobOutput | null;
  error: JobError | null;
}

export interface GenerationJob {
  id: string;
  status: "idle" | "running" | "completed" | "failed";
  startedAt: string;
  finishedAt?: string;
  command?: string[];
}

export interface GenerationOutput {
  id: string;
  path: string;
  thumbnailPath?: string;
  moduleType?: string | null;
  prompt: string;
  negativePrompt?: string;
  model: string;
  seed: number;
  createdAt: string;
  width?: number | null;
  height?: number | null;
  steps?: number | null;
  guidance?: number | null;
  scheduler?: string | null;
  metadataSource?: string | null;
  baseModel?: string | null;
  precision?: string | null;
  quantize?: number | null;
  generationTimeSeconds?: number | null;
  mfluxVersion?: string | null;
}

export interface GalleryResponse {
  total: number;
  items: GenerationOutput[];
}

export interface GalleryDeleteResponse {
  deleted_path: string;
  metadata_deleted: boolean;
}

export interface GalleryRevealResponse {
  status: string;
}

export interface GallerySidecarResponse {
  filename: string;
  path: string;
  content: unknown;
}

export interface Txt2ImgRequest {
  prompt: string;
  negativePrompt?: string;
  model: string;
  quantize?: number | null;
  width: number;
  height: number;
  steps: number;
  guidance: number | null;
  scheduler: string;
  seed?: number | number[] | null;
  autoSeeds?: number | null;
  output?: string | null;
  metadata?: boolean;
  lowRam?: boolean;
  livePreview?: boolean;
  loras?: Array<{ path: string; strength: number }>;
}

export interface Txt2ImgResponse {
  job: GenerationJob;
  outputs: GenerationOutput[];
}

export interface Img2ImgFormState {
  prompt: string;
  negativePrompt: string;
  model: string;
  quantize: string;
  width: number;
  height: number;
  steps: number;
  guidance: number;
  scheduler: string;
  seed: string;
  imageStrength: number;
}

export interface UpscalerRequest {
  imagePath: string;
  model: string;
  quantize?: number | null;
  resolution: string;
  softness: number;
  seed?: number | null;
  output?: string | null;
  metadata?: boolean;
}

export interface DepthProRequest {
  imagePath: string;
  quantize?: number | null;
  output?: string | null;
}

export interface SingleOutputResponse {
  job: GenerationJob;
  output: GenerationOutput;
}

export interface JobCreateRequest {
  module: ModuleName;
  params: Record<string, unknown>;
}

export interface JobsListResponse {
  jobs: Job[];
}

export interface JobBaselinesResponse {
  baselines: Record<ModuleName, { median_ms: number; p90_ms: number; samples: number }>;
}

export interface LoraSummary {
  path: string;
  name: string;
  trigger_words?: string[] | null;
  size_mb: number;
  architecture: string;
  compat: "compatible" | "unknown" | "incompatible";
}

export interface LorasResponse {
  loras: LoraSummary[];
}
