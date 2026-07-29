import { VISIBLE_RADIUS_M } from "./worldEnvelope";

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
    near: visibleRadiusM * 2.2,
    far: visibleRadiusM * 3.4,
  };
}
