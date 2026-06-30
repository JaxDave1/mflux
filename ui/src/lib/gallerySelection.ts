import type { GenerationOutput } from "./types";

export function toggleGallerySelectionId(selectedIds: Set<string>, id: string): Set<string> {
  const next = new Set(selectedIds);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

export function selectGalleryItems(items: GenerationOutput[], selectedIds: Set<string>): Set<string> {
  const next = new Set(selectedIds);
  items.forEach((item) => next.add(item.id));
  return next;
}

export function selectGalleryPage(items: GenerationOutput[], selectedIds: Set<string>): Set<string> {
  return selectGalleryItems(items, selectedIds);
}

export function selectedGalleryItems(
  items: GenerationOutput[],
  selectedIds: Set<string>
): GenerationOutput[] {
  return items.filter((item) => selectedIds.has(item.id));
}

export function rangeGallerySelectionIds(
  items: GenerationOutput[],
  anchorId: string | null,
  targetId: string,
  current: Set<string>
): Set<string> {
  const next = new Set(current);
  const anchorIndex = anchorId ? items.findIndex((item) => item.id === anchorId) : -1;
  const targetIndex = items.findIndex((item) => item.id === targetId);
  if (anchorIndex === -1 || targetIndex === -1) {
    next.add(targetId);
    return next;
  }
  const [start, end] =
    anchorIndex < targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
  for (let index = start; index <= end; index += 1) {
    next.add(items[index].id);
  }
  return next;
}

export function firstGallerySelectionItem(
  items: GenerationOutput[],
  selectedIds: Set<string>
): GenerationOutput | null {
  return items.find((item) => selectedIds.has(item.id)) ?? null;
}
