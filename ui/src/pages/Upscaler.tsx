import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  GenerateButton,
  ImageInput,
  ModuleRunColumn,
  PageHeader,
  Panel,
  SelectField,
  QuantizeField,
  SeedField,
  SliderField
} from "../components";
import { useModuleHeaderStatus } from "../hooks/useModuleHeaderStatus";
import { useModuleLivePreview } from "../hooks/useModuleLivePreview";
import { useStickyState } from "../hooks/useStickyState";
import { quantizeApiValue, type QuantizeSelection } from "../lib/quantize";
import { resolveIntegerSeed, type SeedMode } from "../lib/seed";
import { useJobStore } from "../stores/useJobStore";

const upscalerModels = [
  { value: "seedvr2-3b", label: "SeedVR2 3B" },
  { value: "seedvr2-7b", label: "SeedVR2 7B" }
];

export function Upscaler() {
  const [searchParams] = useSearchParams();
  const [imagePath, setImagePath] = useStickyState<string | null>("module:upscaler:imagePath", null);
  const [model, setModel] = useStickyState("module:upscaler:model", "seedvr2-3b");
  const [resolution, setResolution] = useStickyState("module:upscaler:resolution", "2x");
  const [softness, setSoftness] = useStickyState("module:upscaler:softness", 0);
  const [quantize, setQuantize] = useStickyState<QuantizeSelection>("module:upscaler:quantize", "8");
  const [seedMode, setSeedMode] = useStickyState<SeedMode>("module:upscaler:seedMode", "auto");
  const [seed, setSeed] = useStickyState("module:upscaler:seed", "42");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submitJob = useJobStore((state) => state.submitJob);
  const { job: latestJob, stepwiseImages, activeJobs } = useModuleLivePreview("upscaler");

  const runUpscaler = async () => {
    if (!imagePath) return;
    setLoading(true);
    setError(null);
    try {
      await submitJob({
        module: "upscaler",
        params: {
          imagePath,
          model,
          quantize: quantizeApiValue(quantize),
          resolution,
          softness,
          seed: resolveIntegerSeed(seedMode, seed)
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upscaler failed");
    } finally {
      setLoading(false);
    }
  };

  const headerStatus = useModuleHeaderStatus(activeJobs, latestJob);

  return (
    <div className="content-shell module-reskin-page module-reskin-page--generation">
      <PageHeader
        title="UPSCALER"
        description="SeedVR2 diffusion super-resolution workflow."
        version={headerStatus}
        className="module-reskin-page-header"
      />
      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.9fr]">
        <div className="module-form-column space-y-6">
          <Panel title="SOURCE + MODEL" neonBorder="primary" scanline className="space-y-4">
            <ImageInput
              defaultPath={searchParams.get("ref") ?? undefined}
              label="Source Image"
              onChange={setImagePath}
              value={imagePath}
            />
            <SelectField label="MODEL" value={model} onChange={setModel} options={upscalerModels} />
            <QuantizeField value={quantize} onChange={setQuantize} />
          </Panel>
          <Panel title="UPSCALE CONTROLS" className="space-y-4">
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
            <SeedField
              mode={seedMode}
              onModeChange={setSeedMode}
              value={seed}
              onChange={setSeed}
              className="md:col-span-2"
            />
          </Panel>
        </div>
        <ModuleRunColumn
          job={latestJob}
          stepwiseImages={stepwiseImages}
          runControl={
            <>
              <GenerateButton
                onClick={runUpscaler}
                loading={loading}
                disabled={!imagePath}
                label="RUN UPSCALER"
                className="module-primary-action w-full"
              />
              <div className="font-body text-sm text-[var(--color-text-secondary)]">
                {activeJobs.length
                  ? "Generation in progress. Preview and progress update below."
                  : "Select a source image and run SeedVR2 super-resolution."}
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
