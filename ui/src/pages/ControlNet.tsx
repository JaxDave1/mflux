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
  SliderField,
  ToggleChip
} from "../components";
import { useModuleHeaderStatus } from "../hooks/useModuleHeaderStatus";
import { useModuleLoraStack } from "../hooks/useModuleLoraStack";
import { useModuleLivePreview } from "../hooks/useModuleLivePreview";
import { useModuleLivePreviewSetting } from "../hooks/useModuleLivePreviewSetting";
import { useModuleModelOptions } from "../hooks/useModuleModelOptions";
import { quantizeApiValue, type QuantizeSelection } from "../lib/quantize";
import { defaultSchedulerForModel, normalizeSchedulerForModel, type SchedulerId } from "../lib/schedulerOptions";
import { resolveIntegerSeed, type SeedMode } from "../lib/seed";
import { useJobStore } from "../stores/useJobStore";
export function ControlNet() {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("dev-controlnet-canny");
  const [quantize, setQuantize] = useState<QuantizeSelection>("8");
  const [steps, setSteps] = useState(25);
  const [guidance, setGuidance] = useState(3.5);
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [scheduler, setScheduler] = useState<SchedulerId>(defaultSchedulerForModel("dev-controlnet-canny"));
  const [seedMode, setSeedMode] = useState<SeedMode>("auto");
  const [seed, setSeed] = useState("42");
  const [strength, setStrength] = useState(0.4);
  const [saveCanny, setSaveCanny] = useState("OFF");
  const [searchParams] = useSearchParams();
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submitJob = useJobStore((state) => state.submitJob);
  const { job: latestJob, stepwiseImages, activeJobs } = useModuleLivePreview("controlnet");
  const { options: modelOptions } = useModuleModelOptions("controlnet", model);
  const { loras, setLoras, loraModelNotice, trackModelChange, onCompatibilityChange, loraJobParams } =
    useModuleLoraStack(model);
  const { livePreview, setLivePreview } = useModuleLivePreviewSetting();

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
      controlnetStrength: strength,
      controlnetSaveCanny: saveCanny === "ON",
      controlnetImagePath: imagePath,
      livePreview,
      ...loraJobParams
    };

    try {
      await submitJob({ module: "controlnet", params });
    } catch (err) {
      setError(err instanceof Error ? err.message : "ControlNet failed");
    } finally {
      setLoading(false);
    }
  };

  const headerStatus = useModuleHeaderStatus(activeJobs, latestJob);

  return (
    <div className="content-shell module-reskin-page module-reskin-page--generation">
      <LoraModelNotice notice={loraModelNotice} />
      <PageHeader
        title="CONTROLNET"
        description="Canny-guided generation with a control image and strength setting."
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
              placeholder="Describe the controlled render"
              variant="secondary"
            />
          </Panel>
          <Panel title="CONTROL IMAGE" className="space-y-4">
            <ImageInput
              defaultPath={searchParams.get("ref") ?? undefined}
              label="Control Image"
              onChange={setImagePath}
              value={imagePath}
            />
            <SliderField label="CONTROL STRENGTH" value={strength} onChange={setStrength} min={0} max={1} step={0.05} />
            <div>
              <div className="mb-2 font-label text-[10px] tracking-[0.18em] text-on-surface-variant">SAVE CANNY PREVIEW</div>
              <ToggleChip options={["OFF", "ON"]} value={saveCanny} onChange={setSaveCanny} color="primary" />
            </div>
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
            <SliderField label="GUIDANCE" value={guidance} onChange={setGuidance} min={1} max={20} step={0.5} />
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
                label="RUN CONTROLNET"
                className="module-primary-action w-full"
              />
              <div className="font-body text-sm text-[var(--color-text-secondary)]">
                {activeJobs.length
                  ? "Generation in progress. Preview and progress update below."
                  : "Runs a ControlNet pass using the selected control image and edge strength."}
              </div>
              {error ? <div className="rounded-panel bg-error-container px-3 py-3 text-sm text-on-error-container">{error}</div> : null}
            </>
          }
        />
      </div>
    </div>
  );
}
