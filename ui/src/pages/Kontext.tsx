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
export function Kontext() {
  const [prompt, setPrompt] = useStickyState("module:kontext:prompt", "");
  const [model, setModel] = useStickyState("module:kontext:model", "dev-kontext");
  const [quantize, setQuantize] = useStickyState<QuantizeSelection>("module:kontext:quantize", "8");
  const [steps, setSteps] = useStickyState("module:kontext:steps", 25);
  const [guidance, setGuidance] = useStickyState("module:kontext:guidance", 2.5);
  const [width, setWidth] = useStickyState("module:kontext:width", 1024);
  const [height, setHeight] = useStickyState("module:kontext:height", 1024);
  const [scheduler, setScheduler] = useStickyState<SchedulerId>(
    "module:kontext:scheduler",
    defaultSchedulerForModel("dev-kontext")
  );
  const [seedMode, setSeedMode] = useStickyState<SeedMode>("module:kontext:seedMode", "auto");
  const [seed, setSeed] = useStickyState("module:kontext:seed", "42");
  const [searchParams] = useSearchParams();
  const [imagePath, setImagePath] = useStickyState<string | null>("module:kontext:imagePath", null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submitJob = useJobStore((state) => state.submitJob);
  const { job: latestJob, stepwiseImages, activeJobs } = useModuleLivePreview("kontext");
  const { options: modelOptions } = useModuleModelOptions("kontext", model);
  const { loras, setLoras, loraModelNotice, trackModelChange, onCompatibilityChange, loraJobParams } =
    useModuleLoraStack(model, "kontext");
  const { livePreview, setLivePreview } = useModuleLivePreviewSetting("kontext");

  const onGenerate = async () => {
    if (!imagePath) return;
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
      livePreview,
      ...loraJobParams
    };

    try {
      await submitJob({ module: "kontext", params });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kontext failed");
    } finally {
      setLoading(false);
    }
  };

  const headerStatus = useModuleHeaderStatus(activeJobs, latestJob);

  return (
    <div className="content-shell module-reskin-page module-reskin-page--generation">
      <LoraModelNotice notice={loraModelNotice} />
      <PageHeader
        title="KONTEXT"
        description="Reference-image generation with prompt-driven restyling."
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
              placeholder="Describe the contextual edit or restyle"
              variant="secondary"
            />
          </Panel>
          <Panel title="REFERENCE IMAGE" className="space-y-4">
            <ImageInput
              defaultPath={searchParams.get("ref") ?? undefined}
              label="Reference Image"
              onChange={setImagePath}
              value={imagePath}
            />
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
            <SliderField label="GUIDANCE" value={guidance} onChange={setGuidance} min={1} max={10} step={0.5} />
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
                label="RUN KONTEXT"
                className="module-primary-action w-full"
              />
              <div className="font-body text-sm text-[var(--color-text-secondary)]">
                {activeJobs.length
                  ? "Generation in progress. Preview and progress update below."
                  : "Runs a Kontext generation from the selected reference image and prompt."}
              </div>
              {error ? <div className="rounded-panel bg-error-container px-3 py-3 text-sm text-on-error-container">{error}</div> : null}
            </>
          }
        />
      </div>
    </div>
  );
}
