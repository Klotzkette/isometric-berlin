import {
  BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Vector3,
} from "three";
import source from "./data/tachelesV167Source.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { letteringStrokePaths } from "./drawnLettering";

export const TACHELES_V167_GROUP = "Tacheles Fotografiska current measured historic envelope";
export const TACHELES_V167_NATIVE_GROUP = "Tacheles Fotografiska independent native blocks";
export const TACHELES_V167_RENDER_BUDGET = /* @__PURE__ */ (() => Object.freeze({
  sourceParents: source.parents.length, sourceParts: source.sourceParts.length,
  facadeInstances: source.facadeBoxes.length,
  nativeSourceRuns: source.nativeRows.length,
  nativeDetailInstances: source.nativeDetailRows.length,
  drawnBatches: 2, nativeBatches: 2,
}))();
type Surface = { color: number; triangles: number[][][] };

function surfacesMesh(surfaces: Surface[]): Mesh {
  const count = surfaces.reduce((n, s) => n + s.triangles.length * 9, 0);
  const positions = new Float32Array(count), colors = new Float32Array(count), color = new Color();
  let offset = 0;
  for (const s of surfaces) {
    color.setHex(s.color);
    for (const t of s.triangles) for (const p of t) {
      positions.set(p, offset); colors.set([color.r, color.g, color.b], offset); offset += 3;
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const day = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  const night = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .89, flatShading: true });
  const mesh = new Mesh(geometry, day);
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true };
  return mesh;
}
function instances(rows: readonly number[][], native = false): InstancedMesh {
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
  const day = new MeshBasicMaterial({ color: 0xffffff });
  const night = new MeshStandardMaterial({ color: 0xffffff, roughness: .9, flatShading: true });
  const mesh = new InstancedMesh(geometry, day, 0), matrix = new Matrix4(), color = new Color();
  const matrices = new Float32Array(rows.length * 16), colors = new Float32Array(rows.length * 3);
  rows.forEach((r, i) => {
    matrix.makeRotationY(native ? 0 : r[6]); matrix.scale(new Vector3(r[3], r[4], r[5]));
    matrix.setPosition(r[0], r[1], r[2]); matrix.toArray(matrices, i * 16);
    color.setHex(r[native ? 6 : 7]).toArray(colors, i * 3);
  });
  mesh.count = rows.length; mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, blockNative: native, nativeMinecraft: native };
  mesh.computeBoundingBox(); mesh.computeBoundingSphere(); return mesh;
}

/** Independently drawn plain lettering, no copied logo or photographic signage. */
function signSurfaces(): Surface[] {
  const d = new Vector3(64.095, 0, 27.867).normalize();
  const at = (u: number, y: number, v: number): number[] => [1177.782 + d.x * u + d.z * v, y, -753.118 + d.z * u - d.x * v];
  const triangles: number[][][] = [];
  for (const [text, u0, y0, height, out] of [["AM TACHELES", 60.85, 9.75, .55, .56], ["FOTOGRAFISKA", 39.95, 8.1, .39, .34]] as const) {
    for (const path of letteringStrokePaths(text, height)) for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i], dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
      if (!length) continue;
      const u = -.026 * dy / length, v = .026 * dx / length;
      const q = [at(u0 + a[0] + u, y0 + a[1] + v, out), at(u0 + b[0] + u, y0 + b[1] + v, out), at(u0 + b[0] - u, y0 + b[1] - v, out), at(u0 + a[0] - u, y0 + a[1] - v, out)];
      triangles.push([q[0], q[1], q[2]], [q[0], q[2], q[3]]);
    }
  }
  return [{ color: 0xE4DFC8, triangles }];
}
function nativeLettering(): number[][] {
  const cells = new Map<string, number[]>();
  for (const s of signSurfaces()) for (const [a, b, c] of s.triangles) {
    const n = Math.max(1, Math.ceil(Math.max(Math.hypot(...a.map((v, i) => v - b[i])), Math.hypot(...a.map((v, i) => v - c[i]))) / .09));
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) {
      const p = a.map((v, k) => Math.floor((v + (b[k] - v) * i / n + (c[k] - v) * j / n) / .1));
      cells.set(p.join(), [...p.map(v => v * .1 + .05), .1, .1, .1, s.color]);
    }
  }
  return [...cells.values()];
}
function group(native: boolean): Group {
  const root = new Group(); root.name = native ? TACHELES_V167_NATIVE_GROUP : TACHELES_V167_GROUP;
  root.userData = {
    textureFree: true, fullStaticDetailOnTouch: true,
    sourcePartIds: source.sourceParts.map(p => p.id), currentUse: "Fotografiska Berlin",
    originalGeometryRetainedInEvidence: true, currentRoofCorrectionDocumented: true,
    openPassage: true, nativeMinecraft: native, keepInMinecraft: native, blockNative: native,
    noHiddenSolidInfill: true,
  };
  if (native) {
    const shell = instances(source.nativeRows, true); shell.name = "Independent Tacheles native surface skin with open passage";
    const detail = instances([...source.nativeDetailRows, ...nativeLettering()], true); detail.name = "Orthogonal Tacheles windows stonework and signage";
    root.add(shell, detail);
  } else {
    const shell = surfacesMesh([...source.surfaces, ...signSurfaces()]); shell.name = "Measured Tacheles walls wings current roof passage and arched openings";
    const detail = instances(source.facadeBoxes.map(r => r.slice(0, 8).map(Number))); detail.name = "Tacheles stone balustrade pilasters cornices glazing and courtyard remnants";
    root.add(shell, detail);
  }
  return freezeStaticSceneTransforms(root);
}
export function createTachelesV167(_options: { mobileLike?: boolean } = {}): Group { return group(false); }
export function createMinecraftTachelesV167(_options: { mobileLike?: boolean } = {}): Group { return group(true); }
