import scope from "./data/outerThinOutlineScope.json";
import outskirts from "./data/outskirtsScopeV187.json";
import northCity from "./data/northCityScopeV190.json";
import named from "./data/namedScopeV194.json";
import { extrapolatedEnvelopeBounds } from "./worldEnvelope";

/** Camera reach for the explicitly requested sparse overlay, not new city data. */
export function outlineNavigationEnvelopeBounds() {
  const inner = extrapolatedEnvelopeBounds();
  const west = Math.min(scope.bounds[0], outskirts.bounds[0], northCity.bounds[0], named.bounds[0]);
  const north = Math.min(scope.bounds[1], outskirts.bounds[1], northCity.bounds[1], named.bounds[1]);
  const east = Math.max(scope.bounds[2], outskirts.bounds[2], northCity.bounds[2], named.bounds[2]);
  const south = Math.max(scope.bounds[3], outskirts.bounds[3], northCity.bounds[3], named.bounds[3]);
  return {
    minX: Math.min(inner.minX, west - 200), minZ: Math.min(inner.minZ, north - 200),
    maxX: Math.max(inner.maxX, east + 200), maxZ: Math.max(inner.maxZ, south + 200),
  };
}
