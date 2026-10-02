export type VisualMode =
  | "day"
  | "night"
  | "minecraft"
  | "snowstorm"
  | "schwellenraum"
  | "flood";

export function isVisualMode(value: string | null): value is VisualMode {
  return (
    value === "day" ||
    value === "night" ||
    value === "minecraft" ||
    value === "snowstorm" ||
    value === "schwellenraum" ||
    value === "flood"
  );
}

/**
 * Resolve the visual mode a fresh page load should start in. Day mode is
 * always the default; only an explicit, valid `?theme=` request overrides
 * it. The previously-selected mode is deliberately never restored, so a
 * reload always returns to Day.
 */
export function resolveInitialVisualMode(themeParam: string | null): VisualMode {
  return isVisualMode(themeParam) ? themeParam : "day";
}

/** Match collision/roof queries to the world that has actually been published. */
export function publishedNavigationMode(
  requestedMode: VisualMode,
  nativeWorldReady: boolean,
): VisualMode {
  // Desktop retains its complete drawn world during an asynchronous native
  // preload. Its navigation must not query native-only data before that world
  // is ready, including when the preload is cancelled or fails.
  return requestedMode === "minecraft" && !nativeWorldReady ? "day" : requestedMode;
}
