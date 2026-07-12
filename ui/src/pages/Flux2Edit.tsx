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
  SliderField
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

export function Flux2Edit() {
  const [prompt, setPrompt] = useStickyState("module:flux2_edit:prompt", "");
  const [model, setModel, hadCachedModel] = useStickyState("module:flux2_edit:model", "flux2-klein-4b");
  const [quantize, setQuantize] = useStickyState<QuantizeSelection>("module:flux2_edit:quantize", "8");
  const [steps, setSteps] = useStickyState("module:flux2_edit:steps", 4);
  const [guidance, setGuidance] = useStickyState<number | null>("module:flux2_edit:guidance", null);
  const [width, setWidth] = useStickyState("module:flux2_edit:width", 1024);
  const [height, setHeight] = useStickyState("module:flux2_edit:height", 1024);
  const [seedMode, setSeedMode] = useStickyState<SeedMode>("module:flux2_edit:seedMode", "auto");
  const [seed, setSeed] = useStickyState("module:flux2_edit:seed", "42");
  const [primaryPath, setPrimaryPath, hadCachedPrimaryPath] = useStickyState<string | null>(
    "module:flux2_edit:primaryPath",
    null
  );
  const [secondaryPath, setSecondaryPath] = useStickyState<string | null>(
    "module:flux2_edit:secondaryPath",
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submitJob = useJobStore((state) => state.submitJob);
  const { job: latestJob, stepwiseImages, activeJobs } = useModuleLivePreview("flux2_edit");
  const { options: modelOptions } = useModuleModelOptions("flux2_edit", model);
  const { loras, setLoras, loraModelNotice, trackModelChange, onCompatibilityChange, loraJobParams } =
    useModuleLoraStack(model, "flux2_edit");
  const [searchParams] = useSearchParams();
  const hasGalleryReference = Boolean(searchParams.get("ref")?.trim());
  const dimensionSyncedPathRef = useRef<string | null>(hadCachedPrimaryPath ? primaryPath : null);

  const handlePrimaryPathChange = useCallback((path: string | null) => {
    dimensionSyncedPathRef.current = null;
    setPrimaryPath(path);
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
    onPath: handlePrimaryPathChange,
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
      .moduleDefaults("flux2_edit")
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
        setWidth(defaults.width);
        setHeight(defaults.height);
      })
      .catch((err) => {
        if (alive) {
          setError(err instanceof Error ? err.message : "Failed to load FLUX.2 Edit defaults.");
        }
      });
    return () => {
      alive = false;
    };
  }, [hadCachedModel]);

  useEffect(() => {
    if (!primaryPath || dimensionSyncedPathRef.current === primaryPath) {
      return;
    }
    let cancelled = false;
    const image = new window.Image();
    image.onload = () => {
      if (cancelled) {
        return;
      }
      dimensionSyncedPathRef.current = primaryPath;
      setWidth(snapDimension(image.naturalWidth));
      setHeight(snapDimension(image.naturalHeight));
    };
    image.onerror = () => {
      if (!cancelled) {
        dimensionSyncedPathRef.current = primaryPath;
      }
    };
    image.src = resolveInputImageSrc(primaryPath);
    return () => {
      cancelled = true;
    };
  }, [primaryPath]);

  const imagePaths = [primaryPath, secondaryPath].filter((path): path is string => Boolean(path));

  const onGenerate = async () => {
    if (!primaryPath || !prompt.trim()) {
      return;
    }
    setLoading(true);
    setError(null);
    const params = {
      prompt,
      model,
      imagePaths,
      quantize: quantizeApiValue(quantize),
      width,
      height,
      steps,
      guidance: guidance === null || guidance <= 0 ? undefined : guidance,
      seed: resolveIntegerSeed(seedMode, seed),
      ...loraJobParams
    };

    try {
      await submitJob({ module: "flux2_edit", params });
    } catch (err) {
      setError(err instanceof Error ? err.message : "FLUX.2 Edit failed");
    } finally {
      setLoading(false);
    }
  };

  const headerStatus = useModuleHeaderStatus(activeJobs, latestJob);

  return (
    <div className="content-shell module-reskin-page module-reskin-page--generation">
      <LoraModelNotice notice={loraModelNotice} />
      <PageHeader
        title="FLUX.2 KLEIN EDIT"
        description="Multi-image editing with FLUX.2 Klein — combine references and prompt-driven edits."
        version={headerStatus}
        className="module-reskin-page-header"
      />
      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.9fr]">
        <div className="module-form-column space-y-6">
          <Panel neonBorder="primary" scanline className="space-y-4">
            <PromptInput
              label="PROMPT"
              value={prompt}
              onChange={setPrompt}
              placeholder="Describe the edit (negative prompts are not supported)"
              variant="secondary"
            />
          </Panel>
          <Panel title="REFERENCE IMAGES" className="space-y-4">
            <ImageInput
              defaultPath={searchParams.get("ref") ?? undefined}
              label="Primary Image"
              onChange={setPrimaryPath}
              value={primaryPath}
              required
            />
            <ImageInput
              label="Additional Image (optional)"
              onChange={setSecondaryPath}
              value={secondaryPath}
            />
            <div className="text-xs text-on-surface-variant">
              Add a second image to combine references (e.g. person + accessory). FLUX.2 Edit does not use
              negative prompts.
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
              <SliderField label="GUIDANCE" value={guidance} onChange={setGuidance} min={0.5} max={4} step={0.1} />
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
                disabled={!prompt.trim() || !primaryPath}
                label="RUN FLUX.2 EDIT"
                className="module-primary-action w-full"
              />
              <div className="font-body text-sm text-[var(--color-text-secondary)]">
                {activeJobs.length
                  ? "Edit job in progress. Preview updates below when complete."
                  : "Runs mflux-generate-flux2-edit with one or two reference images."}
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