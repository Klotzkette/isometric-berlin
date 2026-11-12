import {
  BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial,
  ShapeUtils, Vector2,
} from "three";
import raw from "./data/nordbahnhofPublicAccess.json";
import type { HbfBoxV291, HbfOpeningV291, HbfPlaneV291 } from "./HbfGeometryOpeningsV291";
import type { PrismBuilding } from "./IsometricCityWorld";
import { indexGeometryExactly } from "./exactGeometryIndex";
import { interleaveStaticGeometry } from "./interleaveStaticGeometry";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { cutNordbahnhofPublicGround } from "./NordbahnhofPublicGround";
import { worldGroundSampler, type VoxelPayload } from "./terrainPayload";

type Point = readonly [number, number];
type Ring = readonly Point[];
type Floor = { source: number; y: number; ring: Ring; holes: readonly Ring[] };
type Wall = readonly [y: number, outdoor: boolean, a: Point, b: Point];
type NativeCut = readonly [y: number, x: number, z: number, endX: number, endZ: number];
type NativeSource = readonly [x: number, z: number, offset: number, width: number, bottom: number, top: number, kind: number];
type Route = readonly [source: number, axis: readonly Point[], startY: number, endY: number, steps: number];
const data = raw as unknown as {
  bounds: readonly [number, number, number, number];
  portals: readonly Route[];
  prisms: readonly PrismBuilding[];
  voxels: readonly NativeSource[];
  drawn: { floors: readonly (readonly [number, number, Ring, readonly Ring[]])[]; walls: readonly Wall[]; cuts: readonly (readonly [number, Ring])[] };
  native: { floors: readonly (readonly [number, ...NativeCut])[]; walls: readonly Wall[]; cuts: readonly NativeCut[] };
};

export const NORDBAHNHOF_PUBLIC_ROUTE = "Nordbahnhof park entrance, mezzanine and both platform stair landings";
const HEADROOM = 2.35;
const GROUND = 5.2;
const LOWEST = -2.79;
const EPS = .00006;
const OUTDOOR = new Set([2393882350, 396459313, 1437106437]);
const owners = new Map(data.prisms.map(prism => [prism.id, JSON.stringify(prism)]));
const near = (x: number, z: number, padding = 0) => x >= data.bounds[0] - padding && x <= data.bounds[2] + padding &&
  z >= data.bounds[1] - padding && z <= data.bounds[3] + padding;

function rectangle(x: number, z: number, endX: number, endZ: number): Ring {
  return [[x, z], [endX, z], [endX, endZ], [x, endZ]];
}

function axisDistance(x: number, z: number, a: Point, b: Point): number {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  if (!dx && !dz) return Math.hypot(x - a[0], z - a[1]);
  const f = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - a[0] - dx * f, z - a[1] - dz * f);
}

function contains(x: number, z: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j], b = ring[i];
    if (x >= Math.min(a[0], b[0]) - EPS && x <= Math.max(a[0], b[0]) + EPS &&
        z >= Math.min(a[1], b[1]) - EPS && z <= Math.max(a[1], b[1]) + EPS &&
        axisDistance(x, z, a, b) <= EPS) return true;
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function makeOpening(y: number, ring: Ring, native: boolean): HbfOpeningV291 {
  const xs = ring.map(p => p[0]), zs = ring.map(p => p[1]);
  const bounds: HbfBoxV291 = { min: [Math.min(...xs), y - .19, Math.min(...zs)], max: [Math.max(...xs), y + HEADROOM, Math.max(...zs)] };
  const midX = xs.reduce((sum, x) => sum + x, 0) / xs.length, midZ = zs.reduce((sum, z) => sum + z, 0) / zs.length;
  const planes: HbfPlaneV291[] = [[0, 1, 0, -bounds.min[1]], [0, -1, 0, bounds.max[1]]];
  for (let i = 0; i < ring.length; i++) {
    const [x, z] = ring[i], [xx, zz] = ring[(i + 1) % ring.length];
    const length = Math.hypot(xx - x, zz - z);
    let a = (z - zz) / length, b = (xx - x) / length;
    if (a * (midX - x) + b * (midZ - z) < 0) { a = -a; b = -b; }
    planes.push([a, 0, b, -a * x - b * z]);
  }
  return { id: NORDBAHNHOF_PUBLIC_ROUTE, bounds, planes, ...(native ? { nativeBoxes: [bounds] } : {}) };
}

export type NordbahnhofDrawnCuts = Readonly<Record<string, readonly HbfOpeningV291[]>>;
export type NordbahnhofNativeCuts = (x: number, z: number, bottom: number, top: number, kind: number) => readonly HbfOpeningV291[];
const emptyCuts: readonly HbfOpeningV291[] = [];

function knownGround(payload: VoxelPayload): boolean {
  const sample = worldGroundSampler(payload);
  return data.portals.every(([, axis]) => axis.every(([x, z]) => sample(x, z) === GROUND));
}

function knownPrisms(buildings: readonly unknown[] | undefined): boolean {
  if (!buildings) return false;
  const matched = new Set<string>();
  for (const record of buildings) {
    if (!record || typeof record !== "object" || !("id" in record) || typeof record.id !== "string" || !owners.has(record.id)) continue;
    if (matched.has(record.id) || JSON.stringify(record) !== owners.get(record.id)) return false;
    matched.add(record.id);
  }
  return matched.size === owners.size;
}

export function prepareNordbahnhofDrawn(buildings: readonly PrismBuilding[], ground: VoxelPayload | null) {
  if (!ground || !knownGround(ground) || !knownPrisms(buildings)) return null;
  const plan = createPlan(false);
  const cuts: Record<string, readonly HbfOpeningV291[]> = {};
  for (const { id, ring, y0_dm, h_dm } of data.prisms) {
    const x0 = Math.min(...ring.map(p => p[0])) / 10, x1 = Math.max(...ring.map(p => p[0])) / 10;
    const z0 = Math.min(...ring.map(p => p[1])) / 10, z1 = Math.max(...ring.map(p => p[1])) / 10;
    cuts[id] = plan.openings.filter(({ bounds: { min, max } }) => min[0] < x1 && max[0] > x0 &&
      min[1] < (y0_dm + h_dm) / 10 && max[1] >= y0_dm / 10 && min[2] < z1 && max[2] > z0);
  }
  return { plan, cuts };
}

export function prepareNordbahnhofNative(buildings: readonly unknown[] | undefined, voxels: VoxelPayload) {
  if (voxels.cell_m !== 4 || !voxels.building_rows || !knownGround(voxels) || !knownPrisms(buildings)) return null;
  const { min_x_idx, min_z_idx } = voxels.grid;
  if (!data.voxels.every(([x, z, offset, width, lo, hi, kind]) => x >= min_x_idx + offset &&
      x < min_x_idx + offset + width && voxels.building_rows![z - min_z_idx]?.filter(row =>
        x >= min_x_idx + row[0] && x < min_x_idx + row[0] + row[1]).length === 1 &&
      voxels.building_rows![z - min_z_idx]?.some(row => row[0] === offset && row[1] === width &&
        row[2] === lo && row[3] === hi && row[4] === kind))) return null;
  const plan = createPlan(true);
  const byColumn = new Map(data.voxels.map(([x, z, , , lo, hi, kind]) => [
    `${x},${z},${lo},${hi},${kind}`,
    plan.openings.filter(({ bounds: { min, max } }) => min[0] < (x + 1) * 4 && max[0] > x * 4 &&
      max[1] > lo / 10 && min[1] < lo / 10 + Math.max(4, (hi - lo) / 10) &&
      min[2] < (z + 1) * 4 && max[2] > z * 4),
  ]));
  const cuts: NordbahnhofNativeCuts = (x, z, lo, hi, kind) =>
    x < 270 || x > 282 || z < -386 || z > -375 ? emptyCuts :
      byColumn.get(`${x},${z},${lo},${hi},${kind}`) ?? emptyCuts;
  return { plan, cuts, expectedColumns: data.voxels.length };
}

function createPlan(native: boolean) {
  const floors: Floor[] = native
    ? data.native.floors.map(([source, y, x, z, endX, endZ]) => ({ source, y, ring: rectangle(x, z, endX, endZ), holes: [] }))
    : data.drawn.floors.map(([source, y, ring, holes]) => ({ source, y, ring, holes }));
  const openings = native
    ? data.native.cuts.map(([y, x, z, endX, endZ]) => makeOpening(y, rectangle(x, z, endX, endZ), true))
    : data.drawn.cuts.map(([y, ring]) => makeOpening(y, ring, false));
  const walls = native ? data.native.walls : data.drawn.walls;
  const floorCells = new Map<string, Floor[]>();
  const wallCells = new Map<string, Wall[]>();
  function insert<T>(index: Map<string, T[]>, box: Ring, item: T, padding = 0): void {
    const xs = box.map(p => p[0]), zs = box.map(p => p[1]);
    for (let z = Math.floor((Math.min(...zs) - padding) / 2); z <= Math.floor((Math.max(...zs) + padding) / 2); z++)
      for (let x = Math.floor((Math.min(...xs) - padding) / 2); x <= Math.floor((Math.max(...xs) + padding) / 2); x++) {
        const key = `${x},${z}`, values = index.get(key) ?? [];
        values.push(item); index.set(key, values);
      }
  }
  for (const floor of floors) insert(floorCells, floor.ring, floor, EPS);
  for (const wall of walls) insert(wallCells, [wall[2], wall[3]], wall, .8);
  const floorIndex = (x: number, z: number) => floorCells.get(`${Math.floor(x / 2)},${Math.floor(z / 2)}`) ?? [];
  const on = (x: number, z: number, f: Floor) => contains(x, z, f.ring) && !f.holes.some(h => contains(x, z, h));
  function inAir(x: number, y: number, z: number): boolean {
    return near(x, z, EPS) && floorIndex(x, z).some(f => y >= f.y - .22 && y <= f.y + HEADROOM && on(x, z, f));
  }
  function groundAt(x: number, z: number, hint?: number) {
    if (!near(x, z, EPS)) return null;
    const reference = hint ?? GROUND;
    let best: number | null = null;
    for (const floor of floorIndex(x, z)) {
      if (floor.y > reference + .47 || floor.y < reference - .56 ||
          best !== null && Math.abs(floor.y - reference) >= Math.abs(best - reference)) continue;
      if (on(x, z, floor)) best = floor.y;
    }
    return best;
  }
  function solidAt(x: number, y: number, z: number, radius = 0): boolean {
    if (!near(x, z, radius + .07) || y < LOWEST - .6 || y > 10.1) return false;
    const localWalls = wallCells.get(`${Math.floor(x / 2)},${Math.floor(z / 2)}`) ?? [];
    if (localWalls.some(([floor, outdoors, a, b]) => y >= floor - .04 &&
        y <= floor + (outdoors ? 1.02 : HEADROOM) + .03 && axisDistance(x, z, a, b) <= radius + .025)) return true;
    // Corridor ceilings are actual bounded planes in both representations.
    return floorIndex(x, z).some(f => !OUTDOOR.has(f.source) &&
      Math.abs(y - f.y - HEADROOM) < .03 && on(x, z, f));
  }
  return { native, floors, walls, openings, groundAt, inAir, solidAt,
    cutGround: (root: Group): boolean => cutNordbahnhofPublicGround(root, native, openings) };
}
export type NordbahnhofPlan = ReturnType<typeof createPlan>;

export function buildNordbahnhofPublicAccess(plan: NordbahnhofPlan): Group {
  const vertices: number[] = [], colors: number[] = [];
  const tint = new Color();
  const positions = (points: readonly (readonly [number, number, number])[], hex: number) => {
    tint.setHex(hex);
    for (const point of points) { vertices.push(...point); colors.push(tint.r, tint.g, tint.b); }
  };
  const lift = (point: Point, y: number) => [point[0], y, point[1]] as const;
  function band(a: Point, b: Point, low: number, high: number, color: number) {
    const p = lift(a, low), q = lift(b, low), r = lift(b, high), s = lift(a, high);
    positions([p, q, r, p, r, s], color);
  }
  for (const floor of plan.floors) {
    const { source, ring, holes, y } = floor;
    const outline = ring.map(p => new Vector2(...p)), voids = holes.map(h => h.map(p => new Vector2(...p)));
    const points = [ring, ...holes].flat();
    const outside = OUTDOOR.has(source);
    const stair = source === 396459313 || source === 397805997 || source === 396459315 || source === 396459318;
    for (const indices of ShapeUtils.triangulateShape(outline, voids)) {
      const corners = indices.map(i => points[i]);
      positions(corners.map(p => lift(p, y)), outside ? 0x9d9487 : stair ? 0xb1a99c : 0xc1b7a8);
      if (!outside) positions(corners.map(p => lift(p, y + HEADROOM)), 0xd5cbb4);
    }
    if (stair) for (let i = 0; i < ring.length; i++) {
      band(ring[i], ring[(i + 1) % ring.length], y - .18, y, 0x898477);
    }
  }
  for (const [y, outdoor, a, b] of plan.walls) {
    if (outdoor) {
      band(a, b, y + .93, y + 1.02, 0x52645a);
      const p: Point = [a[0] + (b[0] - a[0]) * .36, a[1] + (b[1] - a[1]) * .36];
      const q: Point = [a[0] + (b[0] - a[0]) * .59, a[1] + (b[1] - a[1]) * .59];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) > .21) band(p, q, y, y + .96, 0x52645a);
    } else {
      band(a, b, y, y + .34, 0x6f6c60);
      band(a, b, y + .34, y + HEADROOM, 0xbfb5a1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  indexGeometryExactly(geometry);
  geometry.userData.exactIndexPending = false;
  const material = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  const mesh = new Mesh(geometry, material);
  mesh.name = "Mapped Nordbahnhof public stair treads, corridor lining and ceilings";
  mesh.userData = { dayMaterial: material, nightMaterial: material, textureFree: true,
    nativeMinecraft: plan.native, blockNative: plan.native, keepInMinecraft: plan.native };
  const root = new Group();
  root.name = NORDBAHNHOF_PUBLIC_ROUTE;
  root.add(mesh);
  interleaveStaticGeometry(root);
  return freezeStaticSceneTransforms(root);
}
