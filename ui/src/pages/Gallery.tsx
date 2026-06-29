import { useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  ConfirmModal,
  GenerateButton,
  GalleryPager,
  ImageGrid,
  MetadataSidecarPanel,
  PageHeader,
  Panel,
  ToggleChip
} from "../components";
import { api } from "../lib/api";
import { buildGalleryReferenceRoute } from "../lib/galleryReference";
import {
  loadGalleryFavoriteIds,
  pruneGalleryFavorites,
  removeGalleryFavorite,
  toggleGalleryFavorite
} from "../lib/galleryFavorites";
import {
  firstGallerySelectionItem,
  rangeGallerySelectionIds,
  selectGalleryPage,
  selectedGalleryItems,
  toggleGallerySelectionId
} from "../lib/gallerySelection";
import { hasGalleryJsonSidecar } from "../lib/gallerySidecar";
import { formatModelLabel } from "../lib/labels";
import { resolveOutputImageSrc } from "../lib/media";
import type { GenerationOutput } from "../lib/types";

type GalleryFilter = "ALL" | "FAVORITES" | "VALIDATED" | "METADATA" | "UNKNOWN";

const GALLERY_PAGE_SIZE = 12;

export function Gallery() {
  const [items, setItems] = useState<GenerationOutput[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => loadGalleryFavoriteIds());
  const [filter, setFilter] = useState<GalleryFilter>("ALL");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<GenerationOutput | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<GenerationOutput | null>(null);
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  useEffect(() => {
    api.gallery()
      .then((response) => {
        setItems(response.items);
        setFavoriteIds(pruneGalleryFavorites(response.items.map((item) => item.id)));
        setSelected(response.items[0] ?? null);
        setError(null);
      })
      .catch((err) => {
        setItems([]);
        setSelected(null);
        setError(err instanceof Error ? err.message : "Failed to load gallery");
      });
  }, []);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filter === "FAVORITES" && !favoriteIds.has(item.id)) {
        return false;
      }
      if (filter === "VALIDATED" && (!item.moduleType || item.moduleType === "unknown")) {
        return false;
      }
      if (filter === "METADATA" && (!item.metadataSource || item.metadataSource === "none")) {
        return false;
      }
      if (filter === "UNKNOWN" && item.model !== "unknown") {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      return [item.prompt, item.model, item.path].some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [favoriteIds, filter, items, query]);

  const selectedItems = useMemo(() => selectedGalleryItems(items, selectedIds), [items, selectedIds]);
  const selectedCount = selectedItems.length;

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / GALLERY_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * GALLERY_PAGE_SIZE;
    return filteredItems.slice(start, start + GALLERY_PAGE_SIZE);
  }, [currentPage, filteredItems]);

  useEffect(() => {
    setPage(1);
  }, [filter, query]);

  useEffect(() => {
    setPage((value) => Math.min(value, pageCount));
  }, [pageCount]);

  const outputFeedTitle = selectedCount > 0 ? `OUTPUT FEED · ${selectedCount} SELECTED` : "OUTPUT FEED";

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectionAnchorId(null);
  };

  const handleTileSelect = (item: GenerationOutput, event: MouseEvent<HTMLButtonElement>) => {
    setSelected(item);
    setError(null);

    if (event.shiftKey) {
      setSelectedIds((current) => rangeGallerySelectionIds(filteredItems, selectionAnchorId, item.id, current));
      setSelectionAnchorId(item.id);
      return;
    }

    if (event.metaKey || event.ctrlKey) {
      setSelectedIds((current) => toggleGallerySelectionId(current, item.id));
      setSelectionAnchorId(item.id);
      return;
    }

    setSelectionAnchorId(item.id);
  };

  const selectPage = () => {
    setSelectedIds((current) => selectGalleryPage(paginatedItems, current));
    setSelectionAnchorId(paginatedItems[0]?.id ?? null);
  };

  const handleToggleSelection = (item: GenerationOutput) => {
    setSelected(item);
    setSelectedIds((current) => toggleGallerySelectionId(current, item.id));
    setSelectionAnchorId(item.id);
  };

  const deleteItems = async (targets: GenerationOutput[]) => {
    if (!targets.length) {
      return;
    }
    setDeleteBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await api.deleteGalleryItems(targets.map((item) => item.id));
      const deletedIds = new Set(response.deleted.map((item) => item.id));
      const failures = response.failed;

      if (!deletedIds.size) {
        throw new Error(failures[0]?.message ?? "Failed to delete selected outputs");
      }

      let nextFavorites = favoriteIds;
      deletedIds.forEach((id) => {
        nextFavorites = removeGalleryFavorite(id);
      });
      setFavoriteIds(nextFavorites);

      const remaining = items.filter((item) => !deletedIds.has(item.id));
      const remainingFiltered = filteredItems.filter((item) => !deletedIds.has(item.id));
      const nextPageCount = Math.max(1, Math.ceil(remainingFiltered.length / GALLERY_PAGE_SIZE));
      const nextPage = Math.min(currentPage, nextPageCount);
      const nextPageStart = (nextPage - 1) * GALLERY_PAGE_SIZE;
      const nextPageItems = remainingFiltered.slice(nextPageStart, nextPageStart + GALLERY_PAGE_SIZE);

      setItems(remaining);
      setPage(nextPage);
      setSelectedIds((current) => {
        const next = new Set(current);
        deletedIds.forEach((id) => next.delete(id));
        return next;
      });
      setSelected((current) => {
        if (!current || !deletedIds.has(current.id)) {
          return current;
        }
        return nextPageItems[0] ?? remainingFiltered[remainingFiltered.length - 1] ?? null;
      });
      setPendingDelete(null);
      setPendingBulkDelete(false);

      if (failures.length) {
        setNotice(`Deleted ${deletedIds.size} output(s). ${failures.length} failed.`);
        setError(failures[0]?.message ?? failures[0]?.id ?? "Delete failed");
      } else {
        setNotice(
          deletedIds.size === 1 ? "Output deleted from disk." : `Deleted ${deletedIds.size} outputs from disk.`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete outputs");
    } finally {
      setDeleteBusy(false);
    }
  };

  const deleteItem = async (item: GenerationOutput) => {
    await deleteItems([item]);
  };

  const revealBulkSelection = async () => {
    const first = firstGallerySelectionItem(items, selectedIds);
    if (!first) {
      return;
    }
    setError(null);
    setNotice(null);
    try {
      await api.revealGalleryItem(first.id);
      setNotice("Finder opened with the first selected output.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reveal output in Finder");
    }
  };

  const revealSelected = async () => {
    if (!selected) {
      return;
    }
    setError(null);
    setNotice(null);
    try {
      await api.revealGalleryItem(selected.id);
      setNotice("Finder opened with the output selected.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reveal output in Finder");
    }
  };

  const useAsReference = (route: string) => {
    if (!selected) {
      return;
    }
    navigate(buildGalleryReferenceRoute(route, selected));
  };

  const toggleFavorite = (item: GenerationOutput) => {
    const wasFavorite = favoriteIds.has(item.id);
    setFavoriteIds(toggleGalleryFavorite(item.id));
    setNotice(wasFavorite ? "Removed from favorites." : "Added to favorites.");
  };

  return (
    <div className="content-shell module-reskin-page module-reskin-page--generation">
      <PageHeader
        title="GALLERY"
        description="Recent outputs, sidecar recall, metadata traceability, and output review."
        version={items.length ? `${items.length} OUTPUTS` : undefined}
        className="module-reskin-page-header"
      />
      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.9fr]">
        <div className="module-form-column space-y-6">
          <Panel title="OUTPUT INDEX" neonBorder="primary" scanline className="space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <ToggleChip
                  options={["ALL", "FAVORITES", "VALIDATED", "METADATA", "UNKNOWN"]}
                  value={filter}
                  onChange={(value) => setFilter(value as GalleryFilter)}
                />
              </div>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search prompt, model, or path"
                className="w-full max-w-sm rounded-panel border border-outline-variant/60 bg-surface-container px-3 py-3 text-sm outline-none transition focus:border-secondary/60"
              />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="mirror-stat-card px-4 py-3">
                <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">TOTAL OUTPUTS</div>
                <div className="mt-2 font-headline text-2xl font-bold text-on-surface">{items.length}</div>
              </div>
              <div className="mirror-stat-card px-4 py-3">
                <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">WITH METADATA</div>
                <div className="mt-2 font-headline text-2xl font-bold text-secondary">
                  {items.filter((item) => item.metadataSource && item.metadataSource !== "none").length}
                </div>
              </div>
              <div className="mirror-stat-card px-4 py-3">
                <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">FAVORITES</div>
                <div className="mt-2 font-headline text-2xl font-bold text-tertiary">{favoriteIds.size}</div>
              </div>
            </div>
          </Panel>

          <Panel title={outputFeedTitle} className="module-output-panel space-y-4">
            <div className="flex flex-wrap gap-2">
              <GenerateButton onClick={selectPage} label="SELECT PAGE" icon="check_box" variant="ghost" />
              {selectedCount > 0 ? (
                <>
                  <GenerateButton
                    onClick={() => setPendingBulkDelete(true)}
                    label={`DELETE SELECTED (${selectedCount})`}
                    icon="delete"
                    variant="outline"
                  />
                  <GenerateButton
                    onClick={() => void revealBulkSelection()}
                    label="REVEAL FIRST IN FINDER"
                    icon="folder_open"
                    variant="outline"
                  />
                  <GenerateButton onClick={clearSelection} label="CLEAR SELECTION" variant="ghost" />
                </>
              ) : null}
            </div>
            <div className="text-xs text-on-surface-variant">
              Use the checkboxes to select outputs for bulk delete. Shift-click or cmd-click tiles to extend the
              selection.
            </div>
            {error ? (
              <div className="rounded-panel border border-error/20 bg-error/10 px-4 py-4 text-sm text-on-error-container">
                {error}
              </div>
            ) : filteredItems.length ? (
              <>
                <GalleryPager
                  page={currentPage}
                  pageCount={pageCount}
                  total={filteredItems.length}
                  pageSize={GALLERY_PAGE_SIZE}
                  onPageChange={setPage}
                />
                <ImageGrid
                  images={paginatedItems}
                  columns={4}
                  compact
                  favoriteIds={favoriteIds}
                  onSelect={handleTileSelect}
                  onToggleSelection={handleToggleSelection}
                  selectedId={selected?.id}
                  selectedIds={selectedIds}
                  onDelete={setPendingDelete}
                />
                <GalleryPager
                  page={currentPage}
                  pageCount={pageCount}
                  total={filteredItems.length}
                  pageSize={GALLERY_PAGE_SIZE}
                  onPageChange={setPage}
                />
              </>
            ) : (
              <div className="text-sm text-on-surface-variant">No outputs matched the current gallery filters.</div>
            )}
          </Panel>
        </div>

        <div className="module-control-column space-y-6 xl:sticky xl:top-24 xl:self-start">
          <Panel title="OUTPUT DETAILS" neonBorder="secondary" variant="composite" className="module-output-panel space-y-4">
            {selected ? (
              <>
                <div className="overflow-hidden rounded-panel border border-outline-variant/60 bg-surface-container-low">
                  <img
                    src={resolveOutputImageSrc(selected.path, selected.thumbnailPath)}
                    alt={selected.prompt}
                    className="aspect-square w-full object-cover"
                  />
                </div>
                <div>
                  <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">PROMPT</div>
                  <div className="mt-2 text-sm leading-6 text-on-surface">{selected.prompt}</div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">MODULE</div>
                    <div className="mt-1 text-sm text-on-surface">{selected.moduleType ?? "unknown"}</div>
                  </div>
                  <div>
                    <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">MODEL</div>
                    <div className="mt-1 text-sm text-on-surface">{formatModelLabel(selected.model)}</div>
                  </div>
                  <div>
                    <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">SEED</div>
                    <div className="mt-1 text-sm text-on-surface">{selected.seed || "untracked"}</div>
                  </div>
                  <div>
                    <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">DIMENSIONS</div>
                    <div className="mt-1 text-sm text-on-surface">
                      {selected.width && selected.height ? `${selected.width} × ${selected.height}` : "untracked"}
                    </div>
                  </div>
                  <div>
                    <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">METADATA SOURCE</div>
                    <div className="mt-1 text-sm text-on-surface">{selected.metadataSource ?? "none"}</div>
                  </div>
                  <div>
                    <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">STEPS</div>
                    <div className="mt-1 text-sm text-on-surface">{selected.steps ?? "untracked"}</div>
                  </div>
                  <div>
                    <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">GUIDANCE</div>
                    <div className="mt-1 text-sm text-on-surface">{selected.guidance ?? "untracked"}</div>
                  </div>
                  <div>
                    <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">QUANTIZE</div>
                    <div className="mt-1 text-sm text-on-surface">{selected.quantize ?? "untracked"}</div>
                  </div>
                  <div>
                    <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">PRECISION</div>
                    <div className="mt-1 text-sm text-on-surface">{selected.precision ?? "untracked"}</div>
                  </div>
                  <div>
                    <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">BASE MODEL</div>
                    <div className="mt-1 text-sm text-on-surface">{selected.baseModel ?? "none"}</div>
                  </div>
                  <div>
                    <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">GEN TIME</div>
                    <div className="mt-1 text-sm text-on-surface">
                      {selected.generationTimeSeconds ? `${selected.generationTimeSeconds.toFixed(2)}s` : "untracked"}
                    </div>
                  </div>
                  <div>
                    <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">MFLUX VERSION</div>
                    <div className="mt-1 text-sm text-on-surface">{selected.mfluxVersion ?? "untracked"}</div>
                  </div>
                </div>
                <div>
                  <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">FILE</div>
                  <div className="mt-1 break-all text-sm text-on-surface-variant">{selected.path}</div>
                </div>
                {hasGalleryJsonSidecar(selected.metadataSource) ? (
                  <MetadataSidecarPanel
                    itemId={selected.id}
                    sidecarName={selected.metadataSource ?? "metadata.json"}
                  />
                ) : null}
                <div className="grid gap-3 md:grid-cols-2">
                  <GenerateButton
                    onClick={() => toggleFavorite(selected)}
                    label={favoriteIds.has(selected.id) ? "UNFAVORITE" : "ADD FAVORITE"}
                    icon={favoriteIds.has(selected.id) ? "star" : "star_outline"}
                    variant={favoriteIds.has(selected.id) ? "outline" : "ghost"}
                  />
                  <GenerateButton
                    onClick={() => void revealSelected()}
                    label="REVEAL IN FINDER"
                    icon="folder_open"
                    variant="outline"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      selectedCount > 1 ? setPendingBulkDelete(true) : setPendingDelete(selected)
                    }
                    className="rounded-panel border border-error/60 bg-error/10 px-4 py-3 font-label text-xs uppercase tracking-[0.24em] text-error transition hover:bg-error/20 hover:shadow-[0_0_18px_rgba(255,77,107,0.22)]"
                  >
                    {selectedCount > 1 ? `DELETE ${selectedCount} SELECTED` : "DELETE OUTPUT"}
                  </button>
                </div>
                <div className="space-y-3 rounded-panel border border-outline-variant/60 bg-surface-container-low p-4">
                  <div className="font-label text-[10px] tracking-[0.18em] text-on-surface-variant">
                    USE THIS OUTPUT IN
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      ["IMG2IMG", "/img2img"],
                      ["INPAINT", "/inpaint"],
                      ["CONTROLNET", "/controlnet"],
                      ["KONTEXT", "/kontext"],
                      ["UPSCALER", "/upscaler"],
                      ["DEPTH PRO", "/depth-pro"]
                    ].map(([label, route]) => (
                      <GenerateButton
                        key={route}
                        onClick={() => useAsReference(route)}
                        label={label}
                        icon="image"
                        variant="ghost"
                      />
                    ))}
                  </div>
                </div>
                {notice ? (
                  <div className="rounded-panel border border-secondary/35 bg-secondary/10 px-3 py-3 text-sm text-secondary">
                    {notice}
                  </div>
                ) : null}
                {error ? (
                  <div className="rounded-panel border border-error/20 bg-error/10 px-3 py-3 text-sm text-on-error-container">
                    {error}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="text-sm text-on-surface-variant">Select an output tile to inspect its metadata.</div>
            )}
          </Panel>
        </div>
      </div>
      {pendingDelete ? (
        <ConfirmModal
          title="DELETE OUTPUT?"
          confirmLabel="DELETE"
          busy={deleteBusy}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void deleteItem(pendingDelete)}
        >
          <p>This permanently deletes the image and its metadata sidecar.</p>
          <p className="mt-2">This cannot be undone.</p>
        </ConfirmModal>
      ) : null}
      {pendingBulkDelete ? (
        <ConfirmModal
          title={`DELETE ${selectedCount} OUTPUTS?`}
          confirmLabel="DELETE ALL"
          busy={deleteBusy}
          onCancel={() => setPendingBulkDelete(false)}
          onConfirm={() => void deleteItems(selectedItems)}
        >
          <p>This permanently deletes {selectedCount} images and their metadata sidecars.</p>
          <p className="mt-2">This cannot be undone.</p>
        </ConfirmModal>
      ) : null}
    </div>
  );
}
