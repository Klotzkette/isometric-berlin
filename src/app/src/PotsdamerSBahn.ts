import { BoxGeometry, ExtrudeGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Shape, Sphere, Vector3 } from "three";
import { GendarmenmarktFacadeBuilder } from "./GendarmenmarktFacadeBuilder";
import type { HbfOpeningV291 } from "./HbfGeometryOpeningsV291";
import { markHbfMotionFrameV291, markHbfMovingMeshV291 } from "./HbfStationMotionV291";
import type { PedestrianEnvironment } from "./pedestrianNavigation";
import { potsdamerSBahnPlan as plan, potsdamerSBahnRings, potsdamerSBahnTrackSegments, type PotsdamerPlanPoint as XZ } from "./potsdamerSBahnSource";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type Rect = { west: number; east: number; north: number; south: number };
type Flight = { id: number; a: XZ; b: XZ; low: number; high: number; count: number; width: number; motion?: 1 | -1 };
type Point = [number, number, number];

export const POTSDAMER_MEZZANINE_Y = -.518;
export const POTSDAMER_SBAHN_Y = POTSDAMER_MEZZANINE_Y - 4.5;
const middleY = POTSDAMER_MEZZANINE_Y - 1.98;
const topY = POTSDAMER_MEZZANINE_Y;
const bottomY = POTSDAMER_SBAHN_Y;
const railY = bottomY - .96;
const ceilingY = 3.45;
const lowerCeilingY = topY - .44;
const glass = 0xe0e0d5;
const terrazzo = 0xb9b4a6;
const steel = 0x59676c;
const wall = 0xb4b0a6;

const upper = { west: 309.8, east: 344.9, north: 1024.6, south: 1058.6 };
const northBranch = { west: 331.1, east: 344.9, north: 1019.6, south: 1024.6 };
const upperSpaces = [upper, northBranch];
const lowerLandings = [
  { west: 316.42, east: 321.40, north: 1033.72, south: 1039.65 },
  { west: 337.78, east: 342.76, north: 1028.00, south: 1033.85 },
];
const eyes = [
  { west: 312.04, east: 325.76, north: 1032.62, south: 1040.75 },
  { west: 333.42, east: 347.14, north: 1026.82, south: 1035.00 },
];
const fixed = (id: number, a: XZ, b: XZ, low: number, high: number, count: number): Flight =>
  ({ id, a, b, low, high, count, width: 1.95 });
const moving = (id: number, a: XZ, b: XZ, motion: -1 | 1): Flight =>
  ({ id, a, b, low: bottomY, high: topY, count: 26, width: 1.32, motion });
const flights = [
  fixed(237526544, [319.12, 1029.59], [318.99, 1033.78], bottomY, middleY, 14),
  fixed(237526526, [318.70, 1043.78], [318.82, 1039.58], bottomY, middleY, 14),
  fixed(237526553, [316.50, 1036.61], [312.04, 1036.50], middleY, topY, 11),
  fixed(237526536, [321.31, 1036.75], [325.76, 1036.93], middleY, topY, 11),
  fixed(237526549, [340.50, 1023.87], [340.37, 1028.08], bottomY, middleY, 14),
  fixed(237526543, [340.04, 1037.96], [340.17, 1033.77], bottomY, middleY, 14),
  fixed(237526524, [337.88, 1030.85], [333.42, 1030.72], middleY, topY, 11),
  fixed(237526539, [342.68, 1031.00], [347.14, 1031.13], middleY, topY, 11),
  moving(237751555, [319.50, 1018.46], [319.23, 1027.45], 1),
  moving(237526547, [318.19, 1055.55], [318.46, 1046.57], 1),
  moving(237526519, [340.40, 1012.09], [340.12, 1021.07], -1),
  moving(237526533, [339.60, 1051.76], [339.87, 1042.78], 1),
].map(f => {
  const dx = f.b[0] - f.a[0], dz = f.b[1] - f.a[1], len = Math.hypot(dx, dz);
  return { ...f, ux: dx / len, uz: dz / len, len, yaw: -Math.atan2(dz, dx) };
});
type Run = typeof flights[number];

function offset(f: Run, distance: number, side: number, y: number): Point {
  return [f.a[0] + f.ux * distance - f.uz * side, y, f.a[1] + f.uz * distance + f.ux * side];
}
function local(f: Run, x: number, z: number): [number, number] {
  const dx = x - f.a[0], dz = z - f.a[1];
  return [f.ux * dx + f.uz * dz, f.ux * dz - f.uz * dx];
}
const inside = (r: Rect, x: number, z: number, margin = 0) =>
  x >= r.west - margin && x <= r.east + margin && z >= r.north - margin && z <= r.south + margin;
function flightEye(f: Run): Rect {
  const corners = [offset(f, 0, -f.width / 2 - .12, 0), offset(f, 0, f.width / 2 + .12, 0),
    offset(f, f.len, -f.width / 2 - .12, 0), offset(f, f.len, f.width / 2 + .12, 0)];
  const xs = corners.map(p => p[0]), zs = corners.map(p => p[2]);
  return { west: Math.min(...xs), east: Math.max(...xs), north: Math.min(...zs), south: Math.max(...zs) };
}
const upperHoles = [...eyes, ...flights.filter(f => f.motion).map(flightEye)];
const lowerHoles = [...upperHoles, ...flights.filter(f => !f.motion && f.low === bottomY).map(flightEye)];
const upperOpen = (x: number, z: number) => upperSpaces.some(r => inside(r, x, z)) &&
  !upperHoles.some(r => inside(r, x, z));
const near = (x: number, z: number) => x > 305 && x < 357 && z > 927 && z < 1101;

type Platform = { tracks: readonly [number, number]; ring: readonly XZ[]; north: number; south: number;
  edges: readonly [readonly XZ[], readonly XZ[]]; columns: readonly Rect[] };
function polygonBounds(ring: readonly XZ[]): Rect {
  const xs = ring.map(([x]) => x), zs = ring.map(([, z]) => z);
  return { west: Math.min(...xs), east: Math.max(...xs), north: Math.min(...zs), south: Math.max(...zs) };
}
function platform(tracks: readonly [number, number], edges: Platform["edges"],
  [ring, ...obstructions]: readonly (readonly XZ[])[]): Platform {
  const { north, south } = polygonBounds(ring);
  return { tracks, ring, north, south, edges, columns: obstructions.map(polygonBounds) };
}
const platforms = [
  platform([11, 12], [plan[859920451], plan[237250953]], potsdamerSBahnRings[3200537]),
  platform([13, 14], [plan[859920454], plan[237250952]], potsdamerSBahnRings[3198309]),
];
const lowerStation = { west: 308.9, east: 355.1, north: platforms[0].north, south: platforms[0].south };

function spanAt(p: Platform, z: number): [number, number] | null {
  if (z < p.north || z >= p.south) return null;
  let west = Infinity, east = -Infinity;
  for (let i = 0, j = p.ring.length - 1; i < p.ring.length; j = i++) {
    const a = p.ring[j], b = p.ring[i];
    if ((a[1] > z) === (b[1] > z)) continue;
    const x = a[0] + (z - a[1]) / (b[1] - a[1]) * (b[0] - a[0]);
    west = Math.min(west, x); east = Math.max(east, x);
  }
  return east > west ? [west, east] : null;
}
function platformAt(x: number, z: number, border = 0): boolean {
  return platforms.some(p => {
    const span = spanAt(p, z);
    return span !== null && x >= span[0] - border && x <= span[1] + border;
  });
}

function cut(r: Rect, id: string, native: boolean): HbfOpeningV291 {
  const bounds = { min: [r.west, topY, r.north], max: [r.east, ceilingY, r.south] } as const;
  return { id, bounds, ...(native ? { nativeBoxes: [bounds] } : {}),
    planes: [[1, 0, 0, -r.west], [-1, 0, 0, r.east], [0, 0, 1, -r.north], [0, 0, -1, r.south],
      [0, 1, 0, -topY], [0, -1, 0, ceilingY]] };
}
export function potsdamerSBahnOpenings(native: boolean): readonly HbfOpeningV291[] {
  return upperSpaces.map((r, index) => cut(r, `potsdamer-sbahn-concourse-${index}`, native));
}
function rect(builder: GendarmenmarktFacadeBuilder, r: Rect, low: number, high: number, color: number): void {
  if (r.east <= r.west || r.south <= r.north) return;
  builder.box([(r.east + r.west) / 2, (low + high) / 2, (r.south + r.north) / 2],
    [r.east - r.west, high - low, r.south - r.north], color);
}

function clippedFloor(r: Rect, holes: readonly Rect[]): Rect[] {
  const xs = [...new Set([r.west, r.east, ...holes.flatMap(h => [h.west, h.east])
    .filter(x => x > r.west && x < r.east)])].sort((a, b) => a - b);
  const zs = [...new Set([r.north, r.south, ...holes.flatMap(h => [h.north, h.south])
    .filter(z => z > r.north && z < r.south)])].sort((a, b) => a - b);
  return zs.slice(1).flatMap((south, j) => xs.slice(1).flatMap((east, i) => {
    const west = xs[i], north = zs[j];
    return holes.some(h => inside(h, (west + east) / 2, (north + south) / 2))
      ? [] : [{ west, east, north, south }];
  }));
}

function alignedBox(builder: GendarmenmarktFacadeBuilder, a: Point, b: Point, width: number, height: number, color: number): void {
  const dx = b[0] - a[0], dz = b[2] - a[2], length = Math.hypot(dx, dz);
  if (length < 1e-5) return;
  if (builder.minecraft) {
    const n = Math.max(1, Math.ceil(Math.min(Math.abs(dx), Math.abs(dz)) / .19));
    for (let j = 0; j < n; j++) {
      const t = (j + .5) / n;
      builder.box([a[0] + dx * t, a[1] + (b[1] - a[1]) * t, a[2] + dz * t],
        [Math.abs(dx) / n + width * Math.abs(dz) / length, height,
          Math.abs(dz) / n + width * Math.abs(dx) / length], color);
    }
  } else {
    builder.box([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
      [length, height, width], color, -Math.atan2(dz, dx));
  }
}

function stairHeight(f: Run, t: number): number {
  if (f.motion) return f.low + (f.high - f.low) * t;
  const index = Math.min(f.count, Math.max(1, Math.floor(t * f.count) + 1));
  return f.low + (f.high - f.low) * index / f.count;
}

function drawFlight(builder: GendarmenmarktFacadeBuilder, f: Run): void {
  const tread = f.len / f.count;
  for (let i = 0; i < f.count; i++) {
    const y = stairHeight(f, (i + .5) / f.count) - (f.motion ? .24 : .11);
    alignedBox(builder, offset(f, i * tread, 0, y), offset(f, (i + 1) * tread, 0, y),
      f.width, .22, f.motion ? steel : terrazzo);
    if (f.motion) continue;
    const edge = (i + .91) * tread;
    alignedBox(builder, offset(f, edge, 0, y + .112),
      offset(f, edge + tread * .085, 0, y + .112), f.width, .006, 0xe2d9c4);
  }
  for (const side of [-1, 1]) {
    const lateral = side * (f.width / 2 + .06);
    if (builder.minecraft) {
      for (let i = 0; i < f.count; i++) {
        const y = stairHeight(f, (i + .5) / f.count) + .92;
        alignedBox(builder, offset(f, i * tread, lateral, y), offset(f, (i + 1) * tread, lateral, y), .12, .10, steel);
      }
    } else {
      builder.beam(offset(f, 0, lateral, f.low + .92), offset(f, f.len, lateral, f.high + .92), .095, steel);
    }
    const posts = Math.ceil(f.len / 1.1);
    for (let i = 0; i <= posts; i++) {
      const t = i / posts;
      builder.box(offset(f, f.len * t, lateral, stairHeight(f, t) + .42), [.09, .98, .09], steel);
    }
  }
}

function animatedSteps(f: Run, native: boolean): Group {
  const root = new Group();
  root.name = `Potsdamer Platz S-Bahn moving escalator ${f.id}`;
  root.position.set(f.a[0], 0, f.a[1]);
  markHbfMotionFrameV291(root, native);
  const tread = f.len / f.count;
  const geometry = new BoxGeometry(native ? tread + Math.abs(f.uz) * f.width : tread + .005, .16, f.width);
  if (!native) geometry.rotateY(f.yaw);
  geometry.deleteAttribute("uv");
  const day = new MeshBasicMaterial({ color: 0x8d979b });
  const night = new MeshStandardMaterial({ color: 0x8d979b, roughness: .55 });
  const steps = new InstancedMesh(geometry, day, f.count);
  const from: Point = [0, f.low, 0], to: Point = [f.b[0] - f.a[0], f.high, f.b[1] - f.a[1]];
  const matrix = new Matrix4();
  for (let i = 0; i < f.count; i++) {
    const t = i / f.count;
    steps.setMatrixAt(i, matrix.makeTranslation(to[0] * t, stairHeight(f, t) - .08, to[2] * t));
  }
  steps.userData = { dayMaterial: day, nightMaterial: night, blockNative: native, keepInMinecraft: native };
  steps.boundingSphere = new Sphere(new Vector3(to[0] / 2, (f.high + f.low) / 2, to[2] / 2), f.len);
  markHbfMovingMeshV291(steps, { kind: "escalator", from, to, direction: f.motion! });
  root.add(steps);
  return root;
}

function addDeck(root: Group, builder: GendarmenmarktFacadeBuilder, p: Platform): void {
  if (builder.minecraft) {
    for (let z = p.north; z < p.south; z += .65) {
      const end = Math.min(z + .65, p.south);
      const span = spanAt(p, (z + end) / 2);
      if (span) rect(builder, { west: span[0], east: span[1], north: z, south: end }, railY - .1, bottomY, terrazzo);
    }
  } else {
    const shape = new Shape();
    p.ring.forEach(([x, z], i) => i === 0 ? shape.moveTo(x, -z) : shape.lineTo(x, -z));
    const geometry = new ExtrudeGeometry(shape, { depth: bottomY - railY + .1, bevelEnabled: false });
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, railY - .1, 0);
    geometry.deleteAttribute("uv");
    const dayMaterial = new MeshBasicMaterial({ color: terrazzo });
    const nightMaterial = new MeshStandardMaterial({ color: terrazzo, roughness: .78 });
    const deck = new Mesh(geometry, dayMaterial);
    deck.name = `Source platform outline ${p.tracks.join("/")}`;
    deck.userData = { dayMaterial, nightMaterial, keepInMinecraft: false };
    root.add(deck);
  }
  for (const column of p.columns) {
    rect(builder, column, bottomY + .22, lowerCeilingY, glass);
    rect(builder, column, bottomY, bottomY + .22, 0x6d706a);
    const x = (column.west + column.east) / 2, z = (column.north + column.south) / 2;
    builder.box([x, lowerCeilingY - .18, z], [.82, .13, .29], 0xf3eee0);
  }
  for (const [index, ordered] of p.edges.entries()) {
    const side = index === 0 ? -1 : 1;
    for (let i = 1; i < ordered.length; i++) {
      const a = ordered[i - 1], b = ordered[i];
      alignedBox(builder, [a[0] - side * .22, bottomY + .009, a[1]],
        [b[0] - side * .22, bottomY + .009, b[1]], .17, .018, 0xe3ded0);
      alignedBox(builder, [a[0] + side * 3.1, (lowerCeilingY + railY) / 2, a[1]],
        [b[0] + side * 3.1, (lowerCeilingY + railY) / 2, b[1]], .25, lowerCeilingY - railY, glass);
    }
  }

}

function drawTrack(builder: GendarmenmarktFacadeBuilder, route: readonly XZ[], p: Platform): void {
  for (let i = 1; i < route.length; i++) {
    const from = route[i - 1], to = route[i];
    const dz = to[1] - from[1];
    if (dz <= 0 || from[1] >= p.south || to[1] <= p.north) continue;
    const a = Math.max(p.north, from[1]), b = Math.min(p.south, to[1]);
    const xAt = (z: number) => from[0] + (to[0] - from[0]) * (z - from[1]) / dz;
    for (const lateral of [-.7175, .7175]) {
      alignedBox(builder, [xAt(a) + lateral, railY - .045, a], [xAt(b) + lateral, railY - .045, b],
        .085, .09, 0x676f70);
    }
    for (let z = a + .56; z < b; z += .76) builder.box([xAt(z), railY - .105, z], [2.4, .12, .22], 0x555451);
  }
}

type Solid = { area: Rect; low: number; high: number };
const perimeter: Solid[] = [
  { area: { west: upper.west - .16, east: upper.west, north: 1035.10, south: upper.south }, low: topY, high: ceilingY },
  { area: { west: upper.west, east: 310, north: upper.north - .16, south: upper.north }, low: topY, high: ceilingY },
  { area: { west: 313.2, east: northBranch.west, north: upper.north - .16, south: upper.north }, low: topY, high: ceilingY },
  { area: { west: northBranch.west - .16, east: northBranch.west, north: northBranch.north, south: upper.north }, low: topY, high: ceilingY },
  { area: { west: northBranch.west, east: northBranch.east, north: northBranch.north - .16, south: northBranch.north }, low: topY, high: ceilingY },
  { area: { west: northBranch.east, east: northBranch.east + .16, north: northBranch.north, south: 1025.7 }, low: topY, high: ceilingY },
  { area: { west: upper.west, east: upper.east, north: upper.south, south: upper.south + .16 }, low: topY, high: ceilingY },
];
const dockClosures: readonly Solid[] = [
  { area: { west: upper.west - .16, east: upper.west, north: upper.north, south: 1035.10 }, low: topY, high: ceilingY },
  // OSM 464904407 crosses the north wall here on the way from Pavillon Nord.
  { area: { west: 310, east: 313.2, north: upper.north - .16, south: upper.north }, low: topY, high: ceilingY },
];
const guards = eyes.flatMap(r => [r.north, r.south].map(z => ({ west: r.west, east: r.east, north: z - .06, south: z + .06 })));
const centres = [
  { name: "GLEISE 11 12", x: 327.6, z: 1039.6 },
  { name: "GLEISE 13 14", x: 345.5, z: 1034.6 },
];

export function createPotsdamerSBahn(native: boolean, westDock: boolean): Group {
  const root = new Group();
  root.name = "Potsdamer Platz — S-Bahn 11–14 und Mittelpassarelle";
  root.userData = { keepInMinecraft: native, blockNative: native, fullStaticDetailOnTouch: true,
    platformRelations: [3200537, 3198309], platformEdges: [859920451, 237250953, 859920454, 237250952],
    stairWays: flights.map(f => f.id) };
  const builder = new GendarmenmarktFacadeBuilder(native);
  for (const r of upperSpaces) {
    for (const piece of clippedFloor(r, upperHoles)) rect(builder, piece, topY - .22, topY, terrazzo);
  }
  for (const r of lowerLandings) rect(builder, r, middleY - .23, middleY, terrazzo);
  for (const r of perimeter) rect(builder, r.area, r.low, r.high, wall);
  if (!westDock) for (const r of dockClosures) rect(builder, r.area, r.low, r.high, wall);
  for (const r of guards) {
    rect(builder, r, topY + .99, topY + 1.05, steel);
    for (let x = r.west + .13; x < r.east; x += .82)
      builder.box([x, topY + .5, (r.north + r.south) / 2], [.075, 1, .1], steel);
  }
  for (const z of [1024, 1031, 1038, 1045, 1052]) {
    builder.box([334.6, ceilingY - .09, z], [4.5, .11, .29], 0xf3edde);
  }
  for (const { name, x, z } of centres) {
    if (native) continue;
    const edge = { startXZ: [x - 1.5, z], endXZ: [x + 1.5, z], outwardSide: 1,
      wallBaseY: topY, wallTopY: ceilingY, street: "Potsdamer Platz", prismId: name };
    builder.sign(edge, name, 1.5, topY + 2.44, .25, 3, 0xf2efe4, 0x264955, .045);
  }
  for (const f of flights) {
    drawFlight(builder, f);
    if (f.motion) root.add(animatedSteps(f, native));
  }
  for (const p of platforms) addDeck(root, builder, p);
  for (const rail of potsdamerSBahnTrackSegments) {
    drawTrack(builder, rail.points, platforms[rail.track <= 12 ? 0 : 1]);
  }
  for (const r of clippedFloor(lowerStation, lowerHoles)) rect(builder, r, lowerCeilingY, topY - .26, 0x858b87);
  rect(builder, lowerStation, railY - .31, railY - .12, 0x555752);
  root.add(builder.finish("White wall lining, island platforms, rails and fixed staircases"));
  return freezeStaticSceneTransforms(root);
}

function flightTread(f: Run, x: number, z: number): number | null {
  const [s, v] = local(f, x, z);
  return s >= -.025 && s <= f.len + .025 && Math.abs(v) <= f.width / 2
    ? stairHeight(f, Math.max(0, Math.min(1, s / f.len))) : null;
}
function currentFlight(x: number, z: number, hint: number): number | null {
  for (const f of flights) {
    const y = flightTread(f, x, z);
    if (y !== null && Math.abs(y - hint) < .86) return y;
  }
  return null;
}
export function potsdamerSBahnFloorAt(x: number, z: number, hint?: number): number | null {
  if (!near(x, z) || (hint !== undefined && hint > ceilingY)) return null;
  const y = hint ?? topY;
  const tread = currentFlight(x, z, y);
  if (tread !== null) return tread;
  if (Math.abs(y - middleY) < 1.2 && lowerLandings.some(r => inside(r, x, z))) return middleY;
  if (Math.abs(y - bottomY) < 2.6 && platformAt(x, z)) return bottomY;
  return upperOpen(x, z) ? topY : null;
}

export function potsdamerSBahnFlightAt(x: number, y: number, z: number): boolean {
  if (!near(x, z)) return false;
  if (y >= topY && y < ceilingY && upperSpaces.some(r => inside(r, x, z))) return true;
  if (y >= bottomY && y < lowerCeilingY && platformAt(x, z, 3.03)) return true;
  if (lowerLandings.some(r => inside(r, x, z)) && y >= middleY && y < ceilingY) return true;
  return flights.some(f => {
    const tread = flightTread(f, x, z);
    return tread !== null && y >= tread && y <= tread + 2.6 && y < ceilingY;
  });
}

function solid(x: number, y: number, z: number, radius: number, westDock: () => boolean): boolean {
  if (!near(x, z)) return false;
  const touches = (r: Solid) => y + radius >= r.low && y - radius <= r.high && inside(r.area, x, z, radius);
  if (perimeter.some(touches) || (dockClosures.some(touches) && !westDock())) return true;
  if (y >= topY && y <= topY + 1.08 && guards.some(r => inside(r, x, z, radius))) return true;
  const upperRoom = upperSpaces.some(r => inside(r, x, z));
  if (upperRoom && y + radius > ceilingY && y - radius < 5.1) return true;
  if (y + radius > lowerCeilingY && y < topY - .018 &&
      inside(lowerStation, x, z) && !lowerHoles.some(r => inside(r, x, z))) return true;
  if (y + radius >= bottomY && y - radius <= lowerCeilingY &&
      platforms.some(p => p.columns.some(column => inside(column, x, z, radius)))) return true;
  if (y >= railY - .12 && y < bottomY - .018 && platformAt(x, z)) return true;
  for (const f of flights) {
    const [s, v] = local(f, x, z);
    if (s < 0 || s > f.len || Math.abs(v) > f.width / 2 + radius + .15) continue;
    const tread = stairHeight(f, s / f.len);
    if (y > tread - .25 && y < tread - .022 && Math.abs(v) < f.width / 2) return true;
    if (y >= tread + .24 && y <= tread + 1.06 && Math.abs(Math.abs(v) - (f.width / 2 + .06)) < .075 + radius) return true;
  }
  return false;
}

export function installPotsdamerSBahnNavigation(environment: PedestrianEnvironment,
  active: () => boolean, westDock: () => boolean): void {
  const ground = environment.groundAt, interior = environment.interiorGroundAt, priorSolid = environment.interiorSolidAt;
  environment.groundAt = (x, z) => near(x, z) && active()
    ? platformAt(x, z, 3.03) ? railY : upperSpaces.some(r => inside(r, x, z)) ? topY : ground(x, z)
    : ground(x, z);
  environment.interiorGroundAt = (x, z, hint) => (near(x, z) && active() ? potsdamerSBahnFloorAt(x, z, hint) : null) ??
    interior?.(x, z, hint) ?? null;
  environment.interiorSolidAt = (x, y, z, radius = 0) =>
    near(x, z) && active() && solid(x, y, z, radius, westDock) || priorSolid?.(x, y, z, radius) || false;
}
