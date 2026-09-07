import {
  BoxGeometry, BufferGeometry, CircleGeometry, Color, CylinderGeometry, DoubleSide,
  Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh,
  LineBasicMaterial, LineSegments, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Quaternion, ShapeUtils, SphereGeometry, TorusGeometry,
  Vector2, Vector3,
} from "three";
import { markArchitecturalAccentInk } from "./architecturalInk";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import {
  ABGEORDNETENHAUS_FINE_LAYER_NAME, ABGEORDNETENHAUS_GROUP_NAME,
  ABGEORDNETENHAUS_MINECRAFT_GROUP_NAME, ABGEORDNETENHAUS_PROFILE as P,
  abgeordnetenhausDisplayTopAt, abgeordnetenhausLocalPoint,
  abgeordnetenhausMainContains, abgeordnetenhausWorldPoint,
} from "./abgeordnetenhausProfile";

type Point = [number, number, number];
type PlanPoint = [number, number];
type Kind = "box" | "column" | "arch" | "archFill" | "leaf";
type DetailProfile = "full" | "mobile";
type Instance = { matrix: number[]; color: number };
const C = {
  stone: 0xc6bcaa, light: 0xd9cfbd, shade: 0xa89f8c, plaster: 0xd0c8b8,
  joint: 0x999181, glass: 0x405860, glassRoof: 0x819b9d, roof: 0x737c77,
  metal: 0x656b64,
};
const UP = new Vector3(0, 1, 0);
const YAW = new Quaternion().setFromAxisAngle(UP, P.facadeYaw);

export const ABGEORDNETENHAUS_DETAIL_BUDGETS = {
  full: { drawnInstances: 2_700, drawnBytes: 270_000, minecraftBlocks: 3_500 },
  mobile: { drawnInstances: 1_700, drawnBytes: 170_000, minecraftBlocks: 2_800 },
  drawnRenderables: 7,
  minecraftRenderables: 1,
} as const;

function materialPair(vertexColors = false): [MeshBasicMaterial, MeshStandardMaterial] {
  return [new MeshBasicMaterial({ color: 0xffffff, vertexColors, side: DoubleSide }),
    new MeshStandardMaterial({ color: 0xffffff, vertexColors, side: DoubleSide,
      flatShading: true, roughness: 0.88, metalness: 0 })];
}

function attachMaterials(mesh: Mesh, pair: ReturnType<typeof materialPair>): void {
  mesh.material = pair[0];
  Object.assign(mesh.userData, { dayMaterial: pair[0], nightMaterial: pair[1],
    civicBuildingDetail: true, textureFree: true });
}

class Builder {
  readonly batches = new Map<Kind, Instance[]>();
  readonly lines: number[] = [];
  readonly counts: Record<string, number> = {};
  private readonly matrix = new Matrix4();
  private readonly position = new Vector3();
  private readonly scale = new Vector3();
  private readonly rotation = new Quaternion();
  cue(name: string): void { this.counts[name] = (this.counts[name] ?? 0) + 1; }
  add(kind: Kind, p: Point, size: Point, color: number, q = YAW): void {
    const entries = this.batches.get(kind) ?? [];
    this.matrix.compose(this.position.set(...p), q, this.scale.set(...size));
    entries.push({ matrix: this.matrix.toArray(), color });
    this.batches.set(kind, entries);
  }
  box(p: Point, size: Point, color: number, yaw = P.facadeYaw): void {
    this.add("box", p, size, color, this.rotation.setFromAxisAngle(UP, yaw));
  }
  localBox(u: number, y: number, v: number, w: number, h: number, d: number, color: number): void {
    this.box(abgeordnetenhausWorldPoint(u, P.groundY + y, v), [w, h, d], color);
  }
  beam(a: Point, b: Point, width: number, color: number): void {
    const direction = new Vector3(...b).sub(new Vector3(...a));
    const length = direction.length();
    this.add("box", a.map((v, i) => (v + b[i]) / 2) as Point,
      [width, length, width], color,
      this.rotation.setFromUnitVectors(UP, direction.multiplyScalar(1 / length)));
  }
  line(a: Point, b: Point): void { this.lines.push(...a, ...b); }
}

function unitGeometry(kind: Kind): BufferGeometry {
  const geometry = kind === "box" ? new BoxGeometry(1, 1, 1)
    : kind === "column" ? new CylinderGeometry(0.5, 0.5, 1, 10)
    : kind === "arch" ? new TorusGeometry(0.5, 0.06, 5, 16, Math.PI)
    : kind === "archFill" ? new CircleGeometry(0.5, 16, 0, Math.PI)
    : new SphereGeometry(0.5, 8, 5);
  geometry.deleteAttribute("uv");
  return geometry;
}

function finish(builder: Builder, root: Group, name: string): void {
  const pair = materialPair();
  for (const [kind, instances] of builder.batches) {
    const mesh = new InstancedMesh(unitGeometry(kind), pair[0], 0);
    const matrices = new Float32Array(instances.length * 16);
    const colors = new Float32Array(instances.length * 3);
    const tint = new Color();
    instances.forEach((instance, index) => {
      matrices.set(instance.matrix, index * 16);
      tint.setHex(instance.color).toArray(colors, index * 3);
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
  if (builder.lines.length) {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(builder.lines, 3));
    geometry.computeBoundingSphere();
    const ink = new LineSegments(geometry,
      markArchitecturalAccentInk(new LineBasicMaterial(), C.joint, "micro"));
    ink.name = `${name} masonry and silhouette ink`;
    root.add(ink);
  }
}

/** Clip only the front risalit. All source courts lie well behind this strip. */
export function abgeordnetenhausCentralRing(): PlanPoint[] {
  let ring = P.footprintWorldM.map(([x, z]) => abgeordnetenhausLocalPoint(x, z));
  for (const [axis, edge, sign] of [[0, -23.7, 1], [0, 23.7, -1], [1, -14.2, 1]] as const) {
    const output: PlanPoint[] = [];
    for (let i = 0; i < ring.length; i += 1) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      const insideA = (a[axis] - edge) * sign >= 0;
      const insideB = (b[axis] - edge) * sign >= 0;
      if (insideA) output.push(a);
      if (insideA !== insideB) {
        const t = (edge - a[axis]) / (b[axis] - a[axis]);
        output.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
      }
    }
    ring = output;
  }
  return ring.map(([u, v]) => {
    const [x, , z] = abgeordnetenhausWorldPoint(u, 0, v);
    return [x, z];
  });
}

function reconstructedEnvelope(): Mesh {
  const positions: number[] = [], colors: number[] = [];
  const tint = new Color();
  const triangle = (a: Point, b: Point, c: Point, color: number) => {
    positions.push(...a, ...b, ...c);
    tint.setHex(color);
    for (let i = 0; i < 3; i += 1) colors.push(tint.r, tint.g, tint.b);
  };
  const quad = (a: Point, b: Point, c: Point, d: Point, color: number) => {
    triangle(a, b, c, color); triangle(a, c, d, color);
  };
  const shell = (rings: readonly (readonly (readonly [number, number])[])[], bottom: number, top: number) => {
    const flat = rings.flat();
    const projected = rings.map((ring) => ring.map(([x, z]) => new Vector2(x, z)));
    for (const indices of ShapeUtils.triangulateShape(projected[0], projected.slice(1))) {
      const points = indices.map((i) => [flat[i][0], top, flat[i][1]] as Point);
      triangle(points[0], points[1], points[2], C.roof);
    }
    for (const ring of rings) for (let i = 0; i < ring.length; i += 1) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      const [, v] = abgeordnetenhausLocalPoint((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      quad([a[0], bottom, a[1]], [b[0], bottom, b[1]], [b[0], top, b[1]], [a[0], top, a[1]],
        v > -15 ? C.stone : C.plaster);
    }
  };
  shell([P.footprintWorldM, ...P.courtyardHolesWorldM], P.groundY, P.wallTopY);
  shell([abgeordnetenhausCentralRing()], P.wallTopY, P.centralCorniceTopY);
  // Officially documented glass hip roof; footprint and rise are display estimates.
  const at = (u: number, v: number, y: number = P.wallTopY) => abgeordnetenhausWorldPoint(u, y, v);
  const a = at(-12, -72), b = at(12, -72), c = at(12, -46), d = at(-12, -46);
  const r0 = at(0, -64, P.wallTopY + P.displayRoofRiseM);
  const r1 = at(0, -54, P.wallTopY + P.displayRoofRiseM);
  triangle(a, b, r0, C.glassRoof); quad(b, c, r1, r0, C.glassRoof);
  triangle(c, d, r1, C.glassRoof); quad(d, a, r0, r1, C.glassRoof);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  const pair = materialPair(true);
  const mesh = new Mesh(geometry, pair[0]);
  mesh.name = "Abgeordnetenhaus exact plan with six open courts and estimated heights";
  attachMaterials(mesh, pair);
  Object.assign(mesh.userData, { sourcePartIds: [P.mainPrismId], sourceHeightM: P.sourceHeightM,
    displayReconstruction: true, courtyardCount: 6 });
  return mesh;
}

function arch(builder: Builder, u: number, base: number, width: number, straight: number, v: number, minecraft: boolean): void {
  builder.localBox(u, base + straight / 2, v, width, straight, 0.16, C.glass);
  if (minecraft) {
    builder.localBox(u, base + straight + width * 0.2, v, width * 0.72, width * 0.4, 0.18, C.glass);
    for (const side of [-1, 1]) {
      builder.localBox(u + side * (width / 2 + 0.2), base + straight / 2, v + 0.12, 0.42, straight, 0.4, C.light);
      builder.localBox(u + side * width * 0.38, base + straight + width * 0.13, v + 0.12, width * 0.35, 0.52, 0.4, C.light);
    }
    builder.localBox(u, base + straight + width * 0.42, v + 0.12, width * 0.64, 0.48, 0.4, C.light);
  } else {
    builder.add("archFill", abgeordnetenhausWorldPoint(u, P.groundY + base + straight, v), [width, width, 1], C.glass);
    builder.add("arch", abgeordnetenhausWorldPoint(u, P.groundY + base + straight, v + 0.14), [width + 0.46, width + 0.46, 2.4], C.light);
    for (const side of [-1, 1])
      builder.localBox(u + side * (width / 2 + 0.16), base + straight / 2, v + 0.1, 0.3, straight, 0.35, C.light);
  }
  builder.localBox(u, base, v + 0.16, width + 0.75, 0.24, 0.6, C.light);
  builder.localBox(u, base + straight * 0.48, v + 0.13, width, 0.12, 0.15, C.shade);
  builder.localBox(u, base + straight / 2, v + 0.15, 0.13, straight, 0.15, C.shade);
}

function mainFacade(b: Builder, profile: DetailProfile, minecraft: boolean): void {
  const box = b.localBox.bind(b);
  for (const side of [-1, 1]) {
    for (let bay = 0; bay < P.sideWingBays; bay += 1) {
      const u = side * (26.5 + bay * 5.5), v = -4.53;
      arch(b, u, 4.8, 2.35, 3.6, v, minecraft);
      b.cue("wingGroundArch");
      box(u, 17.6, v, 2.55, 4.8, 0.16, C.glass);
      for (const sign of [-1, 1]) box(u + sign * 1.48, 17.6, v + 0.12, 0.36, 5.2, 0.42, C.light);
      box(u, 15.0, v + 0.25, 3.6, 0.36, 0.9, C.light);
      box(u, 20.25, v + 0.2, 3.65, 0.35, 0.7, C.light);
      if (minecraft) {
        box(u, 20.7, v + 0.18, 2.6, 0.48, 0.6, C.light);
        box(u, 21.13, v + 0.18, 1.2, 0.4, 0.6, C.light);
      } else for (const sign of [-1, 1])
        b.beam(abgeordnetenhausWorldPoint(u + sign * 1.8, P.groundY + 20.55, v + 0.2),
          abgeordnetenhausWorldPoint(u, P.groundY + 21.6, v + 0.2), 0.22, C.light);
      b.cue("individualWindowPediment");
      box(u, 23.1, v, 2.3, 1.35, 0.14, C.glass);
      box(u, 23.9, v + 0.12, 2.8, 0.2, 0.38, C.light);
      box(u, 2.3, v, 2.35, 0.9, 0.15, C.glass);
      if (!minecraft) {
        box(u, 17.6, v + 0.17, 0.14, 4.8, 0.16, C.shade);
        box(u, 17.3, v + 0.17, 2.55, 0.14, 0.16, C.shade);
      }
    }
    for (const y of [0.55, 3.5, 12.4, 13.0, 24.55, 25])
      box(side * 35.25, y, -4.45, 23, y === 13 ? 0.5 : 0.25, 0.78, C.light);
  }
  for (let bay = 0; bay < P.centralUpperArchCount; bay += 1) {
    const u = (bay - 3) * 6;
    arch(b, u, 15.1, 3.4, 7.1, 0.4 + (Math.abs(u) < 8 ? 1.1 : 0), minecraft);
    b.cue("centralUpperArch");
  }
  for (const u of [-6, 0, 6]) {
    arch(b, u, 1.2, 3.25, 6.0, 1.5, minecraft);
    b.cue("entrancePortal");
  }
  for (const u of [-18, -12, 12, 18]) arch(b, u, 4.8, 2.5, 3.6, 0.4, minecraft);
  for (let column = 0; column < P.colossalColumnCount; column += 1) {
    const u = (column - 2.5) * 6;
    const v = 1.05 + (Math.abs(u) < 8 ? 1.1 : 0);
    box(u, 13.8, v, 1.7, 1.6, 1.8, C.light);
    if (minecraft) {
      box(u, 20, v, 1.15, 10.7, 1.15, C.light);
      box(u, 25.05, v, 1.85, 0.75, 1.85, C.light);
      box(u, 25.6, v, 2.25, 0.4, 2.25, C.light);
    } else {
      b.add("column", abgeordnetenhausWorldPoint(u, P.groundY + 19.8, v), [1.12, 10.65, 1.12], C.light);
      b.add("column", abgeordnetenhausWorldPoint(u, P.groundY + 14.6, v), [1.6, 0.35, 1.6], C.light);
      b.add("column", abgeordnetenhausWorldPoint(u, P.groundY + 25.1, v), [1.9, 1.05, 1.9], C.light);
      box(u, 25.75, v, 2.1, 0.36, 2.1, C.light);
      const leaves = profile === "full" ? 8 : 4;
      for (let leaf = 0; leaf < leaves; leaf += 1) {
        const angle = leaf / leaves * Math.PI * 2;
        b.add("leaf", abgeordnetenhausWorldPoint(u + Math.cos(angle) * 0.75,
          P.groundY + 24.95, v + Math.sin(angle) * 0.75), [0.5, 1.1, 0.45], C.shade);
      }
    }
    b.cue("colossalCorinthianColumn");
  }
  for (const y of [0.55, 3.5, 12.4, 13, 26.25, 26.9, 27.6, 28]) {
    for (const [u, v] of [[-15.8, 0.35], [0, 1.45], [15.8, 0.35]])
      box(u, y, v, 15.8, y === 26.9 ? 0.6 : 0.28, 0.95, C.light);
  }
  // The current skyline is a balustrade, not a triangular central pediment.
  for (const [centre, width, v, y] of [[0, 47.4, 0.12, 28], [-35.25, 22.8, -4.8, 25], [35.25, 22.8, -4.8, 25]]) {
    const pierCount = Math.round(width / 5.95);
    for (let i = 0; i <= pierCount; i += 1) {
      const u = centre - width / 2 + i * width / pierCount;
      box(u, y + 0.55, v, 0.72, 1.1, 0.85, C.light);
      box(u, y + 1.16, v, 1.0, 0.2, 1.0, C.light);
      if (i === pierCount) continue;
      const span = width / pierCount;
      box(u + span / 2, y + 1.08, v, span, 0.22, 0.62, C.light);
      const count = minecraft ? 3 : profile === "full" ? 7 : 4;
      for (let j = 1; j <= count; j += 1) {
        const at = abgeordnetenhausWorldPoint(u + j * span / (count + 1), P.groundY + y + 0.57, v);
        if (minecraft) b.box(at, [0.42, 0.9, 0.42], C.light);
        else b.add("column", at, [0.28, 0.86, 0.28], C.light);
      }
    }
    b.cue("flatBalustradeRun");
  }
  // Lower masonry courses and staggered joints are display subdivisions.
  if (!minecraft) for (let course = 1; course <= 16; course += 1) {
    const y = P.groundY + course * 0.73;
    for (const [u0, u1, v] of [[-46.5, -24, -4.36], [-23.7, -7.9, 0.47], [-7.9, 7.9, 1.57], [7.9, 23.7, 0.47], [24, 46.5, -4.36]]) {
      b.line(abgeordnetenhausWorldPoint(u0, y, v), abgeordnetenhausWorldPoint(u1, y, v));
      if (profile === "full") for (let u = u0 + 0.8 + course % 2; u < u1; u += 2.2)
        b.line(abgeordnetenhausWorldPoint(u, y, v), abgeordnetenhausWorldPoint(u, y - 0.73, v));
    }
  }
}

function rearFacades(b: Builder, profile: DetailProfile, minecraft: boolean): void {
  const rings = [P.footprintWorldM, ...P.courtyardHolesWorldM];
  for (const [ringIndex, ring] of rings.entries()) for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i], c = ring[(i + 1) % ring.length];
    const dx = c[0] - a[0], dz = c[1] - a[1], length = Math.hypot(dx, dz);
    const [, v] = abgeordnetenhausLocalPoint((a[0] + c[0]) / 2, (a[1] + c[1]) / 2);
    if (length < 4 || (ringIndex === 0 && v > -15)) continue;
    const yaw = -Math.atan2(dz, dx);
    // Select empty side geometrically: source outer/inner winding may differ.
    const nx = dz / length, nz = -dx / length;
    const side = abgeordnetenhausMainContains((a[0] + c[0]) / 2 + nx * 0.2, (a[1] + c[1]) / 2 + nz * 0.2) ? -1 : 1;
    const point = (u: number, y: number, offset = 0.12): Point => [
      a[0] + dx * u / length + nx * offset * side,
      P.groundY + y, a[1] + dz * u / length + nz * offset * side,
    ];
    const count = Math.max(1, Math.floor(length / (minecraft ? 5.3 : 4.1)));
    for (let bay = 0; bay < count; bay += 1) {
      const u = (bay + 0.5) * length / count;
      for (let floor = 0; floor < P.rearStoreys; floor += 1) {
        const y = 3.3 + floor * 3.9;
        b.box(point(u, y), [1.55, 2.15, 0.15], C.glass, yaw);
        if (!minecraft && (profile === "full" || floor % 2 === 1)) {
          b.box(point(u, y - 1.15, 0.22), [1.94, 0.22, 0.45], C.light, yaw);
          if (profile === "full") b.box(point(u, y, 0.22), [0.12, 2.15, 0.12], C.shade, yaw);
        }
        b.cue("rearOfficeWindow");
      }
    }
    for (const y of [1.0, 12.5, 24.75]) b.box(point(length / 2, y, 0.16), [length, 0.28, 0.5], C.light, yaw);
    if (!minecraft) for (const y of [0, 25])
      b.line(point(0, y, 0.02), point(length, y, 0.02));
  }
}

function roofFrames(b: Builder): void {
  const at = (u: number, v: number, y: number = P.wallTopY + 0.04) => abgeordnetenhausWorldPoint(u, y, v);
  const ridgeY = P.wallTopY + 3.25;
  // Real hip edges and a small parallel glazing grid, without a fan of dark
  // diagonals that could be confused with the triangulated source surface.
  b.beam(at(0, -64, ridgeY), at(0, -54, ridgeY), 0.13, C.metal);
  for (const side of [-1, 1]) {
    b.beam(at(side * 12, -72), at(side * 12, -46), 0.13, C.metal);
    b.beam(at(side * 12, -72), at(0, -64, ridgeY), 0.13, C.metal);
    b.beam(at(side * 12, -46), at(0, -54, ridgeY), 0.13, C.metal);
    for (const v of [-64, -59, -54])
      b.beam(at(side * 12, v), at(0, v, ridgeY), 0.08, C.metal);
    b.beam(at(side * 6, -68, P.wallTopY + 1.64), at(side * 6, -50, P.wallTopY + 1.64), 0.08, C.metal);
  }
  for (const v of [-72, -46]) b.beam(at(-12, v), at(12, v), 0.13, C.metal);
  b.cue("glazedHippedPlenaryRoof");
}

export function createAbgeordnetenhausDetails(detailProfile: DetailProfile = "full"): Group {
  const root = new Group();
  root.name = ABGEORDNETENHAUS_GROUP_NAME;
  root.add(reconstructedEnvelope());
  const b = new Builder();
  mainFacade(b, detailProfile, false);
  rearFacades(b, detailProfile, false);
  roofFrames(b);
  finish(b, root, ABGEORDNETENHAUS_FINE_LAYER_NAME);
  Object.assign(root.userData, { detailProfile, sourcePartIds: [P.mainPrismId],
    estimatedHeight: true, photographsBundled: false, textureFree: true, cueCounts: b.counts });
  return freezeStaticSceneTransforms(root);
}

/** All-cube shell, roof pixels and ornaments; the six courts remain empty. */
function minecraftShell(b: Builder, profile: DetailProfile): void {
  const step = profile === "full" ? 3 : 4;
  const rings = [P.footprintWorldM, ...P.courtyardHolesWorldM];
  for (const ring of rings) for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i], c = ring[(i + 1) % ring.length];
    const dx = c[0] - a[0], dz = c[1] - a[1], length = Math.hypot(dx, dz);
    if (length < 0.9) continue;
    const nx = dz / length, nz = -dx / length;
    const side = abgeordnetenhausMainContains((a[0] + c[0]) / 2 + nx * 0.3, (a[1] + c[1]) / 2 + nz * 0.3) ? 1 : -1;
    const count = Math.ceil(length / step);
    const yaw = -Math.atan2(dz, dx);
    for (let cell = 0; cell < count; cell += 1) {
      const t = (cell + 0.5) / count;
      const x = a[0] + dx * t + nx * side * 0.38, z = a[1] + dz * t + nz * side * 0.38;
      const [u, v] = abgeordnetenhausLocalPoint(x, z);
      const top = Math.abs(u) < 23.7 && v > -14.2 ? P.centralCorniceTopY : P.wallTopY;
      for (let floor = 0; floor < 6; floor += 1) {
        const h = (top - P.groundY) / 6;
        b.box([x, P.groundY + (floor + 0.5) * h, z], [length / count + 0.015, h, 0.78],
          v > -15 ? floor < 3 && cell % 2 ? C.shade : C.stone : C.plaster, yaw);
      }
    }
  }
  // Rasterise only cells completely contained by the exact footprint, excluding
  // every courtyard. Thin edge caps below retain the irregular source boundary.
  for (let u = -48; u < 48; u += step) for (let v = -99; v < 2; v += step) {
    const corners = [[u, v], [u + step, v], [u + step, v + step], [u, v + step]];
    if (!corners.every(([x, z]) => {
      const [wx, , wz] = abgeordnetenhausWorldPoint(x, 0, z);
      return abgeordnetenhausMainContains(wx, wz);
    })) continue;
    // Corner tests alone miss a tiny courtyard/notch crossing a cell edge.
    // Reject any cell crossed by a source boundary, including a hole completely
    // enclosed by it; this is conservative and leaves only narrow edge gutters.
    const crossesBoundary = rings.some((ring) => ring.some((p, index) => {
      const a = abgeordnetenhausLocalPoint(p[0], p[1]);
      const next = ring[(index + 1) % ring.length];
      const c = abgeordnetenhausLocalPoint(next[0], next[1]);
      let lo = 0, hi = 1;
      for (const [axis, min, max] of [[0, u, u + step], [1, v, v + step]] as const) {
        const delta = c[axis] - a[axis];
        if (Math.abs(delta) < 1e-9) { if (a[axis] <= min || a[axis] >= max) return false; }
        else {
          const t0 = (min - a[axis]) / delta, t1 = (max - a[axis]) / delta;
          lo = Math.max(lo, Math.min(t0, t1)); hi = Math.min(hi, Math.max(t0, t1));
        }
      }
      return hi - lo > 1e-8;
    }));
    if (crossesBoundary) continue;
    const cu = u + step / 2, cv = v + step / 2;
    const [x, , z] = abgeordnetenhausWorldPoint(cu, 0, cv);
    const isCentral = Math.abs(cu) < 23.7 && cv > -14.2;
    const top = isCentral ? P.centralCorniceTopY : abgeordnetenhausDisplayTopAt(x, z)!;
    const glass = Math.abs(cu) < 12 && cv > -72 && cv < -46;
    b.box([x, top - 0.22, z], [step, 0.44, step], glass ? C.glassRoof : C.roof);
    b.cue("sourceContainedRoofCell");
  }
}

export function createMinecraftAbgeordnetenhausDetails(detailProfile: DetailProfile = "full"): Group {
  const root = new Group();
  root.name = ABGEORDNETENHAUS_MINECRAFT_GROUP_NAME;
  const b = new Builder();
  minecraftShell(b, detailProfile);
  mainFacade(b, detailProfile, true);
  rearFacades(b, detailProfile, true);
  // The voxel hip roof uses stepped flat cells, never sloping smooth panels.
  b.cue("glazedHippedPlenaryRoof");
  finish(b, root, ABGEORDNETENHAUS_MINECRAFT_GROUP_NAME);
  Object.assign(root.userData, { keepInMinecraft: true, detailProfile,
    sourcePartIds: [P.mainPrismId], estimatedHeight: true, photographsBundled: false,
    textureFree: true, cueCounts: b.counts });
  return freezeStaticSceneTransforms(root);
}
