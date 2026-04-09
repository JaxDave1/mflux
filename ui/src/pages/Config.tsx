import { useEffect, useMemo, useState } from "react";
import { GenerateButton, PageHeader, Panel, ToggleChip } from "../components";
import type { AppConfig } from "../lib/types";
import { useConfigStore } from "../stores/useConfigStore";

function cloneConfig(config: AppConfig): AppConfig {
  return JSON.parse(JSON.stringify(config)) as AppConfig;
}

function ConfigInput({
  label,
  value,
  onChange,
  type = "text"
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: "text" | "number";
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">{label}</span>
      <input
        value={value}
        type={type}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-panel border border-outline-variant/60 bg-surface-container px-3 py-3 text-sm outline-none transition focus:border-secondary/60"
      />
    </label>
  );
}

export function Config() {
  const { config, loadConfig, saveConfig } = useConfigStore();
  const [draft, setDraft] = useState<AppConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (config) {
      setDraft(cloneConfig(config));
    }
  }, [config]);

  const dirty = useMemo(() => {
    if (!config || !draft) {
      return false;
    }
    return JSON.stringify(config) !== JSON.stringify(draft);
  }, [config, draft]);

  const setPathField = (field: keyof AppConfig["paths"], value: string) => {
    setDraft((current) => (current ? { ...current, paths: { ...current.paths, [field]: value } } : current));
  };

  const setGenerationField = <K extends keyof AppConfig["generation"]>(field: K, value: AppConfig["generation"][K]) => {
    setDraft((current) =>
      current ? { ...current, generation: { ...current.generation, [field]: value } } : current
    );
  };

  const setSystemField = <K extends keyof AppConfig["system"]>(field: K, value: AppConfig["system"][K]) => {
    setDraft((current) => (current ? { ...current, system: { ...current.system, [field]: value } } : current));
  };

  const setBackendField = <K extends keyof AppConfig["backend"]>(field: K, value: AppConfig["backend"][K]) => {
    setDraft((current) => (current ? { ...current, backend: { ...current.backend, [field]: value } } : current));
  };

  const onSave = async () => {
    if (!draft) {
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await saveConfig(draft);
      setNotice("Configuration saved. New paths and defaults now drive model discovery, gallery indexing, and generation requests.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save configuration.");
    } finally {
      setSaving(false);
    }
  };

  const onReload = async () => {
    setError(null);
    setNotice(null);
    await loadConfig();
  };

  const onReset = () => {
    if (config) {
      setDraft(cloneConfig(config));
      setError(null);
      setNotice("Draft reset to the last saved backend config.");
    }
  };

  if (!draft) {
    return (
      <div className="content-shell">
        <PageHeader title="SYSTEM CONFIG" description="Path management, generation defaults, and backend settings." />
        <Panel title="CONFIG STORE">Loading config...</Panel>
      </div>
    );
  }

  return (
    <div className="content-shell">
      <PageHeader title="SYSTEM CONFIG" description="Persist local paths, default generation behavior, and runtime launch settings." />
      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.9fr]">
        <div className="space-y-6">
          <Panel title="PATHS" neonBorder="primary" className="grid gap-4 md:grid-cols-2">
            <ConfigInput label="HF HOME" value={draft.paths.hfHome} onChange={(value) => setPathField("hfHome", value)} />
            <ConfigInput label="MODEL DIR" value={draft.paths.modelDir} onChange={(value) => setPathField("modelDir", value)} />
            <ConfigInput label="OUTPUT DIR" value={draft.paths.outputDir} onChange={(value) => setPathField("outputDir", value)} />
            <ConfigInput label="LORA DIR" value={draft.paths.loraDir} onChange={(value) => setPathField("loraDir", value)} />
          </Panel>

          <Panel title="GENERATION DEFAULTS" className="grid gap-4 md:grid-cols-2">
            <ConfigInput
              label="DEFAULT MODEL"
              value={draft.generation.defaultModel}
              onChange={(value) => setGenerationField("defaultModel", value)}
            />
            <div>
              <div className="mb-2 font-label text-[10px] tracking-[0.18em] text-on-surface-variant">OUTPUT FORMAT</div>
              <ToggleChip
                options={["png", "jpg", "jpeg", "webp"]}
                value={draft.generation.outputFormat}
                onChange={(value) =>
                  setGenerationField("outputFormat", value as AppConfig["generation"]["outputFormat"])
                }
              />
            </div>
            <ConfigInput
              label="DEFAULT QUANTIZE"
              type="number"
              value={draft.generation.defaultQuantize}
              onChange={(value) => setGenerationField("defaultQuantize", Number(value))}
            />
            <ConfigInput
              label="DEFAULT STEPS"
              type="number"
              value={draft.generation.defaultSteps}
              onChange={(value) => setGenerationField("defaultSteps", Number(value))}
            />
            <ConfigInput
              label="QUALITY"
              type="number"
              value={draft.generation.quality}
              onChange={(value) => setGenerationField("quality", Number(value))}
            />
            <div>
              <div className="mb-2 font-label text-[10px] tracking-[0.18em] text-on-surface-variant">AUTO SEEDS</div>
              <ToggleChip
                options={["OFF", "ON"]}
                value={draft.generation.autoSeeds ? "ON" : "OFF"}
                onChange={(value) => setGenerationField("autoSeeds", value === "ON")}
              />
            </div>
          </Panel>

          <Panel title="SYSTEM + BACKEND" className="grid gap-4 md:grid-cols-2">
            <ConfigInput
              label="CACHE LIMIT (GB)"
              type="number"
              value={draft.system.cacheLimit}
              onChange={(value) => setSystemField("cacheLimit", Number(value))}
            />
            <div>
              <div className="mb-2 font-label text-[10px] tracking-[0.18em] text-on-surface-variant">LOW RAM MODE</div>
              <ToggleChip
                options={["OFF", "ON"]}
                value={draft.system.lowRamMode ? "ON" : "OFF"}
                onChange={(value) => setSystemField("lowRamMode", value === "ON")}
              />
            </div>
            <div>
              <div className="mb-2 font-label text-[10px] tracking-[0.18em] text-on-surface-variant">LIVE PREVIEW</div>
              <ToggleChip
                options={["OFF", "ON"]}
                value={draft.system.livePreview ? "ON" : "OFF"}
                onChange={(value) => setSystemField("livePreview", value === "ON")}
              />
            </div>
            <ConfigInput
              label="SERVER URL"
              value={draft.backend.serverUrl}
              onChange={(value) => setBackendField("serverUrl", value)}
            />
            <ConfigInput
              label="PORT"
              type="number"
              value={draft.backend.port}
              onChange={(value) => setBackendField("port", Number(value))}
            />
            <div>
              <div className="mb-2 font-label text-[10px] tracking-[0.18em] text-on-surface-variant">AUTO OPEN BROWSER</div>
              <ToggleChip
                options={["OFF", "ON"]}
                value={draft.backend.autoOpenBrowser ? "ON" : "OFF"}
                onChange={(value) => setBackendField("autoOpenBrowser", value === "ON")}
              />
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="CONFIG CONTROL" neonBorder="secondary" className="space-y-4">
            <div className="text-sm text-on-surface-variant">
              Save only when the full draft is coherent. These values drive output indexing, detected model paths, and generation defaults across every module.
            </div>
            <div className="grid gap-3">
              <GenerateButton onClick={onSave} loading={saving} disabled={!dirty} label="SAVE CONFIG" />
              <GenerateButton onClick={() => void onReload()} variant="outline" label="RELOAD FROM BACKEND" />
              <GenerateButton onClick={onReset} variant="ghost" disabled={!dirty} label="RESET DRAFT" />
            </div>
            <div className="rounded-panel border border-outline-variant/60 bg-surface-container-low px-3 py-3 text-sm text-on-surface-variant">
              {dirty ? "Unsaved changes detected." : "Draft matches the saved backend config."}
            </div>
            {notice ? (
              <div className="rounded-panel border border-secondary/35 bg-secondary/10 px-3 py-3 text-sm text-secondary">
                {notice}
              </div>
            ) : null}
            {error ? (
              <div className="rounded-panel border border-error-container/60 bg-error-container px-3 py-3 text-sm text-on-error-container">
                {error}
              </div>
            ) : null}
          </Panel>

          <Panel title="DEPENDENCIES" className="space-y-3">
            <div className="text-sm text-on-surface-variant">
              `Models` reads from `MODEL DIR` and `LORA DIR`. `Gallery` reads from `OUTPUT DIR`. The default model and quantization also drive the dashboard status cards and new generation forms.
            </div>
            <div className="font-label text-[10px] tracking-[0.18em] text-primary">
              SAVE CONFIG BEFORE VALIDATING MODEL DISCOVERY OR GALLERY INDEXING
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
