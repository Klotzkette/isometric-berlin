import {
  BoxGeometry, Color, CylinderGeometry, Group, InstancedBufferAttribute,
  InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial,
  Quaternion, SphereGeometry, Vector3,
} from "three";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { letteringStrokePaths } from "./drawnLettering";
import source from "./schlossNaturkundeSource.json";

type Point = [number, number, number];
type Axis = { start: readonly [number, number]; end: readonly [number, number]; side: -1 | 1 };
type Kind = "box" | "column" | "head" | "drum" | "dome";
type Instance = { matrix: number[]; color: number };
const UP = new Vector3(0, 1, 0);
const STONE = 0xe3d0a7, LIGHT = 0xece1c5, DARK = 0xb8a780;
const GLASS = 0x4b6266, FRAME = 0xd5d3be, GOLD = 0xd5b44f;
export const SCHLOSS_NATURKUNDE_FACADES_GROUP_NAME = "Schloss and Naturkunde source-bound facade recognition";
export const MINECRAFT_SCHLOSS_NATURKUNDE_FACADES_GROUP_NAME = "Block-native Schloss and Naturkunde facade recognition";
export const SCHLOSS_NATURKUNDE_FACADE_PROFILE = {
  schloss: {
    osmKey: "relation/3007958", lod2Parent: "DEBE01AL5N30002e", groundY: 5.236,
    domePart: "DEBE3DzLpp1avSfB", domeCentre: [1979.43, 278.0],
    publishedOverallHeightM: 70, crossTopY: 75.236,
    north: { start: [1937.111, 234.4], end: [2085.2, 135.19], side: 1 } as Axis,
    south: { start: [2004.3, 329.897], end: [2141.3, 237.2], side: -1 } as Axis,
    west: { start: [1937.111, 234.4], end: [2004.3, 329.897], side: -1 } as Axis,
    east: { start: [2085.2, 135.19], end: [2147.722, 223.8], side: 1 } as Axis,
    baroqueFronts: 3, modernFronts: 1,
  },
  naturkunde: {
    osmKey: "node/538692583", lod2Parent: "DEBE01YYK00002C5", mainPart: "DEBE3DrUA8mGJ9k2",
    groundY: 5.2, front: { start: [539.842, -1211.588], end: [599.47, -1238.349], side: -1 } as Axis,
    facadeBays: 15, centralBays: 3, portraitFields: 3, entranceFigures: 2,
  },
  textureFree: true, photographsBundled: false, catalogueAddition: false,
  geometryStatus: "Source-bound facade axes; windows, orders, carving, balusters and lantern proportions are procedural display subdivisions, not a facade survey.",
} as const;
function length(a: Axis): number { return Math.hypot(a.end[0] - a.start[0], a.end[1] - a.start[1]); }
function yaw(a: Axis): number { return -Math.atan2(a.end[1] - a.start[1], a.end[0] - a.start[0]); }
const naturkundeAxis = SCHLOSS_NATURKUNDE_FACADE_PROFILE.naturkunde.front;
const naturkundeFrontRing = source.profiles.naturkunde.parts
  .find(p => p.id === SCHLOSS_NATURKUNDE_FACADE_PROFILE.naturkunde.mainPart)!.ring
  .map(([x, z]) => {
    const dx = naturkundeAxis.end[0] - naturkundeAxis.start[0];
    const dz = naturkundeAxis.end[1] - naturkundeAxis.start[1];
    const l = length(naturkundeAxis), px = x - naturkundeAxis.start[0], pz = z - naturkundeAxis.start[1];
    return [(px * dx + pz * dz) / l, (-px * dz + pz * dx) / l];
  });

/** Exact frontmost source edge: the central risalit projects up to 2.75 m. */
export function naturkundeFrontOffsetAt(u: number): number {
  let front = -Infinity;
  for (let i = 0; i < naturkundeFrontRing.length; i++) {
    const a = naturkundeFrontRing[i], b = naturkundeFrontRing[(i + 1) % naturkundeFrontRing.length];
    if (u < Math.min(a[0], b[0]) - 1e-6 || u > Math.max(a[0], b[0]) + 1e-6) continue;
    const span = b[0] - a[0];
    const v = Math.abs(span) < 1e-6 ? Math.max(a[1], b[1]) : a[1] + (b[1] - a[1]) * (u - a[0]) / span;
    front = Math.max(front, v);
  }
  return Number.isFinite(front) ? front : 0;
}
function point(a: Axis, u: number, y: number, out = 0.65): Point {
  if (a === naturkundeAxis) out += naturkundeFrontOffsetAt(u);
  const dx = a.end[0] - a.start[0], dz = a.end[1] - a.start[1], l = length(a);
  return [a.start[0] + (dx * u + dz * out * a.side) / l, y,
    a.start[1] + (dz * u - dx * out * a.side) / l];
}
class Builder {
  readonly batches = new Map<Kind, Instance[]>();
  readonly matrix = new Matrix4();
  readonly rotation = new Quaternion();
  constructor(readonly minecraft: boolean) {}
  add(kind: Kind, p: Point, size: Point, color: number, rotation = new Quaternion()): void {
    // Keep the source rotation: a long angled cornice's world AABB becomes
    // a broad plate across the building. Native detail uses only box shapes.
    if (this.minecraft) kind = "box";
    this.matrix.compose(new Vector3(...p), rotation, new Vector3(...size));
    const batch = this.batches.get(kind) ?? [];
    batch.push({ matrix: this.matrix.toArray(), color }); this.batches.set(kind, batch);
  }
  box(p: Point, size: Point, color: number, angle = 0): void {
    this.add("box", p, size, color, this.rotation.setFromAxisAngle(UP, angle));
  }
  beam(a: Point, b: Point, width: number, color: number): void {
    const d = new Vector3(...b).sub(new Vector3(...a)), l = d.length();
    if (l < 0.001) return;
    this.add("box", a.map((v, i) => (v + b[i]) / 2) as Point, [width, l, width], color,
      this.rotation.setFromUnitVectors(UP, d.multiplyScalar(1 / l)));
  }
  facade(a: Axis, u: number, y: number, w: number, h: number, depth: number, color: number, out = .65): void {
    // Long mouldings follow changes of the projecting street wall.
    const pieces = a === naturkundeAxis && w > 8 ? Math.ceil(w / 2.2) : 1;
    for (let i = 0; i < pieces; i++) {
      const centre = u - w / 2 + (i + .5) * w / pieces;
      this.box(point(a, centre, y, out), [w / pieces, h, depth], color, yaw(a));
    }
  }
  arch(a: Axis, u: number, spring: number, radius: number, width: number, color: number): void {
    const n = this.minecraft ? 5 : 8;
    for (let i = 0; i < n; i++) this.beam(
      point(a, u + Math.cos(i * Math.PI / n) * radius, spring + Math.sin(i * Math.PI / n) * radius, .9),
      point(a, u + Math.cos((i + 1) * Math.PI / n) * radius, spring + Math.sin((i + 1) * Math.PI / n) * radius, .9), width, color);
  }
  finish(root: Group): void {
    const day = new MeshBasicMaterial({ color: 0xffffff });
    const night = new MeshStandardMaterial({ color: 0xffffff, roughness: .88, flatShading: true });
    for (const [kind, instances] of this.batches) {
      const geometry = kind === "dome" ? new SphereGeometry(.5, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2) :
        kind === "drum" ? new CylinderGeometry(.5, .5, 1, 8) : kind === "column" ? new CylinderGeometry(.5, .5, 1, 10) :
        kind === "head" ? new SphereGeometry(.5, 8, 5) : new BoxGeometry(1, 1, 1);
      geometry.deleteAttribute("uv");
      const mesh = new InstancedMesh(geometry, day, 0);
      const matrices = new Float32Array(instances.length * 16), colors = new Float32Array(instances.length * 3), color = new Color();
      instances.forEach((v, i) => { matrices.set(v.matrix, i * 16); color.setHex(v.color).toArray(colors, i * 3); });
      mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
      mesh.instanceColor = new InstancedBufferAttribute(colors, 3); mesh.count = instances.length;
      mesh.name = `${root.name} ${kind}`; mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true };
      mesh.computeBoundingBox(); mesh.computeBoundingSphere(); root.add(mesh);
    }
  }
}
function statue(b: Builder, p: Point, scale = 1): void {
  b.box([p[0], p[1] + .12 * scale, p[2]], [1.1 * scale, .24 * scale, 1.1 * scale], DARK);
  b.add("column", [p[0], p[1] + 1.1 * scale, p[2]], [.7 * scale, 1.9 * scale, .7 * scale], LIGHT);
  b.add("head", [p[0], p[1] + 2.25 * scale, p[2]], [.55 * scale, .63 * scale, .55 * scale], LIGHT);
}
function palaceFront(b: Builder, axis: Axis, bays: number, portals: number[]): void {
  const l = length(axis), pitch = l / bays, base = 5.236;
  for (const [y, h, depth] of [[1,.8,.65],[8.5,.5,.9],[16,.45,.7],[28.5,.8,1.1],[30,.6,1.2]])
    b.facade(axis, l / 2, base + y, l, h, depth, LIGHT);
  for (let i = 0; i < bays; i++) {
    const u = (i + .5) * pitch;
    if (portals.some((v) => Math.abs(u - v * l) < 7.2)) continue;
    for (const [j, h] of [3.7, 12, 21, 26.25].entries()) {
      const y = base + h, w = pitch * .43, height = j === 2 ? 5.4 : j === 3 ? 2 : 3.7;
      b.facade(axis, u, y, w + .42, height + .48, .23, DARK, .62);
      b.facade(axis, u, y, w, height, .25, GLASS, .79);
      b.facade(axis, u, y, .10, height, .15, FRAME, .98);
      if (!b.minecraft) b.facade(axis, u, y + .45, w, .1, .14, FRAME, .98);
      b.facade(axis, u, y - height / 2 - .15, w + .7, .26, .55, LIGHT, .95);
      if (j === 1 || j === 2) {
        const top = y + height / 2 + .35;
        b.beam(point(axis, u - w * .62, top, 1.05), point(axis, u, top + .75, 1.05), .2, LIGHT);
        b.beam(point(axis, u, top + .75, 1.05), point(axis, u + w * .62, top, 1.05), .2, LIGHT);
      }
    }
  }
  for (const fraction of portals) {
    const u = fraction * l;
    b.facade(axis, u, base + 4.2, 6.8, 8.4, .3, 0x3f443f, .82);
    b.arch(axis, u, base + 6.7, 3.4, .65, LIGHT);
    for (const side of [-1, 1]) for (const offset of [4.6, 6.4]) {
      const p = point(axis, u + side * offset, base + 18.25, 1.65);
      b.add("column", p, [1.05, 17.8, 1.05], LIGHT);
      b.facade(axis, u + side * offset, base + 9.3, 1.5, .65, 1.5, DARK, 1.65);
      b.facade(axis, u + side * offset, base + 27.4, 1.7, .7, 1.5, LIGHT, 1.65);
    }
    b.facade(axis, u, base + 28.3, 15.3, .9, 1.8, LIGHT, 1.5);
    b.facade(axis, u, base + 29.45, 13.8, 1.25, .8, STONE, 1.2);
    for (const side of [-1, 1]) statue(b, point(axis, u + side * 5.4, base + 30.4, 1.15), .9);
  }
  for (let u = .7; u < l; u += b.minecraft ? 3.3 : 1.8)
    b.facade(axis, u, base + 29.2, .22, 1.1, .3, DARK, .85);
}
function schloss(b: Builder): void {
  const p = SCHLOSS_NATURKUNDE_FACADE_PROFILE.schloss;
  palaceFront(b, p.north, 33, [.31, .76]);
  palaceFront(b, p.south, 31, [.39, .76]);
  palaceFront(b, p.west, 21, [.515]);
  // Modern Spree elevation intentionally retains its spare concrete/glass order.
  const l = length(p.east);
  for (let bay = 0; bay < 12; bay++) for (const y of [11, 19.8, 27.8])
    b.facade(p.east, (bay + .5) * l / 12, y, 3.65, 5.5, .23, GLASS, .72);
  const [x, z] = p.domeCentre;
  // A curved subdivision replaces the LoD2 dome's coarse extruded perimeter,
  // retaining the same footprint and 64.870 m top; original planes are retained.
  if (!b.minecraft) {
    b.add("drum", [x, 41.25, z], [23.6, 11.9, 23.6], STONE);
    b.add("dome", [x, 47.2, z], [23.6, 35.34, 23.6], 0x775443);
  }
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, dx = Math.cos(a), dz = Math.sin(a);
    b.box([x + dx * 11.8, 42, z + dz * 11.8], [2.8, 5.7, .3], GLASS, Math.PI / 2 - a);
    statue(b, [x + dx * 11.6, 47.35, z + dz * 11.6], 1.1);
    if (!b.minecraft) for (let j = 0; j < 10; j++) {
      const t0 = j * Math.PI / 20, t1 = (j + 1) * Math.PI / 20;
      b.beam([x + dx * 11.87 * Math.cos(t0), 47.2 + 17.72 * Math.sin(t0), z + dz * 11.87 * Math.cos(t0)],
        [x + dx * 11.87 * Math.cos(t1), 47.2 + 17.72 * Math.sin(t1), z + dz * 11.87 * Math.cos(t1)], .14, 0x9d7850);
    }
  }
  // Open lantern and five-metre cross complete the published 70 m silhouette.
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    b.add("column", [x + Math.cos(a) * 1.6, 67.6, z + Math.sin(a) * 1.6], [.24, 5.5, .24], GOLD);
  }
  for (const y of [65, 70.2]) b.add("column", [x, y, z], [4.4, .35, 4.4], GOLD);
  b.add("head", [x, 70.55, z], [2.6, 1.2, 2.6], GOLD);
  b.box([x, 72.736, z], [.36, 5, .36], GOLD);
  b.box([x, 73.6, z], [2.4, .36, .36], GOLD);
}
function naturkunde(b: Builder): void {
  const p = SCHLOSS_NATURKUNDE_FACADE_PROFILE.naturkunde, axis = p.front;
  const l = length(axis), pitch = l / p.facadeBays, base = p.groundY;
  for (let bay = 0; bay < p.facadeBays; bay++) {
    const u = (bay + .5) * pitch, middle = bay >= 6 && bay <= 8;
    for (const [floor, h] of [3.6, 10.35, 17.1].entries()) {
      if (middle && floor === 0 && bay === 7) continue;
      const y = base + h, w = pitch * .65, stem = 3.2;
      b.facade(axis, u, y, w, stem + w / 2, .2, GLASS, .7);
      // Stone shoulders make the dark opening visibly round-headed.
      b.arch(axis, u, y + stem / 2 - w / 4, w / 2 + .15, .26, LIGHT);
      b.facade(axis, u, y - (stem + w / 2) / 2 - .2, w + .65, .35, .45, DARK, .92);
      b.facade(axis, u, y, .11, stem + w / 2, .14, FRAME, .92);
      if (!b.minecraft) b.facade(axis, u, y + .3, w, .12, .14, FRAME, .92);
      for (const side of [-1, 1]) b.facade(axis, u + side * (w / 2 + .19), y - .3, .24, stem + .7, .28, LIGHT, .85);
    }
  }
  for (const y of [7.1, 13.85, 21.35, 22.2]) b.facade(axis, l / 2, base + y, l, .36, .55, LIGHT);
  const centre = l * .5;
  for (const u of [centre - pitch * 1.5, centre - pitch * .5, centre + pitch * .5, centre + pitch * 1.5]) {
    b.add("column", point(axis, u, base + 17.3, 1.1), [.72, 9.4, .72], LIGHT);
    b.facade(axis, u, base + 22.1, 1.2, .52, .8, LIGHT, 1.1);
  }
  b.facade(axis, centre, base + 24, pitch * 3 + 1.5, 1.7, .6, DARK, .8);
  b.facade(axis, centre, base + 25, pitch * 3 + 2.1, .45, .9, LIGHT, 1);
  for (let i = 0; i < 3; i++) b.add("head", point(axis, centre + (i - 1) * pitch, base + 20.75, 1.15), [1.4, 1.5, .35], DARK);
  b.facade(axis, centre, base + 3.35, 3.4, 6.7, .32, 0x333f3b, 1);
  b.arch(axis, centre, base + 5.55, 1.7, .38, LIGHT);
  b.facade(axis, centre, base + 7.5, 6.2, .5, 1.1, LIGHT, 1.15);
  for (let i = 0; i < 6; i++) b.facade(axis, centre, base + .12 + i * .2, 5.8, .2, 3 - i * .4, DARK, 1.8 - i * .2);
  for (const side of [-1, 1]) {
    const u = centre + side * 4.0;
    b.facade(axis, u, base + 3.0, 1.2, 6, 1.15, DARK, 1.3);
    statue(b, point(axis, u, base + 6.0, 1.3), 1.1);
  }
  // Name is the building identity in the project's own stroke alphabet.
  if (!b.minecraft) for (const path of letteringStrokePaths("MUSEUM FUR NATURKUNDE", .44))
    for (let i = 1; i < path.length; i++) b.beam(
      point(axis, centre + path[i - 1][0], base + 24 + path[i - 1][1], 1.18),
      point(axis, centre + path[i][0], base + 24 + path[i][1], 1.18), .06, LIGHT);
}
function create(minecraft: boolean): Group {
  const root = new Group(); root.name = minecraft ? MINECRAFT_SCHLOSS_NATURKUNDE_FACADES_GROUP_NAME : SCHLOSS_NATURKUNDE_FACADES_GROUP_NAME;
  root.userData = { ...SCHLOSS_NATURKUNDE_FACADE_PROFILE, keepInMinecraft: minecraft, blockNative: minecraft };
  const builder = new Builder(minecraft); schloss(builder); naturkunde(builder); builder.finish(root);
  return freezeStaticSceneTransforms(root);
}
export function createSchlossNaturkundeFacades(): Group { return create(false); }
export function createMinecraftSchlossNaturkundeFacades(): Group { return create(true); }
