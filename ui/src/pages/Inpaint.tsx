import { useMemo, useState } from "react";
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
import type { GenerationOutput } from "../lib/types";
import { inpaintModelOptions, schedulerOptions } from "./pageData";

export function Inpaint() {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("dev-fill");
  const [quantize, setQuantize] = useState("8");
  const [steps, setSteps] = useState(25);
  const [guidance, setGuidance] = useState(30);
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [scheduler, setScheduler] = useState("linear");
  const [seed, setSeed] = useState("42");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [maskFile, setMaskFile] = useState<File | null>(null);
  const [result, setResult] = useState<GenerationOutput[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const imagePreview = useMemo(
    () => (imageFile ? URL.createObjectURL(imageFile) : null),
    [imageFile]
  );
  const maskPreview = useMemo(
    () => (maskFile ? URL.createObjectURL(maskFile) : null),
    [maskFile]
  );

  const onGenerate = async () => {
    if (!imageFile || !maskFile) {
      return;
    }
    setLoading(true);
    setError(null);
    const data = new FormData();
    data.append("prompt", prompt);
    data.append("model", model);
    data.append("quantize", quantize);
    data.append("width", String(width));
    data.append("height", String(height));
    data.append("steps", String(steps));
    data.append("guidance", String(guidance));
    data.append("scheduler", scheduler);
    data.append("seed", seed);
    data.append("image", imageFile);
    data.append("mask", maskFile);

    try {
      const response = await fetch("/api/inpaint/generate", {
        method: "POST",
        body: data
      });
      const payload = await response.json();
      if (!payload.ok) {
        throw new Error(payload.error?.message ?? "Inpaint failed");
      }
      setResult(payload.data.outputs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Inpaint failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="content-shell">
      <PageHeader title="INPAINT" description="Masked fill workflow with prompt-driven completion." />
      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.9fr]">
        <div className="space-y-6">
          <Panel neonBorder="primary" className="space-y-4">
            <PromptInput
              label="PROMPT"
              value={prompt}
              onChange={setPrompt}
              placeholder="Describe the fill or repair"
              variant="secondary"
            />
          </Panel>
          <Panel title="SOURCE + MASK" className="grid gap-4 md:grid-cols-2">
            <label className="flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-panel border border-dashed border-secondary/50 bg-surface-container-low px-6 py-8 text-center transition hover:shadow-glow-secondary">
              <span className="material-symbols-outlined mb-3 text-4xl text-secondary">image</span>
              <span className="font-label text-xs tracking-[0.18em] text-on-surface">
                {imageFile ? imageFile.name : "SELECT SOURCE IMAGE"}
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <label className="flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-panel border border-dashed border-primary/50 bg-surface-container-low px-6 py-8 text-center transition hover:shadow-glow-primary">
              <span className="material-symbols-outlined mb-3 text-4xl text-primary">gesture_select</span>
              <span className="font-label text-xs tracking-[0.18em] text-on-surface">
                {maskFile ? maskFile.name : "SELECT MASK IMAGE"}
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => setMaskFile(event.target.files?.[0] ?? null)}
              />
            </label>
            {imagePreview ? (
              <img src={imagePreview} alt="Source preview" className="max-h-[220px] w-full rounded-panel object-cover" />
            ) : null}
            {maskPreview ? (
              <img src={maskPreview} alt="Mask preview" className="max-h-[220px] w-full rounded-panel object-cover" />
            ) : null}
          </Panel>
          <Panel title="MODEL PIPELINE" className="grid gap-4 md:grid-cols-2">
            <SelectField label="MODEL" value={model} onChange={setModel} options={inpaintModelOptions} />
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
              <ToggleChip options={["3", "4", "5", "6", "8"]} value={quantize} onChange={setQuantize} />
            </div>
            <label className="flex flex-col gap-2">
              <span className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">
                SEED
              </span>
              <input
                className="rounded-panel border border-outline-variant/60 bg-surface-container px-3 py-3 text-sm outline-none transition focus:border-secondary/60"
                type="number"
                value={seed}
                onChange={(event) => setSeed(event.target.value)}
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
              max={40}
              step={1}
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
              disabled={!prompt.trim() || !imageFile || !maskFile}
              label="RUN INPAINT"
            />
            <div className="text-sm text-on-surface-variant">
              Uses the audited `mflux-generate-fill` path with uploaded source and mask images.
            </div>
            {error ? (
              <div className="rounded-panel bg-error-container px-3 py-3 text-sm text-on-error-container">{error}</div>
            ) : null}
          </Panel>
          <Panel title="LATEST OUTPUTS">
            {result.length ? (
              <ImageGrid images={result} columns={1} />
            ) : (
              <div className="text-sm text-on-surface-variant">
                No inpaint outputs yet. Upload a source image and mask to run the fill workflow.
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
