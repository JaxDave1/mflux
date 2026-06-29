import type {
  AppConfig,
  Envelope,
  GalleryBatchDeleteResponse,
  GalleryResponse,
  GalleryDeleteResponse,
  GalleryRevealResponse,
  GallerySidecarResponse,
  HealthResponse,
  Job,
  JobBaselinesResponse,
  JobCreateRequest,
  LorasResponse,
  JobsListResponse,
  ModelDefaultsResponse,
  CacheDeleteResponse,
  ModelsResponse,
  ModuleDefaultsResponse,
  RuntimeSummary,
  SecretsResponse,
  SystemStatus,
  TempUploadResponse,
} from "./types";
import { BACKEND_UNAVAILABLE_MESSAGE, INVALID_API_RESPONSE_MESSAGE } from "./fallbacks";

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  let response: Response;
  try {
    response = await fetch(input, {
      headers: isFormData ? undefined : { "Content-Type": "application/json" },
      ...init
    });
  } catch {
    throw new Error(BACKEND_UNAVAILABLE_MESSAGE);
  }

  const raw = await response.text();
  if (!raw) {
    throw new Error(response.ok ? INVALID_API_RESPONSE_MESSAGE : `Backend request failed (${response.status}).`);
  }

  let payload: Envelope<T>;
  try {
    payload = JSON.parse(raw) as Envelope<T>;
  } catch {
    throw new Error(INVALID_API_RESPONSE_MESSAGE);
  }

  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Backend request failed (${response.status}).`);
  }

  if (!payload.ok || payload.data === undefined || payload.data === null) {
    throw new Error(payload.error?.message ?? "Request failed");
  }
  return payload.data;
}

export const api = {
  health: () => request<HealthResponse>("/api/health"),
  systemStatus: () => request<SystemStatus>("/api/system/status"),
  runtimeSummary: () => request<RuntimeSummary>("/api/runtime/summary"),
  models: () => request<ModelsResponse>("/api/models"),
  loras: (compatibleWith?: string) =>
    request<LorasResponse>(
      `/api/models/loras${compatibleWith ? `?compatible_with=${encodeURIComponent(compatibleWith)}` : ""}`
    ),
  modelDefaults: (name: string) => request<ModelDefaultsResponse>(`/api/models/${encodeURIComponent(name)}/defaults`),
  moduleDefaults: (module: string) =>
    request<ModuleDefaultsResponse>(`/api/modules/${encodeURIComponent(module)}/defaults`),
  cacheModel: (id: string) =>
    request<{ status: string; id: string }>("/api/models/cache", {
      method: "POST",
      body: JSON.stringify({ id })
    }),
  deleteModelCache: (id: string) =>
    request<CacheDeleteResponse>(`/api/models/cache/${encodeURIComponent(id)}`, {
      method: "DELETE"
    }),
  config: () => request<AppConfig>("/api/config"),
  updateConfig: (config: AppConfig) =>
    request<AppConfig>("/api/config", { method: "PUT", body: JSON.stringify(config) }),
  secrets: () => request<SecretsResponse>("/api/secrets"),
  setSecret: (key: string, value: string) =>
    request<Record<string, never>>(`/api/secrets/${encodeURIComponent(key)}`, {
      method: "PUT",
      body: JSON.stringify({ value })
    }),
  clearSecret: (key: string) =>
    request<Record<string, never>>(`/api/secrets/${encodeURIComponent(key)}`, {
      method: "DELETE"
    }),
  uploadTempImage: (file: File) => {
    const data = new FormData();
    data.append("file", file);
    return request<TempUploadResponse>("/api/uploads/temp", {
      method: "POST",
      body: data
    });
  },
  gallery: () => request<GalleryResponse>("/api/gallery"),
  deleteGalleryItems: (ids: string[]) =>
    request<GalleryBatchDeleteResponse>("/api/gallery", {
      method: "DELETE",
      body: JSON.stringify({ ids })
    }),
  deleteGalleryItem: (id: string) =>
    request<GalleryDeleteResponse>(`/api/gallery/${encodeURIComponent(id)}`, {
      method: "DELETE"
    }),
  revealGalleryItem: (id: string) =>
    request<GalleryRevealResponse>(`/api/gallery/${encodeURIComponent(id)}/reveal`, {
      method: "POST",
      body: JSON.stringify({})
    }),
  gallerySidecar: (id: string) =>
    request<GallerySidecarResponse>(`/api/gallery/${encodeURIComponent(id)}/sidecar`),
  createJob: (payload: JobCreateRequest | FormData) =>
    request<Job>("/api/jobs", {
      method: "POST",
      body: payload instanceof FormData ? payload : JSON.stringify(payload)
    }),
  jobs: (includeTerminal = false) =>
    request<JobsListResponse>(`/api/jobs${includeTerminal ? "?include_terminal=true" : ""}`),
  job: (id: string) => request<Job>(`/api/jobs/${id}`),
  cancelJob: (id: string) =>
    request<Job>(`/api/jobs/${id}`, {
      method: "DELETE"
    }),
  jobBaselines: () => request<JobBaselinesResponse>("/api/jobs/baselines")
};
