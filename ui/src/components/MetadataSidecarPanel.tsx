import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { formatGallerySidecarJson } from "../lib/gallerySidecar";
import { GenerateButton } from "./GenerateButton";
import { SurfaceLoadingState } from "./SurfaceLoadingState";

export function MetadataSidecarPanel({
  itemId,
  sidecarName
}: {
  itemId: string;
  sidecarName: string;
}) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    api
      .gallerySidecar(itemId)
      .then((response) => {
        if (!alive) {
          return;
        }
        setContent(response.content);
      })
      .catch((err) => {
        if (alive) {
          setContent(null);
          setError(err instanceof Error ? err.message : "Failed to load metadata sidecar");
        }
      })
      .finally(() => {
        if (alive) {
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [itemId, open]);

  useEffect(() => {
    setOpen(false);
    setContent(null);
    setError(null);
    setCopied(false);
  }, [itemId]);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const formattedJson = useMemo(() => formatGallerySidecarJson(content), [content]);

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(formattedJson);
      setCopied(true);
    } catch {
      setError("Failed to copy JSON to clipboard");
    }
  };

  return (
    <div className="rounded-panel border border-outline-variant/60 bg-surface-container-low">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-surface-container"
      >
        <div>
          <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">
            METADATA SIDECAR
          </div>
          <div className="mt-1 text-sm text-on-surface">{sidecarName}</div>
        </div>
        <span className="font-label text-[10px] tracking-[0.18em] text-secondary">
          {open ? "HIDE" : "SHOW"}
        </span>
      </button>
      {open ? (
        <div className="space-y-3 border-t border-outline-variant/60 px-4 py-4">
          <div className="flex flex-wrap gap-2">
            <GenerateButton
              onClick={() => void copyJson()}
              label={copied ? "COPIED" : "COPY JSON"}
              variant="outline"
              disabled={loading || Boolean(error) || content === null}
            />
          </div>
          {loading ? <SurfaceLoadingState label="FETCHING SIDECAR" /> : null}
          {error ? (
            <div className="rounded-panel border border-error/20 bg-error/10 px-3 py-3 text-sm text-on-error-container">
              {error}
            </div>
          ) : null}
          {!loading && !error ? (
            <pre className="max-h-80 overflow-auto rounded-panel border border-outline-variant/50 bg-surface-container px-3 py-3 text-xs leading-5 text-on-surface">
              {formattedJson}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}