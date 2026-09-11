import source from "./bebelplatzBuildingSource.json";
import { pointInWorldRing, type WorldRing } from "./chancelleryExtensionProfile";

export type BebelplatzSourcePart = {
  id: string;
  height_m: number;
  ground_y_m: number;
  top_y_m: number;
  ring: number[][];
  holes: number[][][];
  surfaces: { kind: string; rings: number[][][] }[];
};

export const BEBELPLATZ_BUILDING_SOURCES = Object.values(source.profiles);
export const BEBELPLATZ_CIVIC_SOURCES = [
  source.profiles.humboldt,
  source.profiles.alteBibliothek,
  source.profiles.hotelDeRome,
];
export const BEBELPLATZ_BUILDING_PRISM_IDS = new Set(
  BEBELPLATZ_BUILDING_SOURCES.flatMap((profile) => profile.replaced_osm_prism_ids),
);
export const BEBELPLATZ_BUILDING_GROUP_NAME = "Official Humboldt and Bebelplatz building envelopes";
export const MINECRAFT_BEBELPLATZ_BUILDING_GROUP_NAME = "Block-native Humboldt and Bebelplatz building envelopes";

export function bebelplatzPartContains(part: BebelplatzSourcePart, x: number, z: number): boolean {
  return pointInWorldRing(x, z, part.ring as unknown as WorldRing) &&
    !part.holes.some((hole) => pointInWorldRing(x, z, hole as unknown as WorldRing));
}

export function bebelplatzPartBounds(part: BebelplatzSourcePart): [number, number, number, number] {
  return [
    Math.min(...part.ring.map((p) => p[0])),
    Math.min(...part.ring.map((p) => p[1])),
    Math.max(...part.ring.map((p) => p[0])),
    Math.max(...part.ring.map((p) => p[1])),
  ];
}

export function bebelplatzSourceForPrism(id: string) {
  return BEBELPLATZ_BUILDING_SOURCES.find((profile) =>
    profile.replaced_osm_prism_ids.includes(id));
}

type RoofPlane = {
  rings: WorldRing[];
  a: number[];
  nx: number;
  ny: number;
  nz: number;
};
const roofCache = new WeakMap<BebelplatzSourcePart, RoofPlane[]>();

function roofPlanes(part: BebelplatzSourcePart): RoofPlane[] {
  let planes = roofCache.get(part);
  if (planes) return planes;
  planes = [];
  for (const surface of part.surfaces) {
    if (surface.kind !== "RoofSurface") continue;
    const ring = surface.rings[0];
    let nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      nx += (a[1] - b[1]) * (a[2] + b[2]);
      ny += (a[2] - b[2]) * (a[0] + b[0]);
      nz += (a[0] - b[0]) * (a[1] + b[1]);
    }
    if (Math.abs(ny) < 1e-6) continue;
    planes.push({ a: ring[0], nx, ny, nz,
      rings: surface.rings.map((r) => r.map((p) => [p[0], p[2]]) as WorldRing) });
  }
  roofCache.set(part, planes);
  return planes;
}

/** Exact sloping roof height; open courts and areas outside the source return null. */
export function bebelplatzPartRoofAt(part: BebelplatzSourcePart, x: number, z: number): number | null {
  if (!bebelplatzPartContains(part, x, z)) return null;
  let top: number | null = null;
  for (const plane of roofPlanes(part)) {
    if (!pointInWorldRing(x, z, plane.rings[0]) ||
        plane.rings.slice(1).some((ring) => pointInWorldRing(x, z, ring))) continue;
    const y = plane.a[1] -
      (plane.nx * (x - plane.a[0]) + plane.nz * (z - plane.a[2])) / plane.ny;
    top = Math.max(top ?? -Infinity, Math.min(part.top_y_m, y));
  }
  return top ?? part.top_y_m;
}

const previousRings = BEBELPLATZ_BUILDING_SOURCES.flatMap((profile) =>
  profile.previous_display_prisms.map((prism) => ({
    ring: prism.ring.map(([x, z]) => [x / 10, z / 10]) as WorldRing,
    holes: prism.holes.map((ring) => ring.map(([x, z]) => [x / 10, z / 10]) as WorldRing),
  })),
);

/** Old and official footprints only: preserve nearby hotel blocks and HU canopies. */
export function isBebelplatzBuildingReplacementColumn(x: number, z: number): boolean {
  if (x < 1424 || x > 1604 || z < 2 || z > 451) return false;
  return previousRings.some((p) => pointInWorldRing(x, z, p.ring) &&
    !p.holes.some((ring) => pointInWorldRing(x, z, ring))) ||
    BEBELPLATZ_BUILDING_SOURCES.some((profile) => profile.parts.some((part) =>
      bebelplatzPartContains(part, x, z)));
}
