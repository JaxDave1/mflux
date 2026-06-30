import { useCallback, useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

const stickyState = new Map<string, unknown>();

function resolveInitialValue<T>(initialValue: T | (() => T)): T {
  return typeof initialValue === "function" ? (initialValue as () => T)() : initialValue;
}

export function useStickyState<T>(
  key: string,
  initialValue: T | (() => T)
): readonly [T, Dispatch<SetStateAction<T>>, boolean] {
  const [hadCachedValue] = useState(() => stickyState.has(key));
  const [value, setValueState] = useState<T>(() =>
    stickyState.has(key) ? (stickyState.get(key) as T) : resolveInitialValue(initialValue)
  );

  const setValue = useCallback<Dispatch<SetStateAction<T>>>(
    (nextValue) => {
      setValueState((currentValue) => {
        const resolvedValue =
          typeof nextValue === "function"
            ? (nextValue as (previousValue: T) => T)(currentValue)
            : nextValue;
        stickyState.set(key, resolvedValue);
        return resolvedValue;
      });
    },
    [key]
  );

  useEffect(() => {
    stickyState.set(key, value);
  }, [key, value]);

  return [value, setValue, hadCachedValue];
}
