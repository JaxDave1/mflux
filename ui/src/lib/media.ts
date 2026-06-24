export function resolveOutputImageSrc(path: string, thumbnailPath?: string | null) {
  if (thumbnailPath?.startsWith("/api/") || thumbnailPath?.startsWith("http")) {
    return thumbnailPath;
  }
  return `/api/gallery/file?path=${encodeURIComponent(path)}`;
}

export function resolveInputImageSrc(path: string) {
  const normalized = path.replace(/\\/g, "/");
  if (normalized.includes("/outputs/") || /\/mflux_[^/]+\.(png|jpe?g|webp)$/i.test(normalized)) {
    return resolveOutputImageSrc(path);
  }
  return `/api/uploads/file?path=${encodeURIComponent(path)}`;
}
