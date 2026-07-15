export type VisualMode = "day" | "night" | "minecraft";

export function isVisualMode(value: string | null): value is VisualMode {
  return value === "day" || value === "night" || value === "minecraft";
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
