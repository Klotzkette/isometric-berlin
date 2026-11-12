import { BoxGeometry, Group, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial } from "three";
import { GendarmenmarktFacadeBuilder } from "./GendarmenmarktFacadeBuilder";
import { letteringStrokePaths } from "./drawnLettering";
import type { HbfBoxV291, HbfOpeningV291, HbfPlaneV291 } from "./HbfGeometryOpeningsV291";
import { markHbfMotionFrameV291, markHbfMovingMeshV291 } from "./HbfStationMotionV291";
import type { PedestrianEnvironment } from "./pedestrianNavigation";
import { createPotsdamerSBahn, installPotsdamerSBahnNavigation, potsdamerSBahnFlightAt,
  potsdamerSBahnOpenings, POTSDAMER_MEZZANINE_Y } from "./PotsdamerSBahn";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type XZ = readonly [number, number];
type Point = [number, number, number];
type Rect = { minX: number; maxX: number; minZ: number; maxZ: number };
type Segment = {
  a: XZ; b: XZ; bottom: number; top: number; width: number; count: number; source: number;
};
type Part = { area: Rect; bottom: number; top: number; color: number };

export const POTSDAMER_PASSARELLE_NAME = "Potsdamer Platz — Mittelpassarelle Leipziger Platz";
export const POTSDAMER_PASSARELLE_Y = POTSDAMER_MEZZANINE_Y;

const streetY = 5.4;
const lowerY = POTSDAMER_PASSARELLE_Y;
const roofY = 3.45;
const stone = 0xb7b1a4, terrazzo = 0xbeb9ae, steel = 0x5e686d, darkSteel = 0x495357;
const northStair = [361.34, 1029.88] as const;
const northMid = [366.30, 1029.44] as const;
const northMidTop = [367.51, 1029.33] as const;
const southStair = [363.31, 1065.75] as const;
const southMid = [369.25, 1065.29] as const;
const southMidTop = [371.05, 1065.14] as const;
const northRise = (streetY - lowerY) / 33;
const southRise = (streetY - lowerY) / 26;

// OSM ways in the 29 September 2026 Berlin extract. Coordinates are projected
// to the world frame and rounded to centimetres. Runs and counts follow OSM.
const fixed: readonly Segment[] = [
  { a: northStair, b: northMid, bottom: lowerY, top: lowerY + northRise * 16, width: 1.85, count: 16, source: 237695510 },
  { a: northMid, b: northMidTop, bottom: lowerY + northRise * 16, top: lowerY + northRise * 17, width: 1.85, count: 1, source: 241577207 },
  { a: northMidTop, b: [371.66, 1028.97], bottom: lowerY + northRise * 17, top: streetY, width: 1.85, count: 16, source: 241577208 },
  { a: southStair, b: southMid, bottom: lowerY, top: lowerY + southRise * 13, width: 1.85, count: 13, source: 237695511 },
  { a: southMid, b: southMidTop, bottom: lowerY + southRise * 13, top: lowerY + southRise * 13, width: 1.85, count: 1, source: 241577206 },
  { a: southMidTop, b: [374.57, 1064.87], bottom: lowerY + southRise * 13, top: streetY, width: 1.85, count: 13, source: 241577209 },
];
const escalators: readonly Segment[] = [
  { a: [361.24, 1032.67], b: [371.98, 1031.90], bottom: lowerY, top: streetY, width: 1.32, count: 33, source: 237695526 },
  { a: [363.11, 1062.71], b: [374.12, 1062.00], bottom: lowerY, top: streetY, width: 1.32, count: 33, source: 237695516 },
];
const segments = [...fixed, ...escalators].map(s => {
  const dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1], length = Math.hypot(dx, dz);
  return { ...s, length, ux: dx / length, uz: dz / length, yaw: -Math.atan2(dz, dx) };
});
type Flight = typeof segments[number];

const gallery = { minX: 344.9, maxX: 358.7, minZ: 1025.7, maxZ: 1063.85 };
// Public circulation from OSM 464904220/464904221, 464904510/464904512,
// 237751557/237751573 and corridor 464904400. The west partition bounds
// this modeled portion of the passage at the next, deeper access groups.
const rooms: readonly Rect[] = [
  gallery,
  { minX: 358.7, maxX: 361.56, minZ: 1028.60, maxZ: 1033.58 },
  { minX: 358.7, maxX: 363.56, minZ: 1061.40, maxZ: 1066.82 },
];
const grid = .125;
const part = (minX: number, maxX: number, minZ: number, maxZ: number,
  bottom: number, top: number, color = stone): Part =>
  ({ area: { minX, maxX, minZ, maxZ }, bottom, top, color });
const northGate = rooms[1], southGate = rooms[2];
// OSM 464904448, 464904452 and 464904453 are three column footprints
// at the east side of the concourse. The small orthogonal fit is illustrative.
const columns = [
  part(351.84, 352.51, 1034.12, 1034.79, lowerY, roofY, 0xc4beb0),
  part(351.34, 352.02, 1040.55, 1041.21, lowerY, roofY, 0xc4beb0),
  part(351.73, 352.40, 1027.76, 1028.44, lowerY, roofY, 0xc4beb0),
];
const walls: Part[] = [
  part(gallery.minX - .22, gallery.minX, gallery.minZ, 1030, lowerY, roofY),
  part(gallery.minX - .22, gallery.minX, 1032.2, 1040.8, lowerY, roofY),
  part(gallery.minX - .22, gallery.minX, 1058.6, gallery.maxZ, lowerY, roofY),
  part(gallery.minX - .22, gallery.maxX, gallery.minZ - .22, gallery.minZ, lowerY, roofY),
  part(gallery.minX - .22, gallery.maxX, gallery.maxZ, gallery.maxZ + .22, lowerY, roofY),
  part(gallery.maxX, gallery.maxX + .22, gallery.minZ, northGate.minZ, lowerY, roofY),
  part(gallery.maxX, gallery.maxX + .22, northGate.maxZ, southGate.minZ, lowerY, roofY),
  part(gallery.maxX - .22, gallery.maxX, gallery.maxZ, southGate.maxZ, lowerY, roofY),
  ...columns,
  ...[northGate, southGate].flatMap(({ minX, maxX, minZ, maxZ }) => [
    part(minX, maxX, minZ - .14, minZ, lowerY, roofY),
    part(minX, maxX, maxZ, maxZ + .14, lowerY, roofY),
  ]),
];
const roomsContain = (x: number, z: number) => rooms.some(r => within(r, x, z));
const within = ({ minX, maxX, minZ, maxZ }: Rect, x: number, z: number, margin = 0) =>
  x >= minX - margin && x <= maxX + margin && z >= minZ - margin && z <= maxZ + margin;
const near = (x: number, z: number) => x > 344 && x < 376 && z > 1024 && z < 1068;

function frameAt(f: Flight, along: number, offset: number, y: number): Point {
  return [f.a[0] + f.ux * along - f.uz * offset, y, f.a[1] + f.uz * along + f.ux * offset];
}
function frameFrom(f: Flight, x: number, z: number): [along: number, lateral: number] {
  const dx = x - f.a[0], dz = z - f.a[1];
  return [dx * f.ux + dz * f.uz, dz * f.ux - dx * f.uz];
}
function flightBounds(f: Flight, start: number, end: number, half: number): Rect {
  const corners = [frameAt(f, start, -half, 0), frameAt(f, start, half, 0),
    frameAt(f, end, -half, 0), frameAt(f, end, half, 0)];
  return { minX: Math.min(...corners.map(p => p[0])), maxX: Math.max(...corners.map(p => p[0])),
    minZ: Math.min(...corners.map(p => p[2])), maxZ: Math.max(...corners.map(p => p[2])) };
}
function cardinalFlight(f: Flight, start: number, end: number, half: number, offset = 0): Rect[] {
  const bounds = flightBounds(f, start, end, half + Math.abs(offset));
  const rows: Rect[] = [];
  for (let i = Math.floor(bounds.minX / grid); i < Math.ceil(bounds.maxX / grid); i++) {
    let minZ = Infinity, maxZ = -Infinity;
    for (let j = Math.floor(bounds.minZ / grid); j < Math.ceil(bounds.maxZ / grid); j++) {
      const [s, v] = frameFrom(f, (i + .5) * grid, (j + .5) * grid);
      if (s >= start && s < end && Math.abs(v - offset) <= half) {
        minZ = Math.min(minZ, j * grid); maxZ = Math.max(maxZ, (j + 1) * grid);
      }
    }
    if (minZ === Infinity) continue;
    const previous = rows.at(-1);
    if (previous?.minZ === minZ && previous.maxZ === maxZ) previous.maxX = (i + 1) * grid;
    else rows.push({ minX: i * grid, maxX: (i + 1) * grid, minZ, maxZ });
  }
  return rows;
}

function yPlanes(bottom: number, top: number): HbfPlaneV291[] {
  return [[0, 1, 0, -bottom], [0, -1, 0, top]];
}
function box({ minX, maxX, minZ, maxZ }: Rect, bottom: number, top: number): HbfBoxV291 {
  return { min: [minX, bottom, minZ], max: [maxX, top, maxZ] };
}
function flatCut(id: string, r: Rect, bottom: number, top: number, native: boolean): HbfOpeningV291 {
  const bounds = box(r, bottom, top);
  return { id, bounds, ...(native ? { nativeBoxes: [bounds] } : {}),
    planes: [[1, 0, 0, -r.minX], [-1, 0, 0, r.maxX], [0, 0, 1, -r.minZ], [0, 0, -1, r.maxZ], ...yPlanes(bottom, top)] };
}
function smoothStairCut(f: Flight, half: number): HbfOpeningV291 {
  const { ux, uz, a, b, source } = f;
  return { id: String(source), bounds: box(flightBounds(f, 0, f.length, half), lowerY, streetY + 1),
    planes: [[ux, 0, uz, -ux * a[0] - uz * a[1]], [-ux, 0, -uz, ux * b[0] + uz * b[1]],
      [-uz, 0, ux, half + uz * a[0] - ux * a[1]], [uz, 0, -ux, half - uz * a[0] + ux * a[1]],
      ...yPlanes(lowerY, streetY + 1)] };
}
const cutWidth = (f: Flight) => f.width / 2 + .12;
function groundOpenings(native: boolean): readonly HbfOpeningV291[] {
  const hall = rooms.map((r, i) => flatCut(`passarelle-hall-${i}`, r, lowerY, roofY, native));
  return [...hall, ...potsdamerSBahnOpenings(native), ...segments.flatMap(f => native
    ? cardinalFlight(f, 0, f.length, cutWidth(f)).map(r => flatCut(String(f.source), r, lowerY, streetY + 1, true))
    : [smoothStairCut(f, cutWidth(f))])];
}
const drawnOpenings = groundOpenings(false), nativeOpenings = groundOpenings(true);
export function potsdamerPassarelleGroundOpenings(native: boolean): readonly HbfOpeningV291[] {
  return native ? nativeOpenings : drawnOpenings;
}

function paintRect(builder: GendarmenmarktFacadeBuilder, r: Rect, bottom: number, top: number, color: number) {
  builder.box([(r.minX + r.maxX) / 2, (bottom + top) / 2, (r.minZ + r.maxZ) / 2],
    [r.maxX - r.minX, top - bottom, r.maxZ - r.minZ], color);
}
function paintFlight(builder: GendarmenmarktFacadeBuilder, f: Flight, start: number, end: number,
  width: number, offset: number, bottom: number, top: number, color: number) {
  if (builder.minecraft) {
    for (const r of cardinalFlight(f, start, end, width / 2, offset)) paintRect(builder, r, bottom, top, color);
  } else {
    builder.box(frameAt(f, (start + end) / 2, offset, (bottom + top) / 2),
      [end - start, top - bottom, width], color, f.yaw);
  }
}

function stairY(f: Flight, course: number): number {
  return f.bottom + (f.top - f.bottom) * course / f.count;
}
function drawFlight(builder: GendarmenmarktFacadeBuilder, f: Flight, moving: boolean): void {
  const run = f.length / f.count;
  const half = f.width / 2;
  for (let i = 0; i < f.count; i++) {
    const top = stairY(f, i + 1);
    paintFlight(builder, f, i * run, (i + 1) * run, f.width, 0,
      top - (moving ? .34 : .25), top - (moving ? .17 : 0), moving ? darkSteel : terrazzo);
  }
  for (const side of [-1, 1]) {
    const offset = side * (half + .09);
    paintFlight(builder, f, 0, f.length, .17, offset, lowerY - .06, streetY + .12, stone);
    paintFlight(builder, f, 0, f.length, .14, offset, streetY + .98, streetY + 1.07, steel);
    for (let i = 0; i <= Math.ceil(f.length / 1.2); i++) {
      const at = f.length * i / Math.ceil(f.length / 1.2);
      paintFlight(builder, f, at - .075, at + .075, .15, offset, streetY + .1, streetY + 1.03, steel);
    }
    if (!builder.minecraft) builder.beam(frameAt(f, 0, side * half, f.bottom + .9),
      frameAt(f, f.length, side * half, f.top + .9), .10, steel);
    else for (let i = 0; i < f.count; i++) {
      const y = stairY(f, i + 1) + .9;
      paintFlight(builder, f, i * run, (i + 1) * run, .17, side * half, y - .065, y + .065, steel);
    }
  }
}

function movingEscalator(f: Flight, native: boolean): Group {
  const root = new Group();
  root.name = `Potsdamer Platz moving escalator — OSM ${f.source}`;
  root.position.set(f.a[0], 0, f.a[1]);
  markHbfMotionFrameV291(root, native);
  const run = f.length / f.count;
  const caps = new BoxGeometry(native ? run + Math.abs(f.uz) * f.width : run + .005, .16, f.width);
  if (!native) caps.rotateY(f.yaw);
  caps.deleteAttribute("uv");
  const day = new MeshBasicMaterial({ color: 0x7a878b });
  const night = new MeshStandardMaterial({ color: 0x7a878b, roughness: .55 });
  const steps = new InstancedMesh(caps, day, f.count);
  const matrix = new Matrix4();
  const from: Point = [0, f.bottom, 0], to: Point = [f.b[0] - f.a[0], f.top, f.b[1] - f.a[1]];
  for (let i = 0; i < f.count; i++) {
    const t = i / f.count;
    steps.setMatrixAt(i, matrix.makeTranslation(to[0] * t, stairY(f, i) - .08, to[2] * t));
  }
  steps.userData = { dayMaterial: day, nightMaterial: night, blockNative: native, keepInMinecraft: native };
  steps.computeBoundingSphere();
  markHbfMovingMeshV291(steps, { kind: "escalator", from, to, direction: 1 });
  root.add(steps);
  return root;
}

export function createPotsdamerPassarelle(native: boolean, westDock = false): Group {
  const root = new Group();
  root.name = POTSDAMER_PASSARELLE_NAME;
  root.userData = { blockNative: native, keepInMinecraft: native, fullStaticDetailOnTouch: true,
    sourceWays: [...segments.map(s => s.source), 464904220, 464904221, 464904400, 464904510,
      464904512, 237751557, 237751573, 464904448, 464904452, 464904453] };
  const builder = new GendarmenmarktFacadeBuilder(native);
  // The eastern branch of the documented 13/14 stair reaches this existing
  // gallery. Remove only its bounded floor aperture from the old east slab.
  const eastStairHole = { minX: gallery.minX, maxX: 347.14, minZ: 1030, maxZ: 1032.2 };
  for (const r of [northGate, southGate, { ...gallery, maxZ: eastStairHole.minZ },
      { ...gallery, minZ: eastStairHole.maxZ },
      { ...eastStairHole, minX: eastStairHole.maxX, maxX: gallery.maxX }]) {
    paintRect(builder, r, lowerY - .26, lowerY, terrazzo);
  }
  for (const row of walls) paintRect(builder, row.area, row.bottom, row.top, row.color);
  for (let z = gallery.minZ + 3; z < gallery.maxZ - 1; z += 5.4) {
    builder.box([351.7, roofY - .09, z], [3.7, .18, .30], 0xf4ebd7);
    builder.box([351.7, roofY - .035, z], [3.95, .07, .45], darkSteel);
    if (z > 1034.9 && z < 1038.0) {
      builder.box([345.02, lowerY + .11, z], [.22, .22, 5.4], 0x898780);
      builder.box([344.93, lowerY + 1.07, z], [.055, .035, 5.39], 0xa39c8f);
      builder.box([344.93, lowerY + 1.95, z], [.055, 1.72, .035], 0xa39c8f);
    }
  }
  const architrave = { startXZ: [345, 1032.5], endXZ: [345, 1041], outwardSide: -1,
    wallBaseY: lowerY, wallTopY: roofY, street: "Leipziger Platz", prismId: "Mittelpassarelle" };
  if (!native) builder.sign(architrave, "MITTELPASSARELLE", 4.25, lowerY + 2.2, .27, 4.7,
    0xf1eee5, 0x273f50, .05);
  else {
    builder.box([345.05, lowerY + 2.33, 1036.75], [.10, .62, 4.7], 0x273f50);
    for (const path of letteringStrokePaths("MITTELPASSARELLE", .27)) {
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1], b = path[i];
        const count = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / .027);
        for (let j = 0; j <= count; j++) {
          const t = j / Math.max(1, count);
          builder.box([345.12, lowerY + 2.2 + a[1] + (b[1] - a[1]) * t,
            1036.75 - a[0] - (b[0] - a[0]) * t], [.035, .034, .034], 0xf1eee5);
        }
      }
    }
  }
  for (const [i, f] of segments.entries()) {
    const moving = i >= fixed.length;
    drawFlight(builder, f, moving);
    if (moving) root.add(movingEscalator(f, native));
  }
  root.add(builder.finish("Passage floor, lining, stair flights, steel guards and luminaires"), createPotsdamerSBahn(native, westDock));
  return freezeStaticSceneTransforms(root);
}

function supportedFlight(x: number, z: number, native: boolean) {
  if (native) {
    x = (Math.floor(x / grid) + .5) * grid;
    z = (Math.floor(z / grid) + .5) * grid;
  }
  for (const f of segments) {
    const [s, v] = frameFrom(f, x, z);
    if (s >= 0 && s <= f.length && Math.abs(v) < f.width / 2) return { f, s };
  }
  return null;
}
export function potsdamerPassarelleFloorAt(x: number, z: number, native: boolean, hint?: number): number | null {
  if (!near(x, z)) return null;
  const stair = supportedFlight(x, z, native);
  if (stair) {
    const { f, s } = stair;
    return stairY(f, Math.min(f.count, Math.floor(s * f.count / f.length) + 1));
  }
  return (hint === undefined || hint < roofY) && roomsContain(x, z) ? lowerY : null;
}

function solidAt(x: number, y: number, z: number, radius: number, native: boolean): boolean {
  if (!near(x, z) || y < lowerY - .3 || y > streetY + 1.2 + radius) return false;
  if (walls.some(w => y >= w.bottom - radius && y <= w.top + radius && within(w.area, x, z, radius))) return true;
  const stair = supportedFlight(x, z, native);
  if (stair) {
    const { f, s } = stair;
    const treadY = stairY(f, Math.min(f.count, Math.floor(s * f.count / f.length) + 1));
    if (y < treadY - .02) return true;
  } else if (roomsContain(x, z) && y + radius > roofY && y - radius < streetY - .09) return true;
  for (const f of segments) {
    const [s, v] = frameFrom(f, x, z);
    if (s >= -radius && s <= f.length + radius &&
        Math.abs(Math.abs(v) - (f.width / 2 + .09)) <= .09 + radius) return true;
  }
  return false;
}

export function potsdamerPassarelleFlightAt(x: number, y: number, z: number): boolean {
  return potsdamerSBahnFlightAt(x, y, z) || near(x, z) && y >= lowerY && (Boolean(supportedFlight(x, z, false)) ||
    (y < roofY && roomsContain(x, z))) && y < streetY + 2;
}

export function installPotsdamerPassarelleNavigation(environment: PedestrianEnvironment,
  active: () => boolean, native: () => boolean, westDock: () => boolean = () => false): void {
  const originalGround = environment.groundAt;
  const originalFloor = environment.interiorGroundAt;
  const originalSolid = environment.interiorSolidAt;
  environment.groundAt = (x, z) => near(x, z) && active() &&
    (roomsContain(x, z) || supportedFlight(x, z, native())) ? lowerY : originalGround(x, z);
  environment.interiorGroundAt = (x, z, hint) => (near(x, z) && active()
    ? potsdamerPassarelleFloorAt(x, z, native(), hint) : null) ?? originalFloor?.(x, z, hint) ?? null;
  environment.interiorSolidAt = (x, y, z, radius = 0) =>
    (near(x, z) && active() && solidAt(x, y, z, radius, native())) || originalSolid?.(x, y, z, radius) || false;
  installPotsdamerSBahnNavigation(environment, active, westDock);
}
