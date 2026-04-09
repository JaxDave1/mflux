import { useState } from "react";
import {
  GenerateButton,
  PageHeader,
  Panel,
  SelectField,
  SliderField,
  ToggleChip
} from "../components";
import { api } from "../lib/api";
import type { GenerationOutput } from "../lib/types";

const upscalerModels = [
  { value: "seedvr2-3b", label: "SeedVR2 3B" },
  { value: "seedvr2-7b", label: "SeedVR2 7B" }
];

export function Upscaler() {
  const [imagePath, setImagePath] = useState("");
  const [model, setModel] = useState("seedvr2-3b");
  const [resolution, setResolution] = useState("2x");
  const [softness, setSoftness] = useState(0);
  const [quantize, setQuantize] = useState("8");
  const [seed, setSeed] = useState("42");
  const [result, setResult] = useState<GenerationOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const runUpscaler = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.upscalerGenerate({
        imagePath,
        model,
        quantize: Number(quantize),
        resolution,
        softness,
        seed: seed ? Number(seed) : null
      });
      setResult(response.output);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upscaler failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="content-shell">
      <PageHeader title="UPSCALER" description="SeedVR2 diffusion super-resolution workflow." />
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel title="SOURCE + MODEL" neonBorder="primary" className="space-y-4">
          <label className="flex flex-col gap-2">
            <span className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">
              IMAGE PATH
            </span>
            <input
              value={imagePath}
              onChange={(event) => setImagePath(event.target.value)}
              placeholder="./input.png"
              className="rounded-panel border border-outline-variant/60 bg-surface-container px-3 py-3 text-sm outline-none transition focus:border-secondary/60"
            />
          </label>
          <SelectField label="MODEL" value={model} onChange={setModel} options={upscalerModels} />
          <div>
            <div className="mb-2 font-label text-[10px] tracking-[0.18em] text-on-surface-variant">
              QUANTIZE
            </div>
            <ToggleChip options={["3", "4", "5", "6", "8"]} value={quantize} onChange={setQuantize} />
          </div>
        </Panel>
        <Panel title="UPSCALE CONTROLS" neonBorder="secondary" className="space-y-4">
          <label className="flex flex-col gap-2">
            <span className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">
              RESOLUTION
            </span>
            <input
              value={resolution}
              onChange={(event) => setResolution(event.target.value)}
              placeholder="2x or 384"
              className="rounded-panel border border-outline-variant/60 bg-surface-container px-3 py-3 text-sm outline-none transition focus:border-secondary/60"
            />
          </label>
          <SliderField
            label="SOFTNESS"
            value={softness}
            onChange={setSoftness}
            min={0}
            max={1}
            step={0.1}
          />
          <label className="flex flex-col gap-2">
            <span className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">
              SEED
            </span>
            <input
              value={seed}
              onChange={(event) => setSeed(event.target.value)}
              className="rounded-panel border border-outline-variant/60 bg-surface-container px-3 py-3 text-sm outline-none transition focus:border-secondary/60"
            />
          </label>
          <GenerateButton
            onClick={runUpscaler}
            loading={loading}
            disabled={!imagePath.trim()}
            label="RUN UPSCALER"
          />
          {error ? (
            <div className="rounded-panel bg-error-container px-3 py-3 text-sm text-on-error-container">
              {error}
            </div>
          ) : null}
        </Panel>
      </div>
      <div className="mt-6">
        <Panel title="LATEST OUTPUT">
          {result ? (
            <div className="grid gap-4 md:grid-cols-[220px_1fr]">
              <img src={result.thumbnailPath ?? result.path} alt={result.prompt} className="aspect-square w-full rounded-panel object-cover" />
              <div className="space-y-3">
                <div className="font-headline text-xl font-bold text-on-surface">{result.model}</div>
                <div className="text-sm text-on-surface-variant">{result.path}</div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-on-surface-variant">
              No upscale output yet. Run the SeedVR2 workflow to generate a result.
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
