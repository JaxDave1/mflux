export function hasGalleryJsonSidecar(metadataSource?: string | null): boolean {
  if (!metadataSource || metadataSource === "none") {
    return false;
  }
  if (metadataSource.startsWith("embedded-")) {
    return false;
  }
  return metadataSource.endsWith(".json");
}

export function formatGallerySidecarJson(content: unknown): string {
  return JSON.stringify(content ?? {}, null, 2);
}