import { useEffect, useState } from "react";
import {
  GenerateButton,
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
  SliderField,
  ToggleChip
} from "../components";
import { useModuleHeaderStatus } from "../hooks/useModuleHeaderStatus";
import { useModuleLoraStack } from "../hooks/useModuleLoraStack";
import { useModuleLivePreview } from "../hooks/useModuleLivePreview";
import { useModuleLivePreviewSetting } from "../hooks/useModuleLivePreviewSetting";
import { useModuleModelOptions } from "../hooks/useModuleModelOptions";
import { useStickyState } from "../hooks/useStickyState";
import { api } from "../lib/api";
import type { ModelDefaultsResponse, Txt2ImgRequest } from "../lib/types";
import { quantizeApiValue, quantizeSelectionFromApi, type QuantizeSelection } from "../lib/quantize";
import {
  normalizeSchedulerForModel,
  type SchedulerId
} from "../lib/schedulerOptions";
import { resolveTxt2ImgSeed, type SeedMode } from "../lib/seed";
import { useConfigStore } from "../stores/useConfigStore";
import { useJobStore } from "../stores/useJobStore";

type DirtyDefaults = {
  steps: boolean;
  guidance: boolean;
  quantize: boolean;
};

export function Txt2Img() {
  const [prompt, setPrompt] = useStickyState("module:txt2img:prompt", "");
  const [negativePrompt, setNegativePrompt] = useStickyState("module:txt2img:negativePrompt", "");
  const [supportsNegativePrompt, setSupportsNegativePrompt] = useStickyState(
    "module:txt2img:supportsNegativePrompt",
    false
  );
  const [model, setModel, hadCachedModel] = useStickyState("module:txt2img:model", "z-image-turbo");
  const [quantize, setQuantize] = useStickyState<QuantizeSelection>("module:txt2img:quantize", "8");
  const [steps, setSteps] = useStickyState("module:txt2img:steps", 9);
  const [guidance, setGuidance] = useStickyState<number | null>("module:txt2img:guidance", 0);
  const [width, setWidth] = useStickyState("module:txt2img:width", 1280);
  const [height, setHeight] = useStickyState("module:txt2img:height", 768);
  const [scheduler, setScheduler] = useStickyState<SchedulerId>("module:txt2img:scheduler", "linear");
  const [seedMode, setSeedMode] = useStickyState<SeedMode>("module:txt2img:seedMode", "auto");
  const [seedInput, setSeedInput] = useStickyState("module:txt2img:seedInput", "42");
  const [lowRam, setLowRam, hadCachedLowRam] = useStickyState("module:txt2img:lowRam", false);
  const { livePreview, setLivePreview } = useModuleLivePreviewSetting("txt2img");
  const [dirty, setDirty] = useStickyState<DirtyDefaults>("module:txt2img:dirty", {
    steps: false,
    guidance: false,
    quantize: false
  });
  const { loras, setLoras, loraModelNotice, trackModelChange, onCompatibilityChange } =
    useModuleLoraStack(model, "txt2img");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submitJob = useJobStore((state) => state.submitJob);
  const { config, loadConfig } = useConfigStore();
  const {
    job: latestTxt2ImgJob,
    stepwiseImages: latestStepwiseImages,
    activeJobs
  } = useModuleLivePreview("txt2img");
  const { options: modelOptions } = useModuleModelOptions("txt2img", model);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (!config || hadCachedLowRam) {
      return;
    }
    setLowRam(config.system.lowRamMode);
  }, [config, hadCachedLowRam, setLowRam]);

  useEffect(() => {
    if (hadCachedModel) {
      return;
    }
    let alive = true;
    api
      .moduleDefaults("txt2img")
      .then((defaults) => {
        if (!alive) {
          return;
        }
        setModel(defaults.model);
        setWidth(defaults.width);
        setHeight(defaults.height);
        setSupportsNegativePrompt(defaults.supports_negative_prompt);
        if (!dirty.steps && defaults.steps !== null) {
          setSteps(defaults.steps);
        }
        if (!dirty.guidance) {
          setGuidance(defaults.guidance);
        }
        if (!dirty.quantize) {
          setQuantize(quantizeSelectionFromApi(defaults.quantize));
        }
        setScheduler(normalizeSchedulerForModel(defaults.model, defaults.scheduler));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load txt2img defaults."));
    return () => {
      alive = false;
    };
  }, [hadCachedModel]);

  const applyModelDefaults = async (nextModel: string) => {
    trackModelChange(model, nextModel);
    setModel(nextModel);
    setError(null);
    try {
      const defaults: ModelDefaultsResponse = await api.modelDefaults(nextModel);
      setSupportsNegativePrompt(defaults.supports_negative_prompt);
      if (!defaults.supports_negative_prompt) {
        setNegativePrompt("");
      }
      if (!dirty.steps && defaults.steps !== null) {
        setSteps(defaults.steps);
      }
      if (!dirty.guidance) {
        setGuidance(defaults.guidance);
      }
      if (!dirty.quantize) {
        setQuantize(quantizeSelectionFromApi(defaults.quantize));
      }
      setScheduler(normalizeSchedulerForModel(nextModel, defaults.scheduler));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load model defaults.");
    }
  };

  const onGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const seedPayload = resolveTxt2ImgSeed(seedMode, seedInput);
      if (seedPayload.displaySeed) {
        setSeedInput(seedPayload.displaySeed);
      }
      const { displaySeed: _displaySeed, ...seedParams } = seedPayload;
      const payload: Txt2ImgRequest = {
        prompt,
        negativePrompt: supportsNegativePrompt ? negativePrompt : "",
        model,
        quantize: quantizeApiValue(quantize),
        width,
        height,
        steps,
        guidance,
        scheduler: normalizeSchedulerForModel(model, scheduler),
        metadata: config?.generation.saveMetadataSidecar ?? true,
        lowRam,
        livePreview,
        ...seedParams
      };
      if (loras.length) {
        payload.loras = loras;
      }
      await submitJob({ module: "txt2img", params: { ...payload } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  const headerStatus = useModuleHeaderStatus(activeJobs, latestTxt2ImgJob);
  return (
    <div className="content-shell module-reskin-page module-reskin-page--generation">
      <LoraModelNotice notice={loraModelNotice} />
      <PageHeader
        title="TXT2IMG"
        description="Prompt-first image generation with live runtime controls."
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
              placeholder="Enter positive prompt"
              variant="secondary"
            />
            {supportsNegativePrompt ? (
              <PromptInput
                label="NEGATIVE PROMPT"
                value={negativePrompt}
                onChange={setNegativePrompt}
                placeholder="Terms to suppress for Qwen models"
                rows={3}
              />
            ) : null}
          </Panel>

          <Panel title="MODEL PIPELINE" className="grid gap-4 md:grid-cols-2">
            <SelectField
              label="MODEL"
              value={model}
              onChange={(value) => void applyModelDefaults(value)}
              options={modelOptions}
            />
            <SchedulerField model={model} value={scheduler} onChange={setScheduler} />
            <QuantizeField
              value={quantize}
              onChange={(value) => {
                setDirty((current) => ({ ...current, quantize: true }));
                setQuantize(value);
              }}
            />
            <SeedField
              mode={seedMode}
              onModeChange={setSeedMode}
              value={seedInput}
              onChange={setSeedInput}
              variant="advanced"
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
            <div className="space-y-4">
              <SliderField
                label="STEPS"
                value={steps}
                onChange={(value) => {
                  setDirty((current) => ({ ...current, steps: true }));
                  setSteps(value);
                }}
                min={1}
                max={100}
              />
              {guidance !== null ? (
                <SliderField
                  label="GUIDANCE"
                  value={guidance}
                  onChange={(value) => {
                    setDirty((current) => ({ ...current, guidance: true }));
                    setGuidance(value);
                  }}
                  min={0}
                  max={40}
                  step={0.5}
                />
              ) : null}
              <SliderField label="WIDTH" value={width} onChange={setWidth} min={256} max={2048} step={64} />
              <SliderField label="HEIGHT" value={height} onChange={setHeight} min={256} max={2048} step={64} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <LivePreviewField value={livePreview} onChange={setLivePreview} />
              <div>
                <div className="mb-2 font-label text-[10px] tracking-[0.18em] text-on-surface-variant">LOW RAM MODE</div>
                <ToggleChip options={["OFF", "ON"]} value={lowRam ? "ON" : "OFF"} onChange={(value) => setLowRam(value === "ON")} />
              </div>
            </div>
          </Panel>
        </div>

        <ModuleRunColumn job={latestTxt2ImgJob} stepwiseImages={latestStepwiseImages} runControl={
          <>
            <GenerateButton
              onClick={onGenerate}
              loading={loading}
              disabled={!prompt.trim()}
              label="GENERATE IMAGE"
              className="module-primary-action w-full"
            />
            <div className="font-body text-sm text-[var(--color-text-secondary)]">
              {activeJobs.length
                ? "Generation in progress. Preview and progress update below."
                : "Enter a prompt to start a generation run."}
            </div>
            {error ? <div className="rounded-panel bg-error-container px-3 py-3 text-sm text-on-error-container">{error}</div> : null}
          </>
        } />
      </div>
    </div>
  );
}
