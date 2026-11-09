import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, Group,
  InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  Quaternion, Vector3,
} from "three";
import data from "./data/steglitzBernsteinV328.json";
import { letteringStrokePaths } from "./drawnLettering";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type Row = readonly [number, number, number, number, number, number, number, number];
type Plaque = readonly [number, number, number, number, number, number, number, number];
type Family = { rows: readonly Row[]; triangles: readonly number[][]; plaque: Plaque };
const CONTROL = 373130006;
const BYTE_LIMIT = 64 * 1024;

function fingerprint(value: unknown): number {
  const json = JSON.stringify(value);
  let hash = 2166136261;
  for (let i = 0; i < json.length; i++) hash = Math.imul(hash ^ json.charCodeAt(i), 16777619) >>> 0;
  return hash;
}

function materials(vertexColors = false) {
  const day = new MeshBasicMaterial({ vertexColors, side: DoubleSide });
  const night = new MeshStandardMaterial({ vertexColors, side: DoubleSide, roughness: .84 });
  return { day, night };
}

function plaqueLetters([x, y, z, dx, dz, nx, nz, height]: Plaque, native: boolean): Matrix4[] {
  const result: Matrix4[] = [];
  const width = height * .113;
  const reading = nx * dz - nz * dx > 0 ? -1 : 1;
  const up = new Vector3(0, 1, 0);
  const point = (u: number, v: number) => new Vector3(x + reading * u * dx, y + v - height / 2, z + reading * u * dz);
  const cells = new Set<string>();
  for (const path of letteringStrokePaths("F. W. BERNSTEIN", height)) {
    for (let i = 1; i < path.length; i++) {
      const a = point(...path[i - 1]), b = point(...path[i]);
      const delta = b.clone().sub(a);
      const length = delta.length();
      if (length === 0) continue;
      if (!native) {
        const orientation = new Quaternion().setFromUnitVectors(up, delta.normalize());
        result.push(new Matrix4().compose(a.lerp(b, .5), orientation, new Vector3(width, length + width, width)));
        continue;
      }
      const count = Math.ceil(length / width);
      for (let step = 0; step <= count; step++) {
        const p = a.clone().lerp(b, step / count);
        const u = Math.round(((p.x - x) * dx + (p.z - z) * dz) / width);
        const v = Math.round((p.y - y) / width);
        const key = `${u},${v}`;
        if (cells.has(key)) continue;
        cells.add(key);
        result.push(new Matrix4().makeScale(width, width, width)
          .setPosition(x + u * width * dx, y + v * width, z + u * width * dz));
      }
    }
  }
  return result;
}

function relief(rows: readonly Row[], letters: readonly Matrix4[], native: boolean): InstancedMesh {
  const geometry = new BoxGeometry(1, 1, 1);
  geometry.deleteAttribute("uv");
  const { day, night } = materials();
  const mesh = new InstancedMesh(geometry, day, rows.length + letters.length);
  const color = new Color(), matrix = new Matrix4(), scale = new Vector3();
  rows.forEach(([x, y, z, w, h, d, yaw, rgb], index) => {
    mesh.setMatrixAt(index, matrix.makeRotationY(yaw).scale(scale.set(w, h, d)).setPosition(x, y, z));
    mesh.setColorAt(index, color.setHex(rgb));
  });
  color.setHex(0x252a29);
  letters.forEach((matrix, i) => {
    mesh.setMatrixAt(rows.length + i, matrix);
    mesh.setColorAt(rows.length + i, color);
  });
  mesh.computeBoundingSphere();
  mesh.name = "Südendstraße 2 — Erker, Balkone, Portal und silberne Bernstein-Tafel";
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, blockNative: native, nativeMinecraft: native };
  return mesh;
}

function ornament(rows: readonly number[][]): Mesh {
  const positions = new Float32Array(rows.length * 9), colors = new Float32Array(positions.length);
  const color = new Color();
  rows.forEach(([rgb, ...xyz], i) => {
    positions.set(xyz, i * 9);
    color.setHex(rgb);
    for (let v = 0; v < 3; v++) color.toArray(colors, i * 9 + v * 3);
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const { day, night } = materials(true);
  const mesh = new Mesh(geometry, day);
  mesh.name = "Südendstraße 2 — Giebel und Oberlicht";
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true };
  return mesh;
}

/** Independent fittings for the original, retained street face in each family. */
export function createSteglitzBernsteinV328(native: boolean): Group | null {
  if (typeof native !== "boolean" || fingerprint(data) !== CONTROL) return null;
  const family = data.families[native ? "minecraft" : "drawn"] as unknown as Family;
  const letters = plaqueLetters(family.plaque, native);
  if ((family.rows.length + letters.length) * 76 + family.triangles.length * 108 + 1024 > BYTE_LIMIT) return null;
  const root = new Group();
  root.name = "Wohnhaus von F. W. Bernstein — Südendstraße 2";
  root.userData = { blockNative: native, nativeMinecraft: native, keepInMinecraft: native, textureFree: true, fullStaticDetailOnTouch: true };
  root.add(relief(family.rows, letters, native));
  if (family.triangles.length) root.add(ornament(family.triangles));
  freezeStaticSceneTransforms(root);
  return root;
}
