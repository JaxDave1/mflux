import { useState } from "react";
import { GenerateButton, PageHeader, Panel, ToggleChip } from "../components";
import { api } from "../lib/api";
import type { GenerationOutput } from "../lib/types";

export function DepthPro() {
  const [imagePath, setImagePath] = useState("");
  const [quantize, setQuantize] = useState("8");
  const [output, setOutput] = useState("");
  const [result, setResult] = useState<GenerationOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const runDepth = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.depthProRun({
        imagePath,
        quantize: Number(quantize),
        output: output || null
      });
      setResult(response.output);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Depth Pro failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="content-shell">
      <PageHeader title="DEPTH PRO" description="Apple monocular depth extraction and export." />
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel title="DEPTH EXTRACTION" neonBorder="primary" className="space-y-4">
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
          <div>
            <div className="mb-2 font-label text-[10px] tracking-[0.18em] text-on-surface-variant">
              QUANTIZE
            </div>
            <ToggleChip options={["3", "4", "5", "6", "8"]} value={quantize} onChange={setQuantize} />
          </div>
        </Panel>
        <Panel title="RUN CONTROL" neonBorder="secondary" className="space-y-4">
          <div className="text-sm text-on-surface-variant">
            Uses the audited `mflux-save-depth` flow and writes a PNG depth map to the configured output path.
          </div>
          <GenerateButton
            onClick={runDepth}
            loading={loading}
            disabled={!imagePath.trim()}
            label="RUN DEPTH MAP"
          />
          {error ? (
            <div className="rounded-panel bg-error-container px-3 py-3 text-sm text-on-error-container">
              {error}
            </div>
          ) : null}
        </Panel>
      </div>
      <div className="mt-6">
        <Panel title="LATEST DEPTH OUTPUT">
          {result ? (
            <div className="grid gap-4 md:grid-cols-[220px_1fr]">
              <img src={result.thumbnailPath ?? result.path} alt={result.prompt} className="aspect-square w-full rounded-panel object-cover" />
              <div className="space-y-3">
                <div className="font-headline text-xl font-bold text-on-surface">Depth map complete</div>
                <div className="text-sm text-on-surface-variant">{result.path}</div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-on-surface-variant">
              No depth map has been generated yet.
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
