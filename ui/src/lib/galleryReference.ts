const GALLERY_MODEL_TO_SLUG: Record<string, string> = {
  "tongyi-mai/z-image-turbo": "z-image-turbo",
  "tongyi-mai/z-image": "z-image",
  "z-image-turbo": "z-image-turbo",
  "z-image": "z-image",
  "black-forest-labs/flux.1-dev": "dev",
  "black-forest-labs/flux.1-schnell": "schnell",
  "flux.1-dev": "dev",
  "flux.1-schnell": "schnell",
  "qwen/qwen-image-edit-2509": "qwen-image-edit",
  "qwen/qwen-image": "qwen-image",
  "qwen-image-edit": "qwen-image-edit",
  "qwen-image": "qwen-image",
  "briaai/fibo": "fibo",
  "fibo": "fibo",
  "black-forest-labs/flux.1-kontext-dev": "dev-kontext",
  "dev-kontext": "dev-kontext",
  "black-forest-labs/flux.1-fill-dev": "dev-fill",
  "dev-fill": "dev-fill",
  "fill-dev": "dev-fill",
  "black-forest-labs/flux.1-depth-dev": "dev-depth",
  "dev-depth": "dev-depth",
  "depth-dev": "dev-depth",
  "black-forest-labs/flux.1-canny-dev": "dev-controlnet-canny",
  "dev-controlnet-canny": "dev-controlnet-canny",
  "controlnet-dev": "dev-controlnet-canny"
};

export type GalleryReference = {
  path: string;
  prompt?: string;
  sourcePrompt?: string;
  width?: number;
  height?: number;
  model?: string;
};

function parseOptionalInt(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function normalizeGalleryModel(raw: string | null | undefined): string | undefined {
  if (!raw) {
    return undefined;
  }

  const normalized = raw.trim().toLowerCase();
  if (GALLERY_MODEL_TO_SLUG[normalized]) {
    return GALLERY_MODEL_TO_SLUG[normalized];
  }

  const tail = normalized.split("/").pop() ?? normalized;
  return GALLERY_MODEL_TO_SLUG[tail];
}

export function modelFromOutputPath(path: string): string | undefined {
  const name = path.replace(/\\/g, "/").split("/").pop() ?? "";
  const match = /^mflux_([^_]+(?:-[^_]+)*)_\d{8}_\d{6}/i.exec(name);
  if (!match) {
    return undefined;
  }
  return normalizeGalleryModel(match[1]);
}

export function parseGalleryReference(searchParams: URLSearchParams): GalleryReference | null {
  const path = searchParams.get("ref")?.trim();
  if (!path) {
    return null;
  }

  const prompt = searchParams.get("prompt")?.trim();
  const sourcePrompt = searchParams.get("sourcePrompt")?.trim();
  const model =
    normalizeGalleryModel(searchParams.get("model")) ?? modelFromOutputPath(path);

  return {
    path,
    prompt: prompt || undefined,
    sourcePrompt: sourcePrompt || undefined,
    width: parseOptionalInt(searchParams.get("width")),
    height: parseOptionalInt(searchParams.get("height")),
    model
  };
}

export function buildGalleryReferenceRoute(
  route: string,
  item: {
    path: string;
    prompt?: string;
    width?: number | null;
    height?: number | null;
    model?: string;
  }
) {
  const params = new URLSearchParams();
  params.set("ref", item.path);

  if (item.prompt?.trim()) {
    if (route === "/img2img") {
      params.set("sourcePrompt", item.prompt.trim());
    } else {
      params.set("prompt", item.prompt.trim());
    }
  }
  if (item.width && item.width > 0) {
    params.set("width", String(item.width));
  }
  if (item.height && item.height > 0) {
    params.set("height", String(item.height));
  }
  if (item.model && item.model !== "unknown") {
    params.set("model", item.model);
  }

  return `${route}?${params.toString()}`;
}