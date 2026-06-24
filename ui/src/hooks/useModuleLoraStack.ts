import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LoraSelection, LoraStackCompatibility } from "../components/LoRAStack";

export function useModuleLoraStack(model: string) {
  const [loras, setLoras] = useState<LoraSelection[]>([]);
  const [loraModelNotice, setLoraModelNotice] = useState<{
    message: string;
    oldModel: string;
    newModel: string;
  } | null>(null);
  const pendingModelChange = useRef<{ oldModel: string; newModel: string } | null>(null);

  const trackModelChange = useCallback((oldModel: string, newModel: string) => {
    if (oldModel !== newModel) {
      pendingModelChange.current = { oldModel, newModel };
    }
  }, []);

  const onCompatibilityChange = useCallback(
    ({ incompatibleCount }: LoraStackCompatibility) => {
      if (incompatibleCount === 0) {
        setLoraModelNotice(null);
        pendingModelChange.current = null;
        return;
      }
      const pending = pendingModelChange.current;
      if (!pending || pending.newModel !== model) {
        return;
      }
      setLoraModelNotice({
        oldModel: pending.oldModel,
        newModel: pending.newModel,
        message: `${incompatibleCount} stacked LoRA${incompatibleCount === 1 ? "" : "s"} incompatible with ${pending.newModel}. Remove or switch model back to ${pending.oldModel} to continue.`
      });
    },
    [model]
  );

  useEffect(() => {
    if (!loraModelNotice) {
      return;
    }
    const timeout = window.setTimeout(() => setLoraModelNotice(null), 8000);
    return () => window.clearTimeout(timeout);
  }, [loraModelNotice]);

  const loraJobParams = useMemo(() => {
    if (!loras.length) {
      return {};
    }
    return {
      loraPaths: loras.map((lora) => lora.path),
      loraScales: loras.map((lora) => lora.strength)
    };
  }, [loras]);

  return {
    loras,
    setLoras,
    loraModelNotice,
    trackModelChange,
    onCompatibilityChange,
    loraJobParams
  };
}