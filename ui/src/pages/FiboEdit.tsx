import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  GenerateButton,
  ImageInput,
  LoRAStack,
  LoraModelNotice,
  ModuleRunColumn,
  PageHeader,
  Panel,
  PromptInput,
  QuantizeField,
  SelectField,
  SeedField,
  SliderField,
  ToggleChip
} from "../components";
import { useGalleryReference } from "../hooks/useGalleryReference";
import { useModuleHeaderStatus } from "../hooks/useModuleHeaderStatus";
import { useModuleLoraStack } from "../hooks/useModuleLoraStack";
import { useModuleLivePreview } from "../hooks/useModuleLivePreview";
import { useModuleModelOptions } from "../hooks/useModuleModelOptions";
import { useStickyState } from "../hooks/useStickyState";
import { api } from "../lib/api";
import { resolveInputImageSrc } from "../lib/media";
import { quantizeApiValue, quantizeSelectionFromApi, type QuantizeSelection } from "../lib/quantize";
import { resolveIntegerSeed, type SeedMode } from "../lib/seed";
import { useJobStore } from "../stores/useJobStore";

function snapDimension(value: number) {
  const clamped = Math.min(1536, Math.max(256, value));
  return Math.round(clamped / 64) * 64;
}

export function FiboEdit() {
  const [prompt, setPrompt] = useStickyState("module:fibo_edit:prompt", "");
  const [negativePrompt, setNegativePrompt] = useStickyState("module:fibo_edit:negativePrompt", "");
  const [model, setModel, hadCachedModel] = useStickyState("module:fibo_edit:model", "fibo-edit");
  const [quantize, setQuantize] = useStickyState<QuantizeSelection>("module:fibo_edit:quantize", "8");
  const [steps, setSteps] = useStickyState("module:fibo_edit:steps", 50);
  const [guidance, setGuidance] = useStickyState<number | null>("module:fibo_edit:guidance", 3.5);
  const [supportsNegativePrompt, setSupportsNegativePrompt] = useStickyState(
    "module:fibo_edit:supportsNegativePrompt",
    true
  );
  const [width, setWidth] = useStickyState("module:fibo_edit:width", 1024);
  const [height, setHeight] = useStickyState("module:fibo_edit:height", 1024);
  const [seedMode, setSeedMode] = useStickyState<SeedMode>("module:fibo_edit:seedMode", "auto");
  const [seed, setSeed] = useStickyState("module:fibo_edit:seed", "42");
  const [imagePath, setImagePath, hadCachedImagePath] = useStickyState<string | null>(
    "module:fibo_edit:imagePath",
    null
  );
  const [maskPath, setMaskPath] = useStickyState<string | null>("module:fibo_edit:maskPath", null);
  const [saveMatte, setSaveMatte] = useStickyState("module:fibo_edit:saveMatte", false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submitJob = useJobStore((state) => state.submitJob);
  const { job: latestJob, stepwiseImages, activeJobs } = useModuleLivePreview("fibo_edit");
  const { options: modelOptions } = useModuleModelOptions("fibo_edit", model);
  const { loras, setLoras, loraModelNotice, trackModelChange, onCompatibilityChange, loraJobParams } =
    useModuleLoraStack(model, "fibo_edit");
  const [searchParams] = useSearchParams();
  const isRmbg = model === "fibo-edit-rmbg";
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
      if (defaults.steps !== null) {
        setSteps(defaults.steps);
      }
      setGuidance(defaults.guidance);
      setQuantize(quantizeSelectionFromApi(defaults.quantize));
      setSupportsNegativePrompt(defaults.supports_negative_prompt);
      if (!defaults.supports_negative_prompt) {
        setNegativePrompt("");
      }
      if (nextModel !== "fibo-edit-rmbg") {
        setSaveMatte(false);
      }
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

  useGalleryReference({
    onPath: handleImagePathChange,
    onWidth: setWidth,
    onHeight: setHeight,
    onModel: handleGalleryModel
  });

  useEffect(() => {
    if (hadCachedModel) {
      return;
    }
    let alive = true;
    api
      .moduleDefaults("fibo_edit")
      .then((defaults) => {
        if (!alive) {
          return;
        }
        setModel(defaults.model);
        if (defaults.steps !== null) {
          setSteps(defaults.steps);
        }
        setGuidance(defaults.guidance);
        setQuantize(quantizeSelectionFromApi(defaults.quantize));
        setSupportsNegativePrompt(defaults.supports_negative_prompt);
        setWidth(defaults.width);
        setHeight(defaults.height);
      })
      .catch((err) => {
        if (alive) {
          setError(err instanceof Error ? err.message : "Failed to load FIBO Edit defaults.");
        }
      });
    return () => {
      alive = false;
    };
  }, [hadCachedModel]);

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

  const canGenerate = Boolean(imagePath) && (isRmbg || Boolean(prompt.trim()));

  const onGenerate = async () => {
    if (!canGenerate || !imagePath) {
      return;
    }
    setLoading(true);
    setError(null);
    const params = {
      prompt,
      model,
      imagePath,
      maskPath: maskPath ?? undefined,
      saveMatte: isRmbg ? saveMatte : false,
      quantize: quantizeApiValue(quantize),
      width,
      height,
      steps,
      guidance: guidance === null || guidance <= 0 ? undefined : guidance,
      negativePrompt: supportsNegativePrompt && negativePrompt.trim() ? negativePrompt : undefined,
      seed: resolveIntegerSeed(seedMode, seed),
      ...loraJobParams
    };

    try {
      await submitJob({ module: "fibo_edit", params });
    } catch (err) {
      setError(err instanceof Error ? err.message : "FIBO Edit failed");
    } finally {
      setLoading(false);
    }
  };

  const headerStatus = useModuleHeaderStatus(activeJobs, latestJob);

  return (
    <div className="content-shell module-reskin-page module-reskin-page--generation">
      <LoraModelNotice notice={loraModelNotice} />
      <PageHeader
        title="FIBO EDIT"
        description="Image-conditioned editing with Bria FIBO Edit — plain-text instructions, optional mask, or background removal."
        version={headerStatus}
        className="module-reskin-page-header"
      />
      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.9fr]">
        <div className="module-form-column space-y-6">
          <Panel neonBorder="primary" scanline className="space-y-4">
            <PromptInput
              label={isRmbg ? "EDIT INSTRUCTION (OPTIONAL)" : "EDIT INSTRUCTION"}
              value={prompt}
              onChange={setPrompt}
              placeholder={
                isRmbg
                  ? "Leave blank to use the built-in background-removal instruction"
                  : "Describe the edit to apply to the source image"
              }
              variant="secondary"
            />
            {supportsNegativePrompt ? (
              <PromptInput
                label="NEGATIVE PROMPT"
                value={negativePrompt}
                onChange={setNegativePrompt}
                placeholder="Optional attributes to avoid"
                variant="secondary"
              />
            ) : null}
          </Panel>
          <Panel title="SOURCE IMAGE" className="space-y-4">
            <ImageInput
              defaultPath={searchParams.get("ref") ?? undefined}
              label="Source Image"
              onChange={setImagePath}
              value={imagePath}
              required
            />
            <ImageInput label="Mask Image (optional)" onChange={setMaskPath} value={maskPath} />
            <div className="text-xs text-on-surface-variant">
              Provide a mask for localized edits. FIBO Edit-RMBG outputs a transparent PNG cutout; enable matte
              export below to also save the grayscale matte.
            </div>
          </Panel>
          <Panel title="MODEL PIPELINE" className="grid gap-4 md:grid-cols-2">
            <SelectField
              label="MODEL"
              value={model}
              onChange={(nextModel) => void applyModelDefaults(nextModel)}
              options={modelOptions}
            />
            <QuantizeField value={quantize} onChange={setQuantize} />
            <SeedField
              mode={seedMode}
              onModeChange={setSeedMode}
              value={seed}
              onChange={setSeed}
              className="md:col-span-2"
            />
            {isRmbg ? (
              <div className="md:col-span-2 space-y-2">
                <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">SAVE MATTE OUTPUT</div>
                <ToggleChip
                  options={["OFF", "ON"]}
                  value={saveMatte ? "ON" : "OFF"}
                  onChange={(value) => setSaveMatte(value === "ON")}
                />
              </div>
            ) : null}
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
            <SliderField label="STEPS" value={steps} onChange={setSteps} min={1} max={100} />
            {guidance !== null ? (
              <SliderField label="GUIDANCE" value={guidance} onChange={setGuidance} min={0.5} max={10} step={0.1} />
            ) : null}
            <SliderField label="WIDTH" value={width} onChange={setWidth} min={256} max={1536} step={64} />
            <SliderField label="HEIGHT" value={height} onChange={setHeight} min={256} max={1536} step={64} />
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
                disabled={!canGenerate}
                label="RUN FIBO EDIT"
                className="module-primary-action w-full"
              />
              <div className="font-body text-sm text-[var(--color-text-secondary)]">
                {activeJobs.length
                  ? "Edit job in progress. Preview updates below when complete."
                  : "Runs mflux-generate-fibo-edit with a source image and edit instruction."}
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