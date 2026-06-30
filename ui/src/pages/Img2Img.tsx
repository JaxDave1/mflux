import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  GenerateButton,
  ImageInput,
  LivePreviewField,
  LoRAStack,
  LoraModelNotice,
  ModuleRunColumn,
  PageHeader,
  Panel,
  PromptInput,
  QuantizeField,
  SchedulerField,
  SelectField,
  SeedField,
  SliderField
} from "../components";
import { useGalleryReference } from "../hooks/useGalleryReference";
import { useModuleLoraStack } from "../hooks/useModuleLoraStack";
import { useModuleHeaderStatus } from "../hooks/useModuleHeaderStatus";
import { useModuleLivePreview } from "../hooks/useModuleLivePreview";
import { useModuleLivePreviewSetting } from "../hooks/useModuleLivePreviewSetting";
import { useModuleModelOptions } from "../hooks/useModuleModelOptions";
import { useStickyState } from "../hooks/useStickyState";
import { api } from "../lib/api";
import { quantizeApiValue, quantizeSelectionFromApi, type QuantizeSelection } from "../lib/quantize";
import {
  normalizeSchedulerForModel,
  type SchedulerId
} from "../lib/schedulerOptions";
import { resolveIntegerSeed, type SeedMode } from "../lib/seed";
import { resolveInputImageSrc } from "../lib/media";
import { useJobStore } from "../stores/useJobStore";

function snapDimension(value: number) {
  const clamped = Math.min(1536, Math.max(256, value));
  return Math.round(clamped / 64) * 64;
}

export function Img2Img() {
  const [prompt, setPrompt] = useStickyState("module:img2img:prompt", "");
  const [negativePrompt, setNegativePrompt] = useStickyState("module:img2img:negativePrompt", "");
  const [supportsNegativePrompt, setSupportsNegativePrompt] = useStickyState(
    "module:img2img:supportsNegativePrompt",
    false
  );
  const [model, setModel, hadCachedModel] = useStickyState("module:img2img:model", "z-image-turbo");
  const [quantize, setQuantize] = useStickyState<QuantizeSelection>("module:img2img:quantize", "8");
  const [steps, setSteps] = useStickyState("module:img2img:steps", 9);
  const [guidance, setGuidance] = useStickyState<number | null>("module:img2img:guidance", 3.5);
  const [width, setWidth] = useStickyState("module:img2img:width", 1280);
  const [height, setHeight] = useStickyState("module:img2img:height", 768);
  const [scheduler, setScheduler] = useStickyState<SchedulerId>("module:img2img:scheduler", "linear");
  const [seedMode, setSeedMode] = useStickyState<SeedMode>("module:img2img:seedMode", "auto");
  const [seed, setSeed] = useStickyState("module:img2img:seed", "42");
  const [imageStrength, setImageStrength] = useStickyState("module:img2img:imageStrength", 0.75);
  const [imagePath, setImagePath, hadCachedImagePath] = useStickyState<string | null>(
    "module:img2img:imagePath",
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submitJob = useJobStore((state) => state.submitJob);
  const { job: latestJob, stepwiseImages, activeJobs } = useModuleLivePreview("img2img");
  const { options: modelOptions } = useModuleModelOptions("img2img", model);
  const { loras, setLoras, loraModelNotice, trackModelChange, onCompatibilityChange, loraJobParams } =
    useModuleLoraStack(model, "img2img");
  const { livePreview, setLivePreview } = useModuleLivePreviewSetting("img2img");
  const [searchParams] = useSearchParams();
  const hasGalleryReference = Boolean(searchParams.get("ref")?.trim());
  const dimensionSyncedPathRef = useRef<string | null>(hadCachedImagePath ? imagePath : null);

  const handleImagePathChange = useCallback((path: string | null) => {
    dimensionSyncedPathRef.current = null;
    setImagePath(path);
  }, []);

  const applyModelDefaults = useCallback(async (nextModel: string) => {
    trackModelChange(model, nextModel);
    setModel(nextModel);
    setError(null);
    try {
      const defaults = await api.modelDefaults(nextModel);
      setSupportsNegativePrompt(defaults.supports_negative_prompt);
      if (!defaults.supports_negative_prompt) {
        setNegativePrompt("");
      }
      if (defaults.steps !== null) {
        setSteps(defaults.steps);
      }
      setGuidance(defaults.guidance);
      setQuantize(quantizeSelectionFromApi(defaults.quantize));
      setScheduler(normalizeSchedulerForModel(nextModel, defaults.scheduler));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load model defaults.");
    }
  }, [model, trackModelChange]);

  const handleGalleryModel = useCallback(
    (nextModel: string) => {
      void applyModelDefaults(nextModel);
    },
    [applyModelDefaults]
  );

  const galleryReference = useGalleryReference({
    onPath: handleImagePathChange,
    onWidth: setWidth,
    onHeight: setHeight,
    onModel: handleGalleryModel
  });

  const sourcePrompt = galleryReference?.sourcePrompt ?? galleryReference?.prompt;

  useEffect(() => {
    if (hasGalleryReference || hadCachedModel) {
      return;
    }

    let alive = true;
    api
      .moduleDefaults("img2img")
      .then((defaults) => {
        if (!alive) {
          return;
        }
        setModel(defaults.model);
        setWidth(defaults.width);
        setHeight(defaults.height);
        setSupportsNegativePrompt(defaults.supports_negative_prompt);
        if (defaults.steps !== null) {
          setSteps(defaults.steps);
        }
        setGuidance(defaults.guidance);
        setQuantize(quantizeSelectionFromApi(defaults.quantize));
        setScheduler(normalizeSchedulerForModel(defaults.model, defaults.scheduler));
      })
      .catch((err) => {
        if (alive) {
          setError(err instanceof Error ? err.message : "Failed to load img2img defaults.");
        }
      });

    return () => {
      alive = false;
    };
  }, [hadCachedModel, hasGalleryReference]);

  useEffect(() => {
    if (!imagePath || dimensionSyncedPathRef.current === imagePath) {
      return;
    }

    let cancelled = false;
    const image = new window.Image();
    image.onload = () => {
      if (cancelled) {
        return;
      }
      dimensionSyncedPathRef.current = imagePath;
      setWidth(snapDimension(image.naturalWidth));
      setHeight(snapDimension(image.naturalHeight));
    };
    image.onerror = () => {
      if (!cancelled) {
        dimensionSyncedPathRef.current = imagePath;
      }
    };
    image.src = resolveInputImageSrc(imagePath);

    return () => {
      cancelled = true;
    };
  }, [imagePath]);

  const onGenerate = async () => {
    if (!imagePath) {
      return;
    }
    setLoading(true);
    setError(null);
    const params = {
      prompt,
      negativePrompt: supportsNegativePrompt ? negativePrompt : "",
      model,
      quantize: quantizeApiValue(quantize),
      width,
      height,
      steps,
      guidance: guidance === null || guidance <= 0 ? 0.01 : guidance,
      scheduler: normalizeSchedulerForModel(model, scheduler),
      seed: resolveIntegerSeed(seedMode, seed),
      imageStrength,
      imagePath,
      livePreview,
      ...loraJobParams
    };

    try {
      await submitJob({ module: "img2img", params });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Img2img failed");
    } finally {
      setLoading(false);
    }
  };

  const headerStatus = useModuleHeaderStatus(activeJobs, latestJob);
  return (
    <div className="content-shell module-reskin-page module-reskin-page--generation">
      <LoraModelNotice notice={loraModelNotice} />
      <PageHeader
        title="IMG2IMG"
        description="Reference-driven image transformation with denoise control."
        version={headerStatus}
        className="module-reskin-page-header"
      />
      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.9fr]">
        <div className="module-form-column space-y-6">
          {galleryReference ? (
            <div className="rounded-panel border border-secondary/35 bg-secondary/10 px-4 py-3 text-sm leading-6 text-secondary">
              <div>Source image loaded from gallery.</div>
              {sourcePrompt ? (
                <div className="mt-2 text-on-surface-variant">
                  Original prompt: <span className="text-on-surface">"{sourcePrompt}"</span>
                </div>
              ) : null}
              <div className="mt-2">Enter a new prompt below describing how you want to transform this image.</div>
            </div>
          ) : null}
          <Panel neonBorder="primary" scanline className="space-y-4">
            <PromptInput
              label="PROMPT"
              value={prompt}
              onChange={setPrompt}
              placeholder={
                galleryReference
                  ? "Describe how to transform the source image"
                  : "Describe the transformation"
              }
              variant="secondary"
            />
            {supportsNegativePrompt ? (
              <PromptInput
                label="NEGATIVE PROMPT"
                value={negativePrompt}
                onChange={setNegativePrompt}
                placeholder="Terms to suppress for Qwen Image Edit"
                rows={3}
              />
            ) : null}
          </Panel>
          <Panel title="SOURCE IMAGE" className="space-y-4">
            <ImageInput label="Source Image" onChange={handleImagePathChange} value={imagePath} />
            <SliderField
              label="IMAGE STRENGTH"
              value={imageStrength}
              onChange={setImageStrength}
              min={0}
              max={1}
              step={0.05}
            />
          </Panel>
          <Panel title="MODEL PIPELINE" className="grid gap-4 md:grid-cols-2">
            <SelectField
              label="MODEL"
              value={model}
              onChange={(nextModel) => void applyModelDefaults(nextModel)}
              options={modelOptions}
            />
            <SchedulerField model={model} value={scheduler} onChange={setScheduler} />
            <QuantizeField value={quantize} onChange={setQuantize} />
            <SeedField
              mode={seedMode}
              onModeChange={setSeedMode}
              value={seed}
              onChange={setSeed}
              className="md:col-span-2"
            />
          </Panel>
          <Panel title="LORA STACK">
            <LoRAStack
              value={loras}
              onChange={setLoras}
              model={model}
              onCompatibilityChange={onCompatibilityChange}
            />
          </Panel>
          <Panel title="GENERATION CONTROLS" className="space-y-4">
            <SliderField label="STEPS" value={steps} onChange={setSteps} min={1} max={60} />
            {guidance !== null ? (
              <SliderField
                label="GUIDANCE"
                value={guidance}
                onChange={setGuidance}
                min={0}
                max={20}
                step={0.5}
              />
            ) : null}
            <SliderField label="WIDTH" value={width} onChange={setWidth} min={256} max={1536} step={64} />
            <SliderField label="HEIGHT" value={height} onChange={setHeight} min={256} max={1536} step={64} />
            <LivePreviewField value={livePreview} onChange={setLivePreview} />
          </Panel>
        </div>
        <ModuleRunColumn
          job={latestJob}
          stepwiseImages={stepwiseImages}
          runControl={
            <>
              <GenerateButton
                onClick={onGenerate}
                loading={loading}
                disabled={!prompt.trim() || !imagePath}
                label="RUN IMG2IMG"
                className="module-primary-action w-full"
              />
              <div className="font-body text-sm text-[var(--color-text-secondary)]">
                {activeJobs.length
                  ? "Generation in progress. Preview and progress update below."
                  : "Runs the current prompt against the selected source image and denoise strength."}
              </div>
              {error ? (
                <div className="rounded-panel bg-error-container px-3 py-3 text-sm text-on-error-container">{error}</div>
              ) : null}
            </>
          }
        />
      </div>
    </div>
  );
}
