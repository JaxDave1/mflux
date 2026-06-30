import { useState } from "react";
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
import { useModuleHeaderStatus } from "../hooks/useModuleHeaderStatus";
import { useModuleLoraStack } from "../hooks/useModuleLoraStack";
import { useModuleLivePreview } from "../hooks/useModuleLivePreview";
import { useModuleLivePreviewSetting } from "../hooks/useModuleLivePreviewSetting";
import { useModuleModelOptions } from "../hooks/useModuleModelOptions";
import { useStickyState } from "../hooks/useStickyState";
import { quantizeApiValue, type QuantizeSelection } from "../lib/quantize";
import { defaultSchedulerForModel, normalizeSchedulerForModel, type SchedulerId } from "../lib/schedulerOptions";
import { resolveIntegerSeed, type SeedMode } from "../lib/seed";
import { useJobStore } from "../stores/useJobStore";
export function Inpaint() {
  const [prompt, setPrompt] = useStickyState("module:inpaint:prompt", "");
  const [model, setModel] = useStickyState("module:inpaint:model", "dev-fill");
  const [quantize, setQuantize] = useStickyState<QuantizeSelection>("module:inpaint:quantize", "8");
  const [steps, setSteps] = useStickyState("module:inpaint:steps", 25);
  const [guidance, setGuidance] = useStickyState("module:inpaint:guidance", 30);
  const [width, setWidth] = useStickyState("module:inpaint:width", 1024);
  const [height, setHeight] = useStickyState("module:inpaint:height", 1024);
  const [scheduler, setScheduler] = useStickyState<SchedulerId>(
    "module:inpaint:scheduler",
    defaultSchedulerForModel("dev-fill")
  );
  const [seedMode, setSeedMode] = useStickyState<SeedMode>("module:inpaint:seedMode", "auto");
  const [seed, setSeed] = useStickyState("module:inpaint:seed", "42");
  const [searchParams] = useSearchParams();
  const [imagePath, setImagePath] = useStickyState<string | null>("module:inpaint:imagePath", null);
  const [maskPath, setMaskPath] = useStickyState<string | null>("module:inpaint:maskPath", null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submitJob = useJobStore((state) => state.submitJob);
  const { job: latestJob, stepwiseImages, activeJobs } = useModuleLivePreview("inpaint");
  const { options: modelOptions } = useModuleModelOptions("inpaint", model);
  const { loras, setLoras, loraModelNotice, trackModelChange, onCompatibilityChange, loraJobParams } =
    useModuleLoraStack(model, "inpaint");
  const { livePreview, setLivePreview } = useModuleLivePreviewSetting("inpaint");

  const onGenerate = async () => {
    if (!imagePath || !maskPath) {
      return;
    }
    setLoading(true);
    setError(null);
    const params = {
      prompt,
      model,
      quantize: quantizeApiValue(quantize),
      width,
      height,
      steps,
      guidance,
      scheduler: normalizeSchedulerForModel(model, scheduler),
      seed: resolveIntegerSeed(seedMode, seed),
      imagePath,
      maskedImagePath: maskPath,
      livePreview,
      ...loraJobParams
    };

    try {
      await submitJob({ module: "inpaint", params });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Inpaint failed");
    } finally {
      setLoading(false);
    }
  };

  const headerStatus = useModuleHeaderStatus(activeJobs, latestJob);

  return (
    <div className="content-shell module-reskin-page module-reskin-page--generation">
      <LoraModelNotice notice={loraModelNotice} />
      <PageHeader
        title="INPAINT"
        description="Masked fill workflow with prompt-driven completion."
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
              placeholder="Describe the fill or repair"
              variant="secondary"
            />
          </Panel>
          <Panel title="SOURCE + MASK" className="grid gap-4 md:grid-cols-2">
            <ImageInput
              defaultPath={searchParams.get("ref") ?? undefined}
              label="Source Image"
              onChange={setImagePath}
              value={imagePath}
            />
            <ImageInput label="Mask Image" onChange={setMaskPath} value={maskPath} />
          </Panel>
          <Panel title="MODEL PIPELINE" className="grid gap-4 md:grid-cols-2">
            <SelectField
              label="MODEL"
              value={model}
              onChange={(nextModel) => {
                trackModelChange(model, nextModel);
                setModel(nextModel);
                setScheduler(defaultSchedulerForModel(nextModel));
              }}
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
            <SliderField label="GUIDANCE" value={guidance} onChange={setGuidance} min={1} max={40} step={1} />
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
                disabled={!prompt.trim() || !imagePath || !maskPath}
                label="RUN INPAINT"
                className="module-primary-action w-full"
              />
              <div className="font-body text-sm text-[var(--color-text-secondary)]">
                {activeJobs.length
                  ? "Generation in progress. Preview and progress update below."
                  : "Runs a masked fill using the selected source image, mask, and prompt."}
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
