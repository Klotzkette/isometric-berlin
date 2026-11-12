import { BoxGeometry, Group, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial } from "three";
import { GendarmenmarktFacadeBuilder } from "./GendarmenmarktFacadeBuilder";
import { POTSDAMER_DETAIL_PROFILE } from "./expandedCityProfiles";
import { markHbfMotionFrameV291, markHbfMovingMeshV291 } from "./HbfStationMotionV291";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import type { PedestrianEnvironment } from "./pedestrianNavigation";
import type { HbfBoxV291, HbfOpeningV291, HbfPlaneV291 } from "./HbfGeometryOpeningsV291";

const hall = POTSDAMER_DETAIL_PROFILE.stationEntranceHalls.halls[1];
const [centreX, centreZ] = hall.centerWorldM;
const c = Math.cos(hall.rotationY);
const s = Math.sin(hall.rotationY);
const streetY = hall.groundY;
const lowerY = hall.sourceGroundYM;
const start = -hall.footprintSizeM[1] / 2 + 1.8;
const end = start + 17;
const back = 10.75;
const halfWidth = 7.55;
const grid = .25;
const stepCount = 34;
const bankCentres = [-5, 5] as const;
const laneHalfWidth = .58;
const stationSourceId = "K0000BRX";
const railTone = 0x536166;
const floorTone = 0xb9b3a7;

type Rect = { minX: number; maxX: number; minZ: number; maxZ: number };
type Part = Rect & { bottom: number; top: number; color: number };
type Point = [number, number, number];

export const POTSDAMER_SOUTH_ACCESS_NAME = "Potsdamer Platz south pavilion public descent";
const footprint: Rect = { minX: -halfWidth, maxX: halfWidth, minZ: start, maxZ: back };

const point = (x: number, y: number, z: number): Point =>
  [centreX + x * c + z * s, y, centreZ - x * s + z * c];
const within = (r: Rect, x: number, z: number) =>
  x >= r.minX && x < r.maxX && z >= r.minZ && z < r.maxZ;
function local(x: number, z: number, native: boolean): [number, number] {
  const dx = (native ? (Math.floor(x / grid) + .5) * grid : x) - centreX;
  const dz = (native ? (Math.floor(z / grid) + .5) * grid : z) - centreZ;
  return [dx * c - dz * s, dx * s + dz * c];
}

const course = (index: number) => streetY + (lowerY - streetY) * index / stepCount;
const descent = (z: number) => Math.max(lowerY, streetY + (lowerY - streetY) * (z - start) / (end - start));
const bank = (x: number) => bankCentres.find(centre => Math.abs(centre - x) < 2.2);

function cardinalStrips(rect: Rect): Rect[] {
  const corners = [point(rect.minX, 0, rect.minZ), point(rect.maxX, 0, rect.minZ),
    point(rect.maxX, 0, rect.maxZ), point(rect.minX, 0, rect.maxZ)];
  const xs = corners.map(v => v[0]), zs = corners.map(v => v[2]);
  const strips: Rect[] = [];
  for (let z = Math.floor(Math.min(...zs) / grid); z < Math.ceil(Math.max(...zs) / grid); z++) {
    let first = Infinity, last = -Infinity;
    for (let x = Math.floor(Math.min(...xs) / grid); x < Math.ceil(Math.max(...xs) / grid); x++) {
      if (!within(rect, ...local((x + .5) * grid, (z + .5) * grid, false))) continue;
      first = Math.min(first, x);
      last = Math.max(last, x + 1);
    }
    if (first === Infinity) continue;
    const previous = strips.at(-1);
    if (previous?.minX === first * grid && previous.maxX === last * grid) previous.maxZ = (z + 1) * grid;
    else strips.push({ minX: first * grid, maxX: last * grid, minZ: z * grid, maxZ: (z + 1) * grid });
  }
  return strips;
}

const roofGuardHeight = 1.1;
const staticParts: Part[] = [
  { ...footprint, bottom: lowerY - .3, top: lowerY, color: floorTone },
];
function part(minX: number, maxX: number, minZ: number, maxZ: number, bottom: number, top: number, color: number): Part {
  return { minX, maxX, minZ, maxZ, bottom, top, color };
}
const pitWalls = [
  part(-halfWidth - .14, -halfWidth, start, back, lowerY, streetY, floorTone),
  part(halfWidth, halfWidth + .14, start, back, lowerY, streetY, floorTone),
  part(-halfWidth, halfWidth, back, back + .14, lowerY, streetY, floorTone),
  part(-halfWidth, halfWidth, start - .14, start, lowerY, streetY - .12, floorTone),
];
const perimeterGuards = [
  part(-halfWidth - .15, -halfWidth, start, back, streetY, streetY + roofGuardHeight, railTone),
  part(halfWidth, halfWidth + .15, start, back, streetY, streetY + roofGuardHeight, railTone),
  part(-halfWidth, halfWidth, back, back + .15, streetY, streetY + roofGuardHeight, railTone),
  part(-2.8, 2.8, start - .1, start + .06, streetY, streetY + roofGuardHeight, railTone),
  part(-halfWidth, -7.2, start - .1, start + .06, streetY, streetY + roofGuardHeight, railTone),
  part(7.2, halfWidth, start - .1, start + .06, streetY, streetY + roofGuardHeight, railTone),
];

const escalatorCentres = bankCentres.flatMap(centre => [centre - 1.42, centre + 1.42]);
const laneRailOffsets = [-2.2, -.84, .84, 2.2];
for (const centre of bankCentres) for (let i = 0; i < stepCount; i++) {
  const z = start + (end - start) * i / stepCount;
  const next = start + (end - start) * (i + 1) / stepCount;
  // Deep backing closes the riser beneath the actual load-bearing tread.
  staticParts.push(part(centre - 2.2, centre + 2.2, z, next,
    course(i + 1) - .13, course(i) - .12, railTone));
  staticParts.push(part(centre - .77, centre + .77, z, next,
    course(i) - .12, course(i), floorTone));
}

function opening(rect: Rect, native = false): HbfOpeningV291 {
  const corners = native
    ? [[rect.minX, 0, rect.minZ], [rect.maxX, 0, rect.maxZ]]
    : [point(rect.minX, 0, rect.minZ), point(rect.maxX, 0, rect.minZ),
        point(rect.maxX, 0, rect.maxZ), point(rect.minX, 0, rect.maxZ)];
  const xs = corners.map(p => p[0]), zs = corners.map(p => p[2]);
  const bounds: HbfBoxV291 = { min: [Math.min(...xs), lowerY - .4, Math.min(...zs)],
    max: [Math.max(...xs), streetY + .5, Math.max(...zs)] };
  const a = native ? 1 : c, b = native ? 0 : s;
  const ox = native ? 0 : centreX, oz = native ? 0 : centreZ;
  const planes: HbfPlaneV291[] = [
    [a, 0, -b, -a * ox + b * oz - rect.minX], [-a, 0, b, a * ox - b * oz + rect.maxX],
    [b, 0, a, -b * ox - a * oz - rect.minZ], [-b, 0, -a, b * ox + a * oz + rect.maxZ],
    [0, 1, 0, -bounds.min[1]], [0, -1, 0, bounds.max[1]],
  ];
  return { id: "potsdamer-south-pavilion", planes, bounds, ...(native ? { nativeBoxes: [bounds] } : {}) };
}
export function potsdamerSouthGroundOpenings(native: boolean): readonly HbfOpeningV291[] {
  return native ? cardinalStrips(footprint).map(rect => opening(rect, true)) : [opening(footprint)];
}

function addPart(builder: GendarmenmarktFacadeBuilder, row: Part, native: boolean): void {
  for (const rect of native ? cardinalStrips(row) : [row]) {
    const x = (rect.minX + rect.maxX) / 2, z = (rect.minZ + rect.maxZ) / 2;
    const y = (row.bottom + row.top) / 2;
    builder.box(native ? [x, y, z] : point(x, y, z),
      [rect.maxX - rect.minX, row.top - row.bottom, rect.maxZ - rect.minZ], row.color,
      native ? 0 : hall.rotationY);
  }
}

export function createPotsdamerSouthAccess(native: boolean): Group {
  const root = new Group();
  root.name = POTSDAMER_SOUTH_ACCESS_NAME;
  root.userData = { blockNative: native, keepInMinecraft: native, fullStaticDetailOnTouch: true };
  const builder = new GendarmenmarktFacadeBuilder(native);
  for (const row of [...staticParts, ...pitWalls]) addPart(builder, row, native);
  for (const guard of perimeterGuards) {
    const longX = guard.maxX - guard.minX > guard.maxZ - guard.minZ;
    const from = longX ? guard.minX : guard.minZ, to = longX ? guard.maxX : guard.maxZ;
    const count = Math.max(1, Math.ceil((to - from) / 1.25));
    for (const offset of [.22, 1.05]) addPart(builder, { ...guard,
      bottom: streetY + offset, top: streetY + offset + .05 }, native);
    for (let i = 0; i <= count; i++) {
      const axis = from + (to - from) * i / count;
      addPart(builder, { ...guard, ...(longX ? { minX: axis - .045, maxX: axis + .045 }
        : { minZ: axis - .045, maxZ: axis + .045 }) }, native);
    }
  }
  for (const centre of bankCentres) for (const dx of laneRailOffsets) {
    const x = centre + dx;
    if (native) {
      for (let i = 0; i < stepCount; i++) {
        const z = start + (end - start) * i / stepCount;
        const next = start + (end - start) * (i + 1) / stepCount;
        addPart(builder, part(x - .13, x + .13, z, next, course(i) + .83, course(i) + .98, railTone), true);
      }
    } else {
      builder.beam(point(x, streetY + .95, start), point(x, lowerY + .95, end), .11, railTone);
    }
    for (let i = 0; i <= 8; i++) {
      const z = start + (end - start) * i / 8, y = descent(z);
      addPart(builder, part(x - .13, x + .13, z - .13, z + .13, y - .08, y + .95, railTone), native);
    }
  }
  root.add(builder.finish("Potsdamer Platz stairs, retaining walls, landing and handrails"));
  const motion = new Group();
  motion.position.set(centreX, 0, centreZ);
  motion.name = "Potsdamer Platz south escalators";
  markHbfMotionFrameV291(motion, native);
  const caps = new BoxGeometry(laneHalfWidth * 2, .16, .49);
  if (!native) caps.rotateY(hall.rotationY);
  caps.deleteAttribute("uv");
  const day = new MeshBasicMaterial({ color: 0x818d91 });
  const night = new MeshStandardMaterial({ color: 0x818d91, roughness: .6 });
  const matrix = new Matrix4();
  for (const [i, lane] of escalatorCentres.entries()) {
    const steps = new InstancedMesh(caps, day, stepCount);
    const from = point(lane, streetY, start), to = point(lane, lowerY, end);
    for (const p of [from, to]) {
      p[0] -= centreX;
      p[2] -= centreZ;
    }
    for (let step = 0; step < stepCount; step++) {
      const t = step / stepCount;
      steps.setMatrixAt(step, matrix.makeTranslation(from[0] + (to[0] - from[0]) * t,
        course(step) - .08, from[2] + (to[2] - from[2]) * t));
    }
    steps.name = `Potsdamer Platz south moving escalator ${i + 1}`;
    steps.userData.dayMaterial = day;
    steps.userData.nightMaterial = night;
    steps.userData.blockNative = native;
    steps.userData.keepInMinecraft = native;
    steps.computeBoundingSphere();
    markHbfMovingMeshV291(steps, { kind: "escalator", from, to, direction: i % 2 === 0 ? -1 : 1 });
    motion.add(steps);
  }
  root.add(motion);
  return freezeStaticSceneTransforms(root);
}

export function potsdamerSouthFloorAt(x: number, z: number, native: boolean, hint?: number): number | null {
  const [px, pz] = local(x, z, native);
  if (!within(footprint, px, pz)) return null;
  const centre = bank(px);
  if (centre === undefined || pz >= end) return lowerY;
  const index = Math.min(stepCount - 1, Math.floor((pz - start) / ((end - start) / stepCount)));
  const treadY = Math.abs(px - centre) <= .77 ? course(index) : descent(pz);
  return hint !== undefined && hint < treadY - 1.35 ? lowerY : treadY;
}

function insidePart(row: Part, x: number, y: number, z: number, radius: number): boolean {
  return x >= row.minX - radius && x <= row.maxX + radius &&
    z >= row.minZ - radius && z <= row.maxZ + radius &&
    y >= row.bottom - .02 && y <= row.top + .02;
}

function stationSolidAt(x: number, y: number, z: number, radius: number, native: boolean): boolean {
  const [px, pz] = local(x, z, native);
  if (Math.abs(px) > 14 + radius || Math.abs(pz) > 14 + radius) return false;
  if (y >= streetY - radius && y <= hall.sourceRoofYM + radius) {
    const [width, depth] = hall.footprintSizeM;
    if (Math.abs(Math.abs(px) - (width / 2 - .22)) < .24 + radius && Math.abs(pz) <= depth / 2 + radius) return true;
    if (Math.abs(pz - (depth / 2 - .22)) < .24 + radius && Math.abs(px) <= width / 2 + radius) return true;
  }
  if (pitWalls.some(row => insidePart(row, px, y, pz, radius)) ||
      perimeterGuards.some(row => insidePart(row, px, y, pz, radius))) return true;
  const railBase = descent(pz);
  return pz >= start && pz < end && y >= railBase - .1 && y <= railBase + 1.06 + radius &&
    bankCentres.some(centre => laneRailOffsets.some(dx => Math.abs(px - centre - dx) <= .065 + radius));
}

/** Called after both ordinary environment constructors set their mode hooks. */
export function potsdamerSouthFlightAt(x: number, y: number, z: number): boolean {
  const [px, pz] = local(x, z, false);
  return y >= lowerY && y < hall.sourceRoofYM && Math.abs(px) <= 13 && Math.abs(pz) <= 14;
}

export function installPotsdamerSouthNavigation(
  environment: PedestrianEnvironment,
  active: () => boolean,
  native: () => boolean,
): void {
  const terrain = environment.groundAt;
  const floor = environment.interiorGroundAt;
  // Flight's terrain test must see the real floor of the cut, while walking
  // and the flight clearance plane still follow the selected tread height.
  environment.groundAt = (x, z) =>
    active() && within(footprint, ...local(x, z, native())) ? lowerY : terrain(x, z);
  const interior = environment.walkableInteriorAt;
  const solid = environment.interiorSolidAt;
  environment.interiorGroundAt = (x, z, hint) =>
    (active() ? potsdamerSouthFloorAt(x, z, native(), hint) : null) ?? floor?.(x, z, hint) ?? null;
  environment.walkableInteriorAt = (x, y, z, id) => {
    if (active() && id === stationSourceId && y >= lowerY - .02 && y < hall.sourceRoofYM - .12) {
      const [px, pz] = local(x, z, false);
      if (Math.abs(px) <= 14.5 && Math.abs(pz) <= 14.5) return true;
    }
    return interior?.(x, y, z, id) ?? false;
  };
  environment.interiorSolidAt = (x, y, z, radius = 0) =>
    active() && stationSolidAt(x, y, z, radius, native()) || solid?.(x, y, z, radius) || false;
}
