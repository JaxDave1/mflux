from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class LoraSelection(BaseModel):
    path: str = Field(min_length=1)
    strength: float = Field(default=1.0, ge=0.0, le=2.0)


class Txt2ImgRequest(BaseModel):
    prompt: str = Field(min_length=1)
    negativePrompt: str = ""
    model: str
    quantize: int | None = Field(default=None, ge=3, le=8)
    width: int = Field(default=1024, ge=256, le=2048)
    height: int = Field(default=1024, ge=256, le=2048)
    steps: int = Field(default=25, ge=1, le=100)
    guidance: float | None = Field(default=3.5, ge=0)
    scheduler: str = "linear"
    seed: int | list[int] | None = None
    autoSeeds: int | None = Field(default=None, ge=1, le=128)
    output: str | None = None
    metadata: bool = True
    lowRam: bool = False
    livePreview: bool = False
    stepwiseOutputDir: str | None = None
    loras: list[LoraSelection] = Field(default_factory=list)
    loraPaths: list[str] = Field(default_factory=list)
    loraScales: list[float] = Field(default_factory=list)

    @model_validator(mode="after")
    def sync_lora_fields(self) -> "Txt2ImgRequest":
        if self.loras:
            self.loraPaths = [lora.path for lora in self.loras]
            self.loraScales = [lora.strength for lora in self.loras]
        return self


class Img2ImgRequest(BaseModel):
    prompt: str = Field(min_length=1)
    negativePrompt: str = ""
    model: str
    quantize: int | None = Field(default=None, ge=3, le=8)
    width: int = Field(default=1024, ge=256, le=2048)
    height: int = Field(default=1024, ge=256, le=2048)
    steps: int = Field(default=25, ge=1, le=100)
    guidance: float = Field(default=3.5, gt=0)
    scheduler: str = "linear"
    seed: int | None = None
    output: str | None = None
    metadata: bool = True
    imagePath: str = Field(min_length=1)
    imageStrength: float = Field(default=0.75, ge=0.0, le=1.0)
    livePreview: bool = False
    stepwiseOutputDir: str | None = None
    loraPaths: list[str] = Field(default_factory=list)
    loraScales: list[float] = Field(default_factory=list)


class InpaintRequest(BaseModel):
    prompt: str = Field(min_length=1)
    model: str
    quantize: int | None = Field(default=None, ge=3, le=8)
    width: int = Field(default=1024, ge=256, le=2048)
    height: int = Field(default=1024, ge=256, le=2048)
    steps: int = Field(default=25, ge=1, le=100)
    guidance: float = Field(default=30.0, gt=0)
    scheduler: str = "linear"
    seed: int | None = None
    output: str | None = None
    metadata: bool = True
    imagePath: str = Field(min_length=1)
    maskedImagePath: str = Field(min_length=1)
    livePreview: bool = False
    stepwiseOutputDir: str | None = None
    loraPaths: list[str] = Field(default_factory=list)
    loraScales: list[float] = Field(default_factory=list)


class Flux2EditRequest(BaseModel):
    prompt: str = Field(min_length=1)
    model: str
    imagePaths: list[str] = Field(min_length=1, max_length=4)
    quantize: int | None = Field(default=None, ge=3, le=8)
    width: int = Field(default=1024, ge=256, le=2048)
    height: int = Field(default=1024, ge=256, le=2048)
    steps: int = Field(default=4, ge=1, le=100)
    guidance: float | None = Field(default=None, ge=0)
    seed: int | None = None
    output: str | None = None
    metadata: bool = True
    loraPaths: list[str] = Field(default_factory=list)
    loraScales: list[float] = Field(default_factory=list)

    @field_validator("imagePaths")
    @classmethod
    def _require_image_paths(cls, value: list[str]) -> list[str]:
        normalized = [path.strip() for path in value if path and path.strip()]
        if not normalized:
            raise ValueError("At least one image path is required")
        return normalized


class KontextRequest(BaseModel):
    prompt: str = Field(min_length=1)
    model: str
    quantize: int | None = Field(default=None, ge=3, le=8)
    width: int = Field(default=1024, ge=256, le=2048)
    height: int = Field(default=1024, ge=256, le=2048)
    steps: int = Field(default=25, ge=1, le=100)
    guidance: float = Field(default=2.5, gt=0)
    scheduler: str = "linear"
    seed: int | None = None
    output: str | None = None
    metadata: bool = True
    imagePath: str = Field(min_length=1)
    livePreview: bool = False
    stepwiseOutputDir: str | None = None
    loraPaths: list[str] = Field(default_factory=list)
    loraScales: list[float] = Field(default_factory=list)


class ControlNetRequest(BaseModel):
    prompt: str = Field(min_length=1)
    model: str
    quantize: int | None = Field(default=None, ge=3, le=8)
    width: int = Field(default=1024, ge=256, le=2048)
    height: int = Field(default=1024, ge=256, le=2048)
    steps: int = Field(default=25, ge=1, le=100)
    guidance: float = Field(default=3.5, gt=0)
    scheduler: str = "linear"
    seed: int | None = None
    output: str | None = None
    metadata: bool = True
    controlnetImagePath: str = Field(min_length=1)
    controlnetStrength: float = Field(default=0.4, ge=0.0, le=1.0)
    controlnetSaveCanny: bool = False
    livePreview: bool = False
    stepwiseOutputDir: str | None = None
    loraPaths: list[str] = Field(default_factory=list)
    loraScales: list[float] = Field(default_factory=list)


class UpscalerRequest(BaseModel):
    imagePath: str = Field(min_length=1)
    model: str = "seedvr2-3b"
    quantize: int | None = Field(default=None, ge=3, le=8)
    resolution: str = "2x"
    softness: float = Field(default=0.0, ge=0.0, le=1.0)
    seed: int | None = None
    output: str | None = None
    metadata: bool = False


class DepthProRequest(BaseModel):
    imagePath: str = Field(min_length=1)
    quantize: int | None = Field(default=None, ge=3, le=8)
    output: str | None = None


class ModelDownloadRequest(BaseModel):
    model_name: str = Field(min_length=1)
    base_model: str | None = None


class ModelExportRequest(BaseModel):
    model_name: str = Field(min_length=1)
    quantize: int = Field(default=8, ge=3, le=8)
    output: str | None = None


class CivitaiDownloadRequest(BaseModel):
    modelVersionId: int | None = Field(default=None, ge=1)
    downloadUrl: str | None = None
    destination: Literal["lora", "custom"] = "lora"

    @model_validator(mode="after")
    def require_source(self) -> "CivitaiDownloadRequest":
        if self.modelVersionId is None and not (self.downloadUrl and self.downloadUrl.strip()):
            raise ValueError("modelVersionId or downloadUrl is required")
        return self


class JobCreateRequest(BaseModel):
    module: Literal[
        "txt2img",
        "img2img",
        "flux2_edit",
        "inpaint",
        "controlnet",
        "kontext",
        "upscaler",
        "depth_pro",
        "model_download",
        "civitai_download",
        "model_export",
    ]
    params: dict[str, Any]


class GalleryBatchDeleteRequest(BaseModel):
    ids: list[str] = Field(min_length=1, max_length=500)

    @field_validator("ids")
    @classmethod
    def _reject_blank_ids(cls, value: list[str]) -> list[str]:
        normalized = [item_id.strip() for item_id in value]
        if any(not item_id for item_id in normalized):
            raise ValueError("Gallery ids must not be blank")
        return normalized


class PathsConfig(BaseModel):
    hfHome: str
    modelDir: str
    outputDir: str
    loraDir: str


class GenerationConfig(BaseModel):
    defaultModel: str
    defaultQuantize: int
    defaultSteps: int
    outputFormat: Literal["png"] = "png"
    quality: int
    autoSeeds: bool
    saveMetadataSidecar: bool = True

    @field_validator("outputFormat", mode="before")
    @classmethod
    def _coerce_output_format(cls, value: object) -> str:
        return "png"


class SystemConfig(BaseModel):
    cacheLimit: int
    lowRamMode: bool
    livePreview: bool


class BackendConfig(BaseModel):
    serverUrl: str
    port: int
    autoOpenBrowser: bool


class AppConfig(BaseModel):
    paths: PathsConfig
    generation: GenerationConfig
    system: SystemConfig
    backend: BackendConfig
