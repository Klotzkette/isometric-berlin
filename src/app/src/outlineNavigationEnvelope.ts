import scope from "./data/outerThinOutlineScope.json";
import outskirts from "./data/outskirtsScopeV187.json";
import northCity from "./data/northCityScopeV190.json";
import named from "./data/namedScopeV194.json";
import parks from "./data/namedScopeV198.json";
import eastCity from "./data/eastCityScopeV200.json";
import regional from "./data/regionalScopeV200.json";
import { extrapolatedEnvelopeBounds } from "./worldEnvelope";

const outlineScopes = [scope, outskirts, northCity, named, parks, eastCity, regional];

/** Camera reach for the explicitly requested sparse overlay, not new city data. */
export function outlineNavigationEnvelopeBounds() {
  const inner = extrapolatedEnvelopeBounds();
  const west = Math.min(...outlineScopes.map(s => s.bounds[0]));
  const north = Math.min(...outlineScopes.map(s => s.bounds[1]));
  const east = Math.max(...outlineScopes.map(s => s.bounds[2]));
  const south = Math.max(...outlineScopes.map(s => s.bounds[3]));
  return {
    minX: Math.min(inner.minX, west - 200), minZ: Math.min(inner.minZ, north - 200),
    maxX: Math.max(inner.maxX, east + 200), maxZ: Math.max(inner.maxZ, south + 200),
  };
}
