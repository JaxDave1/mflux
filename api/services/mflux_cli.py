import shutil
import os
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from urllib.parse import quote
from uuid import uuid4

from api.schemas.requests import (
    AppConfig,
    ControlNetRequest,
    DepthProRequest,
    Img2ImgRequest,
    InpaintRequest,
    KontextRequest,
    Txt2ImgRequest,
    UpscalerRequest,
)
from api.schemas.responses import GenerationJob, GenerationOutput, SingleOutputResponse, Txt2ImgResponse


@dataclass
class CommandSpec:
    module: str
    args: list[str]


def _root_dir() -> Path:
    return Path(__file__).resolve().parents[2]


def _resolve_path(value: str) -> Path:
    path = Path(value).expanduser()
    if path.is_absolute():
        return path
    return (_root_dir() / path).resolve()


def _output_path(config: AppConfig, request: Txt2ImgRequest) -> Path:
    base = _resolve_path(request.output) if request.output else _resolve_path(config.paths.outputDir)
    if base.suffix:
        base.parent.mkdir(parents=True, exist_ok=True)
        return base
    base.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return base / f"mflux_{request.model}_{stamp}.{config.generation.outputFormat}"


def _generic_output_path(config: AppConfig, output: str | None, stem: str, suffix: str = ".png") -> Path:
    base = _resolve_path(output) if output else _resolve_path(config.paths.outputDir)
    if base.suffix:
        base.parent.mkdir(parents=True, exist_ok=True)
        return base
    base.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return base / f"{stem}_{stamp}{suffix}"


def _thumbnail_path(path: Path) -> str:
    return f"/api/gallery/file?path={quote(str(path))}"


FLUX2_DISTILLED_NO_GUIDANCE = frozenset({"flux2-klein-4b", "flux2-klein-9b"})


def _append_guidance_args(args: list[str], model: str, guidance: float | None) -> None:
    if model in FLUX2_DISTILLED_NO_GUIDANCE:
        return
    if guidance is not None:
        args += ["--guidance", str(guidance)]


def _append_stepwise_args(args: list[str], stepwise_output_dir: str | None) -> None:
    if stepwise_output_dir:
        args += ["--stepwise-image-output-dir", stepwise_output_dir]


def _txt2img_command(request: Txt2ImgRequest, output: Path) -> CommandSpec:
    script_map = {
        "dev": "mflux.models.flux.cli.flux_generate",
        "schnell": "mflux.models.flux.cli.flux_generate",
        "krea-dev": "mflux.models.flux.cli.flux_generate",
        "z-image": "mflux.models.z_image.cli.z_image_generate",
        "z-image-turbo": "mflux.models.z_image.cli.z_image_turbo_generate",
        "qwen-image": "mflux.models.qwen.cli.qwen_image_generate",
        "qwen": "mflux.models.qwen.cli.qwen_image_generate",
        "fibo": "mflux.models.fibo.cli.fibo_generate",
        "fibo-lite": "mflux.models.fibo.cli.fibo_generate",
        "flux2-klein-4b": "mflux.models.flux2.cli.flux2_generate",
        "flux2-klein-9b": "mflux.models.flux2.cli.flux2_generate",
        "flux2-klein-base-4b": "mflux.models.flux2.cli.flux2_generate",
        "flux2-klein-base-9b": "mflux.models.flux2.cli.flux2_generate"
    }
    module = script_map.get(request.model, "mflux.models.flux.cli.flux_generate")
    args = [
        "--model",
        request.model,
        "--prompt",
        request.prompt,
        "--negative-prompt",
        request.negativePrompt,
        "--width",
        str(request.width),
        "--height",
        str(request.height),
        "--steps",
        str(request.steps),
        "--scheduler",
        request.scheduler,
        "--output",
        str(output)
    ]
    _append_guidance_args(args, request.model, request.guidance)
    if request.quantize is not None:
        args += ["--quantize", str(request.quantize)]
    if request.autoSeeds is not None:
        args += ["--auto-seeds", str(request.autoSeeds)]
    elif isinstance(request.seed, list):
        if request.seed:
            args += ["--seed", *[str(seed) for seed in request.seed]]
    elif request.seed is not None:
        args += ["--seed", str(request.seed)]
    if request.metadata:
        args.append("--metadata")
    if request.lowRam:
        args.append("--low-ram")
    _append_stepwise_args(args, request.stepwiseOutputDir)
    if request.loraPaths:
        args += ["--lora-paths", *request.loraPaths]
    if request.loraScales:
        args += ["--lora-scales", *[str(scale) for scale in request.loraScales]]
    return CommandSpec(module=module, args=args)


def _img2img_command(request: Img2ImgRequest, output: Path) -> CommandSpec:
    script_map = {
        "dev": "mflux.models.flux.cli.flux_generate",
        "schnell": "mflux.models.flux.cli.flux_generate",
        "krea-dev": "mflux.models.flux.cli.flux_generate",
        "z-image": "mflux.models.z_image.cli.z_image_generate",
        "z-image-turbo": "mflux.models.z_image.cli.z_image_turbo_generate",
        "qwen-image": "mflux.models.qwen.cli.qwen_image_generate",
        "qwen-image-edit": "mflux.models.qwen.cli.qwen_image_edit_generate",
        "fibo": "mflux.models.fibo.cli.fibo_generate",
        "fibo-lite": "mflux.models.fibo.cli.fibo_generate",
        "flux2-klein-4b": "mflux.models.flux2.cli.flux2_generate",
        "flux2-klein-9b": "mflux.models.flux2.cli.flux2_generate",
        "flux2-klein-base-4b": "mflux.models.flux2.cli.flux2_generate",
        "flux2-klein-base-9b": "mflux.models.flux2.cli.flux2_generate",
    }
    module = script_map.get(request.model, "mflux.models.flux.cli.flux_generate")
    args = [
        "--model",
        request.model,
        "--prompt",
        request.prompt,
        "--negative-prompt",
        request.negativePrompt,
        "--width",
        str(request.width),
        "--height",
        str(request.height),
        "--steps",
        str(request.steps),
        "--scheduler",
        request.scheduler,
        "--output",
        str(output),
    ]
    _append_guidance_args(args, request.model, request.guidance)
    if module == "mflux.models.qwen.cli.qwen_image_edit_generate":
        args += ["--image-paths", str(_resolve_path(request.imagePath))]
    else:
        args += [
            "--image-path",
            str(_resolve_path(request.imagePath)),
            "--image-strength",
            str(request.imageStrength),
        ]
    if request.quantize is not None:
        args += ["--quantize", str(request.quantize)]
    if request.seed is not None:
        args += ["--seed", str(request.seed)]
    if request.metadata:
        args.append("--metadata")
    _append_stepwise_args(args, request.stepwiseOutputDir)
    for lora in request.loraPaths:
        args += ["--lora-paths", lora]
    if request.loraScales:
        args += ["--lora-scales", *[str(scale) for scale in request.loraScales]]
    return CommandSpec(module=module, args=args)


def _inpaint_command(request: InpaintRequest, output: Path) -> CommandSpec:
    args = [
        "--model",
        request.model,
        "--prompt",
        request.prompt,
        "--width",
        str(request.width),
        "--height",
        str(request.height),
        "--steps",
        str(request.steps),
        "--guidance",
        str(request.guidance),
        "--scheduler",
        request.scheduler,
        "--image-path",
        str(_resolve_path(request.imagePath)),
        "--masked-image-path",
        str(_resolve_path(request.maskedImagePath)),
        "--output",
        str(output),
    ]
    if request.quantize is not None:
        args += ["--quantize", str(request.quantize)]
    if request.seed is not None:
        args += ["--seed", str(request.seed)]
    if request.metadata:
        args.append("--metadata")
    _append_stepwise_args(args, request.stepwiseOutputDir)
    for lora in request.loraPaths:
        args += ["--lora-paths", lora]
    if request.loraScales:
        args += ["--lora-scales", *[str(scale) for scale in request.loraScales]]
    return CommandSpec(module="mflux.models.flux.cli.flux_generate_fill", args=args)


def _kontext_command(request: KontextRequest, output: Path) -> CommandSpec:
    args = [
        "--model",
        request.model,
        "--prompt",
        request.prompt,
        "--width",
        str(request.width),
        "--height",
        str(request.height),
        "--steps",
        str(request.steps),
        "--guidance",
        str(request.guidance),
        "--scheduler",
        request.scheduler,
        "--image-path",
        str(_resolve_path(request.imagePath)),
        "--output",
        str(output),
    ]
    if request.quantize is not None:
        args += ["--quantize", str(request.quantize)]
    if request.seed is not None:
        args += ["--seed", str(request.seed)]
    if request.metadata:
        args.append("--metadata")
    _append_stepwise_args(args, request.stepwiseOutputDir)
    for lora in request.loraPaths:
        args += ["--lora-paths", lora]
    if request.loraScales:
        args += ["--lora-scales", *[str(scale) for scale in request.loraScales]]
    return CommandSpec(module="mflux.models.flux.cli.flux_generate_kontext", args=args)


def _controlnet_command(request: ControlNetRequest, output: Path) -> CommandSpec:
    args = [
        "--model",
        request.model,
        "--prompt",
        request.prompt,
        "--width",
        str(request.width),
        "--height",
        str(request.height),
        "--steps",
        str(request.steps),
        "--guidance",
        str(request.guidance),
        "--scheduler",
        request.scheduler,
        "--controlnet-image-path",
        str(_resolve_path(request.controlnetImagePath)),
        "--controlnet-strength",
        str(request.controlnetStrength),
        "--output",
        str(output),
    ]
    if request.quantize is not None:
        args += ["--quantize", str(request.quantize)]
    if request.seed is not None:
        args += ["--seed", str(request.seed)]
    if request.metadata:
        args.append("--metadata")
    if request.controlnetSaveCanny:
        args.append("--controlnet-save-canny")
    _append_stepwise_args(args, request.stepwiseOutputDir)
    for lora in request.loraPaths:
        args += ["--lora-paths", lora]
    if request.loraScales:
        args += ["--lora-scales", *[str(scale) for scale in request.loraScales]]
    return CommandSpec(module="mflux.models.flux.cli.flux_generate_controlnet", args=args)


def _upscaler_command(request: UpscalerRequest, output: Path) -> CommandSpec:
    model = request.model or "seedvr2-3b"
    args = [
        "--image-path",
        str(_resolve_path(request.imagePath)),
        "--resolution",
        request.resolution,
        "--output",
        str(output),
        "--model",
        model,
    ]
    if request.quantize is not None:
        args += ["--quantize", str(request.quantize)]
    if request.seed is not None:
        args += ["--seed", str(request.seed)]
    if request.softness != 0.0:
        args += ["--softness", str(request.softness)]
    if request.metadata:
        args.append("--metadata")
    return CommandSpec(module="mflux.models.seedvr2.cli.seedvr2_upscale", args=args)


def _depth_pro_command(request: DepthProRequest, output: Path | None = None) -> CommandSpec:
    args = ["--image-path", str(_resolve_path(request.imagePath))]
    if request.quantize is not None:
        args += ["--quantize", str(request.quantize)]
    if output is not None:
        args += ["--output", str(output)]
    return CommandSpec(module="mflux.models.depth_pro.cli.save_depth", args=args)


def _base_env(config: AppConfig) -> dict[str, str]:
    env = {**os.environ, "PYTHONPATH": str(_root_dir() / "src")}
    env.setdefault("HF_HOME", str(Path(config.paths.hfHome).expanduser()))
    env.setdefault("MFLUX_CACHE_DIR", str(_resolve_path(config.paths.modelDir)))
    return env


def run_txt2img(request: Txt2ImgRequest, config: AppConfig) -> Txt2ImgResponse:
    output = _output_path(config, request)
    command = _txt2img_command(request, output)
    full_command = [sys.executable, "-m", command.module, *command.args]
    started = datetime.utcnow()
    job = GenerationJob(
        id=uuid4().hex,
        status="running",
        startedAt=started,
        command=full_command
    )

    process = subprocess.run(
        full_command,
        cwd=_root_dir(),
        env=_base_env(config),
        capture_output=True,
        text=True,
        check=False
    )

    if process.returncode != 0:
        raise RuntimeError(process.stderr.strip() or process.stdout.strip() or "MFLUX command failed")

    output_item = GenerationOutput(
        id=job.id,
        path=str(output),
        thumbnailPath=_thumbnail_path(output),
        prompt=request.prompt,
        negativePrompt=request.negativePrompt,
        model=request.model,
        seed=request.seed or 0,
        createdAt=datetime.utcnow()
    )
    return Txt2ImgResponse(
        job=GenerationJob(
            id=job.id,
            status="completed",
            startedAt=started,
            finishedAt=datetime.utcnow(),
            command=full_command
        ),
        outputs=[output_item]
    )


def run_img2img(request: Img2ImgRequest, config: AppConfig) -> Txt2ImgResponse:
    output = _output_path(config, request)  # type: ignore[arg-type]
    command = _img2img_command(request, output)
    full_command = [sys.executable, "-m", command.module, *command.args]
    started = datetime.utcnow()
    process = subprocess.run(
        full_command,
        cwd=_root_dir(),
        env=_base_env(config),
        capture_output=True,
        text=True,
        check=False,
    )

    if process.returncode != 0:
        raise RuntimeError(process.stderr.strip() or process.stdout.strip() or "MFLUX img2img command failed")

    output_item = GenerationOutput(
        id=uuid4().hex,
        path=str(output),
        thumbnailPath=_thumbnail_path(output),
        prompt=request.prompt,
        negativePrompt=request.negativePrompt,
        model=request.model,
        seed=request.seed or 0,
        createdAt=datetime.utcnow(),
    )
    return Txt2ImgResponse(
        job=GenerationJob(
            id=output_item.id,
            status="completed",
            startedAt=started,
            finishedAt=datetime.utcnow(),
            command=full_command,
        ),
        outputs=[output_item],
    )


def run_inpaint(request: InpaintRequest, config: AppConfig) -> Txt2ImgResponse:
    output = _output_path(config, request)  # type: ignore[arg-type]
    command = _inpaint_command(request, output)
    full_command = [sys.executable, "-m", command.module, *command.args]
    started = datetime.utcnow()
    process = subprocess.run(
        full_command,
        cwd=_root_dir(),
        env=_base_env(config),
        capture_output=True,
        text=True,
        check=False,
    )

    if process.returncode != 0:
        raise RuntimeError(process.stderr.strip() or process.stdout.strip() or "MFLUX inpaint command failed")

    output_item = GenerationOutput(
        id=uuid4().hex,
        path=str(output),
        thumbnailPath=_thumbnail_path(output),
        prompt=request.prompt,
        model=request.model,
        seed=request.seed or 0,
        createdAt=datetime.utcnow(),
    )
    return Txt2ImgResponse(
        job=GenerationJob(
            id=output_item.id,
            status="completed",
            startedAt=started,
            finishedAt=datetime.utcnow(),
            command=full_command,
        ),
        outputs=[output_item],
    )


def run_kontext(request: KontextRequest, config: AppConfig) -> Txt2ImgResponse:
    output = _output_path(config, request)  # type: ignore[arg-type]
    command = _kontext_command(request, output)
    full_command = [sys.executable, "-m", command.module, *command.args]
    started = datetime.utcnow()
    process = subprocess.run(
        full_command,
        cwd=_root_dir(),
        env=_base_env(config),
        capture_output=True,
        text=True,
        check=False,
    )
    if process.returncode != 0:
        raise RuntimeError(process.stderr.strip() or process.stdout.strip() or "MFLUX kontext command failed")
    output_item = GenerationOutput(
        id=uuid4().hex,
        path=str(output),
        thumbnailPath=_thumbnail_path(output),
        prompt=request.prompt,
        model=request.model,
        seed=request.seed or 0,
        createdAt=datetime.utcnow(),
    )
    return Txt2ImgResponse(
        job=GenerationJob(
            id=output_item.id,
            status="completed",
            startedAt=started,
            finishedAt=datetime.utcnow(),
            command=full_command,
        ),
        outputs=[output_item],
    )


def run_controlnet(request: ControlNetRequest, config: AppConfig) -> Txt2ImgResponse:
    output = _output_path(config, request)  # type: ignore[arg-type]
    command = _controlnet_command(request, output)
    full_command = [sys.executable, "-m", command.module, *command.args]
    started = datetime.utcnow()
    process = subprocess.run(
        full_command,
        cwd=_root_dir(),
        env=_base_env(config),
        capture_output=True,
        text=True,
        check=False,
    )
    if process.returncode != 0:
        raise RuntimeError(process.stderr.strip() or process.stdout.strip() or "MFLUX controlnet command failed")
    output_item = GenerationOutput(
        id=uuid4().hex,
        path=str(output),
        thumbnailPath=_thumbnail_path(output),
        prompt=request.prompt,
        model=request.model,
        seed=request.seed or 0,
        createdAt=datetime.utcnow(),
    )
    return Txt2ImgResponse(
        job=GenerationJob(
            id=output_item.id,
            status="completed",
            startedAt=started,
            finishedAt=datetime.utcnow(),
            command=full_command,
        ),
        outputs=[output_item],
    )


def run_upscaler(request: UpscalerRequest, config: AppConfig) -> SingleOutputResponse:
    input_path = _resolve_path(request.imagePath)
    output = _generic_output_path(config, request.output, f"{input_path.stem}_upscaled")
    command = _upscaler_command(request, output)
    full_command = [sys.executable, "-m", command.module, *command.args]
    started = datetime.utcnow()
    process = subprocess.run(
        full_command,
        cwd=_root_dir(),
        env=_base_env(config),
        capture_output=True,
        text=True,
        check=False,
    )
    if process.returncode != 0:
        raise RuntimeError(process.stderr.strip() or process.stdout.strip() or "Upscaler command failed")
    result = GenerationOutput(
        id=uuid4().hex,
        path=str(output),
        thumbnailPath=_thumbnail_path(output),
        prompt=f"Upscale {input_path.name}",
        model=request.model,
        seed=request.seed or 0,
        createdAt=datetime.utcnow(),
    )
    return SingleOutputResponse(
        job=GenerationJob(
            id=result.id,
            status="completed",
            startedAt=started,
            finishedAt=datetime.utcnow(),
            command=full_command,
        ),
        output=result,
    )


def run_depth_pro(request: DepthProRequest, config: AppConfig) -> SingleOutputResponse:
    input_path = _resolve_path(request.imagePath)
    final_output = _generic_output_path(config, request.output, f"{input_path.stem}_depth")
    command = _depth_pro_command(request, final_output)
    full_command = [sys.executable, "-m", command.module, *command.args]
    started = datetime.utcnow()
    process = subprocess.run(
        full_command,
        cwd=_root_dir(),
        env=_base_env(config),
        capture_output=True,
        text=True,
        check=False,
    )
    if process.returncode != 0:
        raise RuntimeError(process.stderr.strip() or process.stdout.strip() or "Depth Pro command failed")
    if not final_output.exists():
        generated_path = input_path.with_stem(f"{input_path.stem}_depth").with_suffix(".png")
        if generated_path.exists() and generated_path.resolve() != final_output.resolve():
            final_output.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(generated_path), str(final_output))
        elif generated_path.exists():
            final_output = generated_path
    result = GenerationOutput(
        id=uuid4().hex,
        path=str(final_output),
        thumbnailPath=_thumbnail_path(final_output),
        prompt=f"Depth map for {input_path.name}",
        model="depth-pro",
        seed=0,
        createdAt=datetime.utcnow(),
    )
    return SingleOutputResponse(
        job=GenerationJob(
            id=result.id,
            status="completed",
            startedAt=started,
            finishedAt=datetime.utcnow(),
            command=full_command,
        ),
        output=result,
    )
