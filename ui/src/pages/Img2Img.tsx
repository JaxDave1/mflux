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
import { img2imgModelOptions, schedulerOptions } from "./pageData";

export function Img2Img() {
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [model, setModel] = useState("z-image-turbo");
  const [quantize, setQuantize] = useState("8");
  const [steps, setSteps] = useState(9);
  const [guidance, setGuidance] = useState(3.5);
  const [width, setWidth] = useState(1280);
  const [height, setHeight] = useState(768);
  const [scheduler, setScheduler] = useState("linear");
  const [seed, setSeed] = useState("42");
  const [imageStrength, setImageStrength] = useState(0.75);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<GenerationOutput[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  const onGenerate = async () => {
    if (!file) {
      return;
    }
    setLoading(true);
    setError(null);
    const data = new FormData();
    data.append("prompt", prompt);
    data.append("negativePrompt", negativePrompt);
    data.append("model", model);
    data.append("quantize", quantize);
    data.append("width", String(width));
    data.append("height", String(height));
    data.append("steps", String(steps));
    data.append("guidance", String(guidance));
    data.append("scheduler", scheduler);
    data.append("seed", seed);
    data.append("imageStrength", String(imageStrength));
    data.append("image", file);

    try {
      const response = await api.img2imgGenerate(data);
      setResult(response.outputs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Img2img failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="content-shell">
      <PageHeader title="IMG2IMG" description="Reference-driven generation and denoise control." />
      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.9fr]">
        <div className="space-y-6">
          <Panel neonBorder="primary" className="space-y-4">
            <PromptInput
              label="PROMPT"
              value={prompt}
              onChange={setPrompt}
              placeholder="Describe the transformation"
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
          <Panel title="SOURCE IMAGE" className="space-y-4">
            <label className="flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-panel border border-dashed border-secondary/50 bg-surface-container-low px-6 py-8 text-center transition hover:shadow-glow-secondary">
              <span className="material-symbols-outlined mb-3 text-4xl text-secondary">upload_file</span>
              <span className="font-label text-xs tracking-[0.18em] text-on-surface">
                {file ? file.name : "SELECT SOURCE IMAGE"}
              </span>
              <span className="mt-2 text-sm text-on-surface-variant">
                File picker workflow wired. Drag/drop can be layered on top later.
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
            {previewUrl ? (
              <img src={previewUrl} alt="Source preview" className="max-h-[240px] w-full rounded-panel object-cover" />
            ) : null}
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
            <SelectField label="MODEL" value={model} onChange={setModel} options={img2imgModelOptions} />
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
              disabled={!prompt.trim() || !file}
              label="RUN IMG2IMG"
            />
            <div className="text-sm text-on-surface-variant">
              Uses the audited `mflux-generate` path with `--image-path` and `--image-strength`.
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
                No img2img outputs yet. Upload an image and run the transform.
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
