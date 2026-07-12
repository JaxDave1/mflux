from datetime import datetime
from typing import Any, Generic, Literal, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class ApiError(BaseModel):
    code: str
    message: str
    details: str | None = None


class ApiEnvelope(BaseModel, Generic[T]):
    ok: bool
    data: T | None = None
    error: ApiError | None = None


class HealthResponse(BaseModel):
    status: str
    version: str
    runtimeReady: bool
    runtimeMessage: str | None = None


class MemoryStat(BaseModel):
    used: float
    total: float
    unit: str


class NeuralEngineStatus(BaseModel):
    active: bool
    load: int
    status: str


class LoadedModel(BaseModel):
    name: str
    quantize: str


class SystemStatus(BaseModel):
    platform: str
    memory: MemoryStat
    mlxCache: MemoryStat
    modelDiskCache: MemoryStat
    cachedModelCount: int = 0
    diskSpace: MemoryStat
    diskPath: str | None = None
    neuralEngine: NeuralEngineStatus
    temperature: int
    activeJobs: int
    loadedModel: LoadedModel | None = None


class ModuleValidation(BaseModel):
    id: str
    validated: bool
    evidencePath: str | None = None
    metadataPath: str | None = None


class RuntimeSummary(BaseModel):
    validatedCount: int
    modules: list[ModuleValidation]


class ModelMetadata(BaseModel):
    minVram: str | None = None
    inferenceSpeed: str | None = None
    precision: str | None = None
    triggerWords: list[str] = []
    notes: str | None = None
    installed: bool = False
    detectedFiles: int = 0
    cached: bool = False
    downloadable: bool = False
    exportable: bool = False
    loraArchitecture: str | None = None


class ModelSummary(BaseModel):
    id: str
    name: str
    type: Literal["checkpoint", "lora", "vae", "upscaler", "depth"]
    architecture: str
    size: str
    path: str
    active: bool
    source: Literal["builtin", "custom", "lora"]
    repoId: str | None = None
    metadata: ModelMetadata


class GenerationJob(BaseModel):
    id: str
    status: Literal["idle", "running", "completed", "failed"]
    startedAt: datetime
    finishedAt: datetime | None = None
    command: list[str] | None = None


JobState = Literal["queued", "running", "succeeded", "failed", "cancelled", "timed_out"]
ModuleName = Literal[
    "txt2img",
    "img2img",
    "flux2_edit",
    "fibo_edit",
    "inpaint",
    "controlnet",
    "kontext",
    "upscaler",
    "depth_pro",
    "model_download",
    "civitai_download",
    "model_export",
]
ProgressSource = Literal["step_parser", "baseline", "indeterminate"]
ErrorType = Literal[
    "invalid_params",
    "concurrent_job_blocked",
    "lora_not_found",
    "lora_incompatible",
    "model_not_found",
    "model_load_failed",
    "gated_repo",
    "subprocess_crashed",
    "output_missing",
    "timed_out",
    "cancelled",
    "already_terminal",
    "internal",
]


class JobProgress(BaseModel):
    step: int | None = None
    total_steps: int | None = None
    percent: int | None = None
    elapsed_ms: int = 0
    eta_ms: int | None = None
    source: ProgressSource = "indeterminate"
    last_stdout_line: str | None = None


class JobOutput(BaseModel):
    output_path: str
    output_url: str | None
    metadata: dict[str, Any] = {}


class JobError(BaseModel):
    type: ErrorType
    message: str
    exit_code: int | None = None
    stderr_tail: str | None = None


class Job(BaseModel):
    id: str
    module: ModuleName
    state: JobState
    command: list[str]
    params: dict[str, Any]
    created_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None
    progress: JobProgress
    output: JobOutput | None = None
    error: JobError | None = None


class JobsListResponse(BaseModel):
    jobs: list[Job]


class JobBaseline(BaseModel):
    median_ms: int
    p90_ms: int
    samples: int


class JobBaselinesResponse(BaseModel):
    baselines: dict[ModuleName, JobBaseline]


class GenerationOutput(BaseModel):
    id: str
    path: str
    thumbnailPath: str | None = None
    moduleType: str | None = None
    prompt: str
    negativePrompt: str = ""
    model: str
    seed: int
    createdAt: datetime
    width: int | None = None
    height: int | None = None
    steps: int | None = None
    guidance: float | None = None
    scheduler: str | None = None
    metadataSource: str | None = None
    baseModel: str | None = None
    precision: str | None = None
    quantize: int | None = None
    generationTimeSeconds: float | None = None
    mfluxVersion: str | None = None


class Txt2ImgResponse(BaseModel):
    job: GenerationJob
    outputs: list[GenerationOutput]


class SingleOutputResponse(BaseModel):
    job: GenerationJob
    output: GenerationOutput


class GalleryResponse(BaseModel):
    total: int
    items: list[GenerationOutput]


class GalleryDeletedItem(BaseModel):
    id: str
    deleted_path: str
    metadata_deleted: bool = False


class GalleryDeleteFailure(BaseModel):
    id: str
    code: str
    message: str
    details: str | None = None


class GalleryBatchDeleteResponse(BaseModel):
    deleted: list[GalleryDeletedItem]
    failed: list[GalleryDeleteFailure]


class GallerySidecarResponse(BaseModel):
    filename: str
    path: str
    content: dict | list | str | int | float | bool | None


class CacheRoots(BaseModel):
    hfHub: str
    mflux: str
    loras: str
    customModels: str


class ModelsResponse(BaseModel):
    builtin: list[ModelSummary]
    custom: list[ModelSummary]
    loras: list[ModelSummary]
    total: int
    cacheRoots: CacheRoots


class CacheDeleteResponse(BaseModel):
    id: str
    deleted_paths: list[str]


class ModelDefaultsResponse(BaseModel):
    steps: int | None
    guidance: float | None
    quantize: int | None
    scheduler: str = "linear"
    supports_negative_prompt: bool = False


class ModuleDefaultsResponse(ModelDefaultsResponse):
    model: str
    width: int
    height: int


class SecretStatus(BaseModel):
    key: str
    is_set: bool


class SecretsResponse(BaseModel):
    tokens: list[SecretStatus]


class TempUploadResponse(BaseModel):
    path: str


class LoraSummary(BaseModel):
    path: str
    name: str
    trigger_words: list[str] | None = None
    size_mb: float
    architecture: str = "unknown"
    compat: Literal["compatible", "unknown", "incompatible"] = "unknown"


class LorasResponse(BaseModel):
    loras: list[LoraSummary]
