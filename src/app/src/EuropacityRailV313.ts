import {
  BoxGeometry, BufferGeometry, Color, Float32BufferAttribute, Group, InstancedMesh,
  Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3,
} from "three";
import { createDkbLetteringV313 } from "./DkbLetteringV313";
import { createSapEntranceSignV313 } from "./SapEntranceSignV313";
import data from "./data/europacityRailV313.json";
import type { RailPayload } from "./RailNetwork";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { worldGroundSampler, type VoxelPayload } from "./terrainPayload";

type Point = [number, number, number];
type Chain = { id: string; kind: string; ways: number[]; points: number[][]; bridge: number[][] };
type Section = { point: Point; normal: [number, number]; station: number };
type Face = [Point, Point, Point];
const ROAD_CELL = 2;
const ROAD_WIDTH = data.road.width;
const ROAD_DEPTH = 0.74;
const STEEL = 0x667780;
const CONCRETE = 0xb3ada0;
const BALLAST = 0xa49b87;
const RAIL = 0x65615a;
const ASPHALT = 0x737773;
const PAVING = 0xb7b5aa;
const CYCLE = 0x9d766d;
const UP = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);

export const EUROPACITY_RAIL_V313 = Object.freeze({
  bridgeNumber: "3446154",
  bridgeWidthM: ROAD_WIDTH,
  roadMappedWay: 4677616,
  railwayArchLengthM: 48,
  sourceWayIds: data.track.flatMap(track => track.ways.map(Math.abs)),
  retiredDecks: data.legacy.viaduct.length,
  retiredTrackCourses: data.legacy.viaduct_tracks.length + data.legacy.embankment_tracks.length,
  retiredPiers: data.legacy.piers.length,
});

function readPoint(value: number[]): Point {
  return [value[0], value[1], value[2]];
}

function sections(points: number[][]): Section[] {
  let station = 0;
  return points.map((value, index) => {
    const point = readPoint(value);
    const previous = points[Math.max(index - 1, 0)];
    const next = points[Math.min(index + 1, points.length - 1)];
    if (index) station += Math.hypot(point[0] - previous[0], point[2] - previous[2]);
    const dx = next[0] - previous[0];
    const dz = next[2] - previous[2];
    const length = Math.hypot(dx, dz) || 1;
    return { point, normal: [-dz / length, dx / length], station };
  });
}

function at(section: Section, offset: number, rise = 0): Point {
  return [section.point[0] + section.normal[0] * offset, section.point[1] + rise, section.point[2] + section.normal[1] * offset];
}

function stationAt(course: Section[], station: number): Section {
  const end = course.findIndex(section => section.station >= station);
  if (end <= 0) return course[end === 0 ? 0 : course.length - 1];
  const a = course[end - 1], b = course[end];
  const ratio = (station - a.station) / (b.station - a.station);
  const point = a.point.map((value, index) => value + (b.point[index] - value) * ratio) as Point;
  return { point, normal: a.normal, station };
}

function closestSection(course: Section[], x: number, z: number): Section {
  let result = course[0], minimum = Infinity;
  for (let i = 1; i < course.length; i++) {
    const a = course[i - 1], b = course[i];
    const dx = b.point[0] - a.point[0], dz = b.point[2] - a.point[2];
    const lengthSquared = dx * dx + dz * dz;
    if (!lengthSquared) continue;
    const ratio = Math.max(0, Math.min(1, ((x - a.point[0]) * dx + (z - a.point[2]) * dz) / lengthSquared));
    const px = a.point[0] + ratio * dx, pz = a.point[2] + ratio * dz;
    const distance = (x - px) ** 2 + (z - pz) ** 2;
    if (distance >= minimum) continue;
    minimum = distance;
    result = {
      point: [px, a.point[1] + ratio * (b.point[1] - a.point[1]), pz],
      normal: a.normal,
      station: a.station + ratio * (b.station - a.station),
    };
  }
  return result;
}

function stripFaces(course: Section[], low: number, high: number, rise: number): Face[] {
  const faces: Face[] = [];
  for (let i = 1; i < course.length; i++) {
    const a = at(course[i - 1], low, rise), b = at(course[i - 1], high, rise);
    const c = at(course[i], high, rise), d = at(course[i], low, rise);
    faces.push([a, b, c], [a, c, d]);
  }
  return faces;
}

class JunctionBatch {
  private readonly matrices: number[] = [];
  private readonly colours: number[] = [];
  private readonly vertices: number[] = [];
  private readonly faceColours: number[] = [];
  private readonly matrix = new Matrix4();
  private readonly colour = new Color();

  constructor(readonly native: boolean) {}

  box(position: Point, size: Point, tone: number, rotation?: Quaternion): void {
    this.matrix.compose(new Vector3(...position), rotation ?? new Quaternion(), new Vector3(...size)).toArray(this.matrices, this.matrices.length);
    this.colour.setHex(tone).toArray(this.colours, this.colours.length);
  }

  beam(a: Point, b: Point, width: number, depth: number, tone: number, nativePitch = 0.8): void {
    const direction = new Vector3(...b).sub(new Vector3(...a));
    const length = direction.length();
    if (length < 0.015) return;
    if (!this.native) {
      const rotation = new Quaternion().setFromUnitVectors(Z, direction.normalize());
      this.box(a.map((value, i) => (value + b[i]) / 2) as Point, [width, depth, length + 0.012], tone, rotation);
      return;
    }
    // The native course is sampled into axis-aligned members independently.
    const count = Math.ceil(length / nativePitch);
    for (let i = 0; i < count; i++) {
      const ratio = (i + 0.5) / count;
      const position = a.map((value, k) => value + ratio * (b[k] - value)) as Point;
      const side = Math.max(width, length / count + 0.035);
      this.box(position, [side, depth, side], tone);
    }
  }

  faces(faces: Face[], tone: number): void {
    this.colour.setHex(tone);
    for (const face of faces) {
      for (const point of face) {
        this.vertices.push(...point);
        this.faceColours.push(this.colour.r, this.colour.g, this.colour.b);
      }
    }
  }

  finish(root: Group): void {
    if (this.matrices.length) {
      const day = new MeshBasicMaterial({ color: 0xffffff });
      const night = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
      const geometry = new BoxGeometry();
      geometry.deleteAttribute("uv");
      const mesh = new InstancedMesh(geometry, day, this.colours.length / 3);
      mesh.instanceMatrix.array.set(this.matrices);
      for (let i = 0; i < mesh.count; i++) mesh.setColorAt(i, this.colour.fromArray(this.colours, i * 3));
      mesh.name = "Europacity rails, girders and bridge fittings v313";
      mesh.userData = { dayMaterial: day, nightMaterial: night, keepInMinecraft: this.native, blockNative: this.native };
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
      root.add(mesh);
    }
    if (this.vertices.length) {
      const day = new MeshBasicMaterial({ vertexColors: true });
      const night = new MeshStandardMaterial({ vertexColors: true, roughness: 0.94 });
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new Float32BufferAttribute(this.vertices, 3));
      geometry.setAttribute("color", new Float32BufferAttribute(this.faceColours, 3));
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
      const mesh = new Mesh(geometry, day);
      mesh.name = "Europacity rail and road deck sections v313";
      mesh.userData = { dayMaterial: day, nightMaterial: night };
      root.add(mesh);
    }
  }
}

const road = sections(data.road.points);
const roadBounds = { minX: -970, maxX: -694, minZ: -2077, maxZ: -1867 };
const roadBands = [
  { low: -10.2, high: -8.2, rise: 0.12, tone: PAVING },
  { low: -8.2, high: -6.32, rise: 0.07, tone: CYCLE },
  { low: -6.32, high: 6.32, rise: 0, tone: ASPHALT },
  { low: 6.32, high: 8.2, rise: 0.07, tone: CYCLE },
  { low: 8.2, high: 10.2, rise: 0.12, tone: PAVING },
];
const roadSurface = roadBands.map(band => ({ ...band, faces: stripFaces(road, band.low, band.high, band.rise) }));

function triangleHeight(x: number, z: number, [a, b, c]: Face): number | null {
  if (x < Math.min(a[0], b[0], c[0]) || x > Math.max(a[0], b[0], c[0]) || z < Math.min(a[2], b[2], c[2]) || z > Math.max(a[2], b[2], c[2])) return null;
  const ux = b[0] - a[0], uz = b[2] - a[2], vx = c[0] - a[0], vz = c[2] - a[2];
  const determinant = ux * vz - uz * vx;
  if (Math.abs(determinant) < 1e-9) return null;
  const u = ((x - a[0]) * vz - (z - a[2]) * vx) / determinant;
  const v = (ux * (z - a[2]) - uz * (x - a[0])) / determinant;
  if (u < -1e-7 || v < -1e-7 || u + v > 1 + 1e-7) return null;
  return a[1] + u * (b[1] - a[1]) + v * (c[1] - a[1]);
}

function roadTop(x: number, z: number): { height: number; tone: number } | null {
  if (x < roadBounds.minX || x > roadBounds.maxX || z < roadBounds.minZ || z > roadBounds.maxZ) return null;
  for (const band of roadSurface) {
    for (const face of band.faces) {
      const height = triangleHeight(x, z, face);
      if (height !== null) return { height, tone: band.tone };
    }
  }
  return null;
}

function nativeRoadTop(x: number, z: number) {
  return roadTop(Math.floor(x / ROAD_CELL) * ROAD_CELL + ROAD_CELL / 2, Math.floor(z / ROAD_CELL) * ROAD_CELL + ROAD_CELL / 2);
}

/** Same road surface as the rendered deck, including its independent native blocks. */
export function perlebergerRoadFloorAtV313(x: number, z: number, native: boolean, currentY?: number): number | null {
  const hit = native ? nativeRoadTop(x, z) : roadTop(x, z);
  if (!hit) return null;
  // Keep the lower public/ground route selected if a visitor is already below the deck.
  return currentY !== undefined && currentY < hit.height - 1.35 ? null : hit.height;
}

function nativeFaces(faces: Face[]): Map<string, Point> {
  const cells = new Map<string, Point>();
  for (const face of faces) {
    const x = face.map(point => point[0]), z = face.map(point => point[2]);
    const lowX = Math.floor(Math.min(...x) / ROAD_CELL) * ROAD_CELL;
    const lowZ = Math.floor(Math.min(...z) / ROAD_CELL) * ROAD_CELL;
    const highX = Math.max(...x), highZ = Math.max(...z);
    for (let px = lowX + 1; px <= highX; px += ROAD_CELL) {
      for (let pz = lowZ + 1; pz <= highZ; pz += ROAD_CELL) {
        const key = `${px},${pz}`;
        if (cells.has(key)) continue;
        const height = triangleHeight(px, pz, face);
        if (height !== null) cells.set(key, [px, height, pz]);
      }
    }
  }
  return cells;
}

function deck(batch: JunctionBatch, course: Section[], half: number, depth: number, tone: number, cap = true): void {
  if (batch.native) {
    // Each top slab has a separate cardinal footprint sampled from the source corridor.
    for (const [x, y, z] of nativeFaces(stripFaces(course, -half, half, 0)).values()) {
      batch.box([x, y - depth / 2, z], [ROAD_CELL, depth, ROAD_CELL], tone);
    }
    return;
  }
  if (cap) batch.faces(stripFaces(course, -half, half, 0), tone);
  batch.faces(stripFaces(course, -half, half, -depth).map(([a, b, c]) => [a, c, b]), tone);
  for (let index = 1; index < course.length; index++) {
    for (const side of [-1, 1]) {
      const a = at(course[index - 1], side * half), b = at(course[index], side * half);
      const c = at(course[index], side * half, -depth), d = at(course[index - 1], side * half, -depth);
      const triangles: Face[] = side > 0 ? [[a, c, b], [a, d, c]] : [[a, b, c], [a, c, d]];
      batch.faces(triangles, tone);
    }
  }
  for (const end of [course[0], course[course.length - 1]]) {
    const a = at(end, -half), b = at(end, half), c = at(end, half, -depth), d = at(end, -half, -depth);
    batch.faces(end === course[0] ? [[a, d, c], [a, c, b]] : [[a, b, c], [a, c, d]], tone);
  }
}

function roadStructure(batch: JunctionBatch, ground: (x: number, z: number) => number | null): void {
  const [start, end] = data.road.bridge[0];
  if (batch.native) {
    const emitted = new Set<string>();
    for (const band of roadSurface) {
      for (const [key, [x, y, z]] of nativeFaces(band.faces)) {
        if (emitted.has(key)) continue;
        const station = closestSection(road, x, z).station;
        const isApproach = station < start || station > end;
        const depth = isApproach ? Math.max(ROAD_DEPTH, y - (ground(x, z) ?? 5.2) + 0.12) : ROAD_DEPTH;
        batch.box([x, y - depth / 2, z], [ROAD_CELL, depth, ROAD_CELL], band.tone);
        emitted.add(key);
      }
    }
  } else {
    deck(batch, road, ROAD_WIDTH / 2, ROAD_DEPTH, STEEL, false);
    for (const band of roadSurface) batch.faces(band.faces, band.tone);
    for (let i = 1; i < road.length; i++) {
      const a = road[i - 1], b = road[i];
      const centre = (a.station + b.station) / 2;
      if (centre >= start && centre <= end) continue;
      for (const side of [-1, 1]) {
        const pa = at(a, side * ROAD_WIDTH / 2, -ROAD_DEPTH), pb = at(b, side * ROAD_WIDTH / 2, -ROAD_DEPTH);
        const qa: Point = [pa[0], Math.min(pa[1], ground(pa[0], pa[2]) ?? 5.2) - 0.06, pa[2]];
        const qb: Point = [pb[0], Math.min(pb[1], ground(pb[0], pb[2]) ?? 5.2) - 0.06, pb[2]];
        batch.faces(side > 0 ? [[pa, qb, pb], [pa, qa, qb]] : [[pa, pb, qb], [pa, qb, qa]], CONCRETE);
      }
    }
  }
  for (let station = start; station <= end; station += 3.1) {
    for (const side of [-1, 1]) {
      const position = at(stationAt(road, station), side * 10.0, 0.63);
      batch.box(position, [0.095, 1.06, 0.095], STEEL);
    }
  }
  for (const side of [-1, 1]) {
    for (let station = start; station < end; station += 3.1) {
      const a = stationAt(road, station), b = stationAt(road, Math.min(end, station + 3.1));
      for (const rise of [0.34, 1.17]) batch.beam(at(a, side * 10.0, rise), at(b, side * 10.0, rise), 0.09, 0.095, STEEL);
      batch.beam(at(a, side * 7.6, -0.66), at(b, side * 7.6, -0.66), 0.28, 0.42, 0x777f80);
    }
  }
  // Abutments close the two embankment ends. The tracks remain open between them.
  for (const station of [start, end]) {
    const section = stationAt(road, station), [x, top, z] = section.point;
    const foot = ground(x, z) ?? 5.2;
    if (top - foot < 1) continue;
    const rotation = new Quaternion().setFromAxisAngle(UP, Math.atan2(section.normal[0], section.normal[1]));
    if (batch.native) batch.beam(at(section, -9.5, (foot - top) / 2), at(section, 9.5, (foot - top) / 2), 0.65, top - foot - 0.42, CONCRETE);
    else batch.box([x, (top + foot) / 2 - 0.22, z], [1.4, top - foot - 0.42, 20.4], CONCRETE, rotation);
  }
  for (let station = 4; station + 3 < road[road.length - 1].station; station += 10) {
    const a = stationAt(road, station), b = stationAt(road, station + 3);
    for (const offset of [-3.15, 0, 3.15]) batch.beam(at(a, offset, 0.022), at(b, offset, 0.022), 0.12, 0.026, 0xe5e1ce);
  }
}

function trackStructure(batch: JunctionBatch, track: Chain, course: Section[]): void {
  const electrified = track.kind !== "mainline";
  for (let index = 1; index < course.length; index++) {
    const a = course[index - 1], b = course[index];
    for (const offset of [-0.7175, 0.7175]) batch.beam(at(a, offset, -0.062), at(b, offset, -0.062), 0.14, 0.124, RAIL, 1.04);
    if (electrified) batch.beam(at(a, -1.48, -0.14), at(b, -1.48, -0.14), 0.16, 0.14, 0x7e817b, 1.04);
  }
  const step = batch.native ? 2.8 : 1.28;
  for (let station = step / 2; station < course[course.length - 1].station; station += step) {
    const section = stationAt(course, station);
    batch.beam(at(section, -1.26, -0.19), at(section, 1.26, -0.19), 0.26, 0.13, 0xb1aa98);
  }
}

function pairedDeck(batch: JunctionBatch, primary: Chain, course: Section[], partner: Section[], half: number): void {
  const [start, end] = [primary.bridge[0][0], primary.bridge[primary.bridge.length - 1][1]];
  const samples = [stationAt(course, start), ...course.filter(row => row.station > start && row.station < end), stationAt(course, end)];
  const centre = samples.map(section => {
    const [x, y, z] = section.point;
    const other = closestSection(partner, x, z).point;
    return [(x + other[0]) / 2, (y + other[1]) / 2 - 0.29, (z + other[2]) / 2];
  });
  deck(batch, sections(centre), half, primary.kind === "mainline" ? 1.35 : 0.89, primary.kind === "mainline" ? 0x9c9c93 : CONCRETE);
}

function flyoverCatenary(batch: JunctionBatch, course: Section[], partner: Section[], from: number, to: number): void {
  // The press photograph shows the separate overhead equipment on the Fernbahn.
  // Its spacing is a display estimate. S-Bahn rails use side conductors instead.
  const stay = 0x798680;
  for (let station = from + 12; station < to; station += 45) {
    const section = stationAt(course, station);
    const [x, y, z] = section.point;
    const other = closestSection(partner, x, z).point;
    const dx = other[0] - x, dz = other[2] - z;
    const length = Math.hypot(dx, dz);
    if (length < 2 || length > 6) continue;
    const px = x - dx / length * 2.45, pz = z - dz / length * 2.45;
    batch.box([px, y + 2.83, pz], [0.18, 6.1, 0.18], stay);
    batch.beam([px, y + 5.63, pz], [x, y + 5.1, z], 0.075, 0.075, stay);
  }
  // The native view uses masts and cantilevers without a fine diagonal wire.
  if (batch.native) return;
  for (let station = from; station < to; station += 8) {
    const a = stationAt(course, station), b = stationAt(course, Math.min(to, station + 8));
    batch.beam(at(a, 0, 5.07), at(b, 0, 5.07), 0.025, 0.025, 0x666f68);
    const p = closestSection(partner, a.point[0], a.point[2]), q = closestSection(partner, b.point[0], b.point[2]);
    batch.beam(at(p, 0, 5.07), at(q, 0, 5.07), 0.025, 0.025, 0x666f68);
  }
}

function railArch(batch: JunctionBatch, course: Section[], partner: Section[]): void {
  const centre = data.archCenter[0];
  const half = EUROPACITY_RAIL_V313.railwayArchLengthM / 2;
  const frame = (d: number, side: number, arch: boolean): Point => {
    const section = stationAt(course, centre + d);
    const [x, y, z] = section.point;
    const q = closestSection(partner, x, z).point;
    const separation = Math.hypot(q[0] - x, q[2] - z);
    const offset = side * 4.34 / Math.max(0.1, separation);
    const rise = arch ? 0.25 + 6.3 * (1 - (d / half) ** 2) : 0;
    return [(x + q[0]) / 2 + (q[0] - x) * offset, (y + q[1]) / 2 + rise, (z + q[2]) / 2 + (q[2] - z) * offset];
  };
  for (const side of [-1, 1]) {
    for (let d = -half; d < half; d += 2) {
      const next = Math.min(half, d + 2);
      batch.beam(frame(d, side, true), frame(next, side, true), 0.51, 0.54, STEEL);
      batch.beam(frame(d, side, false), frame(next, side, false), 0.21, 0.32, STEEL);
      if (d > -half && d % 4 === 0) batch.beam(frame(d, side, false), frame(d, side, true), 0.13, 0.15, STEEL);
    }
  }
  for (const d of [-16, -8, 0, 8, 16]) batch.beam(frame(d, -1, true), frame(d, 1, true), 0.24, 0.26, STEEL);
}

function railApproachFill(batch: JunctionBatch, track: Chain, course: Section[], ground: (x: number, z: number) => number | null): void {
  for (let i = 1; i < course.length; i++) {
    const a = course[i - 1], b = course[i], middle = (a.station + b.station) / 2;
    if (track.bridge.some(([start, end]) => middle >= start && middle <= end)) continue;
    const section = stationAt(course, middle), [x, y, z] = section.point;
    const floor = ground(x, z) ?? 5.2;
    const depth = y - floor - 0.26;
    if (depth < 0.4) continue;
    if (batch.native) batch.beam(at(a, 0, -depth / 2 - 0.26), at(b, 0, -depth / 2 - 0.26), 3.75, depth, BALLAST, 1.75);
    else deck(batch, [a, b].map(row => ({ ...row, point: at(row, 0, -0.26) })), 1.9, depth, BALLAST);
  }
}

/** Build both rail levels and the public road as a single complete mode owner. */
export function createEuropacityRailV313(ground: VoxelPayload, native = false): Group {
  const root = new Group();
  root.name = "Europacity rail junction and Perleberger Brücke v313";
  root.userData = { sourceBound: true, blockNative: native, keepInMinecraft: native, textureFree: true, source: EUROPACITY_RAIL_V313 };
  const sample = worldGroundSampler(ground);
  const batch = new JunctionBatch(native);
  const courses = data.track.map(track => sections(track.points));
  for (const [i, track] of data.track.entries()) {
    if (track.kind === "native-only" && !native) continue;
    trackStructure(batch, track, courses[i]);
    if (track.kind !== "native-only") railApproachFill(batch, track, courses[i], sample);
  }
  pairedDeck(batch, data.track[0], courses[0], courses[1], 4.65);
  pairedDeck(batch, data.track[2], courses[2], courses[3], 5.0);
  flyoverCatenary(batch, courses[2], courses[3], data.track[2].bridge[0][0], data.track[2].bridge[1][1]);
  railArch(batch, courses[0], courses[1]);
  for (const [x, y, z] of [...data.supports["s-bahn"], ...data.supports.mainline]) {
    const foot = sample(x, z) ?? 5.2;
    if (y - foot > 0.4) batch.box([x, (y + foot) / 2, z], [1.45, y - foot, 1.45], CONCRETE);
  }
  roadStructure(batch, sample);
  batch.finish(root);
  if (native) {
    root.add(createDkbLetteringV313(true));
    const sap = createSapEntranceSignV313(ground);
    if (sap) root.add(sap);
  }
  return freezeStaticSceneTransforms(root);
}

/** Admit only the exact old deck, rail paths and pier ordinals replaced above. */
export function replaceEuropacityRailPayloadV313(payload: RailPayload): RailPayload | null {
  const keys = ["viaduct", "viaduct_tracks", "embankment_tracks", "piers"] as const;
  for (const key of keys) {
    for (const [index, expected] of data.legacy[key]) {
      if (typeof index !== "number" || JSON.stringify(payload[key][index]) !== JSON.stringify(expected)) return null;
    }
  }
  const skip = (key: typeof keys[number]) => new Set(data.legacy[key].map(row => row[0]));
  const omitDeck = skip("viaduct"), omitTrack = skip("viaduct_tracks"), omitGrade = skip("embankment_tracks"), omitPier = skip("piers");
  return {
    ...payload,
    viaduct: payload.viaduct.filter((_, index) => !omitDeck.has(index)),
    viaduct_tracks: payload.viaduct_tracks.filter((_, index) => !omitTrack.has(index)),
    embankment_tracks: payload.embankment_tracks.map((track, index) => omitGrade.has(index) ? [] : track),
    piers: payload.piers.filter((_, index) => !omitPier.has(index)),
  };
}
