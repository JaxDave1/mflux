export interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: string;
  };
}

export interface SystemStatus {
  platform: string;
  memory: { used: number; total: number; unit: string };
  mlxCache: { used: number; total: number; unit: string };
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
    outputFormat: string;
    quality: number;
    autoSeeds: boolean;
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

export interface Txt2ImgRequest {
  prompt: string;
  negativePrompt?: string;
  model: string;
  quantize?: number | null;
  width: number;
  height: number;
  steps: number;
  guidance: number;
  scheduler: string;
  seed?: number | null;
  output?: string | null;
  metadata?: boolean;
  loraPaths?: string[];
  loraScales?: number[];
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
