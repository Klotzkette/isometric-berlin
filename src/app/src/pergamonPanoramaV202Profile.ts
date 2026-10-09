import source from './pergamonPanoramaV202Source.json';
import { pointInWorldRing, type WorldRing } from './chancelleryExtensionProfile';

export const PERGAMON_PANORAMA_V202_SOURCE = source;
export const PERGAMON_PANORAMA_V202_IDS = new Set(['35493631']);
export const PERGAMON_PANORAMA_V202_PROFILE = {
  version: '1.0.102', sourceId: 'way/235493631', catalogueAddition: false,
  textureFree: true, baseY: 4.9, hallTopY: 14.4, rotundaTopY: 37.4,
  entranceFloorY: 5.95, entranceSoffitY: 8.6,
  centre: source.rotunda_fit.centre, published: source.published_dimensions,
  displayStatus: source.display_estimates,
} as const;
const C = .8848, S = -.46596, N = Math.hypot(C, S), A = C / N, B = S / N;
export const PERGAMON_PANORAMA_V202_YAW = -Math.atan2(B, A);
export function panoramaWorld(u: number, y: number, v: number): [number, number, number] {
  return [1455.323 + A * u - B * v, y, -149.517 + B * u + A * v];
}
export function panoramaLocal(x: number, z: number): [number, number] {
  const dx = x - 1455.323, dz = z + 149.517;
  return [dx * A + dz * B, -dx * B + dz * A];
}
export function panoramaContains(x: number, z: number): boolean {
  return pointInWorldRing(x, z, source.ring as unknown as WorldRing);
}
export function pergamonPanoramaV202RoofAt(x: number, z: number): number | null {
  if (!panoramaContains(x, z)) return null;
  return Math.hypot(x-source.rotunda_fit.centre[0],z-source.rotunda_fit.centre[1]) <= source.rotunda_fit.radius_m ? 37.4 : 14.4;
}
export function panoramaStairYAt(u: number, v: number): number | null {
  if (u < 108 || u > 112.2 || Math.abs(v) > 6.9) return null;
  return 4.9 + Math.min(7, Math.max(1, Math.ceil((112.2 - u) / .6))) * .15;
}
/** Only the real undercroft; the museum and artwork chamber remain closed. */
export function pergamonPanoramaV202PassageAt(x: number, y: number, z: number, sourceId?: string): boolean {
  if (sourceId && !PERGAMON_PANORAMA_V202_IDS.has(sourceId)) return false;
  const [u, v] = panoramaLocal(x, z);
  return u > 101.3 && u < 108.7 && Math.abs(v) < 7.05 && y >= 5.4 && y < 8.57;
}
export function pergamonPanoramaV202SolidAt(x: number, y: number, z: number, radius = 0): boolean {
  const [u, v] = panoramaLocal(x, z);
  if (u < -1 - radius || u > 113 + radius || Math.abs(v) > 39 + radius) return false;
  for (const postV of [-6.5, -2.2, 2.2, 6.5]) {
    if (Math.abs(u - 107.45) < .15 + radius && Math.abs(v - postV) < .15 + radius && y > 5.9 - radius && y < 8.65 + radius) return true;
  }
  if (u > 99.6 - radius && u < 101.4 + radius && Math.abs(v) < 7.25 + radius && y > 5.9 && y < 8.6) return true;
  return panoramaContains(x, z) && y >= 4.9 - radius && y < (
    Math.hypot(x - source.rotunda_fit.centre[0], z - source.rotunda_fit.centre[1]) < source.rotunda_fit.radius_m + radius ? 37.4 : 14.4
  )-.02 && !pergamonPanoramaV202PassageAt(x, y, z);
}
export function pergamonPanoramaV202GroundAt(x: number, z: number, feetY: number): number | null {
  const [u, v] = panoramaLocal(x, z);
  // The entrance lies below a real roof: roof walkers must retain that surface.
  if(feetY>=8.58&&u<=109.2)return null;
  const stair = panoramaStairYAt(u, v);
  if (stair !== null && stair <= feetY + .52) return stair;
  if (u >= 101.2 && u <= 108.1 && Math.abs(v) <= 7.1 && 5.95 <= feetY + .52) return 5.95;
  return null;
}
const nativeSignatures = new Set(source.native_replacement_columns.map(c=>c.map(v=>Math.round(v*10)).join(',')));
/** Exact delivered x/z/bottom/top signatures, never neighbouring cells or taller owners. */
export function isPergamonPanoramaV202ReplacementColumn(x: number, z: number, bottom: number, top: number, cell = 4): boolean {
  if(cell!==4||![x,z,bottom,top].every(Number.isFinite))return false;
  return nativeSignatures.has([x,z,bottom,top].map(v=>Math.round(v*10)).join(','));
}
