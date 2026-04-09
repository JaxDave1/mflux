import { useEffect, useState } from "react";
import {
  GenerateButton,
  ImageGrid,
  PageHeader,
  Panel,
  PromptInput,
  SelectField,
  SliderField,
  ToggleChip
} from "../components";
import { api } from "../lib/api";
import type { Txt2ImgRequest } from "../lib/types";
import { useGenerationStore } from "../stores/useGenerationStore";
import { schedulerOptions, txt2imgModelOptions } from "./pageData";

export function Txt2Img() {
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [model, setModel] = useState("z-image-turbo");
  const [quantize, setQuantize] = useState("8");
  const [steps, setSteps] = useState(9);
  const [guidance, setGuidance] = useState(3.5);
  const [width, setWidth] = useState(1280);
  const [height, setHeight] = useState(768);
  const [scheduler, setScheduler] = useState("linear");
  const [seed, setSeed] = useState<number | null>(42);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { currentJob, recentOutputs, startJob, completeJob, failJob } = useGenerationStore();

  useEffect(() => {
    if (!recentOutputs.length) {
      return;
    }
    setError(null);
  }, [recentOutputs.length]);

  const onGenerate = async () => {
    setLoading(true);
    setError(null);
    const payload: Txt2ImgRequest = {
      prompt,
      negativePrompt,
      model,
      quantize: Number(quantize),
      width,
      height,
      steps,
      guidance,
      scheduler,
      seed
    };

    try {
      const response = await api.txt2imgGenerate(payload);
      startJob(response.job);
      completeJob(response.outputs);
    } catch (err) {
      failJob();
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="content-shell">
      <PageHeader title="TXT2IMG" version="VERSION 0.1.0-NEURAL" />
      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.9fr]">
        <div className="space-y-6">
          <Panel neonBorder="primary" className="space-y-4">
            <PromptInput
              label="PROMPT"
              value={prompt}
              onChange={setPrompt}
              placeholder="Enter positive prompt"
              variant="secondary"
            />
            <PromptInput
              label="NEGATIVE PROMPT"
              value={negativePrompt}
              onChange={setNegativePrompt}
              placeholder="Exclude elements"
              rows={2}
            />
          </Panel>
          <Panel title="MODEL PIPELINE" className="grid gap-4 md:grid-cols-2">
            <SelectField label="MODEL" value={model} onChange={setModel} options={txt2imgModelOptions} />
            <SelectField
              label="SCHEDULER"
              value={scheduler}
              onChange={setScheduler}
              options={schedulerOptions}
            />
            <div>
              <div className="mb-2 font-label text-[10px] tracking-[0.18em] text-on-surface-variant">
                QUANTIZE
              </div>
              <ToggleChip
                options={["3", "4", "5", "6", "8"]}
                value={quantize}
                onChange={setQuantize}
              />
            </div>
            <label className="flex flex-col gap-2">
              <span className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">
                SEED
              </span>
              <input
                className="rounded-panel border border-outline-variant/60 bg-surface-container px-3 py-3 text-sm outline-none transition focus:border-secondary/60"
                type="number"
                value={seed ?? ""}
                onChange={(event) => setSeed(event.target.value ? Number(event.target.value) : null)}
              />
            </label>
          </Panel>
          <Panel title="GENERATION CONTROLS" className="grid gap-4 md:grid-cols-2">
            <SliderField label="STEPS" value={steps} onChange={setSteps} min={1} max={60} />
            <SliderField
              label="GUIDANCE"
              value={guidance}
              onChange={setGuidance}
              min={1}
              max={20}
              step={0.5}
            />
            <SliderField label="WIDTH" value={width} onChange={setWidth} min={256} max={1536} step={64} />
            <SliderField label="HEIGHT" value={height} onChange={setHeight} min={256} max={1536} step={64} />
          </Panel>
        </div>
        <div className="space-y-6">
          <Panel title="RUN CONTROL" neonBorder="secondary" className="space-y-4">
            <GenerateButton
              onClick={onGenerate}
              loading={loading}
              disabled={!prompt.trim()}
              label="GENERATE IMAGE"
            />
            <div className="text-sm text-on-surface-variant">
              {currentJob?.status === "completed"
                ? "Latest job completed."
                : currentJob?.status === "running"
                  ? "Generation in progress."
                  : "Waiting for prompt input."}
            </div>
            {error ? <div className="rounded-panel bg-error-container px-3 py-3 text-sm text-on-error-container">{error}</div> : null}
          </Panel>
          <Panel title="RECENT OUTPUTS">
            {recentOutputs.length ? (
              <ImageGrid images={recentOutputs.slice(0, 4)} columns={2} />
            ) : (
              <div className="text-sm text-on-surface-variant">No outputs yet. Generate an image to populate the gallery feed.</div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
