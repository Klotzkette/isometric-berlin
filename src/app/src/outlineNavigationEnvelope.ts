import scope from "./data/outerThinOutlineScope.json";
import { extrapolatedEnvelopeBounds } from "./worldEnvelope";

/** Camera reach for the explicitly requested sparse overlay, not new city data. */
export function outlineNavigationEnvelopeBounds() {
  const inner = extrapolatedEnvelopeBounds();
  const [west, north, east, south] = scope.bounds;
  return {
    minX: Math.min(inner.minX, west - 200), minZ: Math.min(inner.minZ, north - 200),
    maxX: Math.max(inner.maxX, east + 200), maxZ: Math.max(inner.maxZ, south + 200),
  };
}
