import {
  BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Quaternion, Vector3,
} from "three";
import source from "./data/alexanderStationsV183Source.json";
import navigation from "./data/alexanderStationsV183Navigation.json";
import { appendVoxelEnvelope, sourceMesh } from "./BebelplatzBuildingShells";
import { bebelplatzPartContains, type BebelplatzSourcePart } from "./bebelplatzBuildingProfile";
import { letteringStrokePaths } from "./drawnLettering";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const ALEXANDER_STATIONS_V183_GROUP = "Alexanderplatz Behrens Alexa Lehrer and transparent station halls";
export const ALEXANDER_STATIONS_V183_NATIVE_GROUP = "Alexanderplatz and station halls independent native surfaces";
type P = [number, number, number];
type Profile = typeof source.profiles[number];
type Axis = { a: number[]; b: number[]; dx: number; dz: number; nx: number; nz: number; length: number; yaw: number };
type Row = { matrix: Matrix4; color: number; role: string };
const C = { stone: 0xb5ad94, trim: 0xd5cdbc, dark: 0x384348, glass: 0x60818b, frame: 0xcbd4cc, pink: 0xb75566, rose: 0xd47d8c, red: 0x913e52, steel: 0x667476, roof: 0x9ba4a0, blue: 0x284d6a };
const tone = (key: string) => ({ wall: key === "alexa" ? C.pink : key === "lehrer" ? 0xb2c4bb : C.stone, roof: 0x8c9289, name: key });

class Builder {
  rows: Row[] = [];
  glass: Row[] = [];
  constructor(readonly native: boolean) {}
  box(p: P, size: P, color: number, yaw = 0, role = "facade", glass = false): void {
    const rows = glass ? this.glass : this.rows;
    // The native reading contains orthogonal stepped prisms, including glazing.
    const n = this.native && Math.abs(yaw) > .001 ? Math.max(1, Math.ceil(size[0] / 1.3)) : 1;
    for (let i = 0; i < n; i++) {
      const u = ((i + .5) / n - .5) * size[0];
      const matrix = new Matrix4().makeRotationY(this.native ? 0 : yaw);
      matrix.scale(new Vector3(size[0] / n, size[1], size[2]));
      matrix.setPosition(p[0] + Math.cos(yaw) * u, p[1], p[2] - Math.sin(yaw) * u);
      rows.push({ matrix, color, role });
    }
  }
  beam(a: P, b: P, width: number, color: number, role = "structural-frame"): void {
    const d = new Vector3(...b).sub(new Vector3(...a)), l = d.length(); if (l < .001) return;
    if (this.native) {
      const n = Math.max(1, Math.ceil(l / 1.2));
      for (let i = 0; i < n; i++) {
        const f = (i + .5) / n;
        this.box(a.map((v, j) => v + (b[j] - v) * f) as P,
          [Math.max(width, Math.abs(d.x) / n), Math.max(width, Math.abs(d.y) / n), Math.max(width, Math.abs(d.z) / n)], color, 0, role);
      }
    } else this.rows.push({ matrix: new Matrix4().compose(new Vector3(...a).add(new Vector3(...b)).multiplyScalar(.5),
      new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d.normalize()), new Vector3(width, l, width)), color, role });
  }
  face(a: Axis, u: number, y: number, w: number, h: number, color: number, out = .12, depth = .10, role = "facade"): void {
    this.box(at(a, u, y, out), [w, h, depth], color, a.yaw, role);
  }
  text(a: Axis, label: string, y: number, height: number, color: number, out = .30): void {
    // A geometric alphabet; no font, photograph or texture is created.
    const paths = letteringStrokePaths(label, height), width = Math.max(...paths.flat().map(p => p[0]));
    const reverse = a.dx < 0, point = (p: number[]): P => at(a, a.length / 2 + (reverse ? -1 : 1) * (p[0] - width / 2), y + p[1], out);
    for (const path of paths) for (let i = 1; i < path.length; i++) this.beam(point(path[i - 1]), point(path[i]), height * .095, color, "identity-lettering");
  }
}
function at(a: Axis, u: number, y: number, out = 0): P { return [a.a[0] + a.dx * u + a.nx * out, y, a.a[1] + a.dz * u + a.nz * out]; }
function axes(p: BebelplatzSourcePart): Axis[] {
  // Merge only collinear facade runs. Original source polygons are untouched.
  const ring = p.ring.filter((q, i, r) => {
    const a = r[(i + r.length - 1) % r.length], b = r[(i + 1) % r.length];
    return Math.abs((q[0] - a[0]) * (b[1] - q[1]) - (q[1] - a[1]) * (b[0] - q[0])) > .035;
  });
  return ring.map((a, i) => {
    const b = ring[(i + 1) % ring.length], length = Math.hypot(b[0] - a[0], b[1] - a[1]), dx = (b[0] - a[0]) / length, dz = (b[1] - a[1]) / length;
    let nx = dz, nz = -dx;
    if (bebelplatzPartContains(p, (a[0] + b[0]) / 2 + nx * .2, (a[1] + b[1]) / 2 + nz * .2)) { nx *= -1; nz *= -1; }
    return { a, b, length, dx, dz, nx, nz, yaw: -Math.atan2(dz, dx) };
  }).filter(a => a.length > .4);
}
function displayedParts(p: Profile): BebelplatzSourcePart[] {
  if (p.key !== "lehrer") return p.parts;
  const q = p.parts[0], top = 57.844;
  return [{ ...q, top_y_m: top, surfaces: q.surfaces.filter(s => s.kind !== "RoofSurface").concat([
    { kind: "RoofSurface", rings: [q.ring.map(([x, z]) => [x, top, z])] },
  ]) }];
}
function visibleAxis(p: BebelplatzSourcePart, a: Axis, all: BebelplatzSourcePart[]): boolean {
  const mid = at(a, a.length / 2, 0, .25);
  return !all.some(q => q !== p && q.top_y_m >= p.top_y_m - 2 && bebelplatzPartContains(q, mid[0], mid[2]));
}

function behrens(b: Builder, profile: Profile): void {
  const parts = displayedParts(profile);
  for (const p of parts) for (const a of axes(p)) {
    if (a.length < 3 || !visibleAxis(p, a, parts)) continue;
    const low = p.top_y_m < 22, base = p.ground_y_m, cap = p.top_y_m - .8;
    const upperBottom = base + 7.4, floors = low ? 2 : 6, pitch = (cap - upperBottom) / floors;
    const count = Math.max(1, Math.round(a.length / 5.15)), bay = a.length / count;
    // Two glazed retail/gallery storeys below six paired-window office bands.
    b.face(a, a.length / 2, base + 3.65, a.length - .12, 6.7, C.glass, .14, .13, "Behrens-glazed-two-storey-base");
    for (const y of [base + .4, base + 3.6, upperBottom - .2, cap + .4]) b.face(a, a.length / 2, y, a.length, .28, C.trim, .28, .28);
    for (let i = 0; i <= count * 2; i++) b.face(a, i * a.length / (count * 2), base + 3.65, .13, 6.9, C.trim, .30, .20);
    for (let f = 0; f < floors; f++) for (let i = 0; i < count; i++) {
      const u = (i + .5) * bay, y = upperBottom + (f + .5) * pitch, w = bay * .75, h = pitch * .63;
      b.face(a, u, y, w + .27, h + .24, 0x918b7b, .13);
      b.face(a, u, y, w, h, C.glass, .24);
      for (const du of [-w / 2, -w / 4, 0, w / 4, w / 2]) b.face(a, u + du, y, du === 0 ? .18 : .07, h, C.trim, .36, .08);
      for (const yy of [y - h / 2, y + h / 2, y + h * .18]) b.face(a, u, yy, w + .16, .09, C.trim, .36);
      b.face(a, u, y - h / 2 - .2, w + .5, .14, C.trim, .36, .25);
    }
    for (let i = 0; i <= count; i++) b.face(a, i * bay, (upperBottom + cap) / 2, .30, cap - upperBottom, 0xc9c0a9, .22, .26);
    // The fine roof rail is a separate open outline, never a taller roof slab.
    b.beam(at(a, 0, cap + 1.0, -.25), at(a, a.length, cap + 1.0, -.25), .075, C.steel, "Behrens-open-parapet-rail");
    for (let u = .5; u < a.length; u += 3.2) b.beam(at(a, u, cap + .5, -.25), at(a, u, cap + 1.0, -.25), .06, C.steel);
  }
}
function lehrer(b: Builder, profile: Profile): void {
  const p = displayedParts(profile)[0], base = p.ground_y_m;
  for (const a of axes(p).filter(a => a.length > 4)) {
    const cols = Math.max(3, Math.round(a.length / 2.1)), pitch = a.length / cols;
    b.face(a, a.length / 2, 30.2, a.length - .1, 54.3, 0xa3c0b9, .12);
    // White mullions and mint spandrels surround the nine upper window rows.
    for (let j = 0; j < cols; j++) {
      const u = (j + .5) * pitch;
      for (let floor = 0; floor < 9; floor++) b.face(a, u, 25.65 + floor * 3.48, pitch - .19, 2.10, floor % 3 ? 0x6b8c96 : 0x486f82, .23, .11, "Lehrer-curtain-wall-window");
      for (let floor = 0; floor < 2; floor++) b.face(a, u, base + 6.25 + floor * 3.7, pitch - .19, 2.85, C.glass, .23);
      b.face(a, j * pitch, 30.2, .095, 54.5, 0xe1e2d8, .36, .13);
    }
    for (let floor = 0; floor <= 9; floor++) b.face(a, a.length / 2, 23.95 + floor * 3.48, a.length, .12, 0xe1e2d8, .37, .12);
    b.face(a, a.length / 2, base + 2.1, a.length, 4.2, 0xd9d9c9, .38, .18);
    for (let j = 0; j < cols; j += 2) b.face(a, (j + .5) * pitch, base + 2.1, pitch * 1.5, 3.9, C.dark, .49, .12);
    // The documented eight-metre wrap is independently drawn coarse colour fields.
    // It identifies Womacka's frieze without tracing protected figures or pixels.
    b.face(a, a.length / 2, 19.1, a.length + .3, 8, 0xcfc9ad, .47, .15, "Womacka-eight-metre-colour-frieze");
    const palette = [0x8a3e37, 0x6c8e96, 0xd7bd68, 0x3f555d, 0xb2b09b, 0xe0d5b8];
    for (let j = 0; j < cols * 2; j++) for (let row = 0; row < 4; row++) {
      const u = (j + .5) * a.length / (cols * 2), y = 16.1 + row * 1.75;
      b.face(a, u, y, pitch * .43, 1.5 - ((j + row) % 3) * .22, palette[(j * 7 + row * 3) % palette.length], .57, .08, "procedural-frieze-colour-field");
    }
    for (const y of [15.0, 23.2, 57.6]) b.face(a, a.length / 2, y, a.length + .35, .23, 0xe3e0d2, .50, .35);
  }
}
function alexa(b: Builder, profile: Profile): void {
  const p = profile.parts[0], edges = axes(p);
  for (const a of edges) {
    const top = p.top_y_m, base = p.ground_y_m;
    // The continuous solid rose wall, rounded source corners and incised bands
    // are characteristic of the operator's documented Art Deco exterior.
    for (const y of [base + 1.2, base + 5.9, base + 14.7, top - 1.0, top - .4]) b.face(a, a.length / 2, y, a.length + .03, y < top - 2 ? .16 : .27, C.rose, .12, .17, "Alexa-continuous-Art-Deco-bands");
    if (a.length < 5) continue;
    const count = Math.max(1, Math.round(a.length / 7.4));
    for (let i = 0; i < count; i++) {
      const u = (i + .5) * a.length / count;
      b.face(a, u, base + 3.1, Math.min(3.8, a.length / count * .65), 4.5, C.dark, .20, .13, "Alexa-ground-window");
      for (const d of [-.38, .38]) b.face(a, u + d, base + 11.0, .11, 7.6, C.red, .20, .10, "Alexa-incised-vertical-relief");
      b.face(a, u, base + 16.0, .65, .20, C.rose, .24, .14);
    }
    if (a.length > 35) {
      b.face(a, a.length / 2, base + 9.0, 13, 4.3, C.red, .27, .20, "Alexa-identity-field");
      b.text(a, "ALEXA", base + 7.7, 2.4, 0xe6d4bb, .43);
    }
  }
}

function materialPair(glass = false) {
  const common = { color: 0xffffff, transparent: glass, opacity: glass ? .17 : 1, depthWrite: !glass, side: DoubleSide };
  return { day: new MeshBasicMaterial(common), night: new MeshStandardMaterial({ ...common, roughness: .85, flatShading: true }) };
}
function batch(rows: Row[], native: boolean, glass = false): InstancedMesh {
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
  const { day, night } = materialPair(glass), mesh = new InstancedMesh(geometry, day, 0), color = new Color();
  const matrices = new Float32Array(rows.length * 16), colors = new Float32Array(rows.length * 3);
  rows.forEach((r, i) => { r.matrix.toArray(matrices, i * 16); color.setHex(r.color).toArray(colors, i * 3); });
  mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16); mesh.instanceColor = new InstancedBufferAttribute(colors, 3); mesh.count = rows.length;
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, blockNative: native, glass, surfaceOnly: true, hiddenSolidInfill: false,
    roles: [...new Set(rows.map(r => r.role))] };
  mesh.computeBoundingBox(); mesh.computeBoundingSphere(); return mesh;
}
function sheetMesh(points: number[], glass: boolean): Mesh {
  const geometry = new BufferGeometry(); geometry.setAttribute("position", new Float32BufferAttribute(points, 3)); geometry.computeVertexNormals();
  const { day, night } = materialPair(glass); day.color.setHex(glass ? 0x86a4a6 : C.roof); night.color.copy(day.color);
  const mesh = new Mesh(geometry, day); mesh.userData = { dayMaterial: day, nightMaterial: night, glass, textureFree: true, openRailMouths: true };
  geometry.computeBoundingBox(); geometry.computeBoundingSphere(); return mesh;
}
function quad(out: number[], a: P, b: P, c: P, d: P): void { out.push(...a, ...b, ...c, ...a, ...c, ...d); }

function hall(b: Builder, p: Profile, roof: number[], glass: number[]): void {
  const f = p.frame, alex = p.key === "alexanderStation", length = f.length - (alex ? .18 : 1.5), half = f.width / 2 - .12;
  const top = p.parts[0].top_y_m, eave = alex ? 25.47 : 18.57, platform = alex ? 13.38 : 10.95;
  const point = (u: number, y: number, v: number): P => [f.x + f.dx * u - f.dz * v, y, f.z + f.dz * u + f.dx * v];
  const roofY = (v: number): number => alex ? eave + (top - eave) * Math.sqrt(Math.max(0, 1 - (v / half) ** 2))
    : Math.abs(v) <= half * .41 ? top : eave + .65 * (1 - (Math.abs(v) - half * .41) / (half * .59));
  const profiles = alex ? Array.from({ length: 25 }, (_, i) => -half + i * 2 * half / 24)
    : [-half, -half * .41, -half * .41, half * .41, half * .41, half];
  const yy = (j: number): number => !alex && (j === 1 || j === 4) ? eave + .65 : roofY(profiles[j]);
  const segments = Math.ceil(length / 6.3), steel = alex ? 0x849795 : 0x667275;
  for (let i = 0; i < segments; i++) {
    const u0 = -length / 2 + i * length / segments, u1 = -length / 2 + (i + 1) * length / segments;
    for (let j = 0; j < profiles.length - 1; j++) {
      const a = point(u0, yy(j), profiles[j]), c = point(u1, yy(j + 1), profiles[j + 1]);
      const isGlass = !alex && (j === 1 || j === 3);
      if (!b.native) quad(isGlass ? glass : roof, a, point(u1, yy(j), profiles[j]), c, point(u0, yy(j + 1), profiles[j + 1]));
      else {
        const nv = Math.max(1, Math.ceil(Math.abs(profiles[j + 1] - profiles[j]) / 1.5)), nu = Math.ceil((u1 - u0) / 1.5);
        for (let aidx = 0; aidx < nu; aidx++) for (let vidx = 0; vidx < nv; vidx++) {
          const t = (vidx + .5) / nv, v = profiles[j] + (profiles[j + 1] - profiles[j]) * t, y = yy(j) + (yy(j + 1) - yy(j)) * t;
          b.box(point(u0 + (aidx + .5) * (u1 - u0) / nu, y, v), [(u1 - u0) / nu + .06, isGlass ? Math.abs(yy(j + 1) - yy(j)) : .35, Math.max(.18, Math.abs(profiles[j + 1] - profiles[j]) / nv + .08)], isGlass ? C.glass : C.roof, -Math.atan2(f.dz, f.dx), "station-native-roof-surface", isGlass);
        }
      }
    }
    for (const side of [-1, 1]) {
      const v = side * half, bottom = platform + 1.0;
      if (!b.native) quad(glass, point(u0, bottom, v), point(u1, bottom, v), point(u1, eave, v), point(u0, eave, v));
      else b.box(point((u0 + u1) / 2, (bottom + eave) / 2, v), [u1 - u0, eave - bottom, .15], C.glass, -Math.atan2(f.dz, f.dx), "station-transparent-native-side", true);
      for (const y of [bottom, (bottom + eave) / 2, eave]) b.beam(point(u0, y, v), point(u1, y, v), .12, steel);
    }
  }
  for (let i = 0; i <= segments; i++) {
    const u = -length / 2 + i * length / segments;
    for (let j = 0; j < profiles.length - 1; j++) b.beam(point(u, yy(j) - .10, profiles[j]), point(u, yy(j + 1) - .10, profiles[j + 1]), .18, steel, alex ? "Alexanderplatz-round-arch-rib" : "Jannowitz-basilical-monitor-frame");
    for (const side of [-1, 1]) b.beam(point(u, platform + .2, side * half), point(u, eave, side * half), .21, steel);
    // Below the arched roof, the lattice transom remains an actual open truss.
    if (alex) {
      b.beam(point(u, eave - .55, -half), point(u, eave - .55, half), .16, steel, "open-hall-tie");
      for (let j = 0; j < 10; j++) { const v0 = -half + j * half / 5, v1 = v0 + half / 5; b.beam(point(u, eave - .5, v0), point(u, roofY(v1) - .35, v1), .10, steel, "open-diagonal-truss"); }
    }
  }
  // Glazed gable aprons stop at the spring; tracks can pass through either end.
  for (const end of [-1, 1]) for (let j = 0; j < profiles.length - 1; j++) {
    const u = end * length / 2, v0 = profiles[j], v1 = profiles[j + 1];
    if (Math.abs(v1 - v0) < .01) continue;
    if (!b.native) quad(glass, point(u, eave, v0), point(u, eave, v1), point(u, yy(j + 1), v1), point(u, yy(j), v0));
    else { const h = (yy(j) + yy(j + 1)) / 2 - eave; if (h > .1) b.box(point(u, eave + h / 2, (v0 + v1) / 2), [Math.abs(v1 - v0), h, .15], C.glass, -Math.atan2(f.dx, -f.dz), "station-native-glazed-end-apron", true); }
    b.beam(point(u, eave, v0), point(u, yy(j), v0), .12, steel);
  }
  // Four tracks/two islands at Alexanderplatz, two tracks/one island at Jannowitz.
  const platforms = alex ? [-half * .48, half * .48] : [0], tracks = alex ? [-half * .82, -half * .18, half * .18, half * .82] : [-half * .66, half * .66];
  for (const v of platforms) {
    b.box(point(0, platform - .30, v), [length - 2, .60, alex ? 6.6 : 5.3], 0xbdbbad, -Math.atan2(f.dz, f.dx), "station-island-platform");
    for (const side of [-1, 1]) b.beam(point(-length / 2 + 1, platform + .02, v + side * (alex ? 3.0 : 2.35)), point(length / 2 - 1, platform + .02, v + side * (alex ? 3.0 : 2.35)), .13, 0xe2dcc1, "platform-edge-strip");
    for (let u = -length / 2 + 17; u < length / 2 - 10; u += 24) {
      b.box(point(u, platform + .52, v), [2.5, .16, .60], 0x63786e, -Math.atan2(f.dz, f.dx), "platform-bench");
      b.box(point(u, platform + 2.8, v), [3.8, .65, .12], C.blue, -Math.atan2(f.dz, f.dx), "platform-sign");
    }
  }
  for (const v of tracks) for (const rail of [-.72, .72]) b.beam(point(-length / 2, platform - .30, v + rail), point(length / 2, platform - .30, v + rail), .10, 0x5b6263, "station-running-rail");
  if (!alex) {
    // The station floor and granular viaduct piers replace the old solid prism.
    // Transverse pedestrian entrances remain actual openings below the deck.
    b.box(point(0, platform - .95, 0), [length, .7, half * 2], 0x9a9683, -Math.atan2(f.dz, f.dx), "Jannowitz-viaduct-deck");
    for (let u = -length / 2 + 8; u < length / 2 - 3; u += 8.5) for (const side of [-1, 1]) {
      b.box(point(u, 6.3, side * (half - .45)), [1.3, 6.6, .9], 0x9d7759, -Math.atan2(f.dz, f.dx), "Jannowitz-open-viaduct-pier");
    }
  }
}

/** Recessed members follow the exact established v1.0.10 station frame. */
function friedrichstrasse(b: Builder): void {
  // Published landmark anchor retained in the existing CentralCivicDetails model.
  const origin: P = [navigation.friedrichstrasseAnchor[0], 2.85, navigation.friedrichstrasseAnchor[2]], yaw = -.31;
  const point = (u: number, y: number, v: number): P => {
    const z = -10 - 6 * (u / 84.5) ** 2 + v;
    return [origin[0] + Math.cos(yaw) * u + Math.sin(yaw) * z, origin[1] + y, origin[2] - Math.sin(yaw) * u + Math.cos(yaw) * z];
  };
  const height = (v: number) => { const t = Math.abs(v) / 15; return 18.2 + 9.728 * (.38 * Math.sqrt(Math.max(0, 1 - t * t)) + .62 * (1 - t)); };
  for (let i = 0; i <= 10; i++) {
    const u = -84.5 + i * 16.9;
    for (const centre of [-15, 15]) for (let j = 0; j < 12; j++) {
      const v0 = -15 + j * 2.5, v1 = v0 + 2.5;
      b.beam(point(u, height(v0) - .22, centre + v0), point(u, height(v1) - .22, centre + v1), .17, C.steel, "Friedrichstrasse-recessed-Tudor-rib");
      if (i % 2 === 0) b.beam(point(u, height(v0) - .24, centre + v0), point(u, 18.0, centre + v1), .095, C.steel, "Friedrichstrasse-open-truss-diagonal");
    }
  }
}

function create(native: boolean): Group {
  const root = new Group(), b = new Builder(native), roof: number[] = [], glass: number[] = [];
  root.name = native ? ALEXANDER_STATIONS_V183_NATIVE_GROUP : ALEXANDER_STATIONS_V183_GROUP;
  for (const p of source.profiles) {
    if (p.key === "jannowitz" || p.key === "alexanderStation") { hall(b, p, roof, glass); continue; }
    const parts = displayedParts(p), swatch = tone(p.key);
    if (p.key === "berolinahaus") {
      // Complete v169 resident source shell and its native reading remain.
      // Only the more specific Behrens facade is added over those source sheets.
    } else if (native) {
      const blocks: { position: P; size: P; color: number }[] = [];
      for (const part of parts) appendVoxelEnvelope(part, swatch, blocks);
      for (const r of blocks) b.box(r.position, r.size, r.color, 0, "native-exposed-building-source");
      // The shared legacy sampler starts at y=5.18. Preserve the source-bound
      // outer building skirt from y=3 rather than leaving a floating native skin.
      for (const part of parts) for (const a of axes(part)) b.face(a, a.length / 2, 4.09, a.length, 2.18, swatch.wall, -.18, .65, "native-source-ground-skirt");
    } else {
      const shell = sourceMesh(parts, swatch); shell.userData.sourceGeometryUnchanged = p.key !== "lehrer"; shell.userData.displayConflictResolution = p.key === "lehrer" ? source.conflicts[2] : "Exact retained sheets translated rigidly to established outer ground"; root.add(shell);
    }
    if (p.key === "alexa") alexa(b, p); else if (p.key === "lehrer") lehrer(b, p); else behrens(b, p);
  }
  friedrichstrasse(b);
  if (!native) { root.add(sheetMesh(roof, false), sheetMesh(glass, true)); }
  root.add(batch(b.rows, native)); if (b.glass.length) root.add(batch(b.glass, native, true));
  root.userData = { textureFree: true, fullStaticDetailOnTouch: true, sourceGeometryRetained: true, blockNative: native,
    keepInMinecraft: native, surfaceOnly: true, hiddenSolidInfill: false, stationRailMouthsOpen: true,
    photographsBundled: false, sourceParents: source.profiles.map(p => p.parentId),
    instanceCount: b.rows.length + b.glass.length, sourceConflicts: source.conflicts };
  return freezeStaticSceneTransforms(root);
}
export function createAlexanderStationsV183(_mobileLike = false): Group { return create(false); }
export function createMinecraftAlexanderStationsV183(_mobileLike = false): Group { return create(true); }
