import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, Group,
  InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3,
} from "three";
import data from "./data/steglitzSchoolStoresV327.json";
import { letteringStrokePaths } from "./drawnLettering";
import { isSceneGeometryGpuRetirementV309 } from "./sceneGeometryGpuResidency";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type Point = readonly [number, number];
type Row = readonly [number, number, number, number, number, number, number, number];
type Collider = readonly [number, number, number, number, number, number, number];
type Run = readonly [number, number, number, number];
type Sign = readonly [number, number, number, number, number, number, number, string, number, number];
type Family = { rows: Row[]; triangles: number[][]; signs: Sign[]; colliders: Collider[]; roofRuns: Run[] };
type Source = {
  schemaVersion: number;
  roofY: number;
  upperUndersideY: number;
  lidlRing: Point[];
  families: { drawn: Family; minecraft: Family };
};

const source = data as unknown as Source;
const CONTROL = 2415382706;
const BYTE_LIMIT = 130 * 1024;
const UNIT_MATRIX = new Matrix4().elements;

function fingerprint(value: unknown): number {
  let hash = 2166136261;
  const text = JSON.stringify(value);
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
  return hash;
}

function materials(vertexColors = false) {
  const day = new MeshBasicMaterial({ vertexColors, side: DoubleSide });
  const night = new MeshStandardMaterial({ vertexColors, side: DoubleSide, roughness: .84 });
  return { day, night };
}

function shell(rows: readonly number[][]): Mesh {
  const position = new Float32Array(rows.length * 9);
  const colors = new Float32Array(position.length);
  const color = new Color();
  for (let i = 0; i < rows.length; i++) {
    const [rgb, ...xyz] = rows[i];
    position.set(xyz, i * 9);
    color.setHex(rgb);
    for (let v = 0; v < 3; v++) color.toArray(colors, i * 9 + v * 3);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(position, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const { day, night } = materials(true);
  const mesh = new Mesh(geometry, day);
  mesh.name = "Bergstraße 86 — complete mapped upper envelope and roof";
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true };
  return mesh;
}

type Member = { matrix: Matrix4; rgb: number };

function lettering(signs: readonly Sign[], native: boolean): Member[] {
  const out: Member[] = [];
  const up = new Vector3(0, 1, 0);
  for (const [x, y, z, dx, dz, nx, nz, text, height, rgb] of signs) {
    // The outward normal fixes the reading direction on both returns.
    const direction = nx * dz - nz * dx > 0 ? -1 : 1;
    const point = (u: number, v: number) => new Vector3(x + direction * dx * u, y + v - height / 2, z + direction * dz * u);
    const stroke = height * .125;
    const seen = new Set<string>();
    for (const path of letteringStrokePaths(text, height)) {
      for (let i = 1; i < path.length; i++) {
        const a = point(...path[i - 1]), b = point(...path[i]);
        const delta = b.clone().sub(a), length = delta.length();
        if (length < 1e-6) continue;
        if (!native) {
          const q = new Quaternion().setFromUnitVectors(up, delta.normalize());
          out.push({ matrix: new Matrix4().compose(a.lerp(b, .5), q, new Vector3(stroke, length + stroke * .55, stroke)), rgb });
          continue;
        }
        // Independent cardinal lettering: quantised support-plane blocks.
        const count = Math.ceil(length / (stroke * .8));
        for (let step = 0; step <= count; step++) {
          const p = a.clone().lerp(b, step / count);
          const u = Math.round(((p.x - x) * dx + (p.z - z) * dz) / stroke);
          const v = Math.round((p.y - y) / stroke);
          const key = `${u},${v}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({ matrix: new Matrix4().makeScale(stroke, stroke, stroke).setPosition(x + u * stroke * dx, y + v * stroke, z + u * stroke * dz), rgb });
        }
      }
    }
  }
  return out;
}

function fittings(rows: readonly Row[], signs: readonly Member[], native: boolean): InstancedMesh {
  const geometry = new BoxGeometry(1, 1, 1);
  geometry.deleteAttribute("uv");
  const { day, night } = materials();
  const mesh = new InstancedMesh(geometry, day, rows.length + signs.length);
  const matrix = new Matrix4(), size = new Vector3(), color = new Color();
  for (let i = 0; i < rows.length; i++) {
    const [x, y, z, w, h, d, yaw, rgb] = rows[i];
    matrix.makeRotationY(yaw).scale(size.set(w, h, d)).setPosition(x, y, z);
    mesh.setMatrixAt(i, matrix);
    mesh.setColorAt(i, color.setHex(rgb));
  }
  signs.forEach(({ matrix, rgb }, i) => {
    mesh.setMatrixAt(rows.length + i, matrix);
    mesh.setColorAt(rows.length + i, color.setHex(rgb));
  });
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  mesh.name = "Mensa glazing, ALDI entrance canopy and Lidl facade members";
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, blockNative: native, nativeMinecraft: native };
  return mesh;
}

type Receipt = {
  native: boolean;
  ring: readonly Point[];
  bounds: Run;
  runs: readonly Run[];
  colliders: readonly Collider[];
  roofY: number;
  undersideY: number;
  members: readonly { mesh: Mesh; geometry: BufferGeometry; count: number | undefined }[];
  disposed: boolean;
};
const receipts = new WeakMap<Group, Receipt>();

/** The existing late landmark lifetime owns attachment, modes and disposal. */
export function createSteglitzSchoolStoresV327(native: boolean): Group | null {
  if (typeof native !== "boolean" || source.schemaVersion !== 1 || fingerprint(source) !== CONTROL) return null;
  const family = source.families[native ? "minecraft" : "drawn"];
  const glyphs = lettering(family.signs, native);
  const bytes = (family.rows.length + glyphs.length) * 76 + family.triangles.length * 108 + 1024;
  if (bytes > BYTE_LIMIT) return null;
  const root = new Group();
  root.name = "Gymnasium Steglitz Mensa and Bergstraße 86 / 93–97";
  root.userData = { textureFree: true, blockNative: native, nativeMinecraft: native, keepInMinecraft: native, fullStaticDetailOnTouch: true };
  if (family.triangles.length) root.add(shell(family.triangles));
  root.add(fittings(family.rows, glyphs, native));
  freezeStaticSceneTransforms(root);
  const ring = source.lidlRing.map(([x, z]): Point => [x, z]);
  const xs = ring.map(p => p[0]), zs = ring.map(p => p[1]);
  const receipt: Receipt = {
    native, ring, bounds: [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)],
    runs: family.roofRuns.map(row => [...row]), colliders: family.colliders.map(row => [...row]),
    roofY: source.roofY, undersideY: source.upperUndersideY,
    members: root.children.map(o => {
      const mesh = o as Mesh;
      return { mesh, geometry: mesh.geometry, count: mesh instanceof InstancedMesh ? mesh.count : undefined };
    }),
    disposed: false,
  };
  for (const { geometry } of receipt.members) geometry.addEventListener("dispose", () => {
    if (!isSceneGeometryGpuRetirementV309(geometry)) receipt.disposed = true;
  });
  receipts.set(root, receipt);
  return root;
}

function active(root: Group, x: number, z: number, radius = 0): Receipt | undefined {
  const receipt = receipts.get(root);
  if (!receipt || receipt.disposed || !root.parent || !Number.isFinite(x) || !Number.isFinite(z)) return;
  const [minX, minZ, maxX, maxZ] = receipt.bounds;
  if (x < minX - radius - .25 || z < minZ - radius - .25 || x > maxX + radius + .25 || z > maxZ + radius + .25) return;
  for (let object: Group | Group["parent"] = root; object; object = object.parent) if (!object.visible) return;
  if (!root.matrixWorld.elements.every((v, i) => v === UNIT_MATRIX[i]) || root.children.length !== receipt.members.length) return;
  if (!receipt.members.every(({ mesh, geometry, count }, i) => root.children[i] === mesh && mesh.parent === root &&
      mesh.visible && mesh.geometry === geometry && mesh.matrixWorld.elements.every((v, j) => v === UNIT_MATRIX[j]) &&
      (!(mesh instanceof InstancedMesh) || mesh.count === count))) return;
  return receipt;
}

function touchesRoof(receipt: Receipt, x: number, z: number, radius: number): boolean {
  if (receipt.native) return receipt.runs.some(([a, b, c, d]) =>
    Math.hypot(Math.max(a - x, x - c, 0), Math.max(b - z, z - d, 0)) <= radius);
  let inside = false;
  const ring = receipt.ring;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[j], [bx, bz] = ring[i];
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
    if (radius > 0) {
      const dx = bx - ax, dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
      if (Math.hypot(x - ax - dx * t, z - az - dz * t) <= radius) return true;
    }
  }
  return inside;
}

export function steglitzLidlV327SolidAt(root: Group, x: number, y: number, z: number, radius = 0): boolean {
  if (!Number.isFinite(y) || !Number.isFinite(radius) || radius < 0) return false;
  const receipt = active(root, x, z, radius);
  if (!receipt) return false;
  if (y >= receipt.undersideY && y < receipt.roofY && touchesRoof(receipt, x, z, radius)) return true;
  return receipt.colliders.some(([cx, cy, cz, w, h, d, yaw]) => {
    if (Math.abs(y - cy) >= h / 2) return false;
    const co = Math.cos(yaw), si = Math.sin(yaw), dx = x - cx, dz = z - cz;
    const u = dx * co - dz * si, v = dx * si + dz * co;
    return Math.hypot(Math.max(Math.abs(u) - w / 2, 0), Math.max(Math.abs(v) - d / 2, 0)) <= radius;
  });
}

/** The open deck keeps the old ground. A height hint near the represented roof
 * is required before the roof may become a walking floor. */
export function steglitzLidlV327GroundAt(root: Group, x: number, z: number, currentY?: number): number | null {
  if (currentY === undefined || !Number.isFinite(currentY)) return null;
  const receipt = active(root, x, z);
  if (!receipt || currentY < receipt.roofY - .65 || currentY > receipt.roofY + 1.2) return null;
  return touchesRoof(receipt, x, z, 0) ? receipt.roofY : null;
}
