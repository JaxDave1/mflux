export const modulePanels = {
  img2img: {
    title: "IMG2IMG",
    description: "Reference-driven generation and denoise control.",
    sections: [
      "Source image intake",
      "Denoise strength",
      "Prompt",
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
