import surveyedCastle from "./data/tegelLandscapeCastleV378.json";
import source from "./data/westLakesV194Navigation.json";

function ringContains(x: number, z: number, ring: readonly number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

/** Lazily imported with the outline layer; preserve island holes in either mode. */
export function westLakesV194WaterAt(x: number, z: number, minecraft = false): number | null {
  for (const area of minecraft ? source.native : source.drawn) {
    const b = area.bounds;
    if (x < b[0] || x > b[2] || z < b[1] || z > b[3]) continue;
    for (const polygon of area.polygons) {
      if (ringContains(x, z, polygon[0]) && !polygon.slice(1).some(ring => ringContains(x, z, ring))) return source.waterY;
    }
  }
  return null;
}

import native from "./data/westLakesV194Native.json";
const buildings = source.buildings.map(building => {
  const points = building.polygons.flatMap(p => p[0]);
  return { ...building,
    bounds: [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])),
      Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))],
  };
});

type NativeBuilding = { boxes: number[][]; minY: number; maxY: number };
const nativeBuildings = new Map<string, NativeBuilding>();

/** A Day footprint query must not materialize native lake geometry. */
function nativeBuilding(key: string): NativeBuilding {
  const cached = nativeBuildings.get(key);
  if (cached) return cached;
  const base = native.sites.find(site => site.key === key)?.boxes ?? [];
  const boxes = key === "schloss-tegel" ? [...base, ...surveyedCastle.boxes] : base;
  let minY = Infinity, maxY = -Infinity;
  for (const row of boxes) {
    minY = Math.min(minY, row[1] - row[4] / 2);
    maxY = Math.max(maxY, row[1] + row[4] / 2);
  }
  const result = { boxes, minY, maxY };
  nativeBuildings.set(key, result);
  return result;
}

function touchesRing(x: number, z: number, radius: number, ring: readonly number[][]): boolean {
  if (radius <= 0) return false;
  for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1], b = ring[i], dx = b[0] - a[0], dz = b[1] - a[1];
    const length2 = dx * dx + dz * dz;
    const t = length2 > 0 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / length2)) : 0;
    if ((x - a[0] - t * dx) ** 2 + (z - a[1] - t * dz) ** 2 <= radius * radius) return true;
  }
  return false;
}

function castleRoofAtV378(x: number,z: number): number | null {
  let highest = -Infinity;
  for (const [ax,ay,az,bx,by,bz,cx,cy,cz] of surveyedCastle.roof) {
    const ux=bx-ax, uz=bz-az, vx=cx-ax, vz=cz-az, d=ux*vz-uz*vx;
    if (Math.abs(d)<1e-7) continue;
    const u=((x-ax)*vz-(z-az)*vx)/d, v=(ux*(z-az)-uz*(x-ax))/d;
    if (u>=-1e-7 && v>=-1e-7 && u+v<=1.0000001) highest=Math.max(highest,ay+u*(by-ay)+v*(cy-ay));
  }
  return highest===-Infinity ? null : highest;
}

/** Exact source footprint solids for outlined houses; native uses final block extents. */
export function westLakesV194SolidAt(x: number, y: number, z: number, radius = 0, minecraft = false): boolean {
  for (const building of buildings) {
    const b = building.bounds, pad = radius + (minecraft ? 1.5 : 0);
    if (x < b[0] - pad || x > b[2] + pad || z < b[1] - pad || z > b[3] + pad) continue;
    if (minecraft) {
      const native = nativeBuilding(building.key);
      if (y < native.minY || y > native.maxY) continue;
      for (const r of native.boxes) {
        if (Math.abs(x - r[0]) <= r[3] / 2 + radius && Math.abs(z - r[2]) <= r[5] / 2 + radius && Math.abs(y - r[1]) <= r[4] / 2) return true;
      }
      continue;
    }
    const top = building.key === "schloss-tegel" ? castleRoofAtV378(x,z) ?? building.topY : building.topY;
    if (y < building.groundY || y > top) continue;
    for (const polygon of building.polygons) {
      if (touchesRing(x, z, radius, polygon[0])) return true;
      if (!ringContains(x, z, polygon[0])) continue;
      let inHole = false;
      for (let i = 1; i < polygon.length; i++) {
        if (touchesRing(x, z, radius, polygon[i])) return true;
        if (ringContains(x, z, polygon[i])) inHole = true;
      }
      if (!inHole) return true;
    }
  }
  return false;
}
