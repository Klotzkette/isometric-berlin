import { BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial } from "three";
import profile from "./data/mitteDdrV288Profile.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type Vec = [number, number, number];
type Box = { p: Vec; size: Vec; tint: number; yaw: number; run: number; kind: string };
type Sheet = { points: Vec[]; tint: number; glass: boolean };
type Run = typeof profile.runs[number];
export const MITTE_DDR_V288_PROFILE = profile;

/** Only the two finite source windows belong to this additive native fitting.
 * A changed source keeps the complete earlier city and adds no new fitting. */
export function matchesMitteDdrNativeSourceV288(payload: unknown): boolean {
  const missing = Symbol("missing data");
  const data = (o: unknown, k: PropertyKey): unknown => {
    if (!o || typeof o !== "object") return missing;
    const d = Object.getOwnPropertyDescriptor(o, k);
    return d?.enumerable && "value" in d ? d.value : missing;
  };
  const array = (v: unknown, max = 10000): unknown[] | undefined => {
    if (!Array.isArray(v)) return;
    const d = Object.getOwnPropertyDescriptor(v, "length");
    if (!d || !("value" in d) || !Number.isInteger(d.value) || d.value < 0 || d.value > max || Reflect.ownKeys(v).length !== d.value + 1) return;
    const values = Array.from({ length: d.value }, (_, i) => data(v, String(i)));
    return values.includes(missing) ? undefined : values;
  };
  try {
    const n = profile.native, grid = data(payload, "grid");
    if (data(payload, "schema_version") !== n.schema || data(payload, "cell_m") !== n.cellM || data(grid, "min_x_idx") !== n.gridOrigin[0] || data(grid, "min_z_idx") !== n.gridOrigin[1]) return false;
    const classes = array(data(payload, "classes"));
    if (!classes || classes.length !== n.classes.length || classes.some((v, i) => v !== n.classes[i])) return false;
    const rows = data(payload, "building_rows");
    if (!Array.isArray(rows)) return false;
    for (const window of n.sourceWindows) {
      const found: number[][] = [], [x0, z0, x1, z1] = window.bounds;
      for (let z = z0; z <= z1; z++) {
        const row = array(data(rows, String(z - n.gridOrigin[1]))); if (!row) return false;
        for (const entry of row) {
          const run = array(entry, 5);
          if (!run || run.length !== 5 || !run.every(v => typeof v === "number" && Number.isInteger(v))) return false;
          const [offset, count, bottom, top, kind] = run as number[];
          if (count <= 0 || count > 10000 || top < bottom || kind < 0 || kind >= classes.length) return false;
          const start = n.gridOrigin[0] + offset;
          for (let x = Math.max(x0, start); x < Math.min(x1 + 1, start + count); x++) found.push([x, z, bottom, top, kind]);
        }
      }
      if (found.length !== window.columns.length || found.some((r, i) => r.some((v, j) => v !== window.columns[i][j]))) return false;
    }
    return true;
  } catch { return false; }
}

function frame(run: Run) {
  const dx = run.end[0] - run.start[0], dz = run.end[1] - run.start[1], length = Math.hypot(dx, dz);
  return { length, tx: dx / length, tz: dz / length, nx: run.outward[0], nz: run.outward[1], yaw: -Math.atan2(dz, dx) };
}
function at(run: Run, u: number, y: number, outward: number): Vec {
  const f = frame(run);
  return [run.start[0] + f.tx * u + f.nx * outward, y, run.start[1] + f.tz * u + f.nz * outward];
}
export function mitteDdrNativeBoxBoundsV288(b: Box): number[] {
  const c = Math.abs(Math.cos(b.yaw)), s = Math.abs(Math.sin(b.yaw));
  const x = (b.size[0] * c + b.size[2] * s) / 2, z = (b.size[0] * s + b.size[2] * c) / 2;
  return [b.p[0] - x, b.p[1] - b.size[1] / 2, b.p[2] - z, b.p[0] + x, b.p[1] + b.size[1] / 2, b.p[2] + z];
}
export function mitteDdrNativeOverlapsV288(a: readonly number[], b: readonly number[]): boolean {
  return [0, 1, 2].every(i => Math.min(a[i + 3], b[i + 3]) - Math.max(a[i], b[i]) > 1e-6);
}

/** Finite construction-only inventory. Nothing here retires source geometry,
 * cuts openings, moves roofs or adds a navigation solid. */
export function bakeMitteDdrV288(native: boolean) {
  const boxes: Box[] = [], sheets: Sheet[] = [];
  const stone = 0xc1baaa, joint = 0x8d8b7e, bronze = 0x55544c, seam = 0x77786c, glass = 0x7f9995, dark = 0x343d3d;
  function box(run: Run, ri: number, u: number, y: number, out: number, w: number, h: number, d: number, tint: number, kind: string) {
    const f = frame(run);
    if (native && h > 2) {
      const courses = Math.ceil(h / 2);
      for (let i = 0; i < courses; i++) box(run, ri, u, y - h / 2 + (i + .5) * h / courses, out, w, h / courses, d, tint, kind);
      return;
    }
    boxes.push({ p: at(run, u, y, out), size: native ? [Math.abs(f.tx) * w + Math.abs(f.nx) * d, h, Math.abs(f.tz) * w + Math.abs(f.nz) * d] : [w, h, d], tint, yaw: native ? 0 : f.yaw, run: ri, kind });
  }
  profile.runs.forEach((run, ri) => {
    const f = frame(run);
    if (run.style === "memorial-east-slab") {
      // Thin paired panel seams and open slender balcony/parapet marks;
      // existing glazing and every older Wilhelmstrasse member stay visible.
      const floors = Math.min(7, Math.floor((run.topY - run.groundY - 2) / 3.1));
      for (let level = 1; level <= floors; level++) {
        const y = run.groundY + level * 3.1;
        for (let u = .3; u < f.length - .2; u += native ? 1.0 : 1.6) {
          const w = Math.min(native ? 1.0 : 1.6, f.length - .2 - u);
          box(run, ri, u + w / 2, y, .38, w, .075, .08, joint, "panel-joint");
        }
      }
      for (let u = 1.1; u < f.length - .8; u += 3.4) {
        box(run, ri, u, run.groundY + (run.topY - run.groundY) / 2, .39, .075, run.topY - run.groundY - 1.3, .08, stone, "panel-pier");
        for (let level = 1; level < floors; level++) box(run, ri, u, run.groundY + level * 3.1 + .85, .48, .055, .72, .055, dark, "open-rail-mark");
      }
      return;
    }
    const count = run.orielCount ?? 0, pitch = f.length / count;
    for (let bay = 0; bay < count; bay++) {
      const center = (bay + .5) * pitch, radius = Math.min(2.18, pitch * .43), depth = 1.9;
      const lower = run.groundY + 5.0, upper = run.groundY + 8.1, cap = 2.0;
      const point = (theta: number, phi: number, y: number): Vec => at(run, center + radius * Math.sin(theta) * Math.cos(phi), y + cap * Math.sin(phi), .42 + depth * Math.cos(theta) * Math.cos(phi));
      const angles = native ? 12 : 18, levels = native ? 4 : 7;
      for (const side of [-1, 1]) for (let row = 0; row < levels; row++) for (let col = 0; col < angles; col++) {
        const a = -Math.PI / 2 + col * Math.PI / angles, b = a + Math.PI / angles;
        const v = side * row * Math.PI / (2 * levels), w = side * (row + 1) * Math.PI / (2 * levels), y = side < 0 ? lower : upper;
        if (native) {
          const t = (a + b) / 2, p = (v + w) / 2, u = center + radius * Math.sin(t) * Math.cos(p), out = .42 + depth * Math.cos(t) * Math.cos(p);
          box(run, ri, u, y + cap * Math.sin(p), out, .58, .52, .43, (col % 3) ? bronze : seam, "native-oriel-cap");
        } else sheets.push({ points: [point(a, v, y), point(b, v, y), point(b, w, y), point(a, w, y)], tint: col % 3 ? bronze : seam, glass: false });
      }
      for (let col = 0; col < angles; col++) {
        const a = -Math.PI / 2 + col * Math.PI / angles, b = a + Math.PI / angles, theta = (a + b) / 2;
        if (native) for (let row = 0; row < 3; row++) box(run, ri, center + radius * Math.sin(theta), lower + (row + .5) * (upper - lower) / 3, .42 + depth * Math.cos(theta), .58, .99, .32, glass, "native-oriel-glazing");
        else sheets.push({ points: [at(run, center + radius * Math.sin(a), lower, .42 + depth * Math.cos(a)), at(run, center + radius * Math.sin(b), lower, .42 + depth * Math.cos(b)), at(run, center + radius * Math.sin(b), upper, .42 + depth * Math.cos(b)), at(run, center + radius * Math.sin(a), upper, .42 + depth * Math.cos(a))], tint: glass, glass: true });
        if (col % 3 === 0) box(run, ri, center + radius * Math.sin(theta), (lower + upper) / 2, .53 + depth * Math.cos(theta), .065, upper - lower + .13, .065, dark, "oriel-mullion");
        for (const y of [lower, upper]) box(run, ri, center + radius * Math.sin(theta), y, .48 + depth * Math.cos(theta), Math.max(.2, radius * Math.PI / angles), .10, .10, dark, "oriel-transom");
      }
    }
  });
  const projections: number[] = [];
  if (native) {
    // Translate each complete source-face fitting together. This preserves
    // its independent block form rather than burying a smooth-style detail.
    profile.runs.forEach((run, ri) => {
      const group = boxes.filter(b => b.run === ri), f = frame(run), shift = profile.native.projectionM[ri];
      if (!Number.isFinite(shift) || shift < 0 || shift > profile.limits.maxNativeProjectionM) throw new Error("Invalid bounded Mitte DDR native projection");
      for (const b of group) { b.p[0] += f.nx * shift; b.p[2] += f.nz * shift; }
      projections.push(shift);
    });
  }
  if (boxes.length > (native ? profile.limits.nativeInstances : profile.limits.drawnInstances)) throw new Error("Mitte DDR fitting allowance exceeded");
  return { boxes, sheets, projections };
}

/** Root-only additive integration. Native callers pass the actual original
 * payload; a mismatch returns null and leaves all earlier city owners intact. */
export function createMitteDdrV288(options: { native?: boolean; payload?: unknown } = {}): Group | null {
  const native = options.native === true;
  if (native && !matchesMitteDdrNativeSourceV288(options.payload)) return null;
  const baked = bakeMitteDdrV288(native), root = new Group();
  root.name = native ? "Mitte DDR v288 independent native recognition" : "Mitte DDR v288 source-bound recognition";
  root.userData = { evidenceId: profile.evidenceId, fullStaticDetailOnTouch: true, sourceGeometryRetained: true, textureFree: true, blockNative: native, keepInMinecraft: native, automaticRetirement: false, sourceParents: [...new Set(profile.runs.map(r => r.parentId))], nativeProjectionM: baked.projections, geometryStatus: profile.estimateStatus };
  if (native) {
    const geometry = new BoxGeometry(); geometry.deleteAttribute("uv");
    const day = new MeshBasicMaterial({ color: 0xffffff }), night = new MeshStandardMaterial({ color: 0xffffff, roughness: .9 });
    const mesh = new InstancedMesh(geometry, day, 0), matrix = new Matrix4(), color = new Color();
    const matrices = new Float32Array(baked.boxes.length * 16), colors = new Float32Array(baked.boxes.length * 3);
    baked.boxes.forEach((b, i) => { matrix.makeScale(...b.size).setPosition(...b.p).toArray(matrices, i * 16); color.setHex(b.tint).toArray(colors, i * 3); });
    mesh.count = baked.boxes.length; mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16); mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
    mesh.name = "Independent orthogonal DDR facade and six restaurant oriels"; mesh.userData = { dayMaterial: day, nightMaterial: night, blockNative: true, textureFree: true };
    mesh.computeBoundingBox(); mesh.computeBoundingSphere(); root.add(mesh);
  } else {
    const buckets = [[], []] as { points: Vec[]; tint: number }[][];
    for (const sheet of baked.sheets) buckets[sheet.glass ? 1 : 0].push(sheet);
    const unit = new BoxGeometry(), p = unit.getAttribute("position"), index = unit.index!;
    for (const b of baked.boxes) {
      const c = Math.cos(b.yaw), s = Math.sin(b.yaw);
      for (let i = 0; i < index.count; i += 3) buckets[0].push({ points: [0, 1, 2].map(j => {
        const k = index.getX(i + j), x = p.getX(k) * b.size[0], z = p.getZ(k) * b.size[2];
        return [b.p[0] + c * x + s * z, b.p[1] + p.getY(k) * b.size[1], b.p[2] - s * x + c * z] as Vec;
      }), tint: b.tint });
    }
    unit.dispose();
    buckets.forEach((rows, glass) => {
      const positions: number[] = [], colors: number[] = [], color = new Color();
      for (const row of rows) { color.setHex(row.tint); for (let i = 1; i < row.points.length - 1; i++) for (const p of [row.points[0], row.points[i], row.points[i + 1]]) { positions.push(...p); color.toArray(colors, colors.length); } }
      const geometry = new BufferGeometry(); geometry.setAttribute("position", new Float32BufferAttribute(positions, 3)); geometry.setAttribute("color", new Float32BufferAttribute(colors, 3)); geometry.computeVertexNormals();
      const day = glass ? new MeshPhysicalMaterial({ vertexColors: true, transparent: true, opacity: .52, depthWrite: false, roughness: .24, metalness: .05, side: DoubleSide }) : new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
      const night = glass ? day.clone() : new MeshStandardMaterial({ vertexColors: true, roughness: .9, side: DoubleSide });
      const mesh = new Mesh(geometry, day); mesh.name = glass ? "Six restaurant oriel clear glazed bands" : "DDR source-face joints and six bronze-grey oriel caps";
      mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true }; root.add(mesh);
    });
  }
  root.userData.memberCount = baked.boxes.length;
  return freezeStaticSceneTransforms(root);
}
