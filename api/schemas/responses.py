from datetime import datetime
from typing import Generic, Literal, TypeVar

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
