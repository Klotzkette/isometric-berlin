import { BoxGeometry, Color, Group, InstancedBufferAttribute, InstancedMesh,
  Matrix4, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3 } from "three";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { moabitGuardHouseContains } from "./moabitGuardHouseProfile";
import { ULAP_QUARTER_PARTS as PARTS, ULAP_QUARTER_GROUP_NAME,
  MINECRAFT_ULAP_QUARTER_GROUP_NAME, ULAP_URANIA_PARENT } from "./ulapQuarterProfile";

type Part = typeof PARTS[number];
type Point = [number, number, number];
type Record = { id: string; role: string; position: Point; size: Point; yaw: number; color: number };
type Wall = { x: number; z: number; dx: number; dz: number; nx: number; nz: number; length: number };
const UP = new Vector3(0, 1, 0), BRICK = 0xb66946, MORTAR = 0xc69068;
const PALE = 0xc9c9ba, CAP = 0xc7cbc5, GLASS = 0x576d73, FRAME = 0xa9b1ad;

function eave(p: Part): number {
  return (p.viewerPrism.y0_dm + p.viewerPrism.h_dm) / 10 - p.fitted_roof_rise_m;
}
function walls(part: Part): Wall[] {
  const ring = part.viewerPrism.ring;
  return ring.map((a, i) => {
    const b = ring[(i + 1) % ring.length], dx = (b[0] - a[0]) / 10, dz = (b[1] - a[1]) / 10;
    const length = Math.hypot(dx, dz); let nx = dz / length, nz = -dx / length;
    if (moabitGuardHouseContains(ring, (a[0] + b[0]) / 20 + nx * .04,
      (a[1] + b[1]) / 20 + nz * .04)) { nx = -nx; nz = -nz; }
    return { x: a[0] / 10, z: a[1] / 10, dx: dx / length, dz: dz / length, nx, nz, length };
  }).filter(w => w.length > .2);
}
function exposed(p: Part, w: Wall, u: number, y: number): boolean {
  const x = w.x + w.dx * u + w.nx * .25, z = w.z + w.dz * u + w.nz * .25;
  return !PARTS.some(other => other !== p && y > other.viewerPrism.y0_dm / 10 && y < eave(other) &&
    moabitGuardHouseContains(other.viewerPrism.ring, x, z));
}

class Batch {
  records: Record[] = [];
  constructor(readonly native: boolean) {}
  box(p: Part, role: string, position: Point, size: Point, color: number, yaw = 0): void {
    if (size.some(v => v <= 0)) return;
    this.records.push({ id: p.viewerPrism.id, role, position, size, color, yaw });
  }
  wall(p: Part, w: Wall, role: string, u: number, y: number,
    width: number, height: number, depth: number, color: number, out = .18): void {
    this.box(p, role, [w.x + w.dx * u + w.nx * out, y, w.z + w.dz * u + w.nz * out],
      [width, height, depth], color, -Math.atan2(w.dz, w.dx));
  }
  finish(root: Group, diagnostic: boolean): void {
    const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
    const dayMaterial = new MeshBasicMaterial({ color: 0xffffff });
    const nightMaterial = new MeshStandardMaterial({ color: 0xffffff, roughness: .86 });
    const mesh = new InstancedMesh(geometry, dayMaterial, 0);
    const matrices = new Float32Array(this.records.length * 16), colors = new Float32Array(this.records.length * 3);
    const matrix = new Matrix4(), position = new Vector3(), size = new Vector3(), q = new Quaternion(), color = new Color();
    this.records.forEach((r, i) => {
      matrix.compose(position.set(...r.position), q.setFromAxisAngle(UP, r.yaw), size.set(...r.size));
      matrices.set(matrix.elements, i * 16); color.setHex(r.color).toArray(colors, i * 3);
    });
    mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
    mesh.instanceColor = new InstancedBufferAttribute(colors, 3); mesh.count = this.records.length;
    mesh.name = `${root.name}: compact source-plane detail`;
    mesh.userData = { dayMaterial, nightMaterial, civicBuildingDetail: true, textureFree: true, blockNative: this.native,
      surfaceOnly: true, hiddenSolidInfill: false };
    mesh.computeBoundingBox(); mesh.computeBoundingSphere(); root.add(mesh);
    root.userData.instanceCount = mesh.count;
    if (diagnostic) root.userData.detailRecords = this.records;
  }
}

function roofY(p: Part, x: number, z: number): number | null {
  let result: number | null = null;
  for (const ring of p.roof_surfaces_world_m) for (let i = 1; i < ring.length - 1; i++) {
    const a = ring[0], b = ring[i], c = ring[i + 1];
    const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(d) < 1e-8) continue;
    const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d;
    const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d;
    if (u < -.001 || v < -.001 || u + v > 1.001) continue;
    result = Math.max(result ?? -Infinity, u * a[1] + v * b[1] + (1 - u - v) * c[1]);
  }
  return result;
}
function nativeShell(batch: Batch, p: Part): void {
  const ring = p.viewerPrism.ring, low = p.viewerPrism.y0_dm / 10, top = eave(p);
  for (const w of walls(p)) {
    const count = Math.ceil(w.length / 2);
    for (let k = 0; k < count; k++) batch.wall(p, w, "native-source-wall", (k + .5) * w.length / count,
      (low + top) / 2, w.length / count, top - low, .22,
      p.parent === ULAP_URANIA_PARENT ? BRICK : PALE, 0);
  }
  const minX = Math.min(...ring.map(v => v[0] / 10)), maxX = Math.max(...ring.map(v => v[0] / 10));
  const minZ = Math.min(...ring.map(v => v[1] / 10)), maxZ = Math.max(...ring.map(v => v[1] / 10));
  const step = 1.4;
  for (let x = Math.floor(minX / step) * step + step / 2; x < maxX; x += step)
    for (let z = Math.floor(minZ / step) * step + step / 2; z < maxZ; z += step) {
      if (!moabitGuardHouseContains(ring, x, z)) continue;
      const h = roofY(p, x, z); if (h === null) continue;
      const upper = Math.min((p.viewerPrism.y0_dm + p.viewerPrism.h_dm) / 10, Math.ceil(h * 4) / 4);
      const lower = Math.min(upper - .18, Math.max(top - .15, upper - 2.6));
      batch.box(p, "native-source-roof", [x, (upper + lower) / 2, z], [step, upper - lower, step], CAP);
    }
}
function urania(batch: Batch, p: Part): void {
  const low = p.viewerPrism.y0_dm / 10, top = eave(p), height = top - low;
  for (const w of walls(p)) {
    if (!exposed(p, w, w.length / 2, (low + top) / 2)) continue;
    batch.wall(p, w, "urania-blind-brick", w.length / 2, (low + top) / 2,
      w.length + .015, height, .045, BRICK, .115);
    batch.wall(p, w, "urania-silver-cap", w.length / 2, top - .035,
      w.length + .03, .16, .22, CAP, .17);
    const course = batch.native ? .72 : .29;
    for (let y = low + .45; y < top - .3; y += course)
      batch.wall(p, w, "urania-brick-course", w.length / 2, y, w.length, .021, .026, MORTAR, .15);
    // A pale band marks the photographed low service frontage. Upper curved
    // hall walls remain entirely windowless. Individual bays are not surveyed.
    if (w.nz < -.38 && w.length > 4) {
      batch.wall(p, w, "urania-low-front-band", w.length / 2, low + 3.1,
        w.length, .40, .12, PALE, .20);
      const bays = Math.max(1, Math.floor(w.length / 4.5));
      for (let k = 0; k < bays; k++) {
        const u = (k + .5) * w.length / bays;
        batch.wall(p, w, "urania-service-opening", u, low + 1.25, .62, 1.55, .055, GLASS, .22);
        if (!batch.native) batch.wall(p, w, "urania-service-frame", u, low + 1.25, .065, 1.55, .06, FRAME, .265);
      }
    }
  }
}
function offices(batch: Batch, p: Part): void {
  const low = p.viewerPrism.y0_dm / 10, top = eave(p), height = top - low;
  if (height < 3) return;
  const requested = p.parent === "DEBE01YYK0002LQf" ? 4 : p.parent === "DEBE01YYK0002Nle" ? 3 :
    p.parent === "DEBE01YYK0002NRe" ? 1 : Math.max(1, Math.round(height / 3.55));
  const floors = Math.min(requested, Math.max(1, Math.floor(height / 2.8))), floor = (height - .55) / floors;
  for (const w of walls(p)) {
    if (w.length < 2.6) continue;
    const bays = Math.max(1, Math.floor(w.length / 3.5)), pitch = w.length / bays;
    for (let bay = 0; bay < bays; bay++) {
      const u = (bay + .5) * pitch, width = Math.min(1.65, pitch * .6);
      for (let row = 0; row < floors; row++) {
        const h = Math.min(1.7, floor * .57), y = low + .65 + row * floor + h / 2;
        if (!exposed(p, w, u, y)) continue;
        batch.wall(p, w, "office-window-reveal", u, y, width + .20, h + .18, .06, FRAME, .115);
        batch.wall(p, w, "office-window", u, y, width, h, .055, GLASS, .17);
        batch.wall(p, w, "office-window-sill", u, y - h / 2 - .09, width + .26, .14, .19, PALE, .21);
        if (!batch.native) batch.wall(p, w, "office-window-divider", u, y, .075, h, .055, FRAME, .23);
      }
      for (const y of [low + .45, top - .20]) if (exposed(p, w, u, y))
        batch.wall(p, w, "office-plinth-or-eave", u, y, pitch, .19, .14, CAP, .16);
    }
  }
}
function create(native: boolean, diagnostic: boolean): Group {
  const root = new Group(); root.name = native ? MINECRAFT_ULAP_QUARTER_GROUP_NAME : ULAP_QUARTER_GROUP_NAME;
  root.userData = { sourceBound: true, textureFree: true, fullStaticDetailOnTouch: true,
    keepInMinecraft: native, blockNative: native, facadeOnly: !native, surfaceOnly: true,
    hiddenSolidInfill: false, sourcePartCount: PARTS.length, sourceBuildingCount: 6,
    sourceBodiesRetained: !native, proceduralFacadeDimensions: true };
  const batch = new Batch(native);
  for (const part of PARTS) {
    if (native) nativeShell(batch, part);
    if (part.parent === ULAP_URANIA_PARENT) urania(batch, part); else offices(batch, part);
  }
  batch.finish(root, diagnostic);
  return freezeStaticSceneTransforms(root);
}
export function createUlapQuarter(_mobileLike = false, diagnostic = false): Group { return create(false, diagnostic); }
export function createMinecraftUlapQuarter(_mobileLike = false, diagnostic = false): Group { return create(true, diagnostic); }
