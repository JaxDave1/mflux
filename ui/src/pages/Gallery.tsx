import { useEffect, useMemo, useState } from "react";
import { ImageGrid, PageHeader, Panel, ToggleChip } from "../components";
import { api } from "../lib/api";
import type { GenerationOutput } from "../lib/types";

type GalleryFilter = "ALL" | "VALIDATED" | "METADATA" | "UNKNOWN";

export function Gallery() {
  const [items, setItems] = useState<GenerationOutput[]>([]);
  const [filter, setFilter] = useState<GalleryFilter>("ALL");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<GenerationOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.gallery()
      .then((response) => {
        setItems(response.items);
        setSelected(response.items[0] ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load gallery"));
  }, []);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filter === "VALIDATED" && (!item.moduleType || item.moduleType === "unknown")) {
        return false;
      }
      if (filter === "METADATA" && (!item.metadataSource || item.metadataSource === "none")) {
        return false;
      }
      if (filter === "UNKNOWN" && item.model !== "unknown") {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      return [item.prompt, item.model, item.path].some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [filter, items, query]);

  return (
    <div className="content-shell">
      <PageHeader title="GALLERY" description="Recent outputs, sidecar recall, metadata traceability, and output review." />
      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.9fr]">
        <div className="space-y-6">
          <Panel title="OUTPUT INDEX" neonBorder="primary" className="space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <ToggleChip
                options={["ALL", "VALIDATED", "METADATA", "UNKNOWN"]}
                value={filter}
                onChange={(value) => setFilter(value as GalleryFilter)}
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search prompt, model, or path"
                className="w-full max-w-sm rounded-panel border border-outline-variant/60 bg-surface-container px-3 py-3 text-sm outline-none transition focus:border-secondary/60"
              />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-panel border border-outline-variant/60 bg-surface-container-low px-4 py-3">
                <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">TOTAL OUTPUTS</div>
                <div className="mt-2 font-headline text-2xl font-bold text-on-surface">{items.length}</div>
              </div>
              <div className="rounded-panel border border-outline-variant/60 bg-surface-container-low px-4 py-3">
                <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">WITH METADATA</div>
                <div className="mt-2 font-headline text-2xl font-bold text-secondary">
                  {items.filter((item) => item.metadataSource && item.metadataSource !== "none").length}
                </div>
              </div>
              <div className="rounded-panel border border-outline-variant/60 bg-surface-container-low px-4 py-3">
                <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">VALIDATED MODULES</div>
                <div className="mt-2 font-headline text-2xl font-bold text-primary">
                  {new Set(items.map((item) => item.moduleType).filter((value) => value && value !== "unknown")).size}
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="OUTPUT FEED">
            {error ? (
              <div className="text-sm text-on-error-container">{error}</div>
            ) : filteredItems.length ? (
              <ImageGrid images={filteredItems} columns={2} onSelect={setSelected} />
            ) : (
              <div className="text-sm text-on-surface-variant">No outputs matched the current gallery filters.</div>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="OUTPUT DETAILS" neonBorder="secondary" className="space-y-4">
            {selected ? (
              <>
                <div className="overflow-hidden rounded-panel border border-outline-variant/60 bg-surface-container-low">
                  <img src={selected.thumbnailPath ?? selected.path} alt={selected.prompt} className="aspect-square w-full object-cover" />
                </div>
                <div>
                  <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">PROMPT</div>
                  <div className="mt-2 text-sm leading-6 text-on-surface">{selected.prompt}</div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">MODULE</div>
                    <div className="mt-1 text-sm text-on-surface">{selected.moduleType ?? "unknown"}</div>
                  </div>
                  <div>
                    <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">MODEL</div>
                    <div className="mt-1 text-sm text-on-surface">{selected.model}</div>
                  </div>
                  <div>
                    <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">SEED</div>
                    <div className="mt-1 text-sm text-on-surface">{selected.seed || "untracked"}</div>
                  </div>
                  <div>
                    <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">DIMENSIONS</div>
                    <div className="mt-1 text-sm text-on-surface">
                      {selected.width && selected.height ? `${selected.width} × ${selected.height}` : "untracked"}
                    </div>
                  </div>
                  <div>
                    <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">METADATA SOURCE</div>
                    <div className="mt-1 text-sm text-on-surface">{selected.metadataSource ?? "none"}</div>
                  </div>
                  <div>
                    <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">STEPS</div>
                    <div className="mt-1 text-sm text-on-surface">{selected.steps ?? "untracked"}</div>
                  </div>
                  <div>
                    <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">GUIDANCE</div>
                    <div className="mt-1 text-sm text-on-surface">{selected.guidance ?? "untracked"}</div>
                  </div>
                  <div>
                    <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">QUANTIZE</div>
                    <div className="mt-1 text-sm text-on-surface">{selected.quantize ?? "untracked"}</div>
                  </div>
                  <div>
                    <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">PRECISION</div>
                    <div className="mt-1 text-sm text-on-surface">{selected.precision ?? "untracked"}</div>
                  </div>
                  <div>
                    <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">BASE MODEL</div>
                    <div className="mt-1 text-sm text-on-surface">{selected.baseModel ?? "none"}</div>
                  </div>
                  <div>
                    <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">GEN TIME</div>
                    <div className="mt-1 text-sm text-on-surface">
                      {selected.generationTimeSeconds ? `${selected.generationTimeSeconds.toFixed(2)}s` : "untracked"}
                    </div>
                  </div>
                  <div>
                    <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">MFLUX VERSION</div>
                    <div className="mt-1 text-sm text-on-surface">{selected.mfluxVersion ?? "untracked"}</div>
                  </div>
                </div>
                <div>
                  <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">FILE</div>
                  <div className="mt-1 break-all text-sm text-on-surface-variant">{selected.path}</div>
                </div>
              </>
            ) : (
              <div className="text-sm text-on-surface-variant">Select an output tile to inspect its metadata.</div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
