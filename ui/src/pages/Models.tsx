import { useEffect, useMemo, useState } from "react";
import { GenerateButton, PageHeader, Panel, ToggleChip } from "../components";
import { api } from "../lib/api";
import type { ModelSummary, ModelsResponse } from "../lib/types";

type ModelFilter = "BUILTIN" | "CACHED" | "CUSTOM" | "LORA";

function ModelCard({
  model,
  onWarmCache,
  warming
}: {
  model: ModelSummary;
  onWarmCache?: (id: string) => void;
  warming?: boolean;
}) {
  const cached = Boolean(model.metadata.cached);
  const installed = Boolean(model.metadata.installed);

  return (
    <Panel
      key={model.id}
      neonBorder={model.active ? "secondary" : cached || installed ? "primary" : "none"}
      className="space-y-3"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-headline text-xl font-bold text-on-surface">{model.name}</div>
          <div className="mt-1 font-label text-[10px] tracking-[0.18em] text-on-surface-variant">
            {model.architecture} · {model.type} · {model.source}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {model.active ? (
            <div className="rounded-full border border-secondary/40 px-3 py-1 font-label text-[10px] tracking-[0.18em] text-secondary">
              ACTIVE
            </div>
          ) : null}
          {model.source === "builtin" ? (
            <div
              className={`rounded-full border px-3 py-1 font-label text-[10px] tracking-[0.18em] ${
                cached
                  ? "border-primary/40 text-primary"
                  : "border-outline-variant/60 text-on-surface-variant"
              }`}
            >
              {cached ? "CACHED" : "NOT CACHED"}
            </div>
          ) : (
            <div className="rounded-full border border-primary/40 px-3 py-1 font-label text-[10px] tracking-[0.18em] text-primary">
              LOCAL
            </div>
          )}
        </div>
      </div>
      <div className="text-sm text-on-surface-variant">{model.metadata.notes ?? "Available via MFLUX CLI."}</div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">SIZE</div>
          <div className="mt-1 text-sm text-on-surface">{model.size}</div>
        </div>
        <div>
          <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">
            {model.source === "builtin" ? "CACHE STATUS" : "DETECTED FILES"}
          </div>
          <div className="mt-1 text-sm text-on-surface">
            {model.source === "builtin" ? (cached ? "offline-ready" : "download required") : model.metadata.detectedFiles ?? 0}
          </div>
        </div>
      </div>
      <div>
        <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">
          {model.repoId ? "REPO / PATH" : "PATH"}
        </div>
        <div className="mt-1 break-all text-sm text-on-surface-variant">{model.repoId ?? model.path}</div>
      </div>
      {!!model.metadata.triggerWords?.length && (
        <div className="flex flex-wrap gap-2">
          {model.metadata.triggerWords.map((word) => (
            <span
              key={word}
              className="rounded-full border border-primary/40 px-2 py-1 font-label text-[10px] tracking-[0.18em] text-primary"
            >
              {word}
            </span>
          ))}
        </div>
      )}
      {model.source === "builtin" && !cached && model.metadata.downloadable ? (
        <GenerateButton
          onClick={() => onWarmCache?.(model.id)}
          loading={warming}
          label="CACHE MODEL"
          variant="outline"
        />
      ) : null}
    </Panel>
  );
}

export function Models() {
  const [data, setData] = useState<ModelsResponse | null>(null);
  const [filter, setFilter] = useState<ModelFilter>("BUILTIN");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [warmingId, setWarmingId] = useState<string | null>(null);

  const load = () =>
    api.models()
      .then((response) => setData(response))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load models"));

  useEffect(() => {
    void load();
  }, []);

  const visibleModels = useMemo(() => {
    if (!data) {
      return [];
    }
    if (filter === "BUILTIN") {
      return data.builtin;
    }
    if (filter === "CACHED") {
      return data.builtin.filter((model) => model.metadata.cached);
    }
    if (filter === "CUSTOM") {
      return data.custom;
    }
    return data.loras;
  }, [data, filter]);

  const onWarmCache = async (id: string) => {
    setWarmingId(id);
    setError(null);
    setNotice(null);
    try {
      await api.cacheModel(id);
      setNotice(`Cache warm-up triggered for ${id}. Reload model status after the download completes.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to warm model cache.");
    } finally {
      setWarmingId(null);
    }
  };

  const builtinCount = data?.builtin.length ?? 0;
  const cachedCount = data?.builtin.filter((model) => model.metadata.cached).length ?? 0;
  const customCount = data?.custom.length ?? 0;
  const loraCount = data?.loras.length ?? 0;

  return (
    <div className="content-shell">
      <PageHeader title="MODELS" description="Repo-supported families, offline cache state, optional custom paths, and actual LoRA cache contents." />
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <Panel title="MODEL FILTERS" neonBorder="primary" className="space-y-4">
            <ToggleChip
              options={["BUILTIN", "CACHED", "CUSTOM", "LORA"]}
              value={filter}
              onChange={(value) => setFilter(value as ModelFilter)}
            />
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-panel border border-outline-variant/60 bg-surface-container-low px-4 py-3">
                <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">BUILT-IN</div>
                <div className="mt-2 font-headline text-2xl font-bold text-on-surface">{builtinCount}</div>
              </div>
              <div className="rounded-panel border border-outline-variant/60 bg-surface-container-low px-4 py-3">
                <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">CACHED</div>
                <div className="mt-2 font-headline text-2xl font-bold text-secondary">{cachedCount}</div>
              </div>
              <div className="rounded-panel border border-outline-variant/60 bg-surface-container-low px-4 py-3">
                <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">CUSTOM</div>
                <div className="mt-2 font-headline text-2xl font-bold text-primary">{customCount}</div>
              </div>
              <div className="rounded-panel border border-outline-variant/60 bg-surface-container-low px-4 py-3">
                <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">LORAS</div>
                <div className="mt-2 font-headline text-2xl font-bold text-primary">{loraCount}</div>
              </div>
            </div>
          </Panel>

          {notice ? (
            <Panel title="MODEL CACHE">
              <div className="text-sm text-secondary">{notice}</div>
            </Panel>
          ) : null}

          {error ? (
            <Panel title="DISCOVERY ERROR">
              <div className="text-sm text-on-error-container">{error}</div>
            </Panel>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-2">
            {visibleModels.map((model) => (
              <ModelCard
                key={model.id}
                model={model}
                onWarmCache={onWarmCache}
                warming={warmingId === model.id}
              />
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <Panel title="DISCOVERY RULES" neonBorder="secondary" className="space-y-4">
            <div className="text-sm text-on-surface-variant">
              Built-ins come from the repo’s model families, not from scanning `src/mflux/models`. Cache state is derived from Hugging Face snapshot presence and MFLUX cache conventions.
            </div>
            <div className="text-sm text-on-surface-variant">
              `CUSTOM` is only for user-provided local paths. `LORA` reflects the actual LoRA cache or configured LoRA directory.
            </div>
            {data ? (
              <div className="space-y-3 border-t border-outline-variant/40 pt-4 text-sm text-on-surface-variant">
                <div>
                  <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">HF HUB CACHE</div>
                  <div className="mt-1 break-all">{data.cacheRoots.hfHub}</div>
                </div>
                <div>
                  <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">MFLUX CACHE</div>
                  <div className="mt-1 break-all">{data.cacheRoots.mflux}</div>
                </div>
                <div>
                  <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">LORA CACHE</div>
                  <div className="mt-1 break-all">{data.cacheRoots.loras}</div>
                </div>
                <div>
                  <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">CUSTOM MODEL ROOT</div>
                  <div className="mt-1 break-all">{data.cacheRoots.customModels}</div>
                </div>
              </div>
            ) : null}
          </Panel>
        </div>
      </div>
    </div>
  );
}
