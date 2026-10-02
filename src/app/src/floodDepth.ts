/** Fictional water depth above the central city's approximate street datum. */
export const FLOOD_DEPTHS = [3, 6, 21] as const;
export type FloodDepth = typeof FLOOD_DEPTHS[number];
export const DEFAULT_FLOOD_DEPTH: FloodDepth = 3;

export function floodWaterLevel(depth: FloodDepth): number {
  return 4.2 + depth;
}
