import { pointInWorldRing } from "./chancelleryExtensionProfile";

/**
 * OSM way 198734078 is a bridge support, not a nine-metre building across
 * Gustav-Heinemann's northern approach. The source context record and exact
 * footprint stay intact; the authored bridge supplies its actual structure.
 */
export const GUSTAV_BRIDGE_SUPPORT_FALLBACK = {
  prismId: "98734078",
  osmWayId: 198734078,
  sourceGroundY: 3.2,
  sourceFallbackHeightM: 9,
  ring: [[-33.4, -481.8], [-33.4, -480.4], [-39.9, -478.2], [-39.8, -479.8]],
} as const;

export function gustavBridgeSupportReplacementAt(x: number, z: number): boolean {
  return pointInWorldRing(x, z, GUSTAV_BRIDGE_SUPPORT_FALLBACK.ring);
}
