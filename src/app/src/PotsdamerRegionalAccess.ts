import {
  BoxGeometry, BufferGeometry, DoubleSide, Float32BufferAttribute, Group, InstancedMesh,
  Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, ShapeUtils, Vector2,
} from "three";
import { GendarmenmarktFacadeBuilder } from "./GendarmenmarktFacadeBuilder";
import { markHbfMotionFrameV291, markHbfMovingMeshV291 } from "./HbfStationMotionV291";
import type { PedestrianEnvironment } from "./pedestrianNavigation";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import geometry from "./data/potsdamerRegionalAccess.json";

type XZ = readonly [number, number];
type Point = [number, number, number];
type Span = { minX: number; maxX: number; minZ: number; maxZ: number };
type Axis = {
  id: number; a: XZ; b: XZ; ux: number; uz: number; length: number; width: number;
};
type Flight = Axis & { top: number; bottom: number; risers: number; motion: -1 | 1 | 0 };

export const POTSDAMER_REGIONAL_UPPER_Y = -3.918;
export const POTSDAMER_REGIONAL_PLATFORM_Y = POTSDAMER_REGIONAL_UPPER_Y - 42 * .18;
export const POTSDAMER_REGIONAL_NAME = "Potsdamer Platz public regional platforms 1–4";
const upper = POTSDAMER_REGIONAL_UPPER_Y;
const platformY = POTSDAMER_REGIONAL_PLATFORM_Y;
const railY = platformY - .76;
const ceilingY = upper - 1.6;
const flightGrid = .125;
const platformGrid = .25;
const bounds = { minX: 239.5, maxX: 305, minZ: 989, maxZ: 1238 };
const terrazzo = 0xb6b0a7, silver = 0x98a4a9, white = 0xe1dcd1;
const concrete = 0xa7a6a1, dark = 0x596164;

const platforms = geometry.platforms.map(([, ring]) => ring as unknown as XZ[]);
const tracks = geometry.tracks.map(([, axis]) => axis as unknown as XZ[]);

function axis(id: number, a: XZ, b: XZ, width: number): Axis {
  const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
  return { id, a, b, length, width, ux: dx / length, uz: dz / length };
}

function local(a: Axis, x: number, z: number): [along: number, across: number] {
  const dx = x - a.a[0], dz = z - a.a[1];
  return [dx * a.ux + dz * a.uz, -dx * a.uz + dz * a.ux];
}

function at(a: Axis, along: number, across = 0): XZ {
  return [a.a[0] + a.ux * along - a.uz * across, a.a[1] + a.uz * along + a.ux * across];
}

function span(points: readonly XZ[], pad = 0): Span {
  const xs = points.map(p => p[0]), zs = points.map(p => p[1]);
  return { minX: Math.min(...xs) - pad, maxX: Math.max(...xs) + pad,
    minZ: Math.min(...zs) - pad, maxZ: Math.max(...zs) + pad };
}

function contained(s: Span, x: number, z: number, margin = 0): boolean {
  return x >= s.minX - margin && x <= s.maxX + margin && z >= s.minZ - margin && z <= s.maxZ + margin;
}

function inRing(ring: readonly XZ[], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

const banks = geometry.banks.map(bank => {
  let current = platformY;
  let last: XZ | undefined;
  const course = bank.id === 12 || bank.id === 35 ? [...bank.fixed].reverse() : bank.fixed;
  const fixed: Flight[] = course.map(([id, points], index) => {
    let [low, high] = points as unknown as [XZ, XZ];
    if (last && Math.hypot(last[0] - high[0], last[1] - high[1]) <
      Math.hypot(last[0] - low[0], last[1] - low[1])) [low, high] = [high, low];
    last = high;
    const risers = index % 2 === 0 ? 14 : 0;
    const bottom = current;
    current += risers * .18;
    return { ...axis(id as number, low, high, 1.68), bottom, top: current, risers, motion: 0 };
  });
  const moving: Flight[] = bank.moving.map(([id, points], index) => {
    const [low, high] = points as unknown as [XZ, XZ];
    return { ...axis(id as number, low, high, 1.38), bottom: platformY, top: upper,
      risers: 42, motion: index === 0 ? -1 : 1 };
  });
  const approach = bank.approach.flatMap(([id, points]) => {
    const route = points as unknown as XZ[];
    return route.slice(1).map((p, i) => axis(id as number, route[i], p, 1.85));
  });
  return { fixed, moving, approach, opening: span([...fixed, ...moving].flatMap(a => [a.a, a.b]), .92) };
});
const flights = banks.flatMap(bank => [...bank.fixed, ...bank.moving]);
const approaches = banks.flatMap(bank => bank.approach);
const openings = banks.map(bank => bank.opening);

function railX(track: readonly XZ[], z: number): number {
  const from = track.findIndex(p => p[1] >= z);
  if (from <= 0) return from < 0 ? track.at(-1)![0] : track[0][0];
  const [x0, z0] = track[from - 1], [x1, z1] = track[from];
  return x0 + (x1 - x0) * (z - z0) / (z1 - z0);
}
tracks.forEach(track => track.sort((a, b) => a[1] - b[1]));
const sides = [tracks[0], tracks[3]].map((track, index) =>
  track.map(([x, z]) => [x + (index === 0 ? -3.35 : 3.35), z] as XZ));
const hall = [...sides[0], ...[...sides[1]].reverse()];

function insideHall(x: number, z: number, pad = 0): boolean {
  return z >= Math.max(sides[0][0][1], sides[1][0][1]) - pad &&
    z <= Math.min(sides[0].at(-1)![1], sides[1].at(-1)![1]) + pad &&
    x >= railX(sides[0], z) - pad && x <= railX(sides[1], z) + pad;
}

function sample(value: number, grid: number): number {
  return (Math.floor(value / grid) + .5) * grid;
}

function inPlatform(x: number, z: number, native: boolean): boolean {
  if (native) { x = sample(x, platformGrid); z = sample(z, platformGrid); }
  return platforms.some(ring => inRing(ring, x, z));
}

function hasApproach(x: number, z: number, native: boolean): boolean {
  if (native) { x = sample(x, flightGrid); z = sample(z, flightGrid); }
  return approaches.some(a => {
    const [s, v] = local(a, x, z);
    return s >= -.48 && s <= a.length + .45 && Math.abs(v) <= a.width / 2;
  });
}

function flightAt(x: number, z: number, native: boolean): { flight: Flight; along: number } | null {
  if (native) { x = sample(x, flightGrid); z = sample(z, flightGrid); }
  for (const flight of flights) {
    const [along, lateral] = local(flight, x, z);
    if (along >= -.025 && along <= flight.length + .025 && Math.abs(lateral) < flight.width / 2) return { flight, along };
  }
  return null;
}

function tread(f: Flight, along: number): number {
  if (!f.risers) return f.top;
  const count = Math.min(f.risers, Math.max(1, Math.floor(along / f.length * f.risers) + 1));
  return f.bottom + (f.top - f.bottom) * count / f.risers;
}

export function potsdamerRegionalFloorAt(x: number, z: number, native: boolean, hint = upper + 3): number | null {
  if (!contained(bounds, x, z) || hint > upper + 2.15) return null;
  const flight = flightAt(x, z, native);
  if (flight) {
    const y = tread(flight.flight, flight.along);
    if (Math.abs(hint - y) <= 2.05) return y;
  }
  if (hint >= upper - 1.05 && hasApproach(x, z, native)) return upper;
  return hint <= platformY + 2.65 && inPlatform(x, z, native) ? platformY : null;
}

export function potsdamerRegionalFlightAt(x: number, y: number, z: number, native: boolean): boolean {
  if (!contained(bounds, x, z) || y < railY || y > upper + 2.65) return false;
  if (insideHall(x, z) && y < ceilingY) return true;
  const flight = flightAt(x, z, native);
  return (flight !== null && y >= tread(flight.flight, flight.along) - .03 &&
    y <= tread(flight.flight, flight.along) + 2.85) ||
    (y >= upper && hasApproach(x, z, native));
}

function solidAt(x: number, y: number, z: number, radius: number, native: boolean): boolean {
  if (!contained(bounds, x, z, radius) || y < railY - .55 || y > upper + 1.1 + radius) return false;
  if (insideHall(x, z) && Math.abs(y - ceilingY) < .24 + radius &&
    !openings.some(o => contained(o, x, z, -radius))) return true;
  const hit = flightAt(x, z, native);
  if (hit) {
    const yTread = tread(hit.flight, hit.along);
    if (y < yTread - .02 && y + radius >= yTread - .23) return true;
  }
  for (const f of flights) {
    const [along, lateral] = local(f, x, z);
    if (along < radius * -.55 || along > f.length + radius * .55) continue;
    if (Math.abs(Math.abs(lateral) - f.width / 2 - .075) > .095 + radius) continue;
    const yTread = tread(f, along);
    if (y + radius > yTread && y - radius < yTread + .99) return true;
  }
  return false;
}

export function installPotsdamerRegionalNavigation(environment: PedestrianEnvironment,
  active: () => boolean, native: () => boolean): void {
  const previousFloor = environment.interiorGroundAt;
  const previousSolid = environment.interiorSolidAt;
  const previousFlightGround = environment.flightGroundAt;
  environment.interiorGroundAt = (x, z, hint) => (contained(bounds, x, z) && active()
    ? potsdamerRegionalFloorAt(x, z, native(), hint) : null) ?? previousFloor?.(x, z, hint) ?? null;
  environment.interiorSolidAt = (x, y, z, radius = 0) =>
    (contained(bounds, x, z, radius) && active() && solidAt(x, y, z, radius, native())) ||
    previousSolid?.(x, y, z, radius) || false;
  environment.flightGroundAt = (x, y, z) => {
    if (contained(bounds, x, z) && active() && potsdamerRegionalFlightAt(x, y, z, native())) {
      return potsdamerRegionalFloorAt(x, z, native(), y) ?? railY;
    }
    return previousFlightGround?.(x, y, z) ?? null;
  };
}

function box(builder: GendarmenmarktFacadeBuilder, s: Span, bottom: number, top: number, color: number): void {
  builder.box([(s.minX + s.maxX) / 2, (top + bottom) / 2, (s.minZ + s.maxZ) / 2],
    [s.maxX - s.minX, top - bottom, s.maxZ - s.minZ], color);
}

function blocks(builder: GendarmenmarktFacadeBuilder, area: Span, grid: number,
  contains: (x: number, z: number) => boolean, bottom: number, top: number, color: number): void {
  for (let iz = Math.floor(area.minZ / grid); iz < Math.ceil(area.maxZ / grid); iz++) {
    const z = iz * grid;
    let begin: number | null = null;
    for (let ix = Math.floor(area.minX / grid); ix <= Math.ceil(area.maxX / grid); ix++) {
      const x = ix * grid;
      if (ix < Math.ceil(area.maxX / grid) && contains(x + grid / 2, z + grid / 2)) {
        begin ??= x;
      } else if (begin !== null) {
        box(builder, { minX: begin, maxX: x, minZ: z, maxZ: z + grid }, bottom, top, color);
        begin = null;
      }
    }
  }
}

function strip(builder: GendarmenmarktFacadeBuilder, a: Axis, start: number, end: number,
  offset: number, width: number, bottom: number, top: number, color: number, grid = flightGrid): void {
  const middle = at(a, (start + end) / 2, offset);
  if (!builder.minecraft) {
    builder.box([middle[0], (bottom + top) / 2, middle[1]],
      [end - start, top - bottom, width], color, -Math.atan2(a.uz, a.ux));
    return;
  }
  const area = span([at(a, start, offset - width / 2), at(a, start, offset + width / 2),
    at(a, end, offset - width / 2), at(a, end, offset + width / 2)]);
  blocks(builder, area, grid, (x, z) => {
    const [s, v] = local(a, x, z);
    return s >= start && s < end && Math.abs(v - offset) <= width / 2;
  }, bottom, top, color);
}

function surface(root: Group, name: string, ring: readonly XZ[], holes: readonly (readonly XZ[])[], y: number, color: number): void {
  const shape = (points: readonly XZ[]) => points.map(([x, z]) => new Vector2(x, z));
  const triangles = ShapeUtils.triangulateShape(shape(ring), holes.map(shape));
  const points = [...ring, ...holes.flat()];
  const meshGeometry = new BufferGeometry();
  meshGeometry.setAttribute("position", new Float32BufferAttribute(points.flatMap(([x, z]) => [x, y, z]), 3));
  meshGeometry.setIndex(triangles.flat());
  meshGeometry.computeVertexNormals();
  const day = new MeshBasicMaterial({ color, side: DoubleSide });
  const night = new MeshStandardMaterial({ color, side: DoubleSide, roughness: .78 });
  const mesh = new Mesh(meshGeometry, day);
  mesh.name = name;
  mesh.userData = { dayMaterial: day, nightMaterial: night };
  root.add(mesh);
}

function buildMotion(flight: Flight, native: boolean): Group {
  const root = new Group();
  root.position.set(flight.a[0], 0, flight.a[1]);
  markHbfMotionFrameV291(root, native);
  const length = flight.length / flight.risers;
  const treadGeometry = new BoxGeometry(
    native ? flight.width * Math.abs(flight.uz) + length * Math.abs(flight.ux) : length + .005, .14,
    native ? flight.width * Math.abs(flight.ux) + length * Math.abs(flight.uz) : flight.width,
  );
  if (!native) treadGeometry.rotateY(-Math.atan2(flight.uz, flight.ux));
  treadGeometry.deleteAttribute("uv");
  const day = new MeshBasicMaterial({ color: silver });
  const night = new MeshStandardMaterial({ color: silver, roughness: .53 });
  const steps = new InstancedMesh(treadGeometry, day, flight.risers);
  const matrix = new Matrix4();
  const from: Point = [0, flight.bottom, 0];
  const to: Point = [flight.b[0] - flight.a[0], flight.top, flight.b[1] - flight.a[1]];
  for (let i = 0; i < flight.risers; i++) {
    const t = i / flight.risers;
    steps.setMatrixAt(i, matrix.makeTranslation(to[0] * t, flight.bottom + (flight.top - flight.bottom) * t - .08, to[2] * t));
  }
  steps.computeBoundingSphere();
  steps.name = "Potsdamer Platz regional escalator " + flight.id;
  steps.userData = { dayMaterial: day, nightMaterial: night, blockNative: native, keepInMinecraft: native };
  markHbfMovingMeshV291(steps, { kind: "escalator", from, to, direction: flight.motion === -1 ? -1 : 1 });
  root.add(steps);
  return root;
}

export function createPotsdamerRegionalAccess(native: boolean): Group {
  const root = new Group();
  root.name = POTSDAMER_REGIONAL_NAME;
  root.userData = { blockNative: native, keepInMinecraft: native, fullStaticDetailOnTouch: true,
    source: geometry.sourceExtractSha256, platformRelations: geometry.platforms.map(([id]) => id) };
  const builder = new GendarmenmarktFacadeBuilder(native);
  const rectangle = (s: Span): XZ[] => [[s.minX, s.minZ], [s.maxX, s.minZ], [s.maxX, s.maxZ], [s.minX, s.maxZ]];
  if (native) {
    blocks(builder, span(hall), .5, (x, z) => inRing(hall, x, z), railY - .42, railY - .1, dark);
    blocks(builder, span(hall), .5, (x, z) => inRing(hall, x, z) && !openings.some(o => contained(o, x, z)),
      ceilingY, ceilingY + .22, concrete);
    for (const ring of platforms) blocks(builder, span(ring), platformGrid, (x, z) => inRing(ring, x, z),
      railY - .1, platformY, terrazzo);
  } else {
    surface(root, "Regional railway track bed", hall, [], railY - .1, dark);
    surface(root, "Regional station ceiling with four stair wells", hall, openings.map(rectangle), ceilingY, concrete);
    for (const [i, ring] of platforms.entries()) surface(root, "Regional island " + (i + 1), ring, [], platformY, terrazzo);
  }

  const buildLines = (lines: readonly (readonly XZ[])[], width: number, bottom: number, top: number, color: number,
    offsets: readonly number[], grid: number) => {
    for (const line of lines) for (let i = 1; i < line.length; i++) {
      const a = axis(0, line[i - 1], line[i], width);
      for (const offset of offsets) strip(builder, a, 0, a.length, offset, width, bottom, top, color, grid);
    }
  };
  buildLines(sides, .38, railY - .14, ceilingY + .04, concrete, [0], .25);
  buildLines(tracks, .13, railY - .12, railY + .02, silver, [-.7175, .7175], .125);
  const edges = geometry.edges.map(([, path]) => path as unknown as XZ[]);
  buildLines(edges, .16, railY - .04, platformY, white, [0], .125);
  for (const [i, edge] of edges.entries()) {
    const first = edge[0], last = edge.at(-1)!;
    const leftEdge = (i % 2 === 0) === (last[1] > first[1]);
    buildLines([edge], .28, platformY + .004, platformY + .025, white, [leftEdge ? -.62 : .62], .125);
  }
  for (const a of approaches) strip(builder, a, -.48, a.length + .45, 0, a.width, upper - .21, upper, terrazzo);
  for (const f of flights) {
    const count = Math.max(1, f.risers);
    const run = f.length / count;
    for (let i = 0; i < count; i++) {
      const y = tread(f, (i + .5) * run);
      strip(builder, f, i * run, (i + 1) * run, 0, f.width, y - .24, y - (f.motion ? .14 : 0), terrazzo);
      for (const side of [-1, 1]) {
        const offset = side * (f.width / 2 + .075);
        strip(builder, f, i * run, (i + 1) * run, offset, .17, y + .81, y + .97, silver);
        if (i % 4 === 0) strip(builder, f, i * run, i * run + Math.min(.12, run), offset, .15, y - .05, y + .88, dark);
      }
    }
    if (f.motion) root.add(buildMotion(f, native));
  }
  for (const z of [1020, 1074, 1090, 1147, 1171, 1200]) {
    for (let i = 0; i < 2; i++) {
      const x = (railX(tracks[i * 2], z) + railX(tracks[i * 2 + 1], z)) / 2;
      builder.box([x, ceilingY - .16, z], [6.7, .12, .32], 0xf5e5c9);
      builder.box([x, platformY + .28, z - 2.3], [1.25, .12, .48], 0x68777d);
      builder.box([x, platformY + .14, z - 2.3], [1.05, .27, .32], dark);
      builder.box([x, platformY + 2.56, z + 1.8], [2.6, .59, .17], 0x173853);
      for (const [j, glyph] of (i === 0 ? ["1", "2"] : ["3", "4"]).entries()) {
        const x0 = x - .55 + j * 1.1;
        if (glyph === "1") {
          builder.box([x0, platformY + 2.56, z + 1.69], [.055, .36, .035], white);
        } else {
          const strokes: Record<string, readonly [number, number, number, number][]> = {
            "2": [[0,.15,.23,.05],[.09,.08,.05,.15],[0,0,.23,.05],[-.09,-.08,.05,.15],[0,-.15,.23,.05]],
            "3": [[0,.15,.23,.05],[.09,0,.05,.33],[0,0,.19,.05],[0,-.15,.23,.05]],
            "4": [[-.09,.08,.05,.16],[.09,0,.05,.33],[0,0,.23,.05]],
          };
          for (const [dx, dy, w, h] of strokes[glyph]) {
            builder.box([x0 + dx, platformY + 2.56 + dy, z + 1.69], [w, h, .035], white);
          }
        }
      }
    }
  }
  root.add(builder.finish("Regional platforms, rails, stair banks, signs and luminaires"));
  return freezeStaticSceneTransforms(root);
}
