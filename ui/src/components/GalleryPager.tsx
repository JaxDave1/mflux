import { GenerateButton } from "./GenerateButton";

export function GalleryPager({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  if (total <= pageSize) {
    return null;
  }

  const rangeStart = (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-xs text-on-surface-variant">
        Showing {rangeStart}–{rangeEnd} of {total}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <GenerateButton
          onClick={() => onPageChange(page - 1)}
          label="PREV"
          variant="ghost"
          disabled={page <= 1}
        />
        <div className="rounded-panel border border-outline-variant/60 bg-surface-container px-3 py-2 font-label text-[10px] tracking-[0.18em] text-on-surface-variant">
          PAGE {page} / {pageCount}
        </div>
        <GenerateButton
          onClick={() => onPageChange(page + 1)}
          label="NEXT"
          variant="ghost"
          disabled={page >= pageCount}
        />
      </div>
    </div>
  );
}