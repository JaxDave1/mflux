import type { GenerationOutput } from "../lib/types";

export function ImageGrid({
  images,
  onSelect,
  columns = 3
}: {
  images: GenerationOutput[];
  onSelect?: (image: GenerationOutput) => void;
  columns?: number;
}) {
  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {images.map((image) => (
        <button
          type="button"
          key={image.id}
          onClick={() => onSelect?.(image)}
          className="overflow-hidden rounded-panel border border-outline-variant/60 bg-surface-container-low text-left transition hover:border-secondary/60 hover:shadow-glow-secondary"
        >
          <div className="aspect-square bg-surface-container-high">
            <img
              src={image.thumbnailPath ?? image.path}
              alt={image.prompt}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="p-3">
            <div className="text-sm text-on-surface">{image.prompt}</div>
            <div className="mt-2 font-label text-[10px] tracking-[0.18em] text-secondary">
              {image.model} · seed {image.seed}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
