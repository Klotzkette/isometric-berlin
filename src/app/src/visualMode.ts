export type VisualMode = "day" | "night" | "minecraft";

export const VISUAL_MODE_STORAGE_KEY = "isometric-berlin.visualMode";

export function isVisualMode(value: string | null): value is VisualMode {
  return value === "day" || value === "night" || value === "minecraft";
}
