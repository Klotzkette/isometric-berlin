export function assetPath(path: string): string {
  const base = import.meta.env.BASE_URL || "./";
  return `${base.endsWith("/") ? base : `${base}/`}${path}`;
}

export function resolveCssAssetUrl(path: string): string {
  if (typeof document === "undefined") return path;
  try {
    return new URL(path, document.baseURI).href;
  } catch {
    return path;
  }
}
