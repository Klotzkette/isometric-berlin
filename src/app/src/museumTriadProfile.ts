import source from "./museumTriadSource.json";
import {
  pointInWorldRing,
  type WorldRing,
} from "./chancelleryExtensionProfile";
import type { SourcePart } from "./spreeRecognitionProfile";
export { MUSEUM_TRIAD_PRISM_IDS } from "./museumTriadIds";
export const MUSEUM_TRIAD_SOURCE = source;
export const MUSEUM_TRIAD_SOURCES = [
  source.pergamon,
  source.neues,
  source.nationalgalerie,
];
export const MUSEUM_TRIAD_GROUP_NAME =
  "Source-bound Pergamon Neues Museum and Alte Nationalgalerie";
export const MINECRAFT_MUSEUM_TRIAD_GROUP_NAME =
  "Block-native Pergamon Neues Museum and Alte Nationalgalerie";
export const MUSEUM_TRIAD_PROFILE = {
  sourceCreated: "2026-03-02",
  sourceUrl: source.source_url,
  catalogueAddition: false,
  textureFree: true,
  nationalgalerieColumns: 8,
  geometryStatus:
    "Original 26 official LoD2 parts retain plan and measured height envelopes. Portico openings, stairs, sculptural silhouettes, facade orders, rooflights and materials are procedural display subdivisions. No photograph or texture is loaded. Pergamon keeps its existing three-wing fabric; a future fourth wing and transient building works are not invented.",
} as const;
export function museumTriadContains(
  part: SourcePart,
  x: number,
  z: number,
): boolean {
  return (
    pointInWorldRing(x, z, part.ring as unknown as WorldRing) &&
    !part.holes.some((h) => pointInWorldRing(x, z, h as unknown as WorldRing))
  );
}
export function museumTriadPartRoofAt(
  part: SourcePart,
  x: number,
  z: number,
): number | null {
  if (!museumTriadContains(part, x, z)) return null;
  let result: number | null = null;
  for (const surface of part.surfaces ?? []) {
    if (surface.kind !== "RoofSurface") continue;
    const ring = surface.rings[0];
    if (!pointInWorldRing(x, z, ring.map((p) => [p[0], p[2]]) as WorldRing))
      continue;
    const a = ring[0];
    let nx = 0,
      ny = 0,
      nz = 0;
    for (let i = 0; i < ring.length; i++) {
      const b = ring[i],
        c = ring[(i + 1) % ring.length];
      nx += (b[1] - c[1]) * (b[2] + c[2]);
      ny += (b[2] - c[2]) * (b[0] + c[0]);
      nz += (b[0] - c[0]) * (b[1] + c[1]);
    }
    if (Math.abs(ny) < 1e-6) continue;
    const y = a[1] - (nx * (x - a[0]) + nz * (z - a[2])) / ny;
    result = Math.max(result ?? -Infinity, Math.min(part.top_y_m, y));
  }
  return result ?? part.top_y_m;
}
export function museumTriadSourceForPrism(id: string) {
  return MUSEUM_TRIAD_SOURCES.find((s) => s.previous_display_prism.id === id);
}
/** Old source footprints are retained explicitly, including OSM stair wings. */
export function isMuseumTriadReplacementColumn(x: number, z: number): boolean {
  if (x < 1614 || x > 1870 || z < -272 || z > -48) return false;
  return MUSEUM_TRIAD_SOURCES.some(
    (s) =>
      pointInWorldRing(
        x,
        z,
        s.previous_display_prism.ring.map(([a, b]) => [
          a / 10,
          b / 10,
        ]) as WorldRing,
      ) || s.parts.some((p) => museumTriadContains(p, x, z)),
  );
}
export const NATIONALGALERIE_FRAME = {
  x: 1819.5,
  z: -184,
  yaw: 0.655,
} as const;
export function nationalgalerieLocal(x: number, z: number): [number, number] {
  const a = NATIONALGALERIE_FRAME,
    dx = x - a.x,
    dz = z - a.z,
    c = Math.cos(a.yaw),
    s = Math.sin(a.yaw);
  return [dx * c - dz * s, dx * s + dz * c];
}
/** Author-defined twin stair runs; return null outside represented treads. */
export function nationalgalerieStairTopAt(x: number, z: number): number | null {
  const [u, v] = nationalgalerieLocal(x, z);
  if (v < 33.1 || v > 54.4) return null;
  const side = Math.abs(u);
  if (v >= 49.1 && v <= 54.4 && side >= 5.2 && side <= 23.7)
    return 4.14 + ((side - 5.2) / 18.5) * 4.7;
  if (v >= 42.6 && v <= 49.1 && side >= 18.0 && side <= 23.7) return 8.84;
  if (v >= 36.1 && v <= 42.6 && side >= 5.2 && side <= 23.7)
    return 8.84 + ((23.7 - side) / 18.5) * 4.7;
  if (v >= 33.1 && v <= 36.1 && side <= 16.5) return 13.54;
  return null;
}

export function nationalgaleriePorticoSolidAt(
  x: number,
  z: number,
  y: number,
): boolean {
  if (y < 13.54 || y > 30.2) return false;
  const [u, v] = nationalgalerieLocal(x, z);
  for (let i = 0; i < 8; i++)
    if (Math.abs(u - (-15 + i * 4.14)) < 0.68 && Math.abs(v - 32.3) < 0.68)
      return true;
  return false;
}
/** Capsule clearance only within the open elevated portico, below its canopy. */
export function nationalgaleriePorticoWalkableAt(
  x: number,
  y: number,
  z: number,
  sourceId?: string,
): boolean {
  if (sourceId && sourceId !== "DEBE01YYK00000rL") return false;
  const [u, v] = nationalgalerieLocal(x, z);
  return (
    u >= -16.7 && u <= 15.5 && v > 25.2 && v < 33.2 && y >= 13.44 && y < 29.9
  );
}
export function nationalgalerieWalkSurfaceAt(
  x: number,
  z: number,
): number | null {
  const [u, v] = nationalgalerieLocal(x, z);
  if (u >= -16.7 && u <= 15.5 && v >= 25.2 && v <= 36.15) return 13.54;
  return nationalgalerieStairTopAt(x, z);
}
