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
import type { GenerationOutput } from "../lib/types";
import { kontextModelOptions, schedulerOptions } from "./pageData";

export function Kontext() {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("dev-kontext");
  const [quantize, setQuantize] = useState("8");
  const [steps, setSteps] = useState(25);
  const [guidance, setGuidance] = useState(2.5);
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [scheduler, setScheduler] = useState("linear");
  const [seed, setSeed] = useState("42");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [result, setResult] = useState<GenerationOutput[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const previewUrl = useMemo(() => (imageFile ? URL.createObjectURL(imageFile) : null), [imageFile]);

  const onGenerate = async () => {
    if (!imageFile) return;
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

    try {
      const response = await fetch("/api/kontext/generate", { method: "POST", body: data });
      const payload = await response.json();
      if (!payload.ok) throw new Error(payload.error?.message ?? "Kontext failed");
      setResult(payload.data.outputs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kontext failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="content-shell">
      <PageHeader title="KONTEXT" description="Image-conditioned generation using the audited Kontext path." />
      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.9fr]">
        <div className="space-y-6">
          <Panel neonBorder="primary" className="space-y-4">
            <PromptInput
              label="PROMPT"
              value={prompt}
              onChange={setPrompt}
              placeholder="Describe the contextual edit or restyle"
              variant="secondary"
            />
          </Panel>
          <Panel title="REFERENCE IMAGE" className="space-y-4">
            <label className="flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-panel border border-dashed border-secondary/50 bg-surface-container-low px-6 py-8 text-center transition hover:shadow-glow-secondary">
              <span className="material-symbols-outlined mb-3 text-4xl text-secondary">hub</span>
              <span className="font-label text-xs tracking-[0.18em] text-on-surface">
                {imageFile ? imageFile.name : "SELECT REFERENCE IMAGE"}
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
              />
            </label>
            {previewUrl ? (
              <img src={previewUrl} alt="Reference preview" className="max-h-[260px] w-full rounded-panel object-cover" />
            ) : null}
          </Panel>
          <Panel title="GENERATION CONTROLS" className="grid gap-4 md:grid-cols-2">
            <SelectField label="MODEL" value={model} onChange={setModel} options={kontextModelOptions} />
            <SelectField label="SCHEDULER" value={scheduler} onChange={setScheduler} options={schedulerOptions} />
            <div>
              <div className="mb-2 font-label text-[10px] tracking-[0.18em] text-on-surface-variant">QUANTIZE</div>
              <ToggleChip options={["3", "4", "5", "6", "8"]} value={quantize} onChange={setQuantize} />
            </div>
            <label className="flex flex-col gap-2">
              <span className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">SEED</span>
              <input
                className="rounded-panel border border-outline-variant/60 bg-surface-container px-3 py-3 text-sm outline-none transition focus:border-secondary/60"
                type="number"
                value={seed}
                onChange={(event) => setSeed(event.target.value)}
              />
            </label>
            <SliderField label="STEPS" value={steps} onChange={setSteps} min={1} max={60} />
            <SliderField label="GUIDANCE" value={guidance} onChange={setGuidance} min={1} max={10} step={0.5} />
            <SliderField label="WIDTH" value={width} onChange={setWidth} min={256} max={1536} step={64} />
            <SliderField label="HEIGHT" value={height} onChange={setHeight} min={256} max={1536} step={64} />
          </Panel>
        </div>
        <div className="space-y-6">
          <Panel title="RUN CONTROL" neonBorder="secondary" className="space-y-4">
            <GenerateButton onClick={onGenerate} loading={loading} disabled={!prompt.trim() || !imageFile} label="RUN KONTEXT" />
            <div className="text-sm text-on-surface-variant">
              Kontext v1 is image-conditioned generation only. Stitch-only named context weights were removed.
            </div>
            {error ? <div className="rounded-panel bg-error-container px-3 py-3 text-sm text-on-error-container">{error}</div> : null}
          </Panel>
          <Panel title="LATEST OUTPUTS">
            {result.length ? <ImageGrid images={result} columns={1} /> : <div className="text-sm text-on-surface-variant">No Kontext outputs yet.</div>}
          </Panel>
        </div>
      </div>
    </div>
  );
}
