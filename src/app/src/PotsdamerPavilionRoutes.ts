import { BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, InstancedMesh,
  Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, ShapeUtils, Vector2 } from "three";
import profile from "./data/potsdamerPavilionRoutes.json";
import type { HbfBoxV291, HbfOpeningV291, HbfPlaneV291 } from "./HbfGeometryOpeningsV291";
import { markHbfMotionFrameV291, markHbfMovingMeshV291 } from "./HbfStationMotionV291";
import { clipGroundSlabsThroughOpenings, clipGroundSurfaceThroughOpenings } from "./FidelityGroundOpeningsV296";
import { indexGeometryExactly } from "./exactGeometryIndex";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import type { PedestrianEnvironment } from "./pedestrianNavigation";
import { POTSDAMER_DETAIL_PROFILE } from "./expandedCityProfiles";
import { worldGroundSampler, type VoxelPayload } from "./terrainPayload";

type Point = readonly [number, number];
type XYZ = [number, number, number];
type Ring = readonly Point[];
type Rectangle = readonly [number, number, number, number];
type Floor = { id: number; y: number; ring: Ring; holes: readonly Ring[]; step: boolean };
type Wall = readonly [number, Point, Point];
type Flight = readonly [number, Point, Point, number, number, number, number, number];
type Family<Plan> = { floors: readonly Plan[]; walls: readonly Wall[]; cuts: readonly [number, Rectangle | Ring][] };
const data = profile as unknown as {
  flights: readonly Flight[];
  drawn: Family<readonly [number, number, Ring, readonly Ring[], boolean]>;
  native: Family<readonly [number, number, ...Rectangle, boolean]>;
};
const HEADROOM = 2.42;
const GROUND = 5.4;
const LOWER = -3.918;
const LANDING = -.518;
const STAIRS_NAME = "Potsdamer Platz — public circulation between the glass pavilions";
const guard = 0x596366;
const pavements = /^(District asphalt carriageways|District mapped paved walkways|smooth (paved paths|park paths|earth desire paths|timber paths|metal paths and steps|carriageways|kerb upstands))$/;
const pavementNames = new Set(["Drawn ground slabs", "Voxel ground runs"]);
const ownerIds = new Set(["K0002SCt", "K0000BRX"]);
const RECT = (x: number, z: number, endX: number, endZ: number): Ring => [[x, z], [endX, z], [endX, endZ], [x, endZ]];

const pavilionFrames = POTSDAMER_DETAIL_PROFILE.stationEntranceHalls.halls.map(hall => {
  const [cx, cz] = hall.centerWorldM, [width, depth] = hall.footprintSizeM;
  return { cx, cz, c: Math.cos(hall.rotationY), s: Math.sin(hall.rotationY),
    w: width / 2, d: depth / 2, front: hall.frontSide,
    source: hall.sourceBuildingId.slice(-8),
    roof: "sourceRoofYM" in hall ? hall.sourceRoofYM : hall.groundY + hall.officialHeightM };
});

function pavilionAir(x: number, y: number, z: number, source?: string): boolean {
  return y >= GROUND - .24 && pavilionFrames.some(p => {
    if (y >= p.roof - .11 || source !== undefined && source !== p.source) return false;
    const dx = x - p.cx, dz = z - p.cz;
    return Math.abs(p.c * dx - p.s * dz) <= p.w + .55 &&
      Math.abs(p.s * dx + p.c * dz) <= p.d + .55;
  });
}

function pavilionWall(x: number, y: number, z: number, radius: number): boolean {
  if (y < GROUND - .05) return false;
  return pavilionFrames.some(p => {
    const dx = x - p.cx, dz = z - p.cz;
    if (y > p.roof + radius || Math.abs(dx) > 15 + radius || Math.abs(dz) > 15 + radius) return false;
    const px = p.c * dx - p.s * dz, pz = p.s * dx + p.c * dz;
    if (Math.abs(px) > p.w + radius || Math.abs(pz) > p.d + radius) return false;
    return Math.abs(y - p.roof) <= radius + .12 ||
      Math.abs(Math.abs(px) - p.w + .20) < radius + .11 ||
      Math.abs(pz + p.front * (p.d - .20)) < radius + .11;
  });
}

function distanceTo(x: number, z: number, a: Point, b: Point) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const lengthSq = dx * dx + dz * dz;
  const s = lengthSq ? Math.min(1, Math.max(0, ((x - a[0]) * dx + (z - a[1]) * dz) / lengthSq)) : 0;
  return Math.hypot(x - a[0] - s * dx, z - a[1] - s * dz);
}

function contains(ring: Ring, x: number, z: number) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j], b = ring[i];
    if (x >= Math.min(a[0], b[0]) - .0001 && x <= Math.max(a[0], b[0]) + .0001 &&
      z >= Math.min(a[1], b[1]) - .0001 && z <= Math.max(a[1], b[1]) + .0001 && distanceTo(x, z, a, b) < .0001) return true;
    if ((a[1] > z) !== (b[1] > z) && x < a[0] + (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1])) inside = !inside;
  }
  return inside;
}

function opening(y: number, ring: Ring, native: boolean): HbfOpeningV291 {
  const xs = ring.map(p => p[0]), zs = ring.map(p => p[1]);
  const bounds: HbfBoxV291 = { min: [Math.min(...xs), y - .24, Math.min(...zs)], max: [Math.max(...xs), y + HEADROOM, Math.max(...zs)] };
  const cx = xs.reduce((sum, x) => sum + x, 0) / xs.length, cz = zs.reduce((sum, z) => sum + z, 0) / zs.length;
  const planes: HbfPlaneV291[] = [[0, 1, 0, -bounds.min[1]], [0, -1, 0, bounds.max[1]]];
  for (let i = 0; i < ring.length; i++) {
    const [x, z] = ring[i], [xx, zz] = ring[(i + 1) % ring.length];
    const length = Math.hypot(xx - x, zz - z);
    let a = (z - zz) / length, b = (xx - x) / length;
    if (a * (cx - x) + b * (cz - z) < 0) { a = -a; b = -b; }
    planes.push([a, 0, b, -a * x - b * z]);
  }
  return { id: "potsdamer-pavilion-stair", bounds, planes, ...(native ? { nativeBoxes: [bounds] } : {}) };
}

/** Street hand-offs must still be supported by the retained core payload. */
export function potsdamerPavilionTerrainAdmitted(payload: VoxelPayload | null | undefined): boolean {
  if (!payload) return false;
  const terrain = worldGroundSampler(payload);
  return [[293.5, 1023.43], [301.69, 1128.05]].every(([x, z]) => {
    const top = terrain(x, z);
    return top !== null && Math.abs(top - GROUND) <= .24;
  });
}

function batch(root: Group, vertices: number[], colors: number[], native: boolean) {
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  g.setAttribute("color", new Float32BufferAttribute(colors, 3));
  indexGeometryExactly(g);
  g.userData.exactIndexPending = false;
  const day = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  const mesh = new Mesh(g, day);
  mesh.name = "Potsdamer Platz connected pavilion stair treads, vestibules and corridor lining";
  mesh.userData = { dayMaterial: day, nightMaterial: day, nativeMinecraft: native, blockNative: native,
    keepInMinecraft: native, textureFree: true };
  root.add(mesh);
}

function moving(root: Group, flight: Flight, native: boolean) {
  const [id, a, b, lower, upper, count, width, direction] = flight;
  const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
  const short = length / count;
  const vertical = Math.abs(dz) > Math.abs(dx);
  const geometry = new BoxGeometry(native && vertical ? width : short, .15, native && vertical ? short : width);
  if (!native) geometry.rotateY(-Math.atan2(dz, dx));
  geometry.deleteAttribute("uv");
  const day = new MeshBasicMaterial({ color: 0x8d989a });
  const night = new MeshStandardMaterial({ color: 0x8d989a, roughness: .65 });
  const steps = new InstancedMesh(geometry, day, count);
  const m = new Matrix4();
  for (let i = 0; i < count; i++) steps.setMatrixAt(i, m.makeTranslation(dx * i / count, lower + (upper - lower) * i / count - .08, dz * i / count));
  steps.userData = { dayMaterial: day, nightMaterial: night, nativeMinecraft: native, blockNative: native, keepInMinecraft: native };
  steps.computeBoundingSphere();
  markHbfMovingMeshV291(steps, { kind: "escalator", from: [0, lower, 0], to: [dx, upper, dz], direction: direction < 0 ? -1 : 1 });
  const frame = new Group();
  frame.name = `Potsdamer Platz pavilion escalator — OSM ${id}`;
  frame.position.set(a[0], 0, a[1]);
  markHbfMotionFrameV291(frame, native);
  frame.add(steps);
  root.add(frame);
}

const near = (x: number, z: number, padding = 0) => x >= 253 - padding && x <= 317 + padding &&
  z >= 1002 - padding && z <= 1154 + padding;
const key = (x: number, z: number) => `${Math.floor(x / 2)},${Math.floor(z / 2)}`;

export function createPotsdamerPavilionRoutes(native: boolean) {
  const family = native ? data.native : data.drawn;
  const floors: Floor[] = native ? data.native.floors.map(([id, y, x, z, xx, zz, step]) =>
    ({ id, y, ring: RECT(x, z, xx, zz), holes: [], step })) :
    data.drawn.floors.map(([id, y, ring, holes, step]) => ({ id, y, ring, holes, step }));
  const cuts = family.cuts.map(([y, plan]) => opening(y, native ? RECT(...(plan as Rectangle)) : plan as Ring, native));
  const cells = new Map<string, Floor[]>(), walls = new Map<string, Wall[]>();
  function index<T>(map: Map<string, T[]>, bounds: Ring, row: T, pad: number) {
    const xs = bounds.map(p => p[0]), zs = bounds.map(p => p[1]);
    for (let z = Math.floor((Math.min(...zs) - pad) / 2); z <= Math.floor((Math.max(...zs) + pad) / 2); z++) {
      for (let x = Math.floor((Math.min(...xs) - pad) / 2); x <= Math.floor((Math.max(...xs) + pad) / 2); x++) {
        const id = `${x},${z}`, list = map.get(id) ?? [];
        list.push(row);
        map.set(id, list);
      }
    }
  }
  for (const f of floors) index(cells, f.ring, f, .001);
  for (const w of family.walls) index(walls, [w[1], w[2]], w, .75);

  const on = (f: Floor, x: number, z: number) => contains(f.ring, x, z) && !f.holes.some(h => contains(h, x, z));
  const above = (x: number, y: number, z: number) =>
    near(x, z) && (cells.get(key(x, z))?.some(f => y >= f.y - .25 && y <= f.y + HEADROOM && on(f, x, z)) ?? false);

  function floorAt(x: number, z: number, hint = GROUND): number | null {
    if (!near(x, z)) return null;
    let best: number | null = null, exposedStep: number | null = null;
    for (const floor of cells.get(key(x, z)) ?? []) {
      const isExposed = floor.step && floor.y + HEADROOM >= 5.19 && hint >= 4.72 && hint <= GROUND + .07;
      if (isExposed && (exposedStep === null || floor.y > exposedStep) && on(floor, x, z)) exposedStep = floor.y;
      if (floor.y > hint + .50 || floor.y < hint - .59 ||
          best !== null && Math.abs(hint - floor.y) >= Math.abs(hint - best)) continue;
      if (on(floor, x, z)) best = floor.y;
    }
    return best ?? exposedStep;
  }

  const hasCeiling = (f: Floor) => !f.step && f.y <= LANDING + .01;
  function solidAt(x: number, y: number, z: number, radius = 0) {
    if (pavilionWall(x, y, z, radius)) return true;
    if (!near(x, z, .75) || y < LOWER - .8 || y > GROUND + 1.25) return false;
    return (walls.get(key(x, z))?.some(([base, a, b]) =>
      y >= base - .03 && y <= base + HEADROOM && distanceTo(x, z, a, b) < radius + .025) ?? false) ||
      (cells.get(key(x, z))?.some(f => hasCeiling(f) && Math.abs(y - f.y - HEADROOM) < .04 && on(f, x, z)) ?? false);
  }

  const root = new Group();
  root.name = STAIRS_NAME;
  root.userData = { blockNative: native, keepInMinecraft: native, fullStaticDetailOnTouch: true };
  const points: number[] = [], colors: number[] = [];
  const color = new Color();
  const paint = (ring: readonly XYZ[], tint: number) => {
    color.setHex(tint);
    for (const p of ring) { points.push(...p); colors.push(color.r, color.g, color.b); }
  };
  const lift = ([x, z]: Point, y: number): XYZ => [x, y, z];
  function band(a: Point, b: Point, low: number, high: number, tint: number) {
    const p = lift(a, low), q = lift(b, low), r = lift(b, high), s = lift(a, high);
    paint([p, q, r, p, r, s], tint);
  }
  const movingIds = new Set(data.flights.filter(f => f[7] !== 0).map(f => f[0]));
  for (const floor of floors) {
    const { id, ring, holes, step, y } = floor;
    const rings = [ring, ...holes].flat();
    const contour = ring.map(p => new Vector2(...p)), voids = holes.map(h => h.map(p => new Vector2(...p)));
    const top = movingIds.has(id) ? y - .15 : y;
    for (const indices of ShapeUtils.triangulateShape(contour, voids)) {
      const triangle = indices.map(i => rings[i]);
      paint(triangle.map(p => lift(p, top)), movingIds.has(id) ? guard : step ? 0xa9a49a : 0xc4c0b4);
      if (hasCeiling(floor)) paint(triangle.map(p => lift(p, y + HEADROOM)), 0xd9d1bc);
    }
    if (step) for (let i = 0; i < ring.length; i++) band(ring[i], ring[(i + 1) % ring.length], top - .18, top, 0x89867e);
  }
  for (const [y, a, b] of family.walls) {
    band(a, b, y, y + .26, 0x626465);
    band(a, b, y + .26, y + HEADROOM, 0xbcb8a9);
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 1.25) band(a, b, y + 2.06, y + 2.12, 0xe6ddc5);
  }

  // The guards follow the represented flights. The Native rails use cardinal
  // tread fragments and independent upright posts.
  for (const [id, a, b, lo, hi, count, width, direction] of data.flights) {
    if (direction) moving(root, [id, a, b, lo, hi, count, width, direction], native);
    const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
    const rail = (t: number, offset: number): Point => [a[0] + dx * t - dz * offset / length, a[1] + dz * t + dx * offset / length];
    const snap = (p: Point): Point => [Math.round(p[0] * 8) / 8, Math.round(p[1] * 8) / 8];
    for (const side of [-1, 1]) for (let i = 0; i < count; i++) {
      const offset = side * (width / 2 + .075);
      const a = rail(i / count, offset), b = rail((i + 1) / count, offset);
      const y = lo + (hi - lo) * (i + 1) / count;
      if (native) {
        const [p, q] = [snap(a), snap(b)], bend: Point = [q[0], p[1]];
        band(p, bend, y + .87, y + .96, guard);
        band(bend, q, y + .87, y + .96, guard);
      } else band(a, b, y + .87, y + .96, guard);
      if (i % 4 === 0) {
        const p = native ? snap(a) : a;
        band(p, [p[0] + .07, p[1]], y, y + .91, guard);
      }
    }
  }
  batch(root, points, colors, native);
  freezeStaticSceneTransforms(root);

  function cutGround(world: Group): boolean {
    let changed = false;
    world.traverse(object => {
      if (object instanceof InstancedMesh && pavementNames.has(object.name)) {
        if (clipGroundSlabsThroughOpenings(object, cuts, native, "Retained terrain around Potsdamer pavilion stair openings")) changed = true;
      } else if (object instanceof Mesh && !(object instanceof InstancedMesh) && pavements.test(object.name)) {
        const prior = object.geometry;
        if (!prior.boundingBox) prior.computeBoundingBox();
        const b = prior.boundingBox;
        if (!b || !cuts.some(({ bounds: { min, max } }) => b.min.x <= max[0] && b.max.x >= min[0] &&
            b.min.y <= max[1] && b.max.y >= min[1] && b.min.z <= max[2] && b.max.z >= min[2])) return;
        const cut = clipGroundSurfaceThroughOpenings(prior, cuts);
        if (cut !== prior) { object.geometry = cut; prior.dispose(); }
      }
    });
    return changed;
  }
  return { root, floorAt, flightAt: above, solidAt, cutGround };
}
export type PotsdamerPavilionRoutes = ReturnType<typeof createPotsdamerPavilionRoutes>;

export function installPotsdamerPavilionNavigation(environment: PedestrianEnvironment, get: () => PotsdamerPavilionRoutes | null): void {
  const oldFloor = environment.interiorGroundAt, oldFlight = environment.flightGroundAt;
  const oldSolid = environment.interiorSolidAt, oldInterior = environment.walkableInteriorAt;
  environment.interiorGroundAt = (x, z, hint) => (near(x, z) ? get()?.floorAt(x, z, hint) : null) ?? oldFloor?.(x, z, hint) ?? null;
  environment.interiorSolidAt = (x, y, z, radius) =>
    (near(x, z, .75) && get()?.solidAt(x, y, z, radius) === true) || oldSolid?.(x, y, z, radius) === true;
  environment.walkableInteriorAt = (x, y, z, source) =>
    (source !== undefined && ownerIds.has(source) && near(x, z) && get() !== null &&
      (pavilionAir(x, y, z, source) || get()?.flightAt(x, y, z) === true)) ||
    oldInterior?.(x, y, z, source) === true;
  environment.flightGroundAt = (x, y, z) => near(x, z) && get()?.flightAt(x, y, z) === true
    ? LOWER : oldFlight?.(x, y, z) ?? environment.groundAt(x, z);
}
