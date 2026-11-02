import data from "./data/westKiezV302CoreNavigation.json";
import nativeData from "./data/westKiezV302NativeNavigation.json";

function roofAt(triangles: readonly number[][][], x: number, z: number): number | null {
  let high = -Infinity;
  for (const [a, b, c] of triangles) {
    const det = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(det) < 1e-8) continue;
    const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / det;
    const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / det;
    if (Math.min(u, v, 1 - u - v) >= -1e-7) high = Math.max(high, u * a[1] + v * b[1] + (1 - u - v) * c[1]);
  }
  return Number.isFinite(high) ? high : null;
}

/** Every complete official part and original court hole; same immutable NHN
 * datum as both models. No campus-wide rectangular obstacle. */
type NativeProfile = { id: string; origin: number[]; low: number; high: number; caps: number[][] };
let nativeProfiles: Map<string, { profile: NativeProfile; rows: Map<number, number[][]> }> | undefined;
function nativeParts() {
  if (nativeProfiles) return nativeProfiles;
  nativeProfiles = new Map();
  for (const profile of nativeData.parts) {
    const rows = new Map<number, number[][]>();
    for (const cap of profile.caps) {
      const lo = Math.floor(profile.origin[1] + cap[1] / nativeData.scale);
      const hi = Math.floor(profile.origin[1] + cap[3] / nativeData.scale);
      for (let z = lo; z <= hi; z++) { const list = rows.get(z) ?? []; list.push(cap); rows.set(z, list); }
    }
    nativeProfiles.set(profile.id, { profile, rows });
  }
  return nativeProfiles;
}

/** Native tops follow every actual precompiled box cap, including gable-wall
 * tops and stepped roof rectangles. Source rings and courtyard holes remain. */
export function westKiezV302Solids(native = false) {
  const nativePartsById = native ? nativeParts() : undefined;
  return data.parts.map(part => {
    const compiled = nativePartsById?.get(part.id);
    return {
    sourceId: part.id, ring: part.ring, holes: part.holes,
    low: compiled?.profile.low ?? part.low, high: compiled?.profile.high ?? part.high,
    minY: compiled?.profile.low ?? part.low, maxY: compiled?.profile.high ?? part.high,
    topAt: (x: number, z: number) => {
      if (!native) return roofAt(part.roofTriangles, x, z);
      if (!compiled) return null;
      const u = (x - compiled.profile.origin[0]) * nativeData.scale, v = (z - compiled.profile.origin[1]) * nativeData.scale;
      let top = -Infinity;
      for (const cap of compiled.rows.get(Math.floor(z)) ?? []) {
        if (u >= cap[0] - .001 && u <= cap[2] + .001 && v >= cap[1] - .001 && v <= cap[3] + .001) top = Math.max(top, cap[4] / nativeData.scale);
      }
      return Number.isFinite(top) ? top : null;
    },
  };});
}
