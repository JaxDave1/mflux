import { useEffect, useMemo, useState } from "react";
import { GenerateButton, PageHeader, Panel, SelectField, ToggleChip } from "../components";
import { useModuleModelOptions } from "../hooks/useModuleModelOptions";
import { api } from "../lib/api";
import type { AppConfig, SecretStatus } from "../lib/types";
import { useConfigStore } from "../stores/useConfigStore";

function cloneConfig(config: AppConfig): AppConfig {
  const cloned = JSON.parse(JSON.stringify(config)) as AppConfig;
  cloned.generation.saveMetadataSidecar = cloned.generation.saveMetadataSidecar ?? true;
  return cloned;
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

type SecretKey = "hf" | "civitai";

const secretLabels: Record<SecretKey, string> = {
  hf: "HF TOKEN",
  civitai: "CIVITAI TOKEN"
};

const secretDescriptions: Record<SecretKey, string> = {
  hf: "Hugging Face",
  civitai: "CivitAI"
};

function SecretRow({
  token,
  onSet,
  onClear,
  busy
}: {
  token: SecretStatus;
  onSet: (key: SecretKey) => void;
  onClear: (key: SecretKey) => void;
  busy: boolean;
}) {
  return (
    <div className="rounded-panel border border-outline-variant/60 bg-surface-container-low p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">{secretLabels[token.key]}</div>
          <div className="mt-1 text-xs text-on-surface-variant">{secretDescriptions[token.key]}</div>
        </div>
        <div className={`status-pill ${token.is_set ? "" : "status-pill--warn"}`}>
          {token.is_set ? "SET" : "UNSET"}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <input
          readOnly
          type="password"
          value={token.is_set ? "••••••••" : ""}
          placeholder="No token stored"
          className="rounded-panel border border-outline-variant/60 bg-surface-container px-3 py-3 text-sm outline-none"
        />
        <GenerateButton onClick={() => onSet(token.key)} variant="outline" label="SET TOKEN" disabled={busy} />
        <GenerateButton
          onClick={() => onClear(token.key)}
          variant="ghost"
          label="CLEAR"
          disabled={busy || !token.is_set}
        />
      </div>
    </div>
  );
}

export function Config() {
  const { config, loadConfig, saveConfig } = useConfigStore();
  const [draft, setDraft] = useState<AppConfig | null>(null);
  const [tokens, setTokens] = useState<SecretStatus[]>([
    { key: "hf", is_set: false },
    { key: "civitai", is_set: false }
  ]);
  const [tokenModal, setTokenModal] = useState<SecretKey | null>(null);
  const [tokenValue, setTokenValue] = useState("");
  const [tokenBusy, setTokenBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadConfig();
    void loadSecrets();
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

  const { options: defaultModelOptions } = useModuleModelOptions("config", draft?.generation.defaultModel);

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

  const loadSecrets = async () => {
    try {
      const response = await api.secrets();
      setTokens(response.tokens);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load token status.");
    }
  };

  const openTokenModal = (key: SecretKey) => {
    setTokenModal(key);
    setTokenValue("");
    setError(null);
    setNotice(null);
  };

  const closeTokenModal = () => {
    setTokenModal(null);
    setTokenValue("");
  };

  const saveToken = async () => {
    if (!tokenModal || !tokenValue.trim()) {
      return;
    }
    setTokenBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api.setSecret(tokenModal, tokenValue);
      await loadSecrets();
      setNotice(`${secretLabels[tokenModal]} saved.`);
      closeTokenModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save token.");
    } finally {
      setTokenBusy(false);
    }
  };

  const clearToken = async (key: SecretKey) => {
    setTokenBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api.clearSecret(key);
      await loadSecrets();
      setNotice(`${secretLabels[key]} cleared.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear token.");
    } finally {
      setTokenBusy(false);
    }
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
      setNotice("Configuration saved. Updated paths and defaults are now active across the interface.");
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
      setNotice("Draft reset to the last saved configuration.");
    }
  };

  if (!draft) {
    return (
      <div className="content-shell module-reskin-page">
        <PageHeader
          title="SYSTEM CONFIG"
          description="Path management, generation defaults, and backend settings."
          className="module-reskin-page-header"
        />
        <Panel title="CONFIG STORE">Loading config...</Panel>
      </div>
    );
  }

  return (
    <div className="content-shell module-reskin-page module-reskin-page--generation">
      <PageHeader
        title="SYSTEM CONFIG"
        description="Persist local paths, default generation behavior, and runtime launch settings."
        version={dirty ? "UNSAVED" : "SYNCED"}
        className="module-reskin-page-header"
      />
      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.9fr]">
        <div className="module-form-column space-y-6">
          <Panel title="PATHS" neonBorder="primary" scanline className="grid gap-4 md:grid-cols-2">
            <ConfigInput label="HF HOME" value={draft.paths.hfHome} onChange={(value) => setPathField("hfHome", value)} />
            <ConfigInput label="MODEL DIR" value={draft.paths.modelDir} onChange={(value) => setPathField("modelDir", value)} />
            <ConfigInput label="OUTPUT DIR" value={draft.paths.outputDir} onChange={(value) => setPathField("outputDir", value)} />
            <ConfigInput label="LORA DIR" value={draft.paths.loraDir} onChange={(value) => setPathField("loraDir", value)} />
          </Panel>

          <Panel title="API KEYS & TOKENS" neonBorder="secondary" className="space-y-4">
            {tokens.map((token) => (
              <SecretRow
                key={token.key}
                token={token}
                onSet={openTokenModal}
                onClear={(key) => void clearToken(key)}
                busy={tokenBusy}
              />
            ))}
          </Panel>

          <Panel title="GENERATION DEFAULTS" className="grid gap-4 md:grid-cols-2">
            <SelectField
              label="DEFAULT MODEL"
              value={draft.generation.defaultModel}
              onChange={(value) => setGenerationField("defaultModel", value)}
              options={defaultModelOptions}
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
            <div>
              <div className="mb-2 font-label text-[10px] tracking-[0.18em] text-on-surface-variant">
                SAVE METADATA SIDECAR
              </div>
              <ToggleChip
                options={["OFF", "ON"]}
                value={draft.generation.saveMetadataSidecar ? "ON" : "OFF"}
                onChange={(value) => setGenerationField("saveMetadataSidecar", value === "ON")}
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

        <div className="module-control-column space-y-6 xl:sticky xl:top-24 xl:self-start">
          <Panel title="CONFIG CONTROL" neonBorder="secondary" className="space-y-4">
            <div className="font-body text-sm text-[var(--color-text-secondary)]">
              Save changes to update model discovery, gallery indexing, and default generation behavior across the interface.
            </div>
            <div className="grid gap-3">
              <GenerateButton onClick={onSave} loading={saving} disabled={!dirty} label="SAVE CONFIG" className="module-primary-action" />
              <GenerateButton onClick={() => void onReload()} variant="outline" label="RELOAD FROM BACKEND" />
              <GenerateButton onClick={onReset} variant="ghost" disabled={!dirty} label="RESET DRAFT" />
            </div>
            <div className="rounded-panel border border-outline-variant/60 bg-surface-container-low px-3 py-3 text-sm text-on-surface-variant">
              {dirty ? "Unsaved changes detected." : "Draft matches the saved configuration."}
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

          <Panel title="DEPENDENCIES" variant="composite" className="space-y-3">
            <div className="text-sm text-on-surface-variant">
              Models reads from MODEL DIR and LORA DIR. Gallery reads from OUTPUT DIR. Default model and quantization settings also drive dashboard status cards and new generation forms.
            </div>
            <div className="text-sm text-on-surface-variant">
              HF token required for gated FLUX models. CivitAI token required for CivitAI LoRA downloads.
            </div>
            <div className="font-label text-[10px] tracking-[0.18em] text-primary">
              SAVE CHANGES BEFORE REFRESHING MODELS OR REINDEXING GALLERY
            </div>
          </Panel>
        </div>
      </div>
      {tokenModal ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 px-4">
          <div className="mirror-panel w-full max-w-lg rounded-xl p-5">
            <div className="font-headline text-xl font-bold text-on-surface">SET {secretLabels[tokenModal]}</div>
            <div className="mt-2 text-sm text-on-surface-variant">
              The token is stored locally and never returned by the API after saving.
            </div>
            <input
              autoFocus
              type="password"
              value={tokenValue}
              onChange={(event) => setTokenValue(event.target.value)}
              className="mt-5 w-full rounded-panel border border-outline-variant/60 bg-surface-container px-3 py-3 text-sm outline-none transition focus:border-secondary/60"
            />
            <div className="mt-5 flex justify-end gap-3">
              <GenerateButton onClick={closeTokenModal} variant="ghost" label="CANCEL" disabled={tokenBusy} />
              <GenerateButton
                onClick={() => void saveToken()}
                label="SAVE"
                loading={tokenBusy}
                disabled={!tokenValue.trim()}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
