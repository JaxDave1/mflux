import { useEffect, useState } from "react";
import { useConfigStore } from "../stores/useConfigStore";

export function useModuleLivePreviewSetting() {
  const { config, loadConfig } = useConfigStore();
  const [livePreview, setLivePreview] = useState(false);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (config) {
      setLivePreview(config.system.livePreview);
    }
  }, [config]);

  return { livePreview, setLivePreview };
}