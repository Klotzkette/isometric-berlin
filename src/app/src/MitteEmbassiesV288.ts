import { BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3 } from "three";
import profile from "./data/mitteEmbassiesV288Profile.json";
import type { SurroundingCityChunk, SurroundingPackedMesh } from "./SurroundingCityGeometry";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type Vec = [number, number, number];
type Box = { p: Vec; size: Vec; tint: number; yaw: number; run: number };
type Face = { points: Vec[]; tint: number };
type Site = "china" | "dprk";
type Run = typeof profile.runs[number];
export const MITTE_EMBASSIES_V288_PROFILE = profile;
const KIND = "china-embassy-fittings-v288";

const absent = Symbol("missing data");
function data(o: unknown, k: PropertyKey): unknown {
  if (!o || typeof o !== "object") return absent;
  const d = Object.getOwnPropertyDescriptor(o, k);
  return d?.enumerable && "value" in d ? d.value : absent;
}
function array(value: unknown, max = 10000): unknown[] | undefined {
  if (!Array.isArray(value)) return;
  const d = Object.getOwnPropertyDescriptor(value, "length");
  if (!d || !("value" in d) || !Number.isInteger(d.value) || d.value < 0 || d.value > max || Reflect.ownKeys(value).length !== d.value + 1) return;
  const v = Array.from({ length: d.value }, (_, i) => data(value, String(i)));
  return v.includes(absent) ? undefined : v;
}
function sameData(actual: unknown, expected: unknown): boolean {
  if (expected === null || typeof expected !== "object") return actual === expected;
  if (!actual || typeof actual !== "object" || Array.isArray(actual) !== Array.isArray(expected) || Reflect.ownKeys(actual).length !== Reflect.ownKeys(expected).length) return false;
  return Object.keys(expected).every(k => sameData(data(actual, k), (expected as Record<string, unknown>)[k])) && (!Array.isArray(expected) || array(actual)?.length === expected.length);
}
/** Native resident DPRK additions require the exact original finite payload.
 * No source or authored owner is retired by this independent fitting. */
export function matchesDprkEmbassySourceV288(payload: unknown): boolean {
  try {
    const n = profile.native, grid = data(payload, "grid");
    if (data(payload, "schema_version") !== n.schema || data(payload, "cell_m") !== n.cellM || data(grid, "min_x_idx") !== n.gridOrigin[0] || data(grid, "min_z_idx") !== n.gridOrigin[1] || !sameData(data(payload, "classes"), n.classes)) return false;
    const rows = data(payload, "building_rows"); if (!Array.isArray(rows)) return false;
    for (const w of n.sourceWindows) {
      const found: number[][] = [], [x0, z0, x1, z1] = w.bounds;
      for (let z = z0; z <= z1; z++) {
        const row = array(data(rows, String(z - n.gridOrigin[1]))); if (!row) return false;
        for (const entry of row) {
          const r = array(entry, 5);
          if (!r || r.length !== 5 || !r.every(v => typeof v === "number" && Number.isInteger(v))) return false;
          const [offset, count, low, top, kind] = r as number[];
          if (count <= 0 || count > 10000 || top < low || kind < 0 || kind >= n.classes.length) return false;
          const start = n.gridOrigin[0] + offset;
          for (let x = Math.max(start, x0); x < Math.min(start + count, x1 + 1); x++) found.push([x, z, low, top, kind]);
        }
      }
      if (!sameData(found, w.columns)) return false;
    }
    return true;
  } catch { return false; }
}

function frame(r: Run) {
  const dx = r.end[0] - r.start[0], dz = r.end[1] - r.start[1], length = Math.hypot(dx, dz);
  return { tx: dx / length, tz: dz / length, nx: r.outward[0], nz: r.outward[1], length, yaw: -Math.atan2(dz, dx) };
}
function at(r: Run, u: number, y: number, out: number): Vec {
  const f = frame(r); return [r.start[0] + f.tx * u + f.nx * out, y, r.start[1] + f.tz * u + f.nz * out];
}
export function embassyBoxBoundsV288(b: Box): number[] {
  const c = Math.abs(Math.cos(b.yaw)), s = Math.abs(Math.sin(b.yaw)), x = (c * b.size[0] + s * b.size[2]) / 2, z = (s * b.size[0] + c * b.size[2]) / 2;
  return [b.p[0] - x, b.p[1] - b.size[1] / 2, b.p[2] - z, b.p[0] + x, b.p[1] + b.size[1] / 2, b.p[2] + z];
}
export function embassyBoxesOverlapV288(a: readonly number[], b: readonly number[]): boolean {
  return [0, 1, 2].every(i => Math.min(a[i + 3], b[i + 3]) - Math.max(a[i], b[i]) > 1e-6);
}
/** Constructor-only finite recipes. Ordinary frames reuse the previously
 * accepted source-clipped v169 aperture centers. The central China glass
 * stack is separately identified as a photographic display estimate. */
export function bakeEmbassyFittingsV288(site: Site, native: boolean, applyNativeFit = true) {
  const boxes: Box[] = [], faces: Face[] = [];
  function box(r: Run, ri: number, u: number, y: number, out: number, w: number, h: number, depth: number, tint: number) {
    const course = site === "china" ? 2.1 : 2;
    if (native && Math.max(w, h) > course) {
      const columns = Math.ceil(w / course), rows = Math.ceil(h / course);
      for (let x = 0; x < columns; x++) for (let z = 0; z < rows; z++) box(r, ri, u - w / 2 + (x + .5) * w / columns, y - h / 2 + (z + .5) * h / rows, out, w / columns, h / rows, depth, tint);
      return;
    }
    const f = frame(r), shift = native ? profile.native.projectionM[ri] : 0;
    boxes.push({ p: at(r, u, y, out + shift), size: native ? [Math.abs(f.tx) * w + Math.abs(f.nx) * depth, h, Math.abs(f.tz) * w + Math.abs(f.nz) * depth] : [w, h, depth], tint, yaw: native ? 0 : f.yaw, run: ri });
  }
  profile.runs.forEach((r, ri) => {
    if ((r.style.startsWith("china") ? "china" : "dprk") !== site) return;
    // These five newly authored back runs were the initial erroneous photo
    // orientation. Native focuses on the proved northeastern front instead;
    // all original source bodies and earlier deployed details stay intact.
    if (native && site === "china" && ri < 5) return;
    const f = frame(r), china = site === "china", tint = china ? 0xbcc6c6 : 0xcecfc7;
    const paneWidth = r.glassWidthM ?? 1.25, paneHeight = r.glassHeightM ?? 1.79;
    for (const [u, y] of r.apertures) {
      if (r.newPhotographedGlazing) box(r, ri, u, y, .18, paneWidth, paneHeight, .06, 0x87a5b0);
      if (!china && !native) {
        const outer = [[-.96, -1.2], [.96, -1.2], [.96, 1.2], [-.96, 1.2]], inner = [[-.67, -.96], [.67, -.96], [.67, .96], [-.67, .96]];
        for (let i = 0; i < 4; i++) {
          const j = (i + 1) % 4;
          faces.push({ points: [at(r, u + outer[i][0], y + outer[i][1], .17), at(r, u + outer[j][0], y + outer[j][1], .17), at(r, u + inner[j][0], y + inner[j][1], .34), at(r, u + inner[i][0], y + inner[i][1], .34)], tint });
        }
      } else {
        const tiers = china ? 1 : 2;
        for (let tier = 0; tier < tiers; tier++) {
          const width = china ? (r.newPhotographedGlazing ? paneWidth + .12 : 1.48) : 1.82 - tier * .22, height = china ? (r.newPhotographedGlazing ? Math.min(native ? 2.1 : Infinity, paneHeight + .12) : 2.02) : 2.28 - tier * .22, section = china ? .07 : .13;
          for (const sign of [-1, 1]) {
            box(r, ri, u + sign * width / 2, y, .27 + tier * .075, section, height, .10, tint);
            box(r, ri, u, y + sign * height / 2, .27 + tier * .075, width + section, section, .10, tint);
          }
        }
      }
      // Paired narrow rails read as cladding divisions; they lie below the
      // old glazing, never through its accepted clear rectangle.
      if (china) for (const dy of [-1.07, -1.22]) box(r, ri, u, y + dy, .31, Math.min(r.pitchM - .15, 3.3), .045, .065, 0x596c74);
    }
    if (r.style !== "china-front-stack") {
      for (let u = r.pitchM; u < f.length - .4; u += r.pitchM) box(r, ri, u, r.groundY + (Math.min(r.topY, r.groundY + 25) - r.groundY) / 2, .24, .055, Math.min(r.topY - r.groundY - 1.4, 23.6), .06, china ? 0x7e9298 : 0xa8aaa3);
      if (!china) for (let u = .3; u < f.length - .2; u += 1.5) box(r, ri, u + Math.min(1.5, f.length - .2 - u) / 2, r.groundY + .55, .22, Math.min(1.5, f.length - .2 - u), .85, .08, 0x424e4e);
    }
  });
  if (site === "china") for (const skin of profile.chinaSkins) {
    const r = profile.runs[skin.run];
    if (native) for (const [u, y, w, h] of skin.nativeRects) box(r, skin.run, u, y, .08, w, h, .04, skin.tint);
    else for (const triangle of skin.triangles) faces.push({ points: triangle.map(([u, y]) => at(r, u, y, .025)), tint: skin.tint });
  }
  if (!native && boxes.length > profile.limits.drawnInstances) throw new Error("Embassy fitting allowance exceeded");
  if (native && applyNativeFit) {
    const fits = profile.native.componentFits[site];
    if (fits.length !== boxes.length) throw new Error("Embassy native component receipt changed");
    const admitted = boxes.flatMap((b, i) => {
      const shift = fits[i]; if (shift === null) return [];
      const n = profile.runs[b.run].outward;
      return [{ ...b, p: [b.p[0] + n[0] * shift, b.p[1], b.p[2] + n[1] * shift] as Vec }];
    });
    if (admitted.length > profile.limits.nativeInstances) throw new Error("Embassy fitting allowance exceeded");
    return { boxes: admitted, faces };
  }
  return { boxes, faces };
}

function boxFaces(b: Box): Face[] {
  const [w, h, d] = b.size.map(x => x / 2), c = Math.cos(b.yaw), s = Math.sin(b.yaw);
  const p = (x: number, y: number, z: number): Vec => [b.p[0] + c * x + s * z, b.p[1] + y, b.p[2] - s * x + c * z];
  return [
    [[-w, -h, -d], [-w, -h, d], [-w, h, d], [-w, h, -d]], [[w, -h, d], [w, -h, -d], [w, h, -d], [w, h, d]],
    [[-w, -h, d], [-w, -h, -d], [w, -h, -d], [w, -h, d]], [[-w, h, -d], [-w, h, d], [w, h, d], [w, h, -d]],
    [[w, -h, -d], [-w, -h, -d], [-w, h, -d], [w, h, -d]], [[-w, -h, d], [w, -h, d], [w, h, d], [-w, h, d]],
  ].map(points => ({ points: points.map(v => p(v[0], v[1], v[2])), tint: b.tint }));
}

export function createDprkEmbassyV288(options: { native?: boolean; payload?: unknown } = {}): Group | null {
  const native = options.native === true;
  if (native && !matchesDprkEmbassySourceV288(options.payload)) return null;
  const baked = bakeEmbassyFittingsV288("dprk", native), root = new Group();
  root.name = "DPRK Glinkastrasse source-face recognition v288";
  root.userData = { evidenceId: profile.evidenceId, fullStaticDetailOnTouch: true, sourceGeometryRetained: true, textureFree: true, blockNative: native, keepInMinecraft: native, automaticRetirement: false };
  const geometry = new BoxGeometry(); geometry.deleteAttribute("uv");
  const day = new MeshBasicMaterial({ color: 0xffffff }), night = new MeshStandardMaterial({ color: 0xffffff, roughness: .9 });
  if (baked.boxes.length) {
    const mesh = new InstancedMesh(geometry, day, 0), m = new Matrix4(), q = new Quaternion(), axis = new Vector3(0, 1, 0), color = new Color();
    const matrices = new Float32Array(baked.boxes.length * 16), colors = new Float32Array(baked.boxes.length * 3);
    baked.boxes.forEach((b, i) => { m.compose(new Vector3(...b.p), q.setFromAxisAngle(axis, b.yaw), new Vector3(...b.size)).toArray(matrices, i * 16); color.setHex(b.tint).toArray(colors, i * 3); });
    mesh.count = baked.boxes.length; mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16); mesh.instanceColor = new InstancedBufferAttribute(colors, 3); mesh.userData = { dayMaterial: day, nightMaterial: night, blockNative: native, textureFree: true }; mesh.computeBoundingBox(); mesh.computeBoundingSphere(); root.add(mesh);
  } else { geometry.dispose(); day.dispose(); night.dispose(); }
  if (baked.faces.length) {
    const positions: number[] = [], colors: number[] = [], color = new Color();
    for (const f of baked.faces) { color.setHex(f.tint); for (let i = 1; i < f.points.length - 1; i++) for (const p of [f.points[0], f.points[i], f.points[i + 1]]) { positions.push(...p); color.toArray(colors, colors.length); } }
    const geo = new BufferGeometry(); geo.setAttribute("position", new Float32BufferAttribute(positions, 3)); geo.setAttribute("color", new Float32BufferAttribute(colors, 3)); geo.computeVertexNormals();
    const a = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide }), b = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .9 });
    const mesh = new Mesh(geo, a); mesh.name = "DPRK pale sloping window reveals"; mesh.userData = { dayMaterial: a, nightMaterial: b, textureFree: true }; root.add(mesh);
  }
  return freezeStaticSceneTransforms(root);
}

function* fingerprint(parts: readonly string[]): Generator<void, number> {
  let h = 2166136261;
  for (const text of parts) for (let start = 0; start < text.length; start += 65536) {
    for (let i = start; i < Math.min(text.length, start + 65536); i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
    yield;
  }
  return h;
}
function clip(points: Vec[], axis: 0 | 2, boundary: number, positive: boolean): Vec[] {
  const result: Vec[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length], insideA = positive ? a[axis] >= boundary : a[axis] <= boundary, insideB = positive ? b[axis] >= boundary : b[axis] <= boundary;
    if (insideA) result.push(a);
    if (insideA !== insideB) { const t = (boundary - a[axis]) / (b[axis] - a[axis]); result.push(a.map((v, j) => v + (b[j] - v) * t) as Vec); }
  }
  return result;
}
function encoded(bytes: Uint8Array): string {
  let s = ""; for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(s);
}
/** Only new fittings are clipped to their original streaming tile. No original
 * source vertex, encoded stream, index, navigation row or line is changed. */
export function packChinaEmbassyFittingsV288(id: string, native: boolean, origin: readonly number[]): SurroundingPackedMesh | null {
  const [ix, iz] = id.split("_").map(Number), baked = bakeEmbassyFittingsV288("china", native);
  if (!Number.isInteger(ix) || !Number.isInteger(iz)) return null;
  const faces = [...baked.faces, ...baked.boxes.flatMap(boxFaces)], positions: number[] = [], colors: number[] = [], indices: number[] = [];
  // Existing decoder uses flat shading. Exact indexed vertices of these new
  // fittings retain every triangle and colour while avoiding repeated corners.
  const vertices = new Map<string, number>();
  // The shared packet decoder treats normalized vertex bytes as linear RGB.
  // Author tints are hexadecimal sRGB, just like the drawn Color.setHex path.
  const linearByte = (byte: number) => {
    const srgb = byte / 255;
    return Math.round(255 * (srgb <= .04045 ? srgb / 12.92 : ((srgb + .055) / 1.055) ** 2.4));
  };
  for (const f of faces) {
    let p = clip(f.points, 0, ix * 512, true); p = clip(p, 0, (ix + 1) * 512, false); p = clip(p, 2, iz * 512, true); p = clip(p, 2, (iz + 1) * 512, false);
    if (p.length < 3) continue;
    for (let i = 1; i < p.length - 1; i++) for (const v of [p[0], p[i], p[i + 1]]) {
      const q = v.map((n, j) => Math.round((n - origin[j]) * 100));
      if (q.some(n => n < 0 || n > 65535)) throw new Error("Embassy tile-local encoding out of bounds");
      const key = `${q[0]},${q[1]},${q[2]},${f.tint}`;
      let index = vertices.get(key);
      if (index === undefined) { index = positions.length / 3; vertices.set(key, index); positions.push(...q); colors.push(linearByte(f.tint >> 16 & 255), linearByte(f.tint >> 8 & 255), linearByte(f.tint & 255)); }
      indices.push(index);
    }
  }
  if (!positions.length) return null;
  return { kind: KIND, positionType: "u16cm", positions: encoded(new Uint8Array(new Uint16Array(positions).buffer)), colors: encoded(new Uint8Array(colors)), indices: encoded(new Uint8Array(new Uint32Array(indices).buffer)) };
}

/** Run after immutable preparers, inside the existing cancellable chunk
 * transaction. China never creates a detached resident-only building fitting. */
export function* prepareChinaEmbassyV288(chunk: SurroundingCityChunk, id: string, native: boolean): Generator<void, SurroundingCityChunk> {
  const receipt = profile.chinaPackets.find(r => r.key === `${native ? "minecraft" : "drawn"}:${id}`);
  try {
    if (!receipt || !chunk || Reflect.ownKeys(chunk).some(k => data(chunk, k) === absent)) return chunk;
    const meshes = array(data(chunk, "meshes"), 16);
    const buildings = array(data(data(chunk, "nav"), "buildings"), 20000);
    if (!meshes || !buildings || meshes.length >= 16 || meshes.some(m => data(m, "kind") === KIND)) return chunk;
    if (meshes.some(m => typeof data(m, "kind") !== "string" || data(m, "positionType") !== "u16cm")) return chunk;
    if (!sameData(data(chunk, "origin"), receipt.origin)) return chunk;
    for (const rec of receipt.meshes) {
      const m = meshes[rec.index];
      if (data(m, "kind") !== rec.kind) return chunk;
      const fields = [data(m, "positions"), data(m, "colors"), data(m, "indices")];
      if (!fields.every(v => typeof v === "string") || (yield* fingerprint(fields as string[])) !== rec.fingerprint) return chunk;
    }
    const selected = buildings.filter(b => data(b, "sourceId") === "DEBE01YYK000095y");
    if (!sameData(selected, receipt.bindings)) return chunk;
    const added = packChinaEmbassyFittingsV288(id, native, receipt.origin); if (!added) return chunk;
    const bytes = (s: string) => s.length / 4 * 3 - (s.endsWith("==") ? 2 : s.endsWith("=") ? 1 : 0);
    const counts = meshes.map(m => [data(m, "positions"), data(m, "indices")]);
    if (!counts.every(v => v.every(s => typeof s === "string"))) return chunk;
    if (counts.reduce((n, m) => n + bytes(m[0] as string) / 6, bytes(added.positions) / 6) > 400000 || counts.reduce((n, m) => n + bytes(m[1] as string) / 4, bytes(added.indices) / 4) > 2400000) return chunk;
    return { ...chunk, meshes: [...meshes, added] as SurroundingPackedMesh[] };
  } catch { return chunk; }
}
