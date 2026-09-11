import source from "./neueWacheSource.json";
import { pointInWorldRing, type WorldRing } from "./chancelleryExtensionProfile";

export const NEUE_WACHE_PRISM_IDS: ReadonlySet<string> = new Set(source.replaced_prism_ids);
export const NEUE_WACHE_PROFILE = {
  centre: source.sculpture_world_m as [number, number],
  rotationY: Math.atan2(1.373, 16.443),
  streetY: 5.2, floorY: 5.38, roofY: 15.013, pedimentTopY: 15.479,
  oculusRadius: 1.85, statueHeight: 1.6, frontColumns: 6,
  interiorSurveyed: false,
} as const;
const P = NEUE_WACHE_PROFILE, c = Math.cos(P.rotationY), s = Math.sin(P.rotationY);
export function neueWacheLocal(x: number, z: number): [number, number] {
  const dx = x - P.centre[0], dz = z - P.centre[1];
  return [dx * c - dz * s, dx * s + dz * c];
}
export function neueWacheWorld(u: number, v: number): [number, number] {
  return [P.centre[0] + u * c + v * s, P.centre[1] - u * s + v * c];
}
// A bounded index envelope, not a solid slab. The callback below resolves only
// represented roof surfaces and returns -Infinity over open air (including the
// oculus), preventing generic nearest-edge roof fallback from sealing a hole.
export const NEUE_WACHE_ROOF_INDEX_RING = [
  [-13.1, -8.1], [12.4, -8.1], [12.4, 21], [-13.1, 21],
].map(([u, v]) => neueWacheWorld(u, v));
function hallRoofContains(u: number, v: number, minecraft: boolean): boolean {
  if (!minecraft) return u >= -11.5 && u <= 11.4 && v >= -7.6 && v <= 13.8 && Math.hypot(u, v) >= P.oculusRadius;
  const cell = .55, i = Math.floor((u + 11.5) / cell), j = Math.floor((v + 7.6) / cell);
  return i >= 0 && i < 42 && j >= 0 && j < 39 &&
    Math.hypot(-11.5 + (i + .5) * cell, -7.6 + (j + .5) * cell) >= P.oculusRadius + cell * .5;
}
export function neueWacheRoofAt(x: number, z: number, minecraft = false): number {
  const [u, v] = neueWacheLocal(x, z);
  // Minecraft uses exactly the same .55 m shell cells as NeueWache.ts.
  let top = hallRoofContains(u, v, minecraft) ? P.roofY : Number.NEGATIVE_INFINITY;
  if (u >= -8.7 && u <= 7.8 && v >= 13.75 && v <= 20.85) {
    const sampleU = minecraft ? -8.7 + (Math.min(33, Math.floor((u + 8.7) / (16.5 / 34))) + .5) * 16.5 / 34 : u;
    const rise = minecraft ? Math.max(.025, (1 - Math.abs((sampleU + .45) / 8.25)) * 1.45)
      : (P.pedimentTopY - 13.99) * (sampleU <= -.12 ? (sampleU + 8.7) / 8.58 : (7.8 - sampleU) / 7.92);
    top = Math.max(top, 13.99 + rise);
  }
  for (const a of [-10.65, 9.95]) for (const b of [-5.9, 15.1]) {
    const du = Math.abs(u - a), dv = Math.abs(v - b);
    if (du <= 2.325 && dv <= 2.025) top = Math.max(top, 14.265);
    if (du <= 2.16 && dv <= 1.86) top = Math.max(top, 15.01);
  }
  return top;
}
export function isNeueWacheReplacementColumn(x: number, z: number): boolean {
  if (x < 1616 || x > 1648 || z < 130 || z > 167) return false;
  return source.parts.some(p => pointInWorldRing(x, z, p.ring as unknown as WorldRing)) ||
    source.previous_display_prisms.some(p => pointInWorldRing(x * 10, z * 10, p.ring as unknown as WorldRing));
}
/** Source-specific hollow hall; never exempts unrelated neighbouring obstacles. */
export function neueWacheWalkableAt(x: number, y: number, z: number, sourceId?: string): boolean {
  if (sourceId && !NEUE_WACHE_PRISM_IDS.has(sourceId)) return false;
  const [u, v] = neueWacheLocal(x, z);
  return u > -13 && u < 12.5 && v > -8.5 && v < 22 && y >= P.streetY - .2 && y < 14.1;
}
/** Rectangular wall pieces share precisely the same openings as the visual model. */
export const NEUE_WACHE_WALLS: readonly (readonly [number, number, number, number])[] = [
  [-11.12, 2.9, .8, 20.9], [10.95, 2.9, .8, 20.9], [-.08, -7.22, 22.9, .8],
  [-7.9375, 13.37, 7.125, .9], [-2.0925, 13.37, 1.265, .9],
  [1.2375, 13.37, 1.275, .9], [7.4125, 13.37, 7.775, .9],
];
export const NEUE_WACHE_DOOR_U = -.43;
export const NEUE_WACHE_COLUMN_U = [-7.72, -4.82, -1.92, .98, 3.88, 6.78] as const;
export function neueWacheSolidAt(x: number, y: number, z: number, radius = 0, minecraft = false): boolean {
  const [u, v] = neueWacheLocal(x, z);
  if (u < -14 - radius || u > 14 + radius || v < -9 - radius || v > 22 + radius || y < P.streetY || y > P.pedimentTopY) return false;
  const roofY = neueWacheRoofAt(x, z, minecraft);
  if (Number.isFinite(roofY) && y >= roofY - .02) return false;
  if (y >= 14.35 && y < P.roofY - .02 && (minecraft ? hallRoofContains(u, v, true) :
      u >= -11.5-radius && u <= 11.4+radius && v >= -7.6-radius && v <= 13.8+radius &&
      Math.hypot(u,v) > P.oculusRadius-radius)) return true;
  if (y < 14.8 && NEUE_WACHE_WALLS.some(([a, b, w, d]) => Math.abs(u-a) < w/2+radius && Math.abs(v-b) < d/2+radius)) return true;
  if (Math.abs(v - 13.37) < .55 + radius && (y > 9.35 || (Math.abs(u - NEUE_WACHE_DOOR_U) > 1.03 - radius)) && u > -8 && u < 7) return true;
  if (y <= 12.55) {
    if (NEUE_WACHE_COLUMN_U.some(a => Math.hypot(u - a, v - 19.75) < .52 + radius)) return true;
    for (const a of [-7.72,6.78]) for (const b of [15.65,17.7]) if (Math.hypot(u-a,v-b) < .52+radius) return true;
  }
  if (y >= 12.55 && v > 13.7 && v < 20.8 && u > -8.7 && u < 7.8) return true;
  for (const a of [-10.65,9.95]) for (const b of [-5.9,15.1]) if (Math.abs(u-a) < 2.2+radius && Math.abs(v-b)<1.9+radius) return true;
  return y < P.floorY + 1.65 && Math.hypot(u, v) < .82 + radius;
}
export function neueWacheGroundAt(x: number, z: number, _currentY: number = P.streetY): number | null {
  const [u, v] = neueWacheLocal(x, z);
  // Real roof surfaces are resolved first by navigation. A high hover hint
  // inside the hall or over its opening must still descend to the real floor.
  if (u < -12.9 || u > 12.3 || v < -8.1 || v > 22.15) return null;
  return v > 21.1 ? P.streetY + .09 : P.floorY;
}
