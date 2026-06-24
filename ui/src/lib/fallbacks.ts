import type { ModelsResponse, SystemStatus } from "./types";

export const BACKEND_UNAVAILABLE_MESSAGE =
  "Backend API unavailable. Start the MFLUX API on http://127.0.0.1:8189.";

export const INVALID_API_RESPONSE_MESSAGE =
  "Backend returned an invalid response. Check the Vite proxy and API server.";

export const offlineSystemStatus: SystemStatus = {
  platform: "Apple Silicon",
  memory: { used: 0, total: 0, unit: "GB" },
  mlxCache: { used: 0, total: 0, unit: "GB" },
  modelDiskCache: { used: 0, total: 0, unit: "GB" },
  cachedModelCount: 0,
  diskSpace: { used: 0, total: 0, unit: "GB" },
  diskPath: null,
  neuralEngine: { active: false, load: 0, status: "offline" },
  temperature: 0,
  activeJobs: 0,
  loadedModel: { name: "FLUX.1 Dev", quantize: "q8" }
};

export const offlineModelsResponse: ModelsResponse = {
  builtin: [
    {
      id: "dev",
      name: "FLUX.1 Dev",
      type: "checkpoint",
      architecture: "FLUX.1",
      size: "12B",
      path: "black-forest-labs/FLUX.1-dev",
      active: true,
      source: "builtin",
      repoId: "black-forest-labs/FLUX.1-dev",
      metadata: {
        notes: "Primary FLUX.1 quality model.",
        installed: false,
        detectedFiles: 0,
        cached: false,
        downloadable: false
      }
    },
    {
      id: "schnell",
      name: "FLUX.1 Schnell",
      type: "checkpoint",
      architecture: "FLUX.1",
      size: "12B",
      path: "black-forest-labs/FLUX.1-schnell",
      active: false,
      source: "builtin",
      repoId: "black-forest-labs/FLUX.1-schnell",
      metadata: {
        notes: "Fast distilled FLUX.1 generation path.",
        installed: false,
        detectedFiles: 0,
        cached: false,
        downloadable: false
      }
    },
    {
      id: "dev-fill",
      name: "FLUX.1 Fill Dev",
      type: "checkpoint",
      architecture: "FLUX.1 Fill",
      size: "12B",
      path: "black-forest-labs/FLUX.1-Fill-dev",
      active: false,
      source: "builtin",
      repoId: "black-forest-labs/FLUX.1-Fill-dev",
      metadata: {
        notes: "Prompt-driven fill and inpaint family.",
        installed: false,
        detectedFiles: 0,
        cached: false,
        downloadable: false
      }
    },
    {
      id: "dev-kontext",
      name: "FLUX.1 Kontext Dev",
      type: "checkpoint",
      architecture: "FLUX.1 Kontext",
      size: "12B",
      path: "black-forest-labs/FLUX.1-Kontext-dev",
      active: false,
      source: "builtin",
      repoId: "black-forest-labs/FLUX.1-Kontext-dev",
      metadata: {
        notes: "Image-conditioned Kontext generation family.",
        installed: false,
        detectedFiles: 0,
        cached: false,
        downloadable: false
      }
    },
    {
      id: "dev-depth",
      name: "FLUX.1 Depth Dev",
      type: "checkpoint",
      architecture: "FLUX.1 Depth",
      size: "12B",
      path: "black-forest-labs/FLUX.1-Depth-dev",
      active: false,
      source: "builtin",
      repoId: "black-forest-labs/FLUX.1-Depth-dev",
      metadata: {
        notes: "Depth-conditioned FLUX workflow.",
        installed: false,
        detectedFiles: 0,
        cached: false,
        downloadable: false
      }
    },
    {
      id: "z-image-turbo",
      name: "Z-Image Turbo",
      type: "checkpoint",
      architecture: "Z-Image",
      size: "6B",
      path: "Tongyi-MAI/Z-Image-Turbo",
      active: false,
      source: "builtin",
      repoId: "Tongyi-MAI/Z-Image-Turbo",
      metadata: {
        notes: "Fast distilled image model with strong local performance.",
        installed: false,
        detectedFiles: 0,
        cached: false,
        downloadable: false,
        triggerWords: ["realism", "stylized"]
      }
    },
    {
      id: "seedvr2-3b",
      name: "SeedVR2 3B",
      type: "upscaler",
      architecture: "SeedVR2",
      size: "3B",
      path: "numz/SeedVR2_comfyUI",
      active: false,
      source: "builtin",
      repoId: "numz/SeedVR2_comfyUI",
      metadata: {
        notes: "Dedicated super-resolution upscaler.",
        installed: false,
        detectedFiles: 0,
        cached: false,
        downloadable: false
      }
    },
    {
      id: "depth-pro",
      name: "Depth Pro",
      type: "depth",
      architecture: "Depth Pro",
      size: "Apple",
      path: "depth_pro",
      active: false,
      source: "builtin",
      repoId: null,
      metadata: {
        notes: "Apple monocular depth estimation.",
        installed: false,
        detectedFiles: 0,
        cached: false,
        downloadable: false
      }
    }
  ],
  custom: [],
  loras: [],
  total: 8,
  cacheRoots: {
    hfHub: "~/.cache/huggingface/hub",
    mflux: "~/Library/Caches/mflux",
    loras: "~/Library/Caches/mflux/loras",
    customModels: "~/models"
  }
};
