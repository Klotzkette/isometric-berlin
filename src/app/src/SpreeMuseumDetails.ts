import {
  BoxGeometry, BufferGeometry, Color, CylinderGeometry, DoubleSide,
  Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh,
  LatheGeometry, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  Quaternion, ShapeUtils, SphereGeometry, TorusGeometry, Vector2, Vector3,
} from "three";
import { letteringStrokePaths } from "./drawnLettering";
import {
  BODE_DOMES, BODE_MAIN, BODE_SOURCE, GRILL_SOURCE,
  SPREE_RECOGNITION_FINE_LAYER_NAME,
  SPREE_RECOGNITION_GROUP_NAME, SPREE_RECOGNITION_PROFILE,
  sourcePartBounds, type SourcePart,
} from "./spreeRecognitionProfile";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type Point = [number, number, number];
type PlanPoint = [number, number];
type Kind = "box" | "column" | "round" | "arch" | "ring" | "shade";
type Instance = { matrix: number[]; color: number };
type Batches = Map<Kind, Instance[]>;
const STONE = 0xc7c2b5;
const STONE_LIGHT = 0xe0dacc;
const STONE_DARK = 0xa4a395;
const GLASS = 0x56696d;
const METAL = 0x535b59;
const RED = 0xa43c32;
const UP = new Vector3(0, 1, 0);
const IDENTITY = new Quaternion();

/** A few shared primitives carry thousands of details without per-detail meshes. */
class DetailBuilder {
  readonly batches: Batches = new Map();
  private readonly matrix = new Matrix4();
  private readonly p = new Vector3();
  private readonly s = new Vector3();
  private readonly q = new Quaternion();

  add(kind: Kind, p: Point, size: Point, color: number, rotation = IDENTITY): void {
    const batch = this.batches.get(kind) ?? [];
    this.matrix.compose(this.p.set(...p), rotation, this.s.set(...size));
    batch.push({ matrix: this.matrix.toArray(), color });
    this.batches.set(kind, batch);
  }

  box(p: Point, size: Point, color: number, yaw = 0): void {
    this.add("box", p, size, color, this.q.setFromAxisAngle(UP, yaw));
  }

  beam(a: Point, b: Point, thickness: number, color: number): void {
    const direction = new Vector3(...b).sub(new Vector3(...a));
    const length = direction.length();
    if (length < 0.001) return;
    this.add("box", a.map((v, i) => (v + b[i]) / 2) as Point,
      [thickness, length, thickness], color,
      this.q.setFromUnitVectors(UP, direction.multiplyScalar(1 / length)));
  }
}

function materials(vertexColors = false): [MeshBasicMaterial, MeshStandardMaterial] {
  return [
    new MeshBasicMaterial({ color: 0xffffff, vertexColors, side: DoubleSide }),
    new MeshStandardMaterial({ color: 0xffffff, vertexColors, side: DoubleSide,
      roughness: 0.84, metalness: 0, flatShading: true }),
  ];
}

function attachMaterials(mesh: Mesh, pair: ReturnType<typeof materials>): void {
  mesh.material = pair[0];
  mesh.userData.dayMaterial = pair[0];
  mesh.userData.nightMaterial = pair[1];
  mesh.userData.textureFree = true;
}

function unitGeometry(kind: Kind): BufferGeometry {
  const geometry = kind === "box" ? new BoxGeometry(1, 1, 1)
    : kind === "column" ? new CylinderGeometry(0.5, 0.5, 1, 10)
    : kind === "round" ? new SphereGeometry(0.5, 10, 6)
    : kind === "arch" ? new TorusGeometry(0.5, 0.055, 6, 18, Math.PI)
    : kind === "ring" ? new TorusGeometry(0.5, 0.055, 6, 24)
    : new CylinderGeometry(0.03, 0.5, 1, 12);
  geometry.deleteAttribute("uv");
  return geometry;
}

function finishBatches(
  builder: DetailBuilder, root: Group, name: string,
  geometries: Map<Kind, BufferGeometry>, pair: ReturnType<typeof materials>,
): void {
  for (const [kind, instances] of builder.batches) {
    let geometry = geometries.get(kind);
    if (!geometry) {
      geometry = unitGeometry(kind);
      geometries.set(kind, geometry);
    }
    // Adopt final instance buffers directly; no throwaway identity-matrix fill.
    const mesh = new InstancedMesh(geometry, pair[0], 0);
    const matrices = new Float32Array(instances.length * 16);
    const colors = new Float32Array(instances.length * 3);
    const color = new Color();
    instances.forEach((instance, index) => {
      matrices.set(instance.matrix, index * 16);
      color.setHex(instance.color).toArray(colors, index * 3);
    });
    mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
    mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
    mesh.count = instances.length;
    mesh.name = `${name} ${kind}`;
    attachMaterials(mesh, pair);
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    root.add(mesh);
  }
}

/** Triangulate each official planar surface, retaining all five courtyard holes. */
function sourceSurfaceMesh(parts: SourcePart[], name: string, museum: boolean): Mesh {
  const positions: number[] = [];
  const colors: number[] = [];
  const tint = new Color();
  for (const part of parts) {
    for (const surface of part.surfaces ?? []) {
      const rings = surface.rings;
      const normal = new Vector3();
      const ring = rings[0];
      for (let i = 0; i < ring.length; i += 1) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        normal.x += (a[1] - b[1]) * (a[2] + b[2]);
        normal.y += (a[2] - b[2]) * (a[0] + b[0]);
        normal.z += (a[0] - b[0]) * (a[1] + b[1]);
      }
      normal.normalize();
      const dominant = Math.abs(normal.y) > Math.abs(normal.x)
        ? Math.abs(normal.y) > Math.abs(normal.z) ? 1 : 2
        : Math.abs(normal.x) > Math.abs(normal.z) ? 0 : 2;
      const projected = rings.map((r) => r.map((p) => dominant === 1
        ? new Vector2(p[0], p[2]) : dominant === 0
          ? new Vector2(p[2], p[1]) : new Vector2(p[0], p[1])));
      const triangles = ShapeUtils.triangulateShape(projected[0], projected.slice(1));
      const flat = rings.flat();
      const roof = surface.kind === "RoofSurface";
      tint.setHex(roof ? museum ? 0x858a80 : 0x68716d : museum ? STONE : 0xc6c5b9);
      if (!roof) tint.multiplyScalar(0.9 + 0.1 * Math.abs(normal.x));
      for (const triangle of triangles) for (const index of triangle) {
        const p = flat[index];
        // LoD2's top plane includes the stone balustrade. Subdivide that same
        // envelope into a lower roof and an open parapet, not a taller building.
        const y = part.id === BODE_MAIN.id ? Math.min(p[1], part.top_y_m - 1.6) : p[1];
        positions.push(p[0], y, p[2]);
        colors.push(tint.r, tint.g, tint.b);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  const pair = materials(true);
  const mesh = new Mesh(geometry, pair[0]);
  mesh.name = name;
  mesh.userData.sourcePartIds = parts.map((part) => part.id);
  attachMaterials(mesh, pair);
  return mesh;
}

function facadePoint(start: PlanPoint, end: PlanPoint, u: number, y: number, offset: number): Point {
  const dx = end[0] - start[0], dz = end[1] - start[1];
  const length = Math.hypot(dx, dz);
  return [start[0] + (dx * u + dz * offset) / length, y,
    start[1] + (dz * u - dx * offset) / length];
}

function museumBay(builder: DetailBuilder, fine: DetailBuilder, centre: Point, yaw: number): void {
  const q = new Quaternion().setFromAxisAngle(UP, yaw);
  const at = (u: number, y: number, offset = 0): Point => [
    centre[0] + Math.cos(yaw) * u + Math.sin(yaw) * offset, y,
    centre[2] - Math.sin(yaw) * u + Math.cos(yaw) * offset,
  ];
  const box = (u: number, y: number, w: number, h: number, tone: number, offset = 0.18, depth = 0.16) =>
    builder.box(at(u, y, offset), [w, h, depth], tone, yaw);
  box(0, 7.35, 2.15, 3.8, GLASS);
  builder.add("round", at(0, 9.22, 0.15), [2.15, 2.15, 0.14], GLASS, q);
  builder.add("arch", at(0, 9.25, 0.34), [2.55, 2.55, 1.3], STONE_LIGHT, q);
  for (const side of [-1, 1]) box(side * 1.3, 7.45, 0.28, 3.9, STONE_LIGHT, 0.32, 0.32);
  box(0, 17.1, 2.05, 4.4, GLASS);
  for (const side of [-1, 1]) {
    box(side * 1.23, 17.1, 0.28, 4.82, STONE_LIGHT, 0.32, 0.35);
    box(side * 2.04, 16.35, 0.67, 13.0, STONE_LIGHT, 0.35, 0.5);
    box(side * 2.04, 22.9, 0.96, 0.7, STONE_LIGHT, 0.45, 0.65);
    for (let leaf = -1; leaf <= 1; leaf += 1) {
      fine.add("round", at(side * 2.04 + leaf * 0.27, 22.65, 0.67),
        [0.3, 0.6, 0.3], STONE_DARK, q);
    }
  }
  box(0, 14.65, 2.9, 0.4, STONE_LIGHT, 0.48, 0.64);
  box(0, 19.52, 2.8, 0.42, STONE_LIGHT, 0.44, 0.57);
  box(0, 12.05, 4.4, 0.46, STONE_LIGHT, 0.36, 0.55);
  box(0, 4.95, 2.0, 0.85, GLASS, 0.12);
  for (const y of [6.2, 8.3, 10.2, 15.8, 17.7])
    fine.box(at(0, y, 0.29), [2.08, 0.09, 0.09], STONE_DARK, yaw);
  fine.box(at(0, 17.1, 0.29), [0.09, 4.4, 0.09], STONE_LIGHT, yaw);
}

function museumFacades(builder: DetailBuilder, fine: DetailBuilder): void {
  const runs: [PlanPoint, PlanPoint][] = [
    [[1586.598, -232.172], [1551.855, -274.45]],
    [[1579.401, -320.082], [1633.108, -308.571]],
    [[1676.052, -280.54], [1597.425, -220.229]],
  ];
  for (const [a, b] of runs) {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const yaw = -Math.atan2(b[1] - a[1], b[0] - a[0]);
    const count = Math.floor(length / 4.8);
    for (let bay = 0; bay < count; bay += 1)
      museumBay(builder, fine, facadePoint(a, b, (bay + 0.5) * length / count, 0, 0.13), yaw);
  }
  const [cx, cz] = domeCentre(BODE_DOMES.find((p) => p.height_m > 40)!);
  for (let bay = 0; bay < 11; bay += 1) {
    const angle = -2.602 + (bay - 5) * 0.199;
    museumBay(builder, fine, [cx + Math.cos(angle) * 23.1, 0, cz + Math.sin(angle) * 23.1], Math.PI / 2 - angle);
  }
  for (const offset of [-0.82, -0.38, 0.38, 0.82]) {
    const angle = -2.602 + offset;
    const x = cx + Math.cos(angle) * 22.5, z = cz + Math.sin(angle) * 22.5;
    builder.box([x, 26.5, z], [1.25, 0.55, 1.15], STONE_LIGHT);
    builder.add("column", [x, 27.48, z], [0.82, 1.55, 0.65], STONE_LIGHT);
    builder.add("round", [x, 28.52, z], [0.57, 0.7, 0.57], STONE_LIGHT);
    builder.beam([x - 0.4, 28.0, z], [x - 0.75, 27.4, z + 0.3], 0.28, STONE);
    builder.beam([x + 0.38, 27.95, z], [x + 0.65, 28.42, z], 0.27, STONE);
  }
  for (const ring of BODE_MAIN.holes) for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i] as PlanPoint, b = ring[(i + 1) % ring.length] as PlanPoint;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const count = Math.floor(length / 3.8);
    const yaw = -Math.atan2(b[1] - a[1], b[0] - a[0]);
    for (let bay = 0; bay < count; bay += 1) for (const y of [8.7, 17.2]) {
      const p = facadePoint(a, b, (bay + 0.5) * length / count, y, 0.17);
      builder.box(p, [1.9, 4.0, 0.14], GLASS, yaw);
    }
  }
  // Cornices follow every surveyed risalit and courtyard, not a triangular box.
  for (const ring of [BODE_MAIN.ring, ...BODE_MAIN.holes]) {
    for (let i = 0; i < ring.length; i += 1) {
      const a = ring[i] as PlanPoint, b = ring[(i + 1) % ring.length] as PlanPoint;
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const yaw = -Math.atan2(b[1] - a[1], b[0] - a[0]);
      for (const [y, h, w] of [[12.0, 0.43, 0.48], [23.7, 0.62, 0.8], [24.75, 0.25, 0.86], [26.14, 0.3, 0.86]])
        builder.box(facadePoint(a, b, length / 2, y, 0.14), [length, h, w], STONE_LIGHT, yaw);
      const count = Math.ceil(length / 0.96);
      for (let j = 0; j < count; j += 1) {
        const p = facadePoint(a, b, (j + 0.5) * length / count, 25.45, 0.15);
        builder.add("column", p, [0.19, 1.1, 0.19], STONE);
        builder.add("round", [p[0], 25.42, p[2]], [0.34, 0.62, 0.34], STONE_LIGHT);
      }
    }
  }
}

function domeCentre(part: SourcePart): PlanPoint {
  const [minX, minZ, maxX, maxZ] = sourcePartBounds(part);
  return [(minX + maxX) / 2, (minZ + maxZ) / 2];
}

function domeProfile(part: SourcePart): Vector2[] {
  const [minX, , maxX] = sourcePartBounds(part);
  const r = (maxX - minX) / 2;
  const base = BODE_MAIN.top_y_m, height = part.top_y_m - base;
  return [[r * 0.91, 0], [r * 0.91, 0.21], [r, 0.23],
    [r * 0.985, 0.32], [r * 0.93, 0.44], [r * 0.84, 0.59],
    [r * 0.69, 0.73], [r * 0.48, 0.84], [r * 0.31, 0.9],
    [r * 0.31, 0.94], [0, 0.94]].map(([x, y]) => new Vector2(x, base + y * height));
}

function museumDome(part: SourcePart, root: Group, builder: DetailBuilder, fine: DetailBuilder): void {
  const [cx, cz] = domeCentre(part);
  const profile = domeProfile(part);
  const mesh = new Mesh(new LatheGeometry(profile, 64));
  mesh.geometry.deleteAttribute("uv");
  mesh.name = `${part.id} measured dome envelope`;
  mesh.position.set(cx, 0, cz);
  mesh.userData.sourcePartId = part.id;
  const pair = materials();
  pair[0].color.setHex(0x61655e);
  pair[1].color.setHex(0x61655e);
  attachMaterials(mesh, pair);
  root.add(mesh);
  const large = part.height_m > 40;
  const radius = profile[2].x;
  const base = BODE_MAIN.top_y_m;
  const drumHeight = profile[1].y - base;
  builder.add("column", [cx, base + drumHeight / 2, cz], [radius * 1.84, drumHeight, radius * 1.84], STONE);
  for (let i = 0; i < (large ? 20 : 14); i += 1) {
    const angle = i * Math.PI * 2 / (large ? 20 : 14);
    const yaw = Math.PI / 2 - angle;
    const q = new Quaternion().setFromAxisAngle(UP, yaw);
    for (let j = 2; j < profile.length - 2; j += 1) {
      const a = profile[j], b = profile[j + 1];
      builder.beam([cx + Math.cos(angle) * (a.x + 0.08), a.y, cz + Math.sin(angle) * (a.x + 0.08)],
        [cx + Math.cos(angle) * (b.x + 0.08), b.y, cz + Math.sin(angle) * (b.x + 0.08)], large ? 0.22 : 0.17, 0x97988b);
    }
    const p: Point = [cx + Math.cos(angle) * radius * 0.934, base + drumHeight * 0.57, cz + Math.sin(angle) * radius * 0.934];
    const diameter = large ? 1.85 : 1.05;
    builder.add("round", p, [diameter, diameter, 0.22], GLASS, q);
    builder.add("ring", p, [diameter * 1.2, diameter * 1.2, 1.8], STONE_LIGHT, q);
    const top = profile[profile.length - 3];
    const crown: Point = [cx + Math.cos(angle) * top.x, part.top_y_m - 0.7, cz + Math.sin(angle) * top.x];
    builder.add("column", crown, [0.18, 1.05, 0.18], 0x809b86);
    builder.add("round", [crown[0], part.top_y_m - 0.125, crown[2]], [0.25, 0.25, 0.25], 0xb0a372);
    if (large && i % 2 === 0) {
      const d = profile[4];
      const dormer: Point = [cx + Math.cos(angle) * (d.x + 0.3), d.y + 0.6, cz + Math.sin(angle) * (d.x + 0.3)];
      builder.add("round", dormer, [1.7, 2.5, 0.45], METAL, q);
      builder.add("arch", [dormer[0], dormer[1] + 0.28, dormer[2]], [1.88, 1.88, 2.3], 0x969989, q);
    }
  }
  const crownY = part.top_y_m - 0.78;
  const crownRadius = profile[profile.length - 3].x;
  for (let i = 0; i < 40; i += 1) {
    const a = i * Math.PI / 20, b = (i + 1) * Math.PI / 20;
    builder.beam([cx + Math.cos(a) * crownRadius, crownY, cz + Math.sin(a) * crownRadius],
      [cx + Math.cos(b) * crownRadius, crownY, cz + Math.sin(b) * crownRadius], 0.15, 0x829586);
  }
}

function inscription(builder: DetailBuilder, text: string, centre: Point, yaw: number, height: number, color: number): void {
  const point = ([u, y]: PlanPoint): Point => [centre[0] + Math.cos(yaw) * u, centre[1] + y, centre[2] - Math.sin(yaw) * u];
  for (const path of letteringStrokePaths(text, height))
    for (let i = 1; i < path.length; i += 1)
      builder.beam(point(path[i - 1]), point(path[i]), height * 0.11, color);
}

function grillFacades(builder: DetailBuilder, fine: DetailBuilder): void {
  const runs: [PlanPoint, PlanPoint, number][] = [
    [[1195.375, -389.722], [1145.489, -385.561], 10],
    [[1143.525, -387.252], [1140.761, -420.319], 7],
  ];
  for (const [a, b, bays] of runs) {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const pitch = length / bays;
    const yaw = -Math.atan2(b[1] - a[1], b[0] - a[0]);
    const at = (u: number, y: number, off = 0.22) => facadePoint(a, b, u, y, off);
    const box = (u: number, y: number, w: number, h: number, color: number, off = 0.28, depth = 0.15) =>
      builder.box(at(u, y, off), [w, h, depth], color, yaw);
    for (let bay = 0; bay < bays; bay += 1) {
      const u = (bay + 0.5) * pitch;
      box(u, 6.15, pitch * 0.9, 3.2, 0x394b4a);
      box(u, 8.02, pitch * 0.97, 0.28, 0xc4c3b9);
      for (let floor = 0; floor < 7; floor += 1) {
        const y = 9.75 + floor * 3.08;
        const projecting = bay % 3 === 1;
        const offset = projecting ? 0.86 : 0.25;
        box(u, y, pitch * 0.77, 2.42, projecting ? 0x72888a : GLASS, offset);
        for (const side of [-1, 1]) {
          box(u + side * pitch * 0.39, y, 0.22, 2.76, 0xe0ddce, offset + 0.15, projecting ? 1.0 : 0.28);
          fine.box(at(u + side * pitch * 0.16, y, offset + 0.12), [0.1, 2.35, 0.1], 0xc6cbc4, yaw);
        }
        box(u, y - 1.25, pitch * 0.85, 0.25, 0xd7d5c9, offset + 0.03, projecting ? 1.24 : 0.46);
        if (!projecting) {
          box(u, y - 0.7, pitch * 0.8, 0.1, 0x704c41, 0.82);
          for (let rail = -2; rail <= 2; rail += 1)
            fine.box(at(u + rail * pitch * 0.16, y - 1, 0.82), [0.06, 0.6, 0.06], 0x704c41, yaw);
        }
      }
      box(u, 31.7, pitch * 0.72, 1.9, 0x607775, 0.32);
      for (const side of [-1, 1]) box(u + side * pitch * 0.4, 31.9, 0.22, 2.65, RED, 0.44, 0.3);
      box(u, 33.14, pitch * 0.88, 0.24, RED, 0.46, 0.32);
      if (bays === 10 && bay > 1 && bay < 8) {
        box(u, 7.65, pitch * 0.93, 0.24, 0x3d3c35, 1.3, 2.55);
        box(u, 7.4, pitch * 0.93, 0.44, 0x49443a, 2.5, 0.12);
        const table = at(u, 4.95, 3.7);
        builder.box(table, [1.18, 0.12, 0.74], 0xc4bba5, yaw);
        builder.add("column", [table[0], 4.53, table[2]], [0.12, 0.75, 0.12], METAL);
        for (const side of [-1, 1]) {
          const seat = at(u + side * 0.95, 4.55, 3.7);
          builder.box(seat, [0.48, 0.14, 0.55], 0x765c48, yaw);
          builder.box(at(u + side * 1.15, 4.85, 3.7), [0.12, 0.7, 0.55], 0x765c48, yaw);
          for (const leg of [-1, 1])
            builder.box(at(u + side * 0.95 + leg * 0.18, 4.36, 3.7), [0.07, 0.3, 0.48], METAL, yaw);
        }
        if (bay % 2 === 0) {
          const parasol = at(u, 6.45, 3.8);
          builder.add("column", [parasol[0], 5.4, parasol[2]], [0.09, 2.4, 0.09], METAL);
          builder.add("shade", parasol, [2.25, 0.55, 2.25], RED);
        }
      }
    }
    for (const y of [8.2, 29.95, 34.0]) box(length / 2, y, length, 0.3, 0xc3c7c0, 0.45, 0.85);
    if (bays === 10) inscription(fine, "GRILL ROYAL", at(length * 0.55, 7.38, 2.58), yaw, 0.35, 0xe6e4d6);
  }
}

export function createSpreeMuseumDetails(): Group {
  const group = new Group();
  group.name = SPREE_RECOGNITION_GROUP_NAME;
  group.userData = { ...SPREE_RECOGNITION_PROFILE, buildingCount: 2, courtyardCount: 5 };
  const museum = new Group(), grill = new Group();
  museum.name = "Bode-Museum source-bound architecture";
  grill.name = "Grill Royal source-bound Riverside building";
  museum.add(sourceSurfaceMesh(BODE_SOURCE.parts.filter((p) => p.surfaces), "Bode official five-court envelope", true));
  grill.add(sourceSurfaceMesh(GRILL_SOURCE.parts, "Grill official eight-part envelope", false));
  const builder = new DetailBuilder(), grillBuilder = new DetailBuilder(), fine = new DetailBuilder();
  museumFacades(builder, fine);
  for (const dome of BODE_DOMES) museumDome(dome, museum, builder, fine);
  const [cx, cz] = domeCentre(BODE_DOMES.find((p) => p.height_m > 40)!);
  const angle = -2.602;
  inscription(fine, "BODE-MUSEUM", [cx + Math.cos(angle) * 23.8, 23.0, cz + Math.sin(angle) * 23.8], Math.PI / 2 - angle, 0.64, 0x96865b);
  grillFacades(grillBuilder, fine);
  const geometry = new Map<Kind, BufferGeometry>(), pair = materials();
  finishBatches(builder, museum, "Bode orders and dome fittings", geometry, pair);
  finishBatches(grillBuilder, grill, "Grill bays and terrace", geometry, pair);
  const fineRoot = new Group();
  fineRoot.name = SPREE_RECOGNITION_FINE_LAYER_NAME;
  fineRoot.userData.detailFadeM = [180, 300];
  finishBatches(fine, fineRoot, "Spree close inscriptions and carvings", geometry, pair);
  group.add(museum, grill, fineRoot);
  return freezeStaticSceneTransforms(group);
}
