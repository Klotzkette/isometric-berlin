import navigation from "./data/bndHeadquartersV174Navigation.json";
import { pointInWorldRing, type WorldRing } from "./chancelleryExtensionProfile";

/** A 6 KiB polygon-only navigation payload; no facade/instance arrays. */
export const BND_HEADQUARTERS_V174_PROFILE = Object.freeze({
  name: "Bundesnachrichtendienst headquarters", address: "Chausseestraße 96–99a",
  preservedOwners: navigation.preservedOwners, newReplacedOwners: [],
  originalMainTopY: navigation.originalMainTopY,
  publishedMainHeightM: navigation.publishedMainHeightM,
  visitorCenter: navigation.visitorCenter, additiveOnly: true,
  policy: navigation.policy,
});
export const BND_HEADQUARTERS_V174_PARTS = navigation.upperParts.map(p => ({
  ...p, sourceId: p.id, ground_y_m: p.groundY, top_y_m: p.topY,
}));
const bounds = navigation.upperParts.map(p => ({ p,
  minX: Math.min(...p.ring.map(q => q[0])), maxX: Math.max(...p.ring.map(q => q[0])),
  minZ: Math.min(...p.ring.map(q => q[1])), maxZ: Math.max(...p.ring.map(q => q[1])),
}));
const inside = (x: number, z: number, p: { ring: number[][]; holes: number[][][] }): boolean =>
  pointInWorldRing(x, z, p.ring as unknown as WorldRing) &&
  !p.holes.some(h => pointInWorldRing(x, z, h as unknown as WorldRing));

/** Exact mapped upper footprint; native roof samples match the one-metre cells. */
export function bndHeadquartersV174RoofAt(x: number, z: number, minecraft = false): number | null {
  if (minecraft) { x = Math.floor(x) + .5; z = Math.floor(z) + .5; }
  let roof: number | null = null;
  for (const b of bounds) {
    if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ || !inside(x, z, b.p)) continue;
    roof = Math.max(roof ?? -Infinity, minecraft ? Math.ceil(b.p.topY) : b.p.topY);
  }
  return roof;
}

/** Upper external bodies only; original source navigation still owns the base. */
export function bndHeadquartersV174SolidAt(x: number, z: number, y: number, minecraft = false): boolean {
  const roof = bndHeadquartersV174RoofAt(x, z, minecraft);
  return roof !== null && y > (minecraft ? Math.floor(navigation.originalMainTopY) : navigation.originalMainTopY) + .005 && y < roof - .005;
}
