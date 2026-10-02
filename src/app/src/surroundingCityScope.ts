import scope from "./data/surroundingCityScope.json";
import { surroundingPolygonContains } from "./SurroundingCityGeometry";
import { terrainGroundAt } from "./weinbergTerrainV176";

/**
 * Known display ground is available before any outer chunk request. A mobile
 * world-family remount must keep a walker in their new district while loading.
 * The small source scope contains no building, road or render geometry.
 */
export function surroundingScopeGroundAt(x: number, z: number, native = false): number | null {
  if (surroundingPolygonContains(scope.core, x, z)) return null;
  return scope.footprint.some(polygon => surroundingPolygonContains(polygon, x, z))
    ? terrainGroundAt(x, z, scope.groundY, native) : null;
}
