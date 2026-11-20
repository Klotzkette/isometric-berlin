import {
  BoxGeometry, Color, Group, InstancedMesh, Matrix4, MeshBasicMaterial,
  MeshStandardMaterial, Quaternion, Vector3,
} from "three";
import data from "./data/southFidelityV294.json";
import { SKALITZER_PILOT_V369, skalitzerSectionV369 } from "./skalitzerStructureV369";

type Point3 = [number, number, number];
type Member = { a: Point3; b: Point3; height: number; breadth: number; colour: number; part: string };

const tracks = data.tracks;
const pilot = SKALITZER_PILOT_V369;
const painted = 0x555954, edge = 0x69706b, recess = 0x454b48;
const west = 3270, east = 4635;
const stationWest = 3732.8, stationEast = 3873.6;
const alongX = new Vector3(1, 0, 0);
const up = new Vector3(0, 1, 0);
const hosts = ["6_4", "7_4", "8_4", "9_4"];

/** Each transverse crosses the pair of tracks exactly once. The station hall
 * has its own framing; its cantilevers don't belong to the open viaduct. */
function members(tileId: string): Member[] {
  if (!hosts.includes(tileId)) return [];
  const col = Number(tileId.split("_")[0]);
  const lo = Math.max(west, 512 * col), hi = Math.min(east, 512 * (col + 1));
  const result: Member[] = [];
  const add = (a: Point3, b: Point3, height: number, breadth: number, colour: number, part: string) =>
    result.push({ a, b, height, breadth, colour, part });
  function section(x: number) {
    const s = skalitzerSectionV369(tracks, x);
    if (!s) return null;
    return { ...s, half: s.separation / 2 + 1.49,
      at: (v: number, y: number, u = 0): Point3 =>
        [s.x - s.dz * v + s.dx * u, y, s.z + s.dx * v + s.dz * u] };
  }
  // The three open reaches have a consistent beam phase across chunk edges.
  for (const [from, to, pitch] of [[west, pilot.west, 3.6], [pilot.west, pilot.east, 2.4],
    [pilot.east, stationWest, 3.6], [stationEast, east, 3.6]]) {
    const first = Math.max(0, Math.ceil((lo - from) / pitch));
    for (let i = first; from + i * pitch < Math.min(hi, to); i++) {
      const x = from + i * pitch, s = section(x);
      if (!s) continue;
      add(s.at(-s.half, 8.37), s.at(s.half, 8.37), .30, .105, recess, "floor-beam-web");
      add(s.at(-s.half, 8.21), s.at(s.half, 8.21), .055, .22, painted, "floor-beam-flange");
    }
  }
  // Solid girders, projecting edge and sparse rail uprights in the
  // photographed test field. Long members follow every original track vertex.
  const ends = new Set<number>([Math.max(lo, pilot.west), Math.min(hi, pilot.east)]);
  for (const t of tracks) for (const p of t.points) {
    if (p[0] > Math.max(lo, pilot.west) && p[0] < Math.min(hi, pilot.east)) ends.add(p[0]);
  }
  if (lo < pilot.east && hi > pilot.west) {
    const xs = [...ends].sort((a, b) => a - b);
    for (let j = 1; j < xs.length; j++) {
      const a = section(xs[j - 1]), b = section(xs[j]);
      if (!a || !b) continue;
      for (const sign of [-1, 1]) {
        const span = (extra: number, y: number, h: number, breadth: number, color: number, part: string) =>
          add(a.at(sign * (a.half + extra), y), b.at(sign * (b.half + extra), y), h, breadth, color, part);
        span(0, 8.09, .075, .27, edge, "outer-web-bottom-flange");
        span(.23, 8.91, .09, .69, painted, "edge-walkway");
        span(.48, 9.06, .23, .07, painted, "kick-plate");
        span(.48, 9.98, .065, .065, edge, "handrail");
      }
      add(a.at(0, 8.06), b.at(0, 8.06), .15, .15, 0x646863, "underside-longitudinal-line");
    }
    for (let x = pilot.west + Math.max(0, Math.ceil((lo - pilot.west) / 1.8)) * 1.8;
      x < Math.min(hi, pilot.east); x += 1.8) {
      const s = section(x);
      if (!s) continue;
      for (const side of [-1, 1]) {
        const v = side * (s.half + .48);
        add(s.at(v, 9.1), s.at(v, 9.98), .05, .05, painted, "edge-upright");
      }
    }
  }
  for (const [x, gauge] of pilot.pierPairs) {
    if (x < lo || x >= hi) continue;
    const s = section(x);
    if (!s) continue;
    for (const side of [-1, 1]) {
      const v = side * gauge / 2;
      add(s.at(v, 3.08, -.37), s.at(v, 3.08, .37), .16, .72, recess, "column-foot");
      add(s.at(v, 7.88, -.31), s.at(v, 7.88, .31), .22, .64, edge, "column-collar");
      add(s.at(v - side * .12, 7.04), s.at(v - side * 1.00, 8.08), .115, .115, painted, "portal-knee");
      for (const u of [-.13, .13]) for (const y of [7.90, 8.05]) {
        // Bolt/rivet heads at the bearing joint. Their pattern is illustrative.
        add(s.at(v + side * .23, y, u), s.at(v + side * .26, y, u), .055, .055, edge, "bearing-fastener");
      }
    }
  }
  return result;
}

/** Coordinates are absolute viewer metres. The tile controller attaches the
 * group only while the authored V294 rail deck is present in this geometry mode. */
export function createSkalitzerSteelV369(tileId: string, native = false): Group | null {
  const parts = members(tileId);
  if (!parts.length) return null;
  const matrices: Matrix4[] = [], colours: Color[] = [];
  const p = new Vector3(), q = new Quaternion(), size = new Vector3(), direction = new Vector3();
  const roles: Record<string, number> = {};
  for (const { a, b, height, breadth, colour, part } of parts) {
    roles[part] = (roles[part] || 0) + 1;
    direction.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const length = direction.length(), tone = new Color(colour);
    if (!native) {
      p.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
      if (Math.abs(direction.y) < 1e-6) q.setFromAxisAngle(up, -Math.atan2(direction.z, direction.x));
      else q.setFromUnitVectors(alongX, direction.normalize());
      matrices.push(new Matrix4().compose(p, q, size.set(length, height, breadth)));
      colours.push(tone);
      continue;
    }
    // Cardinal runs are split at their cross-axis drift. A straight horizontal
    // flange takes one block; knees step up in both the lateral and height axes.
    const { x, y, z } = direction;
    const components = [Math.abs(x), Math.abs(y), Math.abs(z)].sort((i, j) => i - j);
    const count = Math.max(1, Math.ceil(components[1] / .24));
    const horizontal = Math.hypot(x, z);
    const widthX = horizontal ? breadth * Math.abs(z) / horizontal : breadth;
    const widthZ = horizontal ? breadth * Math.abs(x) / horizontal : breadth;
    q.identity();
    size.set(Math.max(.03, Math.abs(x) / count + widthX),
      Math.abs(y) / count + (horizontal ? height : 0), Math.max(.03, Math.abs(z) / count + widthZ));
    for (let j = 0; j < count; j++) {
      const t = (j + .5) / count;
      p.set(a[0] + x * t, a[1] + y * t, a[2] + z * t);
      matrices.push(new Matrix4().compose(p, q, size));
      colours.push(tone);
    }
  }
  const root = new Group(), geometry = new BoxGeometry(1, 1, 1);
  geometry.deleteAttribute("uv");
  const night = new MeshStandardMaterial({ roughness: .82, metalness: .13 });
  const day = native ? night : new MeshBasicMaterial();
  const mesh = new InstancedMesh(geometry, day, matrices.length);
  for (let i = 0; i < matrices.length; i++) {
    mesh.setMatrixAt(i, matrices[i]); mesh.setColorAt(i, colours[i]);
  }
  mesh.computeBoundingSphere(); mesh.computeBoundingBox(); mesh.updateMatrix(); mesh.matrixAutoUpdate = false;
  mesh.userData = { dayMaterial: day, nightMaterial: night, nativeMinecraft: native, blockNative: native, keepInMinecraft: native };
  root.name = "Skalitzer Straße · BVG · " + tileId;
  root.userData = { skalitzerSteelV369: true, nativeMinecraft: native, tileId, roles };
  root.add(mesh);
  return root;
}
