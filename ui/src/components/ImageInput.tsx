import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { resolveInputImageSrc } from "../lib/media";
import { Icon } from "./Icon";

const DEFAULT_TYPES = ["image/png", "image/jpeg", "image/webp"];
const EXTENSION_TO_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

function fileExtension(file: File) {
  const match = file.name.toLowerCase().match(/\.[^.]+$/);
  return match?.[0] ?? "";
}

function fileMatchesAcceptedTypes(file: File, acceptedTypes: string[]) {
  if (!acceptedTypes.length) {
    return true;
  }
  if (file.type && acceptedTypes.includes(file.type)) {
    return true;
  }
  const extensionMime = EXTENSION_TO_MIME[fileExtension(file)];
  return Boolean(extensionMime && acceptedTypes.includes(extensionMime));
}

function labelForPath(path: string) {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : path;
}

function pickDroppedFile(dataTransfer: DataTransfer | null) {
  if (!dataTransfer) {
    return null;
  }

  for (const item of Array.from(dataTransfer.items)) {
    if (item.kind === "file") {
      const file = item.getAsFile();
      if (file) {
        return file;
      }
    }
  }

  return dataTransfer.files.item(0);
}

export interface ImageInputProps {
  label: string;
  value: string | null;
  onChange: (path: string | null) => void;
  defaultPath?: string;
  acceptedTypes?: string[];
  required?: boolean;
}

export function ImageInput({
  label,
  value,
  onChange,
  defaultPath,
  acceptedTypes = DEFAULT_TYPES,
  required = false
}: ImageInputProps) {
  const [draftPath, setDraftPath] = useState(value ?? "");
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragDepthRef = useRef(0);
  const lastDefaultPathRef = useRef<string | undefined>(undefined);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const accept = useMemo(() => acceptedTypes.join(","), [acceptedTypes]);
  const previewUrl = value ? resolveInputImageSrc(value) : null;

  useEffect(() => {
    setDraftPath(value ?? "");
  }, [value]);

  useEffect(() => {
    if (!defaultPath) {
      lastDefaultPathRef.current = undefined;
      return;
    }
    if (lastDefaultPathRef.current === defaultPath) {
      return;
    }
    lastDefaultPathRef.current = defaultPath;
    onChange(defaultPath);
  }, [defaultPath, onChange]);

  const uploadFile = useCallback(
    async (file: File) => {
      if (!fileMatchesAcceptedTypes(file, acceptedTypes)) {
        setError(`Unsupported file type: ${file.type || fileExtension(file) || "unknown"}`);
        return;
      }

      setUploading(true);
      setError(null);
      try {
        const response = await api.uploadTempImage(file);
        onChange(response.path);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
        setDragOver(false);
      }
    },
    [acceptedTypes, onChange]
  );

  useEffect(() => {
    const dropZone = dropZoneRef.current;
    if (!dropZone) {
      return;
    }

    const onDragEnter = (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      dragDepthRef.current += 1;
      setDragOver(true);
    };

    const onDragLeave = (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) {
        setDragOver(false);
      }
    };

    const onDragOver = (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy";
      }
      setDragOver(true);
    };

    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      dragDepthRef.current = 0;
      setDragOver(false);
      const file = pickDroppedFile(event.dataTransfer);
      if (file) {
        void uploadFile(file);
      }
    };

    const preventWindowDrop = (event: DragEvent) => {
      event.preventDefault();
    };

    dropZone.addEventListener("dragenter", onDragEnter);
    dropZone.addEventListener("dragleave", onDragLeave);
    dropZone.addEventListener("dragover", onDragOver);
    dropZone.addEventListener("drop", onDrop);
    window.addEventListener("dragover", preventWindowDrop);
    window.addEventListener("drop", preventWindowDrop);

    return () => {
      dropZone.removeEventListener("dragenter", onDragEnter);
      dropZone.removeEventListener("dragleave", onDragLeave);
      dropZone.removeEventListener("dragover", onDragOver);
      dropZone.removeEventListener("drop", onDrop);
      window.removeEventListener("dragover", preventWindowDrop);
      window.removeEventListener("drop", preventWindowDrop);
    };
  }, [uploadFile]);

  const commitPath = () => {
    const nextPath = draftPath.trim();
    setError(null);
    onChange(nextPath ? nextPath : null);
  };

  const handlePathKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitPath();
    }
  };

  const dropZoneClass = dragOver
    ? "border-secondary bg-secondary/10 shadow-glow-secondary"
    : "border-secondary/50 bg-surface-container-low";

  return (
    <div className="space-y-4">
      <div ref={dropZoneRef} className="space-y-4">
        <div
          className={`relative flex min-h-[180px] flex-col items-center justify-center rounded-panel border border-dashed px-6 py-8 text-center transition ${dropZoneClass}`}
        >
          <div className="pointer-events-none flex flex-col items-center">
            <Icon className="mb-3 text-4xl text-secondary" name="upload_file" />
            <span className="font-label text-xs tracking-[0.18em] text-on-surface">
              {value ? labelForPath(value) : label.toUpperCase()}
            </span>
            <span className="mt-2 text-sm text-on-surface-variant">
              {uploading
                ? "UPLOADING SOURCE"
                : value
                  ? "Drop a new image here to replace the current source."
                  : "Drop an image here or browse for a local file."}
            </span>
          </div>
          <button
            className="pointer-events-auto mt-4 rounded-panel border border-secondary/50 px-4 py-2 font-label text-[10px] uppercase tracking-[0.18em] text-secondary transition hover:border-secondary hover:bg-secondary/10 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            Browse Files
          </button>
          <input
            ref={fileInputRef}
            accept={accept}
            className="hidden"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void uploadFile(file);
              }
              event.currentTarget.value = "";
            }}
            required={required && !value}
            type="file"
          />
        </div>

        {previewUrl ? (
          <div
            className={`relative overflow-hidden rounded-panel border border-dashed bg-surface-container-low transition ${dropZoneClass}`}
          >
            <button
              aria-label={`Clear ${label}`}
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant/60 bg-surface-container text-sm text-on-surface transition hover:border-secondary/60 hover:text-secondary"
              onClick={() => {
                setError(null);
                onChange(null);
              }}
              type="button"
            >
              <Icon className="h-4 w-4" name="close" title="Clear" />
            </button>
            <img
              alt={`${label} preview`}
              className="pointer-events-none max-h-[260px] w-full object-contain"
              onError={() =>
                setError(
                  defaultPath && value === defaultPath
                    ? `Reference image not found at ${defaultPath}`
                    : "Preview unavailable for this path. Generation can still use readable local paths."
                )
              }
              src={previewUrl}
            />
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <span className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">
          {label.toUpperCase()} PATH
        </span>
        <div className="grid gap-2 md:grid-cols-[1fr_auto]">
          <input
            className="rounded-panel border border-outline-variant/60 bg-surface-container px-3 py-3 text-sm outline-none transition focus:border-secondary/60"
            onBlur={commitPath}
            onChange={(event) => setDraftPath(event.target.value)}
            onKeyDown={handlePathKeyDown}
            placeholder="./input.png or /absolute/path.png"
            value={draftPath}
          />
          <button
            className="rounded-panel border border-secondary/50 px-4 py-3 font-label text-[10px] uppercase tracking-[0.18em] text-secondary transition hover:border-secondary hover:bg-secondary/10"
            onClick={commitPath}
            type="button"
          >
            Use Path
          </button>
        </div>
      </div>

      {error ? <div className="rounded-panel bg-error-container px-3 py-3 text-sm text-on-error-container">{error}</div> : null}
    </div>
  );
}