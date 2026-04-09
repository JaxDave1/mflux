from typing import Literal

from pydantic import BaseModel, Field


class Txt2ImgRequest(BaseModel):
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
    loraPaths: list[str] = Field(default_factory=list)
    loraScales: list[float] = Field(default_factory=list)


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
    loraPaths: list[str] = Field(default_factory=list)
    loraScales: list[float] = Field(default_factory=list)


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


class PathsConfig(BaseModel):
    hfHome: str
    modelDir: str
    outputDir: str
    loraDir: str


class GenerationConfig(BaseModel):
    defaultModel: str
    defaultQuantize: int
    defaultSteps: int
    outputFormat: Literal["png", "jpg", "jpeg", "webp"]
    quality: int
    autoSeeds: bool


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
