import addedCityV346 from "./data/addedCityScopeV346.json";
import { buddhistFrohnauGroundAtV347 } from "./BuddhistFrohnauGroundV347";
import marzahn from "./data/marzahnScopeV230.json";
import stralau from "./data/stralauScopeV299.json";
import { botanicalV230GroundAt } from "./botanicalV230Navigation";
import { westIndustrialV230TerrainAt } from "./westIndustrialV230Navigation";
import scope from "./data/surroundingCityScope.json";
import ringScope from "./data/ringCityScopeV182.json";
import coverageScope from "./data/cityCoverageScopeV183.json";
import outskirts from "./data/outskirtsScopeV187.json";
import northCity from "./data/northCityScopeV190.json";
import named from "./data/namedScopeV194.json";
import parks from "./data/namedScopeV198.json";
import eastCity from "./data/eastCityScopeV200.json";
import regional from "./data/regionalScopeV200.json";
import { surroundingPolygonContains } from "./SurroundingCityGeometry";
import { terrainGroundAt } from "./weinbergTerrainV176";
import { northParksV198GroundAt } from "./northParksV198Navigation";
import { eastParksV198GroundAt } from "./eastParksV198Ground";
import { tegelSpandauV198GroundAt } from "./tegelSpandauV198Navigation";
import { prisonsMemorialsV209GroundAt } from "./prisonsMemorialsV209Navigation";

const outskirtsPolygons = [...outskirts.footprint,...northCity.footprint,...named.footprint,...parks.footprint,
  ...eastCity.footprint,...regional.footprint,...marzahn.footprint,...stralau.footprint].map(polygon => {
  let minX=Infinity, minZ=Infinity, maxX=-Infinity, maxZ=-Infinity;
  for(const [x,z] of polygon.ring) {minX=Math.min(minX,x);minZ=Math.min(minZ,z);maxX=Math.max(maxX,x);maxZ=Math.max(maxZ,z);}
  return {polygon,minX,minZ,maxX,maxZ};
});

// The exact new-only Kladow/Gatow and Tegel polygons, with original holes.
// A world-family remount can keep its walker on the established 3 m datum
// before any city tile is resident. Actual resident height/roads retain priority.
const addedGroundV346 = addedCityV346.footprint.map(polygon => ({polygon,
  minX:Math.min(...polygon.ring.map(p=>p[0])),maxX:Math.max(...polygon.ring.map(p=>p[0])),
  minZ:Math.min(...polygon.ring.map(p=>p[1])),maxZ:Math.max(...polygon.ring.map(p=>p[1])),
}));
export function addedCityScopeGroundAtV346(x:number,z:number):number|null {
  return addedGroundV346.some(p=>x>=p.minX&&x<=p.maxX&&z>=p.minZ&&z<=p.maxZ&&surroundingPolygonContains(p.polygon,x,z))?addedCityV346.groundY:null;
}

/**
 * Known display ground is available before any outer chunk request. A mobile
 * world-family remount must keep a walker in their new district while loading.
 * The small source scope contains no building, road or render geometry.
 */
export function surroundingScopeGroundAt(x: number, z: number, native = false): number | null {
  const frohnauGround = buddhistFrohnauGroundAtV347(x, z, native);
  if (frohnauGround !== null) return frohnauGround;
  const namedGround = botanicalV230GroundAt(x, z, native) ?? westIndustrialV230TerrainAt(x, z, native) ?? northParksV198GroundAt(x, z, native) ??
    eastParksV198GroundAt(x, z) ?? tegelSpandauV198GroundAt(x, z, native) ??
    prisonsMemorialsV209GroundAt(x, z);
  if (namedGround !== null) return namedGround;
  if (surroundingPolygonContains(scope.core, x, z)) return null;
  return (scope.footprint.some(polygon => surroundingPolygonContains(polygon, x, z)) ||
    ringScope.footprint.some(polygon => surroundingPolygonContains(polygon, x, z)) ||
    coverageScope.footprint.some(polygon => surroundingPolygonContains(polygon, x, z)) ||
    outskirtsPolygons.some(p => x>=p.minX && x<=p.maxX && z>=p.minZ && z<=p.maxZ && surroundingPolygonContains(p.polygon,x,z)))
    ? terrainGroundAt(x, z, scope.groundY, native) : addedCityScopeGroundAtV346(x,z);
}
