const MODEL_LABEL_OVERRIDES: Record<string, string> = {
  "black-forest-labs/flux.1-dev": "FLUX.1 Dev",
  "black-forest-labs/flux.1-schnell": "FLUX.1 Schnell",
  "black-forest-labs/flux.1-fill-dev": "FLUX.1 Fill Dev",
  "black-forest-labs/flux.1-kontext-dev": "FLUX.1 Kontext Dev",
  "tongyi-mai/z-image": "Z-Image",
  "tongyi-mai/z-image-turbo": "Z-Image Turbo",
  "qwen/qwen-image": "Qwen Image",
  "qwen/qwen-image-edit-2509": "Qwen Image Edit",
  "briaai/fibo": "FIBO",
  "briaai/fibo-edit": "FIBO Edit",
  "briaai/fibo-lite": "FIBO Lite",
  "numz/seedvr2_comfyui": "SeedVR2",
  "depth-pro": "Depth Pro",
  "seedvr2-3b": "SeedVR2 3B",
  "seedvr2-7b": "SeedVR2 7B",
  "z-image": "Z-Image",
  "z-image-turbo": "Z-Image Turbo",
  "qwen-image": "Qwen Image",
  "qwen-image-edit": "Qwen Image Edit",
  "fibo": "FIBO",
  "fibo-edit": "FIBO Edit",
  "fibo-lite": "FIBO Lite",
  "flux.1-dev": "FLUX.1 Dev",
  "flux.1-schnell": "FLUX.1 Schnell",
  "flux.1-fill-dev": "FLUX.1 Fill Dev",
  "flux.1-kontext-dev": "FLUX.1 Kontext Dev"
};

function titleCaseLabel(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((token) => {
      if (/^[a-z]*\d+(\.\d+)?[a-z]*$/i.test(token) || token === token.toUpperCase()) {
        return token.toUpperCase();
      }
      return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
    })
    .join(" ");
}

export function formatModelLabel(model: string | null | undefined) {
  if (!model) {
    return "Unknown Model";
  }

  const normalized = model.trim();
  const key = normalized.toLowerCase();
  if (MODEL_LABEL_OVERRIDES[key]) {
    return MODEL_LABEL_OVERRIDES[key];
  }

  const tail = normalized.split("/").pop() ?? normalized;
  const tailKey = tail.toLowerCase();
  if (MODEL_LABEL_OVERRIDES[tailKey]) {
    return MODEL_LABEL_OVERRIDES[tailKey];
  }

  return titleCaseLabel(tail.replace(/\./g, ". "));
}
