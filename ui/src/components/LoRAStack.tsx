import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import type { LoraSummary } from "../lib/types";
import { GenerateButton } from "./GenerateButton";
import { SliderField } from "./SliderField";
import { SurfaceLoadingState } from "./SurfaceLoadingState";

export interface LoraSelection {
  path: string;
  strength: number;
}

export type LoraCompat = "compatible" | "unknown" | "incompatible";

export interface LoraStackCompatibility {
  incompatibleCount: number;
}

function modelArchitecture(model: string) {
  const normalized = model.toLowerCase().replace(/_/g, "-");
  if (normalized.includes("z-image") || normalized.includes("zimage")) {
    return "z-image";
  }
  if (normalized.includes("qwen")) {
    return "qwen";
  }
  if (normalized.includes("fibo")) {
    return "fibo";
  }
  if (normalized.includes("flux2") || normalized.includes("flux.2") || normalized.includes("klein")) {
    return "flux2";
  }
  if (
    [
      "dev",
      "schnell",
      "dev-kontext",
      "dev-fill",
      "dev-redux",
      "dev-depth",
      "dev-controlnet-canny",
      "schnell-controlnet-canny",
      "dev-controlnet-upscaler",
      "dev-fill-catvton",
      "krea-dev"
    ].includes(normalized) ||
    normalized.includes("flux.1") ||
    normalized.includes("flux1")
  ) {
    return "flux";
  }
  return "unknown";
}

function compatFor(lora: LoraSummary | undefined, model: string, useApiCompat = false): LoraCompat {
  if (!lora) {
    return "incompatible";
  }
  if (useApiCompat) {
    return lora.compat;
  }
  const expected = modelArchitecture(model);
  if (lora.architecture === "unknown" || expected === "unknown") {
    return "unknown";
  }
  return lora.architecture === expected ? "compatible" : "incompatible";
}

function compatTooltip(compat: LoraCompat, architecture: string, model: string) {
  if (compat === "unknown") {
    return "Architecture not detected. Compatibility cannot be verified. Use at your own risk.";
  }
  if (compat === "incompatible") {
    return `This LoRA was trained for ${architecture}. Current model is ${model}. Remove or switch back.`;
  }
  return undefined;
}

export function LoRAStack({
  value,
  onChange,
  model,
  onCompatibilityChange,
  max = 6
}: {
  value: LoraSelection[];
  onChange: (value: LoraSelection[]) => void;
  model: string;
  onCompatibilityChange?: (state: LoraStackCompatibility) => void;
  max?: number;
}) {
  const [loras, setLoras] = useState<LoraSummary[]>([]);
  const [allLoras, setAllLoras] = useState<LoraSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([api.loras(model), api.loras()])
      .then(([filteredResponse, allResponse]) => {
        if (alive) {
          setLoras(filteredResponse.loras);
          setAllLoras(allResponse.loras);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (alive) {
          setError(err instanceof Error ? err.message : "Failed to load LoRAs");
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [model]);

  const selected = useMemo(() => new Set(value.map((item) => item.path)), [value]);
  const available = loras.filter((lora) => !selected.has(lora.path));
  const selectedStates = useMemo(
    () =>
      value.map((item) => {
        const filteredLora = loras.find((lora) => lora.path === item.path);
        const selectedLora = filteredLora ?? allLoras.find((lora) => lora.path === item.path);
        return {
          ...item,
          lora: selectedLora,
          compat: compatFor(selectedLora, model, Boolean(filteredLora))
        };
      }),
    [allLoras, loras, model, value]
  );
  const incompatibleCount = loading ? 0 : selectedStates.filter((item) => item.compat === "incompatible").length;

  useEffect(() => {
    if (loading) {
      return;
    }
    onCompatibilityChange?.({ incompatibleCount });
  }, [incompatibleCount, loading, onCompatibilityChange]);

  const addLora = () => {
    const next = available[0];
    if (!next || value.length >= max) {
      return;
    }
    onChange([...value, { path: next.path, strength: 1.0 }]);
  };

  const updateLora = (index: number, patch: Partial<LoraSelection>) => {
    onChange(value.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  };

  const removeLora = (index: number) => {
    onChange(value.filter((_, itemIndex) => itemIndex !== index));
  };

  const labelForPath = (path: string) => path.split("/").pop() ?? path;
  const optionList = (currentPath: string) => {
    const options = loras.filter((lora) => lora.path === currentPath || !selected.has(lora.path));
    if (currentPath && !options.some((lora) => lora.path === currentPath)) {
      return [
        {
          path: currentPath,
          name: `${labelForPath(currentPath)} (incompatible with ${model})`,
          trigger_words: null,
          size_mb: 0,
          architecture: "unknown",
          compat: "incompatible"
        },
        ...options
      ];
    }
    return options;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">LORA STACK</div>
          <div className="mt-1 text-xs text-on-surface-variant">Showing LoRAs compatible with {model}. Up to {max}, no duplicate paths.</div>
        </div>
        <GenerateButton
          onClick={addLora}
          label="ADD LORA"
          icon="add"
          variant="outline"
          disabled={!available.length || value.length >= max}
        />
      </div>
      {error ? <div className="rounded-panel bg-error-container px-3 py-3 text-sm text-on-error-container">{error}</div> : null}
      {incompatibleCount ? (
        <div className="rounded-panel border border-error/50 bg-error/10 px-3 py-3 text-sm text-on-error-container">
          {incompatibleCount} selected LoRA{incompatibleCount === 1 ? " is" : "s are"} incompatible with {model}. Remove or replace before generating.
        </div>
      ) : null}
      {loading ? (
        <div className="rounded-panel border border-outline-variant/60 bg-surface-container-low px-3 py-3">
          <SurfaceLoadingState label="FETCHING LORA LIBRARY" />
        </div>
      ) : null}
      {!loading && !loras.length && !error ? (
        <div className="rounded-panel border border-outline-variant/60 bg-surface-container-low px-3 py-3 text-sm text-on-surface-variant">
          No LoRA files found in the configured LoRA directory.
        </div>
      ) : null}
      {selectedStates.map((item, index) => {
        const selectedLora = item.lora;
        const incompatible = !loading && item.compat === "incompatible";
        const unknown = !loading && item.compat === "unknown";
        const tooltip = compatTooltip(item.compat, selectedLora?.architecture ?? "unknown", model);
        return (
          <div
            key={`${item.path}-${index}`}
            title={tooltip}
            className={`rounded-panel border bg-surface-container-low p-3 ${
              incompatible ? "border-error/70" : unknown ? "border-tertiary/60" : "border-outline-variant/60"
            }`}
          >
            <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
              <label className="flex flex-col gap-2">
                <span className="flex items-center gap-2 font-label text-[10px] tracking-[0.18em] text-on-surface-variant">
                  {unknown ? <span className="h-2 w-2 rounded-full bg-tertiary shadow-[0_0_8px_rgba(255,180,84,0.55)]" /> : null}
                  {incompatible ? <span className="h-2 w-2 rounded-full bg-error shadow-[0_0_8px_rgba(255,77,107,0.55)]" /> : null}
                  LORA
                </span>
                <select
                  value={item.path}
                  onChange={(event) => updateLora(index, { path: event.target.value })}
                  className="rounded-panel border border-outline-variant/60 bg-surface-container px-3 py-3 text-sm outline-none transition focus:border-secondary/60 focus:shadow-glow-secondary"
                >
                  {optionList(item.path).map((lora) => (
                    <option key={lora.path} value={lora.path}>
                      {lora.name}
                    </option>
                  ))}
                </select>
              </label>
              <SliderField
                label="STRENGTH"
                value={item.strength}
                onChange={(strength) => updateLora(index, { strength })}
                min={0}
                max={2}
                step={0.05}
              />
              <GenerateButton onClick={() => removeLora(index)} label="REMOVE" icon="close" variant="ghost" />
            </div>
            {incompatible ? (
              <div className="mt-3 text-sm text-on-error-container">{tooltip}</div>
            ) : null}
            {unknown ? (
              <div className="mt-3 text-sm text-tertiary">{tooltip}</div>
            ) : null}
            {selectedLora?.trigger_words?.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedLora.trigger_words.slice(0, 8).map((word) => (
                  <span key={word} className="rounded-panel border border-secondary/20 bg-secondary/10 px-2 py-1 text-xs text-secondary">
                    {word}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
