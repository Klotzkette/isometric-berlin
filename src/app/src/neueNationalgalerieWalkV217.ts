import { NATIONALGALERIE_V183 as P, NATIONALGALERIE_V183_IDS, NATIONALGALERIE_TERRACE_RING_V183 as terraceRing } from "./neueNationalgalerieV183Profile";
import { pointInWorldRing } from "./chancelleryExtensionProfile";
import type { PedestrianObstacleIndex } from "./pedestrianNavigation";
import { nationalgalerieSculptureSolidAtV221 } from "./nationalgalerieSculpturesV221Profile";
import { nationalgalerieApronContainsV221, NATIONALGALERIE_APRON_V221_RING as apronRing } from "./nationalgalerieApronV221Profile";

const c = Math.cos(P.yaw), s = Math.sin(P.yaw);
const soffitY = P.floorY + P.columnHeight;
const localTerrace = terraceRing.map(([x, z]) => [c * (x - P.center[0]) - s * (z - P.center[1]),
  s * (x - P.center[0]) + c * (z - P.center[1])]);
const supportBounds = {
  minU: Math.min(-15, ...localTerrace.map(p => p[0])), maxU: Math.max(15, ...localTerrace.map(p => p[0])),
  minV: Math.min(54, ...localTerrace.map(p => p[1])), maxV: Math.max(61.59, ...localTerrace.map(p => p[1])),
};

/** Small shared layout: x/z and sizes are local metres; bottoms sit on floorY. */
export const NNG_ROOM_WALLS_V217 = [
  { x: -19, z: 14, width: .18, depth: 12, height: 3.4 },
  { x: -15, z: 9, width: 8, depth: .18, height: 3.4 },
  { x: -15, z: 14, width: 8, depth: .18, height: 3.4 },
] as const;
export const NNG_MARBLE_PIERS_V217 = [
  { x: -9, z: 0, width: 1.8, depth: 3.6, height: 8.4 },
  { x: 9, z: 0, width: 1.8, depth: 3.6, height: 8.4 },
] as const;
const interiorBoxes = [...NNG_ROOM_WALLS_V217, ...NNG_MARBLE_PIERS_V217];
const columns = [-14.4, 14.4].flatMap(along => [-1, 1].flatMap(side => [[along, side * 28.8], [side * 28.8, along]]));

export function neueNationalgalerieWorldV217(x: number, y: number, z: number): [number, number, number] {
  return [P.center[0] + c * x + s * z, y, P.center[1] - s * x + c * z];
}
export function neueNationalgalerieLocalV217(x: number, z: number): [number, number] {
  const dx = x - P.center[0], dz = z - P.center[1];
  return [c * dx - s * dz, s * dx + c * dz];
}

/** Highest actual tread at this point, including the retained overlapping slabs. */
export function neueNationalgalerieStairYV217(x: number, z: number): number | null {
  if (Math.abs(x) > 15 || z < 54 || z > 61.59) return null;
  let top: number | null = null;
  for (let i = 0; i < 22; i++) {
    if (Math.abs(z - (61.26 - i * .33)) <= .33 + 1e-8) top = 5.41 + i * .21;
  }
  return top;
}

export function neueNationalgalerieGroundAtV217(x: number, z: number, feetY: number): number | null {
  // Never pull a visitor on/above the pavilion roof down through its canopy.
  if (!Number.isFinite(feetY) || feetY >= soffitY - .3) return null;
  const [u, v] = neueNationalgalerieLocalV217(x, z);
  const stair = neueNationalgalerieStairYV217(u, v);
  if (stair !== null && stair <= feetY + .52) return stair;
  return P.floorY <= feetY + .52 &&
    (pointInWorldRing(x, z, terraceRing) || nationalgalerieApronContainsV221(x, z)) ? P.floorY : null;
}

/** Opens only the eight replaced source owners above the represented terrace. */
export function neueNationalgalerieWalkableAtV217(x: number, y: number, z: number, sourceId?: string): boolean {
  if (!sourceId || !NATIONALGALERIE_V183_IDS.has(sourceId) || y < P.floorY - .05 || y >= soffitY - .3) return false;
  return pointInWorldRing(x, z, terraceRing);
}

export function neueNationalgalerieSolidAtV217(x: number, y: number, z: number, radius = 0): boolean {
  if (y < P.groundY - .05 || y >= soffitY) return false;
  if (nationalgalerieSculptureSolidAtV221(x, y, z, radius)) return true;
  const [u, v] = neueNationalgalerieLocalV217(x, z);
  if (y < P.floorY - .05) {
    if (nationalgalerieApronContainsV221(x, z)) return true;
    if (radius > 0) for (let i = 0; i < apronRing.length; i++) {
      const a = apronRing[i], b = apronRing[(i + 1) % apronRing.length];
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
      if ((x - a[0] - t * dx) ** 2 + (z - a[1] - t * dz) ** 2 < radius * radius) return true;
    }
    if (u < supportBounds.minU - radius || u > supportBounds.maxU + radius ||
        v < supportBounds.minV - radius || v > supportBounds.maxV + radius) return false;
    if (pointInWorldRing(x, z, terraceRing)) return true;
    // Match the source polygon, including its recessed corner, rather than a
    // rectangular museum envelope. Radius applies once at the capsule centre.
    if (radius > 0) for (let i = 0; i < terraceRing.length; i++) {
      const a = terraceRing[i], b = terraceRing[(i + 1) % terraceRing.length];
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
      if ((x - a[0] - t * dx) ** 2 + (z - a[1] - t * dz) ** 2 < radius * radius) return true;
    }
    if (Math.abs(u) < 15 + radius) for (let i = 0; i < 22; i++) {
      // The existing .52 m ground resolver allowance keeps adjoining .21 m
      // risers climbable while the higher supporting mass blocks side entry.
      if (Math.abs(v - (61.26 - i * .33)) < .33 + radius && y < 5.41 + i * .21 - .52) return true;
    }
    return false;
  }
  if (Math.abs(u) > 33 + radius || Math.abs(v) > 33 + radius) return false;
  const box = (bx: number, bz: number, w: number, d: number, h: number) =>
    y < P.floorY + h && Math.abs(u - bx) < w / 2 + radius && Math.abs(v - bz) < d / 2 + radius;
  // Retain the centered 5.4 m doors and the two 3.6 m east street entrances.
  for (const side of [-1, 1]) {
    const eastDoor = side === 1 && y < P.floorY + 3 &&
      (Math.abs(v - 7.2) + radius < 1.8 || Math.abs(v + 7.2) + radius < 1.8);
    if (box(side * 25.2, 0, .1, 50.4, P.columnHeight) && !eastDoor) return true;
    if (box(0, side * 25.2, 50.4, .1, P.columnHeight) &&
        (Math.abs(u) + radius >= 2.7 || y >= P.floorY + 3)) return true;
  }
  for (const b of interiorBoxes) {
    if (box(b.x, b.z, b.width, b.depth, b.height)) return true;
  }
  // Match the four tapered cross courses of all eight retained exterior columns.
  const course = Math.min(3, Math.max(0, Math.floor((y - P.floorY) / (P.columnHeight / 4))));
  const f = 1 - course * .1;
  for (const [bx, bz] of columns) {
    if (box(bx, bz, .25 * f, 1.05 * f, P.columnHeight) || box(bx, bz, 1.05 * f, .25 * f, P.columnHeight)) return true;
  }
  return false;
}

/** Ground resolution precedes interior support: retire only the obsolete source caps. */
export function configureNeueNationalgalerieObstaclesV217(index: PedestrianObstacleIndex | undefined): void {
  if (!index) return;
  for (const obstacles of index.cells.values()) for (const obstacle of obstacles) {
    if (obstacle.kind !== "polygon" || !obstacle.sourceId || !NATIONALGALERIE_V183_IDS.has(obstacle.sourceId)) continue;
    obstacle.maxY = obstacle.sourceId === "MSMgX8rD" ? P.floorY : soffitY + P.roofThickness;
  }
}
