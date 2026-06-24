import type { MouseEvent } from "react";
import type { GenerationOutput } from "../lib/types";
import { formatModelLabel } from "../lib/labels";
import { resolveOutputImageSrc } from "../lib/media";
import { Icon } from "./Icon";

export function ImageGrid({
  images,
  onSelect,
  onDelete,
  onToggleSelection,
  selectedId,
  selectedIds,
  selectionMode = false,
  favoriteIds,
  columns = 3,
  compact = false
}: {
  images: GenerationOutput[];
  onSelect?: (image: GenerationOutput, event: MouseEvent<HTMLButtonElement>) => void;
  onDelete?: (image: GenerationOutput) => void;
  onToggleSelection?: (image: GenerationOutput) => void;
  selectedId?: string;
  selectedIds?: Set<string>;
  selectionMode?: boolean;
  favoriteIds?: Set<string>;
  columns?: number;
  compact?: boolean;
}) {
  return (
    <div
      className={compact ? "grid gap-2" : "grid gap-4"}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {images.map((image) => {
        const isDetailSelected = selectedId === image.id;
        const isBulkSelected = selectedIds?.has(image.id) ?? false;
        const isFavorite = favoriteIds?.has(image.id) ?? false;

        return (
          <div
            key={image.id}
            className={`group relative overflow-hidden rounded-panel border bg-surface-container-low text-left transition ${
              isDetailSelected
                ? "border-secondary/80 shadow-glow-secondary"
                : isBulkSelected
                  ? "border-tertiary/70 shadow-[0_0_16px_rgba(255,180,84,0.18)]"
                  : "border-outline-variant/60 hover:border-secondary/60 hover:shadow-glow-secondary"
            }`}
          >
            <button
              type="button"
              onClick={(event) => onSelect?.(image, event)}
              className="block w-full text-left"
            >
              <div className="aspect-square bg-surface-container-high">
                <img
                  src={resolveOutputImageSrc(image.path, image.thumbnailPath)}
                  alt={image.prompt}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className={compact ? "p-2" : "p-3"}>
                <div
                  className={`text-on-surface ${compact ? "line-clamp-2 text-xs leading-4" : "text-sm"}`}
                >
                  {image.prompt}
                </div>
                <div
                  className={`font-label tracking-[0.18em] text-secondary ${
                    compact ? "mt-1 text-[9px]" : "mt-2 text-[10px]"
                  }`}
                >
                  {formatModelLabel(image.model)} · seed {image.seed}
                </div>
              </div>
            </button>
            {selectionMode ? (
              <button
                type="button"
                aria-label={isBulkSelected ? "Deselect output" : "Select output"}
                title={isBulkSelected ? "Deselect" : "Select"}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onToggleSelection?.(image);
                }}
                className={`absolute z-10 flex items-center justify-center rounded-panel border bg-black/75 transition hover:bg-black/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tertiary/60 ${
                  isBulkSelected
                    ? "border-tertiary/70 text-tertiary"
                    : "border-outline-variant/70 text-on-surface-variant"
                } ${compact ? "left-1 top-1 h-6 w-6" : "left-2 top-2 h-8 w-8"}`}
              >
                <Icon
                  name={isBulkSelected ? "check_box" : "check_box_outline_blank"}
                  className={compact ? "h-3 w-3" : "h-4 w-4"}
                  title={isBulkSelected ? "Selected" : "Not selected"}
                />
              </button>
            ) : null}
            {isFavorite ? (
              <div
                className={`pointer-events-none absolute z-10 flex items-center justify-center rounded-panel border border-tertiary/50 bg-black/75 text-tertiary ${
                  selectionMode
                    ? compact
                      ? "left-8 top-1 h-6 w-6"
                      : "left-11 top-2 h-8 w-8"
                    : compact
                      ? "left-1 top-1 h-6 w-6"
                      : "left-2 top-2 h-8 w-8"
                }`}
                title="Favorited"
              >
                <Icon name="star" className={compact ? "h-3 w-3" : "h-4 w-4"} title="Favorited" />
              </div>
            ) : null}
            {onDelete ? (
              <button
                type="button"
                aria-label={`Delete output: ${image.prompt}`}
                title="Delete output"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onDelete(image);
                }}
                className={`absolute z-10 flex items-center justify-center rounded-panel border border-error/50 bg-black/75 text-error opacity-0 shadow-[0_2px_8px_rgba(0,0,0,0.45)] transition hover:border-error/70 hover:bg-error/25 hover:shadow-[0_0_12px_rgba(255,77,107,0.24)] group-hover:opacity-100 focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/60 ${
                  compact ? "right-1 top-1 h-6 w-6" : "right-2 top-2 h-8 w-8"
                }`}
              >
                <Icon name="delete" className={compact ? "h-3 w-3" : "h-4 w-4"} title="Delete" />
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}