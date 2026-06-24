import { useEffect, useMemo, useState } from "react";
import { offlineModelsResponse } from "../lib/fallbacks";
import { api } from "../lib/api";
import {
  buildModuleModelOptions,
  resolveDefaultModuleModel,
  type ModuleModelScope
} from "../lib/moduleModelOptions";
import type { ModelsResponse } from "../lib/types";

export function useModuleModelOptions(scope: ModuleModelScope, selectedValue?: string | null) {
  const [modelsData, setModelsData] = useState<ModelsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .models()
      .then((response) => {
        if (!alive) {
          return;
        }
        setModelsData(response);
        setError(null);
      })
      .catch((err) => {
        if (!alive) {
          return;
        }
        setModelsData(offlineModelsResponse);
        setError(err instanceof Error ? err.message : "Failed to load models.");
      })
      .finally(() => {
        if (alive) {
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  const options = useMemo(
    () => buildModuleModelOptions(modelsData, scope, selectedValue),
    [modelsData, scope, selectedValue]
  );

  const defaultModel = useMemo(() => resolveDefaultModuleModel(options, selectedValue), [options, selectedValue]);

  return { options, defaultModel, modelsData, loading, error };
}