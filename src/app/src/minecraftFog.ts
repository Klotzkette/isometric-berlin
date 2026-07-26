import { VISIBLE_RADIUS_M } from "./IsometricCityWorld";

export type MinecraftFogRange = {
  far: number;
  near: number;
};

/**
 * Keep the voxel atmosphere beyond the complete published presentation ring.
 * A fixed far plane made every cumulative +100 m run progressively disappear.
 */
export function minecraftFogRange(
  visibleRadiusM = VISIBLE_RADIUS_M,
): MinecraftFogRange {
  return {
    near: visibleRadiusM * 1.05,
    far: visibleRadiusM * 1.85,
  };
}
