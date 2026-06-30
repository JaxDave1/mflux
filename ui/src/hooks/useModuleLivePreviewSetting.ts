import { useEffect } from "react";
import { useConfigStore } from "../stores/useConfigStore";
import { useStickyState } from "./useStickyState";

export function useModuleLivePreviewSetting(moduleKey: string) {
  const { config, loadConfig } = useConfigStore();
  const [livePreview, setLivePreview, hadCachedLivePreview] = useStickyState(
    `module:${moduleKey}:livePreview`,
    false
  );

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (config && !hadCachedLivePreview) {
      setLivePreview(config.system.livePreview);
    }
  }, [config, hadCachedLivePreview, setLivePreview]);

  return { livePreview, setLivePreview };
}
