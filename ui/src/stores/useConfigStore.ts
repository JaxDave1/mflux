import { create } from "zustand";
import { api } from "../lib/api";
import type { AppConfig } from "../lib/types";

interface ConfigState {
  config: AppConfig | null;
  loadConfig: () => Promise<void>;
  updateConfig: (partial: Partial<AppConfig>) => Promise<void>;
  saveConfig: (config: AppConfig) => Promise<void>;
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  config: null,
  loadConfig: async () => {
    const config = await api.config();
    set({ config });
  },
  updateConfig: async (partial) => {
    const current = get().config;
    if (!current) {
      return;
    }
    const merged = {
      ...current,
      ...partial,
      paths: { ...current.paths, ...partial.paths },
      generation: { ...current.generation, ...partial.generation },
      system: { ...current.system, ...partial.system },
      backend: { ...current.backend, ...partial.backend }
    };
    const config = await api.updateConfig(merged);
    set({ config });
  },
  saveConfig: async (config) => {
    const saved = await api.updateConfig(config);
    set({ config: saved });
  }
}));
