export function safeImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}
export function postImages(media: unknown, limit = 12): string[] {
  if (!Array.isArray(media)) return [];
  const images: string[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    const item = value as Record<string, any>;
    const image =
      safeImageUrl(item.viewer_image?.uri) ||
      safeImageUrl(item.photo_image?.uri) ||
      safeImageUrl(item.image?.uri) ||
      safeImageUrl(item.thumbnail) ||
      safeImageUrl(item.url);
    if (image) images.push(image);
    for (const [key, nested] of Object.entries(item)) {
      if (
        key === "viewer_image" ||
        key === "photo_image" ||
        key === "image" ||
        key === "thumbnail" ||
        key === "url"
      )
        continue;
      visit(nested);
    }
  };
  visit(media);
  return [...new Set(images)].slice(0, limit);
}
