import scope from "./data/surroundingCityScope.json";
import ringScope from "./data/ringCityScopeV182.json";
import coverageScope from "./data/cityCoverageScopeV183.json";
import outskirts from "./data/outskirtsScopeV187.json";
import northCity from "./data/northCityScopeV190.json";
import named from "./data/namedScopeV194.json";
import { surroundingPolygonContains } from "./SurroundingCityGeometry";
import { terrainGroundAt } from "./weinbergTerrainV176";

const outskirtsPolygons = [...outskirts.footprint,...northCity.footprint,...named.footprint].map(polygon => {
  let minX=Infinity, minZ=Infinity, maxX=-Infinity, maxZ=-Infinity;
  for(const [x,z] of polygon.ring) {minX=Math.min(minX,x);minZ=Math.min(minZ,z);maxX=Math.max(maxX,x);maxZ=Math.max(maxZ,z);}
  return {polygon,minX,minZ,maxX,maxZ};
});

/**
 * Known display ground is available before any outer chunk request. A mobile
 * world-family remount must keep a walker in their new district while loading.
 * The small source scope contains no building, road or render geometry.
 */
export function surroundingScopeGroundAt(x: number, z: number, native = false): number | null {
  if (surroundingPolygonContains(scope.core, x, z)) return null;
  return (scope.footprint.some(polygon => surroundingPolygonContains(polygon, x, z)) ||
    ringScope.footprint.some(polygon => surroundingPolygonContains(polygon, x, z)) ||
    coverageScope.footprint.some(polygon => surroundingPolygonContains(polygon, x, z)) ||
    outskirtsPolygons.some(p => x>=p.minX && x<=p.maxX && z>=p.minZ && z<=p.maxZ && surroundingPolygonContains(p.polygon,x,z)))
    ? terrainGroundAt(x, z, scope.groundY, native) : null;
}
