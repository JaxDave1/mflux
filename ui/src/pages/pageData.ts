export const txt2imgModelOptions = [
  { value: "dev", label: "FLUX.1-dev" },
  { value: "schnell", label: "FLUX.1-schnell" },
  { value: "z-image-turbo", label: "Z-Image Turbo" },
  { value: "qwen-image", label: "Qwen Image" },
  { value: "fibo", label: "FIBO" }
];

export const img2imgModelOptions = [
  { value: "dev", label: "FLUX.1-dev" },
  { value: "schnell", label: "FLUX.1-schnell" },
  { value: "z-image-turbo", label: "Z-Image Turbo" },
  { value: "qwen-image-edit", label: "Qwen Image Edit" },
  { value: "fibo", label: "FIBO" }
];

export const inpaintModelOptions = [
  { value: "dev-fill", label: "FLUX.1 Fill Dev" }
];

export const kontextModelOptions = [
  { value: "dev-kontext", label: "FLUX.1 Kontext Dev" }
];

export const schedulerOptions = [
  { value: "linear", label: "Linear" }
];

export const modulePanels = {
  img2img: {
    title: "IMG2IMG",
    description: "Reference-driven generation and denoise control.",
    sections: [
      "Source image intake",
      "Denoise strength",
      "Prompt and negative prompt",
      "Output resolution and seeds"
    ]
  },
  inpaint: {
    title: "INPAINT",
    description: "Masked fill workflow with prompt-driven completion.",
    sections: ["Source image", "Mask image", "Prompt", "Resolution", "Fill guidance"]
  },
  controlnet: {
    title: "CONTROLNET",
    description: "Canny and conditioned generation control surface.",
    sections: ["Prompt", "Control image", "Control strength", "Model and seed"]
  },
  kontext: {
    title: "KONTEXT",
    description: "Image-conditioned edit flow using Flux Kontext.",
    sections: ["Prompt", "Reference image", "Context resolution", "Scheduler"]
  },
  upscaler: {
    title: "UPSCALER",
    description: "SeedVR2 diffusion super-resolution workflow.",
    sections: ["Source image", "Resolution target", "Softness", "Output path"]
  },
  depthPro: {
    title: "DEPTH PRO",
    description: "Apple monocular depth extraction and export.",
    sections: ["Input image", "Output depth map", "PNG export", "Workflow status"]
  },
  models: {
    title: "MODELS",
    description: "Checkpoint, LoRA, and runtime model registry.",
    sections: ["Active model", "Supported families", "Trigger words", "Precision profile"]
  },
  gallery: {
    title: "GALLERY",
    description: "Generation history, metadata, and favorites.",
    sections: ["Recent outputs", "Favorites", "Metadata recall", "Output browsing"]
  }
} as const;
