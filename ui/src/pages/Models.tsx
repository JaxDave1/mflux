import { useEffect, useMemo, useState } from "react";
import { ConfirmModal, GenerateButton, PageHeader, Panel, QuantizeField, SelectField, ToggleChip } from "../components";
import {
  buildCheckpointOptions,
  checkpointCompatId,
  downloadedModels,
  loraSummaryToModelSummary,
  resolveCheckpointModel,
  resolveDefaultCheckpoint
} from "../lib/checkpointOptions";
import { offlineModelsResponse } from "../lib/fallbacks";
import { api } from "../lib/api";
import { formatModelLabel } from "../lib/labels";
import { quantizeApiValue, type QuantizeSelection } from "../lib/quantize";
import type { Job, LoraSummary, ModelSummary, ModelsResponse, SecretStatus } from "../lib/types";
import { useConfigStore } from "../stores/useConfigStore";
import { useJobStore } from "../stores/useJobStore";

type ModelFilter = "BUILTIN" | "DOWNLOADED" | "CUSTOM" | "LORA";
type CivitaiDestination = "lora" | "custom";

function ModelCard({
  model,
  downloadJob,
  exportJob,
  hfTokenSet,
  onCopyTrigger,
  onDownload,
  onExport,
  onDeleteCache,
  deletingCache
}: {
  model: ModelSummary;
  downloadJob?: Job;
  exportJob?: Job;
  hfTokenSet: boolean;
  onCopyTrigger: (word: string) => void;
  onDownload: (id: string) => void;
  onExport: (id: string) => void;
  onDeleteCache: (id: string) => void;
  deletingCache: boolean;
}) {
  const cached = Boolean(model.metadata.cached);
  const installed = Boolean(model.metadata.installed);
  const exportable = Boolean(model.metadata.exportable);
  const downloading = downloadJob?.state === "queued" || downloadJob?.state === "running";
  const exporting = exportJob?.state === "queued" || exportJob?.state === "running";
  const downloadDisabled = !hfTokenSet || downloading || exporting;
  const tokenMessage = "HF token required. Set in Config -> API Keys.";

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
          {model.type === "lora" && model.metadata.loraCompat ? (
            <div
              className={`rounded-full border px-3 py-1 font-label text-[10px] tracking-[0.18em] ${
                model.metadata.loraCompat === "compatible"
                  ? "border-primary/40 text-primary"
                  : model.metadata.loraCompat === "unknown"
                    ? "border-tertiary/40 text-tertiary"
                    : "border-error/40 text-error"
              }`}
            >
              {model.metadata.loraCompat === "compatible"
                ? "COMPATIBLE"
                : model.metadata.loraCompat === "unknown"
                  ? "UNKNOWN"
                  : "INCOMPATIBLE"}
            </div>
          ) : null}
          {model.source === "builtin" ? (
            <div
              className={`rounded-full border px-3 py-1 font-label text-[10px] tracking-[0.18em] ${
                cached
                  ? "border-primary/40 text-primary"
                  : downloading || exporting
                    ? "border-secondary/40 text-secondary"
                  : "border-outline-variant/60 text-on-surface-variant"
              }`}
            >
              {cached ? "CACHED" : downloading ? "DOWNLOADING" : exporting ? "EXPORTING" : "NOT CACHED"}
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
        <div className="space-y-2">
          <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">TRIGGER WORDS</div>
          <div className="flex flex-wrap gap-2">
          {model.metadata.triggerWords.map((word) => (
            <button
              type="button"
              key={word}
              onClick={() => onCopyTrigger(word)}
              className="rounded-full border border-secondary/35 bg-secondary/10 px-2 py-1 font-label text-[10px] tracking-[0.18em] text-secondary transition hover:border-secondary hover:bg-secondary/20"
            >
              {word}
            </button>
          ))}
          </div>
        </div>
      )}
      {model.type === "lora" && !model.metadata.triggerWords?.length ? (
        <div className="text-sm text-on-surface-variant">trigger words: not detected</div>
      ) : null}
      {downloading ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span>{downloadJob?.progress.source === "step_parser" ? "Download progress" : "Download running"}</span>
            <span>{downloadJob?.progress.percent ?? 0}%</span>
          </div>
          <div className="bar-track h-1.5">
            <div className="bar-fill h-full" style={{ width: `${Math.max(0, Math.min(100, downloadJob?.progress.percent ?? 0))}%` }} />
          </div>
        </div>
      ) : null}
      {exporting ? (
        <div className="text-xs text-on-surface-variant">
          Quantized export running. Progress updates in the job panel; this can take several minutes.
        </div>
      ) : null}
      {model.source === "builtin" && !cached && model.metadata.downloadable ? (
        <div title={hfTokenSet ? undefined : tokenMessage}>
          <GenerateButton
            onClick={() => onDownload(model.id)}
            disabled={downloadDisabled}
            loading={downloading}
            label="DOWNLOAD"
            variant="outline"
          />
          {!hfTokenSet ? <div className="mt-2 text-xs text-on-surface-variant">{tokenMessage}</div> : null}
        </div>
      ) : null}
      {model.source === "builtin" && cached && exportable ? (
        <GenerateButton
          onClick={() => onExport(model.id)}
          disabled={exporting || downloading}
          loading={exporting}
          label="EXPORT QUANTIZED"
          variant="outline"
        />
      ) : null}
      {model.source === "builtin" && cached ? (
        <GenerateButton
          onClick={() => onDeleteCache(model.id)}
          disabled={deletingCache || downloading || exporting}
          loading={deletingCache}
          label="DELETE FROM CACHE"
          variant="ghost"
        />
      ) : null}
    </Panel>
  );
}

export function Models() {
  const [data, setData] = useState<ModelsResponse | null>(null);
  const [filter, setFilter] = useState<ModelFilter>("BUILTIN");
  const [selectedCheckpoint, setSelectedCheckpoint] = useState("");
  const [compatibleLoras, setCompatibleLoras] = useState<LoraSummary[]>([]);
  const [lorasLoading, setLorasLoading] = useState(false);
  const [lorasError, setLorasError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tokens, setTokens] = useState<SecretStatus[]>([]);
  const [seenCompletedDownloads, setSeenCompletedDownloads] = useState<Set<string>>(new Set());
  const [usingFallbackCatalog, setUsingFallbackCatalog] = useState(false);
  const [pendingCacheDeleteId, setPendingCacheDeleteId] = useState<string | null>(null);
  const [deletingCacheId, setDeletingCacheId] = useState<string | null>(null);
  const [civitaiInput, setCivitaiInput] = useState("");
  const [civitaiDestination, setCivitaiDestination] = useState<CivitaiDestination>("lora");
  const [civitaiLoading, setCivitaiLoading] = useState(false);
  const [exportQuantize, setExportQuantize] = useState<QuantizeSelection>("8");
  const jobs = useJobStore((state) => state.jobs);
  const submitJob = useJobStore((state) => state.submitJob);
  const connectJob = useJobStore((state) => state.connectJob);
  const { config, loadConfig } = useConfigStore();

  const load = () =>
    api.models()
      .then((response) => {
        setData(response);
        setError(null);
        setUsingFallbackCatalog(false);
      })
      .catch((err) => {
        setData(offlineModelsResponse);
        setError(err instanceof Error ? err.message : "Failed to load models");
        setUsingFallbackCatalog(true);
      });

  useEffect(() => {
    void load();
    void loadConfig();
    void api.secrets().then((response) => setTokens(response.tokens)).catch(() => setTokens([]));
  }, [loadConfig]);

  useEffect(() => {
    setCivitaiDestination(filter === "CUSTOM" ? "custom" : "lora");
  }, [filter]);

  useEffect(() => {
    if (config?.generation.defaultQuantize) {
      setExportQuantize("8");
    }
  }, [config?.generation.defaultQuantize]);

  const checkpointOptions = useMemo(() => buildCheckpointOptions(data), [data]);

  useEffect(() => {
    if (!data || !checkpointOptions.length) {
      return;
    }
    const nextCheckpoint = resolveDefaultCheckpoint(data, checkpointOptions, config?.generation.defaultModel);
    setSelectedCheckpoint((current) =>
      current && checkpointOptions.some((option) => option.value === current) ? current : nextCheckpoint
    );
  }, [checkpointOptions, config?.generation.defaultModel, data]);

  const selectedCheckpointModel = useMemo(
    () => resolveCheckpointModel(data, selectedCheckpoint),
    [data, selectedCheckpoint]
  );

  const selectedCheckpointCompatId = useMemo(() => {
    if (!selectedCheckpointModel) {
      return selectedCheckpoint;
    }
    return checkpointCompatId(selectedCheckpointModel);
  }, [selectedCheckpoint, selectedCheckpointModel]);

  useEffect(() => {
    if (filter !== "LORA" || !selectedCheckpointCompatId) {
      return;
    }
    let alive = true;
    setLorasLoading(true);
    setCompatibleLoras([]);
    void api
      .loras(selectedCheckpointCompatId)
      .then((response) => {
        if (alive) {
          setCompatibleLoras(response.loras);
          setLorasError(null);
          setLorasLoading(false);
        }
      })
      .catch((err) => {
        if (alive) {
          setCompatibleLoras([]);
          setLorasError(err instanceof Error ? err.message : "Failed to load compatible LoRAs");
          setLorasLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [filter, selectedCheckpointCompatId]);

  useEffect(() => {
    jobs.forEach((job) => {
      if (
        (job.module === "model_download" || job.module === "civitai_download" || job.module === "model_export") &&
        ["queued", "running"].includes(job.state)
      ) {
        connectJob(job.id);
      }
    });
  }, [connectJob, jobs]);

  useEffect(() => {
    const completed = jobs.filter(
      (job) =>
        (job.module === "model_download" || job.module === "civitai_download" || job.module === "model_export") &&
        ["succeeded", "failed", "cancelled", "timed_out"].includes(job.state)
    );
    const unseen = completed.filter((job) => !seenCompletedDownloads.has(job.id));
    if (!unseen.length) {
      return;
    }
    setSeenCompletedDownloads((current) => new Set([...current, ...unseen.map((job) => job.id)]));
    void load();
  }, [jobs, seenCompletedDownloads]);

  const visibleModels = useMemo(() => {
    if (!data) {
      return [];
    }
    if (filter === "BUILTIN") {
      return data.builtin;
    }
    if (filter === "DOWNLOADED") {
      return downloadedModels(data);
    }
    if (filter === "CUSTOM") {
      return data.custom;
    }
    return compatibleLoras.map(loraSummaryToModelSummary);
  }, [compatibleLoras, data, filter]);

  const hfTokenSet = tokens.some((token) => token.key === "hf" && token.is_set);
  const civitaiTokenSet = tokens.some((token) => token.key === "civitai" && token.is_set);

  const downloadJobsByModel = useMemo(() => {
    const map = new Map<string, Job>();
    jobs
      .filter((job) => job.module === "model_download" && !["succeeded", "failed", "cancelled", "timed_out"].includes(job.state))
      .forEach((job) => {
        const modelName = typeof job.params.model_name === "string" ? job.params.model_name : "";
        if (modelName) {
          map.set(modelName, job);
        }
      });
    return map;
  }, [jobs]);

  const exportJobsByModel = useMemo(() => {
    const map = new Map<string, Job>();
    jobs
      .filter((job) => job.module === "model_export" && !["succeeded", "failed", "cancelled", "timed_out"].includes(job.state))
      .forEach((job) => {
        const modelName = typeof job.params.model_name === "string" ? job.params.model_name : "";
        if (modelName) {
          map.set(modelName, job);
        }
      });
    return map;
  }, [jobs]);

  const onDeleteCache = (id: string) => {
    setPendingCacheDeleteId(id);
  };

  const confirmDeleteCache = async () => {
    if (!pendingCacheDeleteId) {
      return;
    }
    setDeletingCacheId(pendingCacheDeleteId);
    setError(null);
    setNotice(null);
    try {
      const response = await api.deleteModelCache(pendingCacheDeleteId);
      setNotice(
        response.deleted_paths.length
          ? `Removed cache for ${pendingCacheDeleteId}.`
          : `No cache directories were present for ${pendingCacheDeleteId}.`
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete model cache.");
    } finally {
      setDeletingCacheId(null);
      setPendingCacheDeleteId(null);
    }
  };

  const onCivitaiDownload = async () => {
    const trimmed = civitaiInput.trim();
    if (!trimmed) {
      return;
    }
    setCivitaiLoading(true);
    setError(null);
    setNotice(null);
    const params =
      /^\d+$/.test(trimmed)
        ? { modelVersionId: Number(trimmed), destination: civitaiDestination }
        : { downloadUrl: trimmed, destination: civitaiDestination };
    try {
      const job = await submitJob({ module: "civitai_download", params });
      connectJob(job.id);
      setNotice(`CivitAI download started. Progress is available in the job panel.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start CivitAI download.");
    } finally {
      setCivitaiLoading(false);
    }
  };

  const onExport = async (id: string) => {
    const quantize = quantizeApiValue(exportQuantize);
    if (quantize === null) {
      setError("Quantized export requires 8-bit quantization. Set QUANTIZE to 8.");
      return;
    }
    setError(null);
    setNotice(null);
    try {
      const job = await submitJob({ module: "model_export", params: { model_name: id, quantize } });
      connectJob(job.id);
      setNotice(`Export started for ${id} at q${quantize}. Output lands in the configured custom model directory.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start model export.");
    }
  };

  const onDownload = async (id: string) => {
    setError(null);
    setNotice(null);
    try {
      const job = await submitJob({ module: "model_download", params: { model_name: id } });
      connectJob(job.id);
      setNotice(`Download started for ${id}. Progress is available on the card and in the job panel.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start model download.");
    }
  };

  const onCopyTrigger = async (word: string) => {
    try {
      await navigator.clipboard.writeText(word);
      setNotice(`Copied: ${word}`);
    } catch {
      setError(`Could not copy trigger word: ${word}`);
    }
  };

  const builtinCount = data?.builtin.length ?? 0;
  const cachedCount = data ? downloadedModels(data).length : 0;
  const customCount = data?.custom.length ?? 0;
  const totalLoraCount = data?.loras.length ?? 0;
  const compatibleLoraCount = filter === "LORA" ? compatibleLoras.length : totalLoraCount;
  const selectedCheckpointLabel = formatModelLabel(selectedCheckpointCompatId || selectedCheckpoint);

  return (
    <div className="content-shell module-reskin-page module-reskin-page--generation">
      <PageHeader
        title="MODELS"
        description="Built-in catalog, downloaded local assets across all categories, custom paths, and LoRA library contents."
        version={cachedCount ? `${cachedCount} DOWNLOADED` : undefined}
        className="module-reskin-page-header"
      />
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="module-form-column space-y-6">
          <Panel title="MODEL FILTERS" neonBorder="primary" scanline className="space-y-4">
            <ToggleChip
              options={["BUILTIN", "DOWNLOADED", "CUSTOM", "LORA"]}
              value={filter}
              onChange={(value) => setFilter(value as ModelFilter)}
            />
            <SelectField
              label="CHECKPOINT"
              value={selectedCheckpoint}
              onChange={setSelectedCheckpoint}
              options={
                checkpointOptions.length
                  ? checkpointOptions
                  : [{ value: "", label: "No downloaded checkpoints available" }]
              }
            />
            {filter === "LORA" ? (
              <div className="text-sm text-on-surface-variant">
                Showing LoRAs compatible with {selectedCheckpointLabel}. Unknown-architecture LoRAs are included because compatibility cannot be verified.
              </div>
            ) : null}
            <div className="grid gap-3 md:grid-cols-4">
              <div className="mirror-stat-card px-4 py-3">
                <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">BUILT-IN</div>
                <div className="mt-2 font-headline text-2xl font-bold text-on-surface">{builtinCount}</div>
              </div>
              <div className="mirror-stat-card px-4 py-3">
                <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">DOWNLOADED</div>
                <div className="mt-2 font-headline text-2xl font-bold text-secondary">{cachedCount}</div>
                <div className="mt-1 text-xs text-on-surface-variant">built-in, custom, and LoRA</div>
              </div>
              <div className="mirror-stat-card px-4 py-3">
                <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">CUSTOM</div>
                <div className="mt-2 font-headline text-2xl font-bold text-primary">{customCount}</div>
              </div>
              <div className="mirror-stat-card px-4 py-3">
                <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">
                  {filter === "LORA" ? "COMPATIBLE LORAS" : "LORAS"}
                </div>
                <div className="mt-2 font-headline text-2xl font-bold text-primary">{compatibleLoraCount}</div>
                {filter === "LORA" ? (
                  <div className="mt-1 text-xs text-on-surface-variant">{totalLoraCount} total in library</div>
                ) : null}
              </div>
            </div>
          </Panel>

          {notice ? (
            <Panel title="MODEL CACHE">
              <div className="text-sm text-secondary">{notice}</div>
            </Panel>
          ) : null}

          {error ? (
            <Panel title={usingFallbackCatalog ? "BACKEND STATUS" : "DISCOVERY ERROR"}>
              <div className={`text-sm ${usingFallbackCatalog ? "text-on-surface-variant" : "text-on-error-container"}`}>
                {usingFallbackCatalog ? `${error} Showing the static model catalog only.` : error}
              </div>
            </Panel>
          ) : null}

          {filter === "LORA" && lorasError ? (
            <Panel title="LORA DISCOVERY">
              <div className="text-sm text-on-error-container">{lorasError}</div>
            </Panel>
          ) : null}

          {filter === "LORA" && lorasLoading ? (
            <Panel title="LORA LIST">
              <div className="text-sm text-on-surface-variant">Loading LoRAs for {selectedCheckpointLabel}...</div>
            </Panel>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-2">
            {visibleModels.map((model) => (
              <ModelCard
                key={model.id}
                model={model}
                downloadJob={downloadJobsByModel.get(model.id)}
                exportJob={exportJobsByModel.get(model.id)}
                hfTokenSet={hfTokenSet}
                onCopyTrigger={(word) => void onCopyTrigger(word)}
                onDownload={(id) => void onDownload(id)}
                onExport={(id) => void onExport(id)}
                onDeleteCache={onDeleteCache}
                deletingCache={deletingCacheId === model.id}
              />
            ))}
          </div>
          {!visibleModels.length && !(filter === "LORA" && lorasLoading) ? (
            <Panel title="MODEL LIST">
              <div className="text-sm text-on-surface-variant">
                {filter === "LORA"
                  ? `No LoRAs compatible with ${selectedCheckpointLabel} were found in the configured LoRA directory.`
                  : filter === "DOWNLOADED"
                    ? "No downloaded models were found across built-in, custom, or LoRA directories."
                    : "No models matched the current filter."}
              </div>
            </Panel>
          ) : null}
        </div>

        <div className="module-control-column space-y-6 xl:sticky xl:top-24 xl:self-start">
          {filter === "BUILTIN" || filter === "DOWNLOADED" ? (
            <Panel title="QUANTIZED EXPORT" neonBorder="secondary" className="space-y-4">
              <div className="text-sm text-on-surface-variant">
                Save a cached built-in model to the custom model directory using `mflux-save`. Only cached checkpoint
                families support export.
              </div>
              <QuantizeField value={exportQuantize} onChange={setExportQuantize} />
              {data ? (
                <div className="text-xs text-on-surface-variant">
                  Output path pattern:{" "}
                  <span className="break-all text-on-surface">
                    {data.cacheRoots.customModels}/&lt;model&gt;_q{exportQuantize === "OFF" ? "?" : exportQuantize}
                  </span>
                </div>
              ) : null}
            </Panel>
          ) : null}
          {filter === "CUSTOM" || filter === "LORA" ? (
            <Panel title="CIVITAI DOWNLOAD" neonBorder="primary" className="space-y-4">
              <div className="text-sm text-on-surface-variant">
                Paste a CivitAI model version ID or download URL. Files land in the configured{" "}
                {civitaiDestination === "lora" ? "LoRA" : "custom model"} directory.
              </div>
              <div>
                <div className="mb-2 font-label text-[10px] tracking-[0.18em] text-on-surface-variant">
                  VERSION ID OR URL
                </div>
                <input
                  value={civitaiInput}
                  onChange={(event) => setCivitaiInput(event.target.value)}
                  placeholder="123456 or https://civitai.com/api/download/models/123456"
                  className="w-full rounded-panel border border-outline-variant/60 bg-surface-container px-3 py-3 text-sm text-on-surface outline-none transition focus:border-primary/60"
                />
              </div>
              <div>
                <div className="mb-2 font-label text-[10px] tracking-[0.18em] text-on-surface-variant">DESTINATION</div>
                <ToggleChip
                  options={["LORA", "CUSTOM"]}
                  value={civitaiDestination === "lora" ? "LORA" : "CUSTOM"}
                  onChange={(value) => setCivitaiDestination(value === "LORA" ? "lora" : "custom")}
                />
              </div>
              <div title={civitaiTokenSet ? undefined : "CivitAI token required. Set in Config -> API Keys."}>
                <GenerateButton
                  onClick={() => void onCivitaiDownload()}
                  disabled={!civitaiTokenSet || !civitaiInput.trim() || civitaiLoading}
                  loading={civitaiLoading}
                  label="DOWNLOAD FROM CIVITAI"
                  className="w-full"
                />
                {!civitaiTokenSet ? (
                  <div className="mt-2 text-xs text-on-surface-variant">
                    CivitAI token required. Set in Config -&gt; API Keys.
                  </div>
                ) : null}
              </div>
            </Panel>
          ) : null}
          <Panel title="DISCOVERY RULES" neonBorder="secondary" variant="composite" className="space-y-4">
            <div className="text-sm text-on-surface-variant">
              Built-ins come from the repo’s model families, not from scanning `src/mflux/models`. Cache state is derived from Hugging Face snapshot presence and MFLUX cache conventions.
            </div>
            <div className="text-sm text-on-surface-variant">
              `DOWNLOADED` shows everything local: cached built-ins, custom checkpoints, and LoRA files. `CUSTOM` and `LORA` narrow that view to one source.
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
      {pendingCacheDeleteId ? (
        <ConfirmModal
          title="Delete model cache?"
          confirmLabel="DELETE CACHE"
          busy={Boolean(deletingCacheId)}
          onCancel={() => {
            if (!deletingCacheId) {
              setPendingCacheDeleteId(null);
            }
          }}
          onConfirm={() => void confirmDeleteCache()}
        >
          Remove cached files for <span className="text-on-surface">{pendingCacheDeleteId}</span> from the Hugging Face
          hub or MFLUX cache roots. The built-in catalog entry remains; you can download again later.
        </ConfirmModal>
      ) : null}
    </div>
  );
}
