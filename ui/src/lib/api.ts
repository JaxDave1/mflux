import type {
  AppConfig,
  DepthProRequest,
  Envelope,
  GalleryResponse,
  ModelsResponse,
  RuntimeSummary,
  SingleOutputResponse,
  SystemStatus,
  Txt2ImgRequest,
  Txt2ImgResponse,
  UpscalerRequest
} from "./types";

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  const response = await fetch(input, {
    headers: isFormData ? undefined : { "Content-Type": "application/json" },
    ...init
  });
  const payload = (await response.json()) as Envelope<T>;
  if (!payload.ok || !payload.data) {
    throw new Error(payload.error?.message ?? "Request failed");
  }
  return payload.data;
}

export const api = {
  health: () => request<{ status: string; version: string }>("/api/health"),
  systemStatus: () => request<SystemStatus>("/api/system/status"),
  runtimeSummary: () => request<RuntimeSummary>("/api/runtime/summary"),
  models: () => request<ModelsResponse>("/api/models"),
  cacheModel: (id: string) =>
    request<{ status: string; id: string }>("/api/models/cache", {
      method: "POST",
      body: JSON.stringify({ id })
    }),
  config: () => request<AppConfig>("/api/config"),
  updateConfig: (config: AppConfig) =>
    request<AppConfig>("/api/config", { method: "PUT", body: JSON.stringify(config) }),
  gallery: () => request<GalleryResponse>("/api/gallery"),
  txt2imgGenerate: (payload: Txt2ImgRequest) =>
    request<Txt2ImgResponse>("/api/txt2img/generate", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  img2imgGenerate: (payload: FormData) =>
    request<Txt2ImgResponse>("/api/img2img/generate", {
      method: "POST",
      body: payload
    }),
  upscalerGenerate: (payload: UpscalerRequest) =>
    request<SingleOutputResponse>("/api/upscaler/generate", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  depthProRun: (payload: DepthProRequest) =>
    request<SingleOutputResponse>("/api/depth-pro/run", {
      method: "POST",
      body: JSON.stringify(payload)
    })
};
