import {
  BoxGeometry, BufferGeometry, Color, CylinderGeometry, DoubleSide, Float32BufferAttribute,
  Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Quaternion, ShapeUtils, SphereGeometry, Vector2, Vector3,
} from "three";
import source from "./gendarmenmarktSource.json";
import { GENDARMENMARKT_PROFILE as P, GENDARMENMARKT_SOURCES, gendarmenmarktPartContains } from "./gendarmenmarktProfile";
import { letteringStrokePaths } from "./drawnLettering";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type Point = [number, number, number];
type Kind = "box" | "column" | "drum" | "head" | "dome" | "pediment";
type Instance = { matrix: number[]; color: number };
const UP = new Vector3(0, 1, 0), C = Math.cos(P.bearingRadians), S = Math.sin(P.bearingRadians);
const STONE = 0xd6c6a7, LIGHT = 0xe7ddc7, SHADE = 0xad9d7e, GLASS = 0x455353;
const COPPER = 0x718b7b, GOLD = 0xc7a355, BRONZE = 0x5b6657;
export const GENDARMENMARKT_ARCHITECTURE_GROUP_NAME = "Gendarmenmarkt dome towers, portico and public square";
export const MINECRAFT_GENDARMENMARKT_ARCHITECTURE_GROUP_NAME = "Block-native Gendarmenmarkt architecture and square";
function local(cx: number, cz: number, x: number, y: number, z: number): Point {
  return [cx + C * x + S * z, y, cz - S * x + C * z];
}

class Builder {
  batches = new Map<Kind, Instance[]>();
  matrix = new Matrix4();
  constructor(readonly minecraft: boolean) {}
  add(kind: Kind, p: Point, size: Point, color: number, rotation = new Quaternion()): void {
    // Cuboid primitives preserve their bearing: never replace a rotated narrow
    // cornice by its huge world-aligned bounding box.
    if (this.minecraft && kind !== "box" && Math.max(size[0], size[2]) > 3) {
      const radius = size[0] / 2, count = Math.max(12, Math.ceil(Math.PI * radius));
      if (kind === "dome") {
        const layers = 12, height = size[1] / 2;
        for (let level = 0; level < layers; level++) {
          const t = (level + .5) / layers, r = radius * Math.sqrt(1 - t * t);
          const n = Math.max(8, Math.ceil(Math.PI * r));
          for (let i = 0; i < n; i++) {
            const angle = 2 * Math.PI * i / n;
            this.box([p[0] + r * Math.cos(angle), p[1] + t * height, p[2] + r * Math.sin(angle)],
              [Math.max(.8, 2 * Math.PI * r / n), height / layers + .02, 1.1], color, -angle + Math.PI / 2);
          }
        }
      } else {
        for (let i = 0; i < count; i++) {
          const angle = 2 * Math.PI * i / count;
          this.box([p[0] + radius * Math.cos(angle), p[1], p[2] + radius * Math.sin(angle)],
            [2 * Math.PI * radius / count + .06, size[1], 1], color, -angle + Math.PI / 2);
        }
      }
      return;
    }
    if (this.minecraft) kind = "box";
    this.matrix.compose(new Vector3(...p), rotation, new Vector3(...size));
    const rows = this.batches.get(kind) ?? [];
    rows.push({ matrix: this.matrix.toArray(), color }); this.batches.set(kind, rows);
  }
  box(p: Point, size: Point, color: number, yaw: number = P.bearingRadians): void {
    this.add("box", p, size, color, new Quaternion().setFromAxisAngle(UP, yaw));
  }
  beam(a: Point, b: Point, width: number, color: number): void {
    const delta = new Vector3(...b).sub(new Vector3(...a)), length = delta.length();
    if (length < .001) return;
    this.add("box", a.map((v, i) => (v + b[i]) / 2) as Point, [width, length, width], color,
      new Quaternion().setFromUnitVectors(UP, delta.multiplyScalar(1 / length)));
  }
  column(p: Point, h: number, d: number, color = LIGHT): void {
    this.add("column", [p[0], p[1] + h / 2, p[2]], [d, h, d], color);
    for (const y of [p[1] + .12, p[1] + h - .18]) this.box([p[0], y, p[2]], [d * 1.42, .36, d * 1.42], color);
    if (!this.minecraft) for (const side of [-1, 1]) this.add("head", [p[0] + side * d * .46, p[1] + h - .3, p[2]], [d * .45, .5, d * .65], color);
  }
  pediment(p: Point, width: number, height: number, depth: number, yaw: number): void {
    if (this.minecraft) {
      for (let j = 0; j < 12; j++) this.box([p[0], p[1] + (j + .5) * height / 12, p[2]],
        [width * (1 - j / 12), height / 12 + .01, depth], STONE, yaw);
    } else this.add("pediment", p, [width, height, depth], STONE, new Quaternion().setFromAxisAngle(UP, yaw));
  }
  finish(root: Group): void {
    const day = new MeshBasicMaterial({ color: 0xffffff, vertexColors: true });
    const night = new MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .84, flatShading: true });
    for (const [kind, rows] of this.batches) {
      const geometry = kind === "pediment" ? pedimentGeometry() : kind === "box" ? new BoxGeometry(1, 1, 1) : kind === "dome"
        ? new SphereGeometry(.5, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2)
        : kind === "head" ? new SphereGeometry(.5, 8, 6)
          : new CylinderGeometry(.5, .5, 1, kind === "drum" ? 32 : 10);
      geometry.deleteAttribute("uv");
      const normal = geometry.getAttribute("normal"), tints = new Float32Array(normal.count * 3);
      for (let i = 0; i < normal.count; i++) {
        const shade = .86 + .1 * Math.max(0, normal.getY(i)) + .04 * normal.getX(i) - .04 * normal.getZ(i);
        tints.set([shade, shade, shade], i * 3);
      }
      geometry.setAttribute("color", new Float32BufferAttribute(tints, 3));
      const mesh = new InstancedMesh(geometry, day, 0), colors = new Float32Array(rows.length * 3), matrices = new Float32Array(rows.length * 16), color = new Color();
      rows.forEach((r, i) => { matrices.set(r.matrix, i * 16); color.setHex(r.color).toArray(colors, i * 3); });
      mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
      mesh.instanceColor = new InstancedBufferAttribute(colors, 3); mesh.count = rows.length;
      mesh.name = `${root.name} ${kind}`;
      mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true };
      mesh.computeBoundingBox(); mesh.computeBoundingSphere(); root.add(mesh);
    }
  }
}

function pedimentGeometry(): BufferGeometry {
  const front = [[-.5, 0, .5], [.5, 0, .5], [0, 1, .5]];
  const back = front.map(([x, y]) => [x, y, -.5]);
  const positions = [...front.flat(), ...[back[2], back[1], back[0]].flat()];
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3;
    positions.push(...front[i], ...back[i], ...front[j], ...front[j], ...back[i], ...back[j]);
  }
  const g = new BufferGeometry(); g.setAttribute("position", new Float32BufferAttribute(positions, 3)); g.computeVertexNormals(); return g;
}

function figure(b: Builder, p: Point, height: number, color: number, seated = false): void {
  const torsoY = p[1] + height * (seated ? .4 : .49);
  b.add("head", [p[0], torsoY, p[2]], [height * .32, height * .61, height * .28], color);
  b.add("head", [p[0], p[1] + height * .88, p[2]], [height * .21, height * .24, height * .22], color);
  for (const side of [-1, 1]) {
    b.beam([p[0] + side * height * .1, torsoY, p[2]],
      [p[0] + side * height * .13, p[1] + .08, p[2] + (seated ? height * .3 : 0)], height * .12, color);
    b.beam([p[0] + side * height * .16, torsoY + height * .12, p[2]],
      [p[0] + side * height * .24, torsoY - height * .17, p[2] + height * .15], height * .095, color);
  }
}

function tower(b: Builder, profile: typeof P.frenchTower | typeof P.germanTower): void {
  const [cx, cz] = profile.centre, at = (x: number, y: number, z: number) => local(cx, cz, x, y, z);
  const floor = P.groundY, top = profile.topY;
  b.box(at(0, floor + 9, 0), [20.8, 18, 21.8], STONE);
  b.box(at(0, 25.2, 0), [23.1, 4.6, 23.1], LIGHT);
  b.box(at(0, 27.6, 0), [24.5, .8, 24.5], SHADE);
  // The three six-column temple fronts are open around the solid tower core.
  for (const normal of [[1, 0], [0, -1], [0, 1]]) {
    const [nx, nz] = normal, tx = -nz, tz = nx, reach = nx ? 16.5 : 18.1;
    const q = (u: number, y: number, d: number) => at(nx * d + tx * u, y, nz * d + tz * u);
    const yaw: number = P.bearingRadians - Math.atan2(tz, tx);
    for (let j = 0; j < 4; j++) b.box(q(0, floor + .13 + j * .26, reach - 1.2), [21 - j * .5, .26, 6.5 - j * .5], LIGHT, yaw);
    for (let i = 0; i < 6; i++) b.column(q((i - 2.5) * 3.15, floor + 1, reach - .8), 14.6, 1.04);
    b.box(q(0, floor + 16.1, reach - 1.5), [19.8, 1.4, 5], LIGHT, yaw);
    b.pediment(q(0, floor + 16.8, reach - 1.45), 19.3, 3, 4.6, yaw);
    for (const side of [-1, 1]) b.beam(q(side * 9.9, floor + 16.8, reach + .9), q(0, floor + 20.0, reach + .9), .27, LIGHT);
    // Door recess and paired tall windows are on the real body, behind columns.
    b.box(q(0, floor + 4.1, 10.65), [3.5, 6.2, .22], GLASS, yaw);
    for (const side of [-1, 1]) b.box(q(side * 6.1, floor + 8.5, 10.8), [2.2, 6.8, .2], GLASS, yaw);
    for (const side of [-1, 1]) figure(b, q(side * 8.3, floor + 18.1, reach - .7), 2.6, LIGHT);
  }
  b.add("drum", at(0, 35.1, 0), [15.1, 14.4, 15.1], STONE);
  for (const y of [28.3, 29.1, 41.9, 43.1]) b.add("drum", at(0, y, 0), [21.4, y === 43.1 ? .9 : .55, 21.4], LIGHT);
  for (let i = 0; i < 12; i++) {
    const angle = 2 * Math.PI * i / 12;
    b.column(at(Math.cos(angle) * 9.35, 29.5, Math.sin(angle) * 9.35), 11.65, 1.02);
    const a = angle + Math.PI / 12;
    b.box(at(Math.cos(a) * (b.minecraft ? 8.18 : 7.57), 35.6, Math.sin(a) * (b.minecraft ? 8.18 : 7.57)), [3.3, 6.3, .2], GLASS, P.bearingRadians - a + Math.PI / 2);
  }
  // Fine balustrade remains shared instanced geometry, also visible at distance.
  for (let i = 0; i < (b.minecraft ? 32 : 64); i++) {
    const angle = i * 2 * Math.PI / (b.minecraft ? 32 : 64);
    b.column(at(Math.cos(angle) * 10.45, 43.6, Math.sin(angle) * 10.45), 1.1, .17);
  }
  b.add("drum", at(0, 44.8, 0), [21.6, .35, 21.6], LIGHT);
  const domeTop = top - 3.65;
  b.add("dome", at(0, 44.95, 0), [18.45, (domeTop - 44.95) * 2, 18.45], COPPER);
  if (!b.minecraft) for (let i = 0; i < 16; i++) {
    const angle = i * Math.PI / 8;
    for (let j = 0; j < 10; j++) {
      const t0 = j / 10 * Math.PI / 2, t1 = (j + 1) / 10 * Math.PI / 2;
      b.beam(at(9.27 * Math.cos(t0) * Math.cos(angle), 44.95 + (domeTop - 44.95) * Math.sin(t0), 9.27 * Math.cos(t0) * Math.sin(angle)),
        at(9.27 * Math.cos(t1) * Math.cos(angle), 44.95 + (domeTop - 44.95) * Math.sin(t1), 9.27 * Math.cos(t1) * Math.sin(angle)), .08, 0x899782);
    }
  }
  b.add("drum", at(0, domeTop + .35, 0), [1.5, .7, 1.5], GOLD);
  figure(b, at(0, domeTop + .7, 0), 2.95, GOLD);
}

function churchFacades(b: Builder): void {
  for (const key of ["frenchChurch", "germanChurch"] as const) {
    const profile = source.profiles[key], principal = profile.parts[0];
    const cx = key === "frenchChurch" ? 1375.9 : 1398.4, cz = key === "frenchChurch" ? 534.5 : 718.3;
    // Follow each actual wall segment, including the different rounded and
    // polygonal church ends, rather than drawing an invented rectangular hall.
    for (const part of profile.parts.filter(p => p.height_m > 10)) {
      if (key === "germanChurch" && part === principal) continue;
      const ring = part.ring;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], z = ring[(i + 1) % ring.length], dx = z[0] - a[0], dz = z[1] - a[1], length = Math.hypot(dx, dz);
        if (length < 3.5) continue;
        let nx = -dz / length, nz = dx / length;
        const mx = (a[0] + z[0]) / 2, mz = (a[1] + z[1]) / 2;
        if ((mx - cx) * nx + (mz - cz) * nz < 0) { nx *= -1; nz *= -1; }
        const yaw = -Math.atan2(dz, dx), count = Math.max(1, Math.round(length / 4.7));
        for (let j = 0; j < count; j++) {
          const x = a[0] + dx * (j + .5) / count + nx * (b.minecraft ? 1.25 : .27), zz = a[1] + dz * (j + .5) / count + nz * (b.minecraft ? 1.25 : .27);
          const at = (y: number, out = 0): Point => [x + nx * out, y, zz + nz * out];
          b.box(at(13.2), [2.1, 7, .2], GLASS, yaw);
          b.box(at(9.55, .12), [2.6, .38, .46], LIGHT, yaw);
          b.box(at(13.2, .2), [.1, 7, .1], LIGHT, yaw);
          for (const side of [-1, 1]) b.box([x + dx / length * side * 1.25, 13.2, zz + dz / length * side * 1.25], [.3, 7.5, .3], LIGHT, yaw);
          b.box(at(17.1, .15), [2.7, .45, .42], LIGHT, yaw);
        }
        for (const [y, h] of [[7, .7], [18.5, .5], [20.7, .7]]) b.box([mx + nx * .2, y, mz + nz * .2], [length, h, .6], LIGHT, yaw);
      }
    }
  }
}

function konzerthaus(b: Builder): void {
  const [cx, cz] = P.konzerthaus.frontCentre, q = (u: number, y: number, d: number): Point => local(cx, cz, d, y, u);
  const yaw: number = P.bearingRadians - Math.PI / 2, stage = 10.75, lift = b.minecraft ? 1.35 : 0;
  for (let i = 0; i < P.konzerthaus.stairTreads; i++) {
    const h = (stage - P.groundY) / 29, d = 18.2 - i * .36;
    b.box(q(0, P.groundY + (i + .5) * h, d), [24.8, h, .4], LIGHT, yaw);
  }
  b.box(q(0, stage - .35, 5.5), [25.8, .7, 7.5], LIGHT, yaw);
  for (let i = 0; i < 6; i++) b.column(q((i - 2.5) * 4.25, stage, 7.1), 12.35, 1.02);
  b.box(q(0, 24.0, 4.8), [28.1, 1.7, 7.2], LIGHT, yaw);
  b.pediment(q(0, 24.9, 4.8), 27.8, 3.6, 7.2, yaw);
  for (const s of [-1, 1]) b.beam(q(s * 14, 24.6, 8.5), q(0, 28.65, 8.5), .42, LIGHT);
  b.box(q(0, 24.7, 8.5), [28.5, .4, .36], LIGHT, yaw);
  // Central high front, two lower side wings and glazed principal doors.
  for (const side of [-1, 1]) for (let j = 0; j < 3; j++) {
    const u = side * (21.5 + j * 4.75);
    for (const y of [10.0, 17.6]) {
      b.box(q(u, y, -9.6 + lift), [2.7, y === 10 ? 4.1 : 6.3, .3], GLASS, yaw);
      b.box(q(u, y, -9.35 + lift), [.12, y === 10 ? 4.1 : 6.3, .1], LIGHT, yaw);
      b.box(q(u, y + .5, -9.35 + lift), [2.7, .13, .1], LIGHT, yaw);
      b.box(q(u, y - (y === 10 ? 2.25 : 3.4), -9.3 + lift), [3.3, .4, .7], LIGHT, yaw);
    }
  }
  for (let j = -2; j <= 2; j++) {
    for (const [y, height] of [[13.2, 4.9], [19.55, 5.1]]) {
      b.box(q(j * 4.5, y, .35 + lift), [3.15, height, .24], GLASS, yaw);
      for (const offset of [-1.05, 0, 1.05]) b.box(q(j * 4.5 + offset, y, .54 + lift), [.085, height, .12], LIGHT, yaw);
      for (const offset of [-1.6, -.8, 0, .8, 1.6]) b.box(q(j * 4.5, y + offset, .54 + lift), [3.15, .085, .12], LIGHT, yaw);
    }
  }
  for (let j = -2; j <= 2; j++) {
    b.box(q(j * 4.6, 30.4, .35 + lift), [3.4, 3.8, .26], GLASS, yaw);
    for (const offset of [-.9, 0, .9]) b.box(q(j * 4.6 + offset, 30.4, .55 + lift), [.1, 3.8, .12], LIGHT, yaw);
    for (const offset of [-1.1, 0, 1.1]) b.box(q(j * 4.6, 30.4 + offset, .55 + lift), [3.4, .1, .12], LIGHT, yaw);
  }
  b.box(q(0, 32.5, .5), [29.7, .4, .5], LIGHT, yaw);
  for (const y of [8.0, 22.9]) b.box(q(0, y, -9.7), [73.2, .5, .65], LIGHT, yaw);
  // Source-exterior side/rear bays keep the theatre readable when orbiting.
  // Reject edges covered by another original part and leave the authored front.
  for (const part of source.profiles.konzerthaus.parts.filter(p => p.height_m > 10)) {
    for (let i = 0; i < part.ring.length; i++) {
      const a = part.ring[i], z = part.ring[(i + 1) % part.ring.length];
      const dx = z[0] - a[0], dz = z[1] - a[1], length = Math.hypot(dx, dz);
      if (length < 4.5) continue;
      const mx = (a[0] + z[0]) / 2, mz = (a[1] + z[1]) / 2;
      let nx = -dz / length, nz = dx / length;
      if (gendarmenmarktPartContains(part, mx + nx * .3, mz + nz * .3)) { nx *= -1; nz *= -1; }
      if (nx > .65 || source.profiles.konzerthaus.parts.some(p => p !== part && gendarmenmarktPartContains(p, mx + nx * .6, mz + nz * .6))) continue;
      const angle = -Math.atan2(dz, dx), bays = Math.max(1, Math.round(length / 5.2));
      for (let j = 0; j < bays; j++) for (const y of [10, 17.6]) {
        const u = (j + .5) / bays, px = a[0] + u * dx + nx * (.3 + lift), pz = a[1] + u * dz + nz * (.3 + lift);
        b.box([px, y, pz], [2.55, 4.8, .2], GLASS, angle);
        b.box([px + nx * .13, y, pz + nz * .13], [.1, 4.8, .13], LIGHT, angle);
        b.box([px + nx * .13, y + .3, pz + nz * .13], [2.55, .1, .13], LIGHT, angle);
        b.box([px + nx * .12, y - 2.6, pz + nz * .12], [3.05, .32, .55], LIGHT, angle);
      }
    }
  }
  for (const path of letteringStrokePaths("KONZERTHAUS BERLIN", .68)) for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], z = path[i];
    b.beam(q(-a[0], 23.3 + a[1], 8.49), q(-z[0], 23.3 + z[1], 8.49), .075, SHADE);
  }
  // Music-making cupids on the lion/panther flank the public stair.
  for (const side of [-1, 1]) {
    b.box(q(side * 14.5, 7.25, 17.9), [3, 3.6, 5], LIGHT, yaw);
    const p = q(side * 14.5, 9.65, 17.5);
    b.add("head", p, [2.3, 1.65, 3.8], BRONZE);
    b.add("head", [p[0] + 1.2, p[1] + .6, p[2]], [1.4, 1.5, 1.3], BRONZE);
    figure(b, [p[0] - .3, p[1] + .5, p[2]], 1.8, BRONZE, true);
  }
  // Bounded procedural silhouette of Apollo with the paired griffins.
  const apex = q(0, 37.96, -5);
  figure(b, apex, 2.75, BRONZE);
  for (const s of [-1, 1]) {
    const p = q(s * 1.8, 38.45, -4);
    b.add("head", p, [1.4, 1.3, 2.6], BRONZE);
    b.beam([p[0], p[1] + .4, p[2]], [p[0] - 1, p[1] + 2.15, p[2] + s * .85], .42, BRONZE);
  }
}

function square(b: Builder, root: Group): void {
  // Exact OSM square outline at street level; hidden ground is kept flat.
  const outline = source.square.ring.map(p => new Vector2(p[0], p[1]));
  const triangles = ShapeUtils.triangulateShape(outline, []), positions: number[] = [];
  for (const t of triangles) for (const i of t) positions.push(outline[i].x, 5.23, outline[i].y);
  const geometry = new BufferGeometry(); geometry.setAttribute("position", new Float32BufferAttribute(positions, 3)); geometry.computeVertexNormals();
  const day = new MeshBasicMaterial({ color: 0xaaa89b, side: DoubleSide });
  const night = new MeshStandardMaterial({ color: 0xaaa89b, roughness: .94, side: DoubleSide });
  const mesh = new Mesh(geometry, day); mesh.name = "Exact OSM Gendarmenmarkt flush natural-stone ground";
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, osmKey: source.square.osm_key };
  root.add(mesh);
  // Larger retained-grid readings, not one mesh per individual paving stone.
  const origin = source.square.ring[3], across = source.square.ring[0];
  const dx = across[0] - origin[0], dz = across[1] - origin[1], length = Math.hypot(dx, dz);
  const vx = source.square.ring[2][0] - origin[0], vz = source.square.ring[2][1] - origin[1], depth = Math.hypot(vx, vz);
  const p = (u: number, v: number): Point => [origin[0] + dx * u + vx * v, 5.245, origin[1] + dz * u + vz * v];
  const clear = (point: Point) => !GENDARMENMARKT_SOURCES.some(s => s.parts.some(part => gendarmenmarktPartContains(part, point[0], point[2])));
  // Short segments skip each exact building footprint and keep the broad pale
  // square legible without dense joints that shimmer in mobile distant views.
  for (let u = 0; u <= 1; u += 7.5 / length) for (let v = .01; v < .99; v += 3 / depth) {
    const a = p(u, v), z = p(u, Math.min(.995, v + 3 / depth));
    if (clear(a) && clear(z)) b.beam(a, z, .09, 0x898c84);
  }
  for (let v = 0; v <= 1; v += 7.5 / depth) for (let u = .01; u < .99; u += 3 / length) {
    const a = p(u, v), z = p(Math.min(.995, u + 3 / length), v);
    if (clear(a) && clear(z)) b.beam(a, z, .09, 0x898c84);
  }
  const [sx, sz] = source.schiller.position;
  for (const [h, radius] of [[.12, 5.5], [.38, 4.5], [.78, 3.6]]) b.add("drum", [sx, 5.2 + h, sz], [radius * 2, .35, radius * 2], LIGHT);
  b.box([sx, 7.85, sz], [2.4, 3.9, 2.4], LIGHT);
  b.box([sx, 9.95, sz], [2.9, .35, 2.9], LIGHT);
  figure(b, [sx, 10.12, sz], 3.15, LIGHT);
  for (const x of [-1, 1]) for (const z of [-1, 1]) figure(b, [sx + x * 2.1, 6.05, sz + z * 2.1], 2.45, LIGHT, true);
}

function create(minecraft: boolean): Group {
  const root = new Group(); root.name = minecraft ? MINECRAFT_GENDARMENMARKT_ARCHITECTURE_GROUP_NAME : GENDARMENMARKT_ARCHITECTURE_GROUP_NAME;
  root.userData = { textureFree: true, keepInMinecraft: minecraft, blockNative: minecraft,
    domeTowers: 2, porticosPerTower: 3, columnsPerTowerDrum: 12, theatrePorticoColumns: 6,
    surfaceOnly: true, hiddenSolidInfill: false, sourceBound: true };
  const b = new Builder(minecraft);
  tower(b, P.frenchTower); tower(b, P.germanTower); churchFacades(b); konzerthaus(b); square(b, root); b.finish(root);
  return freezeStaticSceneTransforms(root);
}
export function createGendarmenmarktArchitecture(): Group { return create(false); }
export function createMinecraftGendarmenmarktArchitecture(): Group { return create(true); }
