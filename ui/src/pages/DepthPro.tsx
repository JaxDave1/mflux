import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { GenerateButton, ImageInput, ModuleRunColumn, PageHeader, Panel, QuantizeField } from "../components";
import { useModuleHeaderStatus } from "../hooks/useModuleHeaderStatus";
import { useModuleLivePreview } from "../hooks/useModuleLivePreview";
import { quantizeApiValue, type QuantizeSelection } from "../lib/quantize";
import { useJobStore } from "../stores/useJobStore";

export function DepthPro() {
  const [searchParams] = useSearchParams();
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [quantize, setQuantize] = useState<QuantizeSelection>("8");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submitJob = useJobStore((state) => state.submitJob);
  const { job: latestJob, stepwiseImages, activeJobs } = useModuleLivePreview("depth_pro");

  const runDepth = async () => {
    if (!imagePath) return;
    setLoading(true);
    setError(null);
    try {
      await submitJob({
        module: "depth_pro",
        params: {
          imagePath,
          quantize: quantizeApiValue(quantize),
          output: output || null
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Depth Pro failed");
    } finally {
      setLoading(false);
    }
  };

  const headerStatus = useModuleHeaderStatus(activeJobs, latestJob);

  return (
    <div className="content-shell module-reskin-page module-reskin-page--generation">
      <PageHeader
        title="DEPTH PRO"
        description="Apple monocular depth extraction and export."
        version={headerStatus}
        className="module-reskin-page-header"
      />
      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.9fr]">
        <div className="module-form-column space-y-6">
          <Panel title="DEPTH EXTRACTION" neonBorder="primary" scanline className="space-y-4">
          <ImageInput
            defaultPath={searchParams.get("ref") ?? undefined}
            label="Source Image"
            onChange={setImagePath}
            value={imagePath}
          />
          <label className="flex flex-col gap-2">
            <span className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">
              OUTPUT PATH
            </span>
            <input
              value={output}
              onChange={(event) => setOutput(event.target.value)}
              placeholder="./outputs/depth_map.png"
              className="rounded-panel border border-outline-variant/60 bg-surface-container px-3 py-3 text-sm outline-none transition focus:border-secondary/60"
            />
          </label>
          <QuantizeField value={quantize} onChange={setQuantize} />
          </Panel>
        </div>
        <ModuleRunColumn
          job={latestJob}
          stepwiseImages={stepwiseImages}
          runControl={
            <>
              <div className="font-body text-sm text-[var(--color-text-secondary)]">
                Generates a PNG depth map from the selected image and saves it to the configured output path.
              </div>
              <GenerateButton
                onClick={runDepth}
                loading={loading}
                disabled={!imagePath}
                label="RUN DEPTH MAP"
                className="module-primary-action w-full"
              />
              <div className="font-body text-sm text-[var(--color-text-secondary)]">
                {activeJobs.length
                  ? "Generation in progress. Preview and progress update below."
                  : "Select a source image to extract a depth map."}
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