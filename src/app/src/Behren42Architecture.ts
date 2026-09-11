import {
  BoxGeometry, BufferGeometry, Color, DoubleSide, ExtrudeGeometry, Float32BufferAttribute,
  Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Quaternion, Shape, ShapeUtils, Vector2, Vector3,
} from "three";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { letteringStrokePaths } from "./drawnLettering";
import {
  BEHREN42_GROUP_NAME, BEHREN42_PROFILE as P, BEHREN42_SOURCE as source,
  MINECRAFT_BEHREN42_GROUP_NAME, behren42RoofAt,
} from "./Behren42Profile";

type Point = [number, number, number];
type Axis = { start: readonly [number, number]; end: readonly [number, number]; side: -1 | 1 };
type Kind = "box" | "arch";
type Instance = { matrix: number[]; color: number };
const UP = new Vector3(0, 1, 0);
const STONE = 0xd7c6a4, LIGHT = 0xe8d9bb, SHADE = 0xb09e7e;
const GLASS = 0x45585f, FRAME = 0x626b6d, JOINT = 0x8e826d;
function length(a: Axis): number { return Math.hypot(a.end[0] - a.start[0], a.end[1] - a.start[1]); }
function yaw(a: Axis): number { return -Math.atan2(a.end[1] - a.start[1], a.end[0] - a.start[0]); }
const southFrontRing = (() => {
  const a = P.south, dx = (a.end[0] - a.start[0]) / length(a), dz = (a.end[1] - a.start[1]) / length(a);
  return source.parts.find(p => p.id === "DEBE3DrqsYh7HYMU")!.ring.map(([x, z]) => {
    x -= a.start[0]; z -= a.start[1];
    return [x * dx + z * dz, -x * dz + z * dx];
  });
})();

/** The 0.8 m centre risalit is part of the source, not a flat projected facade. */
export function behren42FacadeOffset(a: Axis, u: number): number {
  if (a !== P.south) return 0;
  const points = southFrontRing;
  let out = -Infinity;
  for (let i = 0; i < points.length; i++) {
    const p = points[i], q = points[(i + 1) % points.length];
    if (u < Math.min(p[0], q[0]) - .001 || u > Math.max(p[0], q[0]) + .001) continue;
    const d = q[0] - p[0];
    out = Math.max(out, Math.abs(d) < .001 ? Math.max(p[1], q[1]) : p[1] + (q[1] - p[1]) * (u - p[0]) / d);
  }
  return Number.isFinite(out) ? out : 0;
}
function point(a: Axis, u: number, y: number, out: number): Point {
  const dx = a.end[0] - a.start[0], dz = a.end[1] - a.start[1], l = length(a);
  out += behren42FacadeOffset(a, u);
  return [a.start[0] + (dx * u + dz * out * a.side) / l, y,
    a.start[1] + (dz * u - dx * out * a.side) / l];
}
class Builder {
  readonly batches = new Map<Kind, Instance[]>();
  readonly matrix = new Matrix4();
  constructor(readonly minecraft: boolean) {}
  add(kind: Kind, position: Point, size: Point, color: number, rotation = new Quaternion()): void {
    const batch = this.batches.get(kind) ?? [];
    this.matrix.compose(new Vector3(...position), rotation, new Vector3(...size));
    batch.push({ matrix: this.matrix.toArray(), color }); this.batches.set(kind, batch);
  }
  box(position: Point, size: Point, color: number, angle = 0): void {
    this.add("box", position, size, color, new Quaternion().setFromAxisAngle(UP, angle));
  }
  face(a: Axis, u: number, y: number, w: number, h: number, d: number, color: number, out = .45): void {
    this.box(point(a, u, y, out + (this.minecraft ? 1 : 0)), [w, h, d], color, yaw(a));
  }
  beam(a: Point, b: Point, width: number, color: number): void {
    const direction = new Vector3(...b).sub(new Vector3(...a)), l = direction.length();
    if (l < .001) return;
    this.add("box", a.map((v, i) => (v + b[i]) / 2) as Point, [width, l, width], color,
      new Quaternion().setFromUnitVectors(UP, direction.multiplyScalar(1 / l)));
  }
  pane(a: Axis, u: number, y: number, w: number, h: number, arch = false): void {
    const out = .55;
    if (arch && this.minecraft) {
      for (let row = 0; row < 7; row++) {
        const t = (row + .5) / 7, width = t < .5 ? w : w * Math.sqrt(1 - (2 * t - 1) ** 2);
        this.face(a, u, y - h / 2 + h * t, width, h / 7, .17, GLASS, out);
      }
    } else {
      this.add(arch ? "arch" : "box", point(a, u, y, out + (this.minecraft ? 1 : 0)),
        [w, h, .17], GLASS, new Quaternion().setFromAxisAngle(UP, yaw(a)));
    }
    // Same openings get physical stone reveals and a shallow sill.
    this.face(a, u, y - h / 2 - .07, w + .35, .15, .37, LIGHT, out + .08);
    for (const side of [-1, 1]) this.face(a, u + side * (w / 2 + .08), y - (arch ? h / 4 : 0),
      .16, arch ? h / 2 : h, .28, LIGHT, out + .03);
    if (arch) {
      const n = this.minecraft ? 8 : 16;
      for (let i = 0; i < n; i++) {
        const aa = Math.PI * i / n, bb = Math.PI * (i + 1) / n;
        this.beam(point(a, u + Math.cos(aa) * (w / 2 + .08), y + Math.sin(aa) * h / 2, out + .07 + (this.minecraft ? 1 : 0)),
          point(a, u + Math.cos(bb) * (w / 2 + .08), y + Math.sin(bb) * h / 2, out + .07 + (this.minecraft ? 1 : 0)), .15, LIGHT);
      }
    }
    this.face(a, u, y - (arch ? .2 : 0), .085, h - .15, .10, FRAME, out + .14);
    this.face(a, u, y - h * .12, w, .09, .10, FRAME, out + .14);
  }
}

function facade(builder: Builder, a: Axis, bays: number): void {
  const l = length(a), pitch = l / bays;
  // Source's historic cornice and contemporary two-storey glass crown stay separate.
  for (const [y, h, d, color] of [[5.45, .45, .5, SHADE], [11.1, .35, .55, LIGHT],
    [17.5, .30, .40, LIGHT], [23.5, .38, .6, LIGHT], [28.35, .45, .75, LIGHT]] as const) {
    for (let bay = 0; bay < bays; bay++) builder.face(a, (bay + .5) * pitch, y, pitch + .02, h, d, color);
  }
  for (let bay = 0; bay < bays; bay++) {
    const u = (bay + .5) * pitch, w = pitch * .53;
    builder.pane(a, u, 8.3, w * 1.02, 4.2, bay === 0 || bay === bays - 1);
    builder.pane(a, u, 14.0, w, 3.6);
    builder.pane(a, u, 20.45, w, 4.4, true);
    builder.pane(a, u, 25.8, w, 3.35);
    // Rusticated ground course faces are split beside apertures, never over them.
    if (!builder.minecraft) for (let row = 0; row < 8; row++) {
      const y = 5.75 + row * .64;
      for (const side of [-1, 1]) builder.face(a, u + side * pitch * .40, y, pitch * .19, .075, .12, JOINT, .62);
    }
    builder.face(a, u, 27.98, .28, .34, .67, LIGHT, .66);
    if (bay % 5 === 0 && a === P.south) {
      builder.face(a, u - pitch * .45, 17.2, .6, 11.7, .6, LIGHT, .68);
      builder.face(a, u - pitch * .45, 23.2, .85, .4, .75, LIGHT, .75);
    }
  }
}
function upper(builder: Builder, a: Axis, bays: number): void {
  const l = length(a), pitch = l / bays;
  for (let floor = 0; floor < 2; floor++) {
    const y = 30.36 + floor * 3.54;
    builder.face(a, l / 2, y, l, 3.42, .16, GLASS, .2);
    builder.face(a, l / 2, y - 1.68, l, .23, .35, FRAME, .31);
    for (let i = 0; i <= bays; i++) builder.face(a, i * pitch, y, .18, 3.45, .35, FRAME, .31);
  }
  builder.face(a, l / 2, 36.36, l, .26, .45, FRAME, .31);
}
function sign(builder: Builder): void {
  // Small entry plaque; no unsupported giant rooftop company advertisement.
  const a = P.south, u = length(a) * .43, y = 7.6;
  builder.face(a, u, y, 2.4, .62, .14, 0x5e6160, .82);
  const centre = point(a, u, y, 1.0 + (builder.minecraft ? 1 : 0)), angle = yaw(a);
  const map = ([x, yy]: [number, number]): Point => [centre[0] + Math.cos(angle) * x, centre[1] + yy, centre[2] - Math.sin(angle) * x];
  for (const path of letteringStrokePaths("HENGELER MUELLER", .13)) for (let i = 1; i < path.length; i++) {
    builder.beam(map(path[i - 1]), map(path[i]), .017, LIGHT);
  }
}

function materials(): [MeshBasicMaterial, MeshStandardMaterial] {
  return [new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide }),
    new MeshStandardMaterial({ color: 0xffffff, roughness: .84, side: DoubleSide, flatShading: true })];
}
function finish(builder: Builder, root: Group): void {
  const pair = materials();
  for (const [kind, instances] of builder.batches) {
    let geometry: BufferGeometry;
    if (kind === "arch") {
      const shape = new Shape();
      shape.moveTo(-.5, -.5); shape.lineTo(.5, -.5); shape.lineTo(.5, 0);
      shape.absellipse(0, 0, .5, .5, 0, Math.PI, false, 0); shape.lineTo(-.5, -.5);
      geometry = new ExtrudeGeometry(shape, { depth: 1, steps: 1, bevelEnabled: false, curveSegments: 8 });
      geometry.translate(0, 0, -.5);
    } else geometry = new BoxGeometry(1, 1, 1);
    geometry.deleteAttribute("uv");
    const matrices = new Float32Array(instances.length * 16), colors = new Float32Array(instances.length * 3), color = new Color();
    instances.forEach((v, i) => { matrices.set(v.matrix, i * 16); color.setHex(v.color).toArray(colors, i * 3); });
    const mesh = new InstancedMesh(geometry, pair[0], 0);
    mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16); mesh.instanceColor = new InstancedBufferAttribute(colors, 3); mesh.count = instances.length;
    mesh.name = `Behren42 ${builder.minecraft ? "native blocks" : "source-bound facade"} ${kind}`;
    mesh.userData = { dayMaterial: pair[0], nightMaterial: pair[1], textureFree: true, surfaceOnly: true };
    mesh.computeBoundingBox(); mesh.computeBoundingSphere(); root.add(mesh);
  }
}

function sourceMesh(): Mesh {
  const positions: number[] = [], colors: number[] = [], normal = new Vector3(), color = new Color();
  for (const part of source.parts) for (const s of part.surfaces) {
    const ring = s.rings[0]; normal.set(0, 0, 0);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      normal.x += (a[1] - b[1]) * (a[2] + b[2]); normal.y += (a[2] - b[2]) * (a[0] + b[0]); normal.z += (a[0] - b[0]) * (a[1] + b[1]);
    }
    normal.normalize();
    const dominant = Math.abs(normal.y) > Math.abs(normal.x) ? Math.abs(normal.y) > Math.abs(normal.z) ? 1 : 2 : Math.abs(normal.x) > Math.abs(normal.z) ? 0 : 2;
    const projected = s.rings.map(r => r.map(p => dominant === 1 ? new Vector2(p[0], p[2]) : dominant === 0 ? new Vector2(p[2], p[1]) : new Vector2(p[0], p[1])));
    const flat = s.rings.flat(), triangles = ShapeUtils.triangulateShape(projected[0], projected.slice(1));
    const roof = s.kind === "RoofSurface";
    color.setHex(roof ? 0x737675 : STONE).multiplyScalar(roof ? 1 : .88 + .12 * Math.abs(normal.x));
    for (const tri of triangles) {
      const a = new Vector3(...flat[tri[0]] as Point), b = new Vector3(...flat[tri[1]] as Point), c = new Vector3(...flat[tri[2]] as Point);
      if (b.sub(a).cross(c.sub(a)).dot(normal) < 0) [tri[1], tri[2]] = [tri[2], tri[1]];
      for (const i of tri) {
        positions.push(flat[i][0], flat[i][1] + source.display_y_translation_m, flat[i][2]); colors.push(color.r, color.g, color.b);
      }
    }
  }
  const g = new BufferGeometry(); g.setAttribute("position", new Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new Float32BufferAttribute(colors, 3)); g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere();
  const pair = materials(); pair.forEach(m => { m.vertexColors = true; });
  const mesh = new Mesh(g, pair[0]); mesh.name = "Behren42 eight original LoD2 wall and roof parts";
  mesh.userData = { dayMaterial: pair[0], nightMaterial: pair[1], textureFree: true, sourcePartIds: source.parts.map(p => p.id) };
  return mesh;
}

function appendNativeEnvelope(builder: Builder): void {
  const cell = 2, columns = new Map<string, { x: number; z: number; top: number }>();
  for (let ix = 658; ix <= 707; ix++) for (let iz = 150; iz <= 183; iz++) {
    const x = (ix + .5) * cell, z = (iz + .5) * cell, top = behren42RoofAt(x, z);
    if (top !== null) columns.set(`${ix},${iz}`, { x, z, top });
  }
  for (const [key, c] of columns) {
    const [ix, iz] = key.split(",").map(Number);
    builder.box([c.x, c.top - .35, c.z], [cell, .7, cell], 0x737675);
    const base = Math.max(P.groundY, Math.min(...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => columns.get(`${ix + dx},${iz + dz}`)?.top ?? P.groundY)));
    const h = c.top - .7 - base;
    if (h <= .1) continue;
    const rows = Math.ceil(h / 3.8), pitch = h / rows;
    for (let i = 0; i < rows; i++) builder.box([c.x, base + (i + .5) * pitch, c.z], [cell, pitch, cell], base + (i + .5) * pitch > P.stoneTopY ? GLASS : STONE);
  }
}

export function createBehren42Architecture(minecraft = false): Group {
  const root = new Group(); root.name = minecraft ? MINECRAFT_BEHREN42_GROUP_NAME : BEHREN42_GROUP_NAME;
  root.userData = { textureFree: true, sourceParent: source.parent_id, blockNative: minecraft,
    keepInMinecraft: minecraft, surfaceOnly: true, hiddenSolidInfill: false, catalogueAddition: false };
  const builder = new Builder(minecraft);
  if (minecraft) appendNativeEnvelope(builder); else root.add(sourceMesh());
  facade(builder, P.south, P.southBays); facade(builder, P.west, P.westBays);
  upper(builder, P.upperSouth, 44); upper(builder, P.upperWest, 9); sign(builder);
  finish(builder, root);
  return freezeStaticSceneTransforms(root);
}
