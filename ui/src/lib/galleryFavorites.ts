const STORAGE_KEY = "mflux.gallery.favorites";

function readIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((value): value is string => typeof value === "string" && value.length > 0);
  } catch {
    return [];
  }
}

function writeIds(ids: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export function loadGalleryFavoriteIds(): Set<string> {
  return new Set(readIds());
}

export function isGalleryFavorite(id: string, favorites?: Set<string>): boolean {
  return favorites?.has(id) ?? loadGalleryFavoriteIds().has(id);
}

export function toggleGalleryFavorite(id: string): Set<string> {
  const favorites = loadGalleryFavoriteIds();
  if (favorites.has(id)) {
    favorites.delete(id);
  } else {
    favorites.add(id);
  }
  writeIds([...favorites]);
  return favorites;
}

export function removeGalleryFavorite(id: string): Set<string> {
  const favorites = loadGalleryFavoriteIds();
  favorites.delete(id);
  writeIds([...favorites]);
  return favorites;
}

export function pruneGalleryFavorites(validIds: Iterable<string>): Set<string> {
  const valid = new Set(validIds);
  const favorites = loadGalleryFavoriteIds();
  const pruned = new Set([...favorites].filter((id) => valid.has(id)));
  if (pruned.size !== favorites.size) {
    writeIds([...pruned]);
  }
  return pruned;
}