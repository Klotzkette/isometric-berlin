import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Quaternion, Vector3,
} from 'three';
import source from './data/lehrterV277.json';
import front from './data/lehrterFrontV358.json';
import { freezeStaticSceneTransforms } from './staticSceneTransforms';
import { letteringStrokePaths } from './drawnLettering';

type Vec = [number, number, number];
type Segment = [Vec, Vec, number, number, string];
function boxDelta(patch: typeof front.drawn) {
  const padding = patch.rows.endsWith("==") ? 2 : patch.rows.endsWith("=") ? 1 : 0;
  return (patch.rows.length * .75 - padding) / 32 - (patch.end - patch.start);
}
export const LEHRTER_V277_BUDGET = Object.freeze({
  ...source.counts,
  facadeBoxes: source.counts.facadeBoxes + boxDelta(front.drawn),
  nativeDetailBoxes: source.counts.nativeDetailBoxes + boxDelta(front.native),
  ribSegments: source.counts.ribSegments + front.ribs.rows.length - (front.ribs.end - front.ribs.start),
  drawnBatches: 2, nativeBatches: 1, fullStaticDetailOnTouch: true,
});
const frontShellCells = new Set(front.nativeShell);
function bytes(value: string): ArrayBuffer { const b = atob(value), a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a.buffer; }
function material() {
  return { dayMaterial: new MeshBasicMaterial({ vertexColors: true, side: DoubleSide }), nightMaterial: new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .84, flatShading: true }), textureFree: true };
}
function shell(): Mesh {
  const points = new Float32Array(bytes(source.sourcePositions)), tones = new Uint32Array(bytes(source.sourceColors));
  for (const face of front.triangles) tones[face] = front.color;
  const colors = new Float32Array(points.length), c = new Color();
  for (let i = 0; i < tones.length; i++) { c.setHex(tones[i]); for (let j = 0; j < 3; j++) c.toArray(colors, i * 9 + j * 3); }
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new BufferAttribute(points, 3)); geometry.setAttribute('color', new BufferAttribute(colors, 3)); geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const data = material(), mesh = new Mesh(geometry, data.dayMaterial); mesh.name = 'Complete eight-part measured Kulturfabrik and police roofs and walls'; mesh.userData = data; return mesh;
}
function lettering(native = false): Segment[] {
  const segments: Segment[] = [];
  function label(text: string, height: number, at: (u: number, y: number) => Vec, y: number, color: number) {
    const paths = letteringStrokePaths(text, height), pts = paths.flat();
    const mid = (Math.min(...pts.map(p => p[0])) + Math.max(...pts.map(p => p[0]))) / 2;
    for (const path of paths) for (let i = 1; i < path.length; i++) segments.push([at(path[i - 1][0] - mid, y + path[i - 1][1]), at(path[i][0] - mid, y + path[i][1]), height * .06, color, 'geometric-venue-lettering']);
  }
  const labels = [...source.labels.slice(0, front.labels.start), ...front.labels.rows, ...source.labels.slice(front.labels.end)];
  for (const f of labels) {
    const a = native ? f.nativeA : f.a;
    // Reading direction is camera-right from outside, independent of ring winding.
    const at = (u: number, y: number): Vec => [a[0] + f.n[1] * u, y, a[1] - f.n[0] * u];
    label(f.text, f.height, at, f.y, f.color);
  }
  return segments;
}
function batch(native: boolean): InstancedMesh {
  const rows = new Float32Array(bytes(native ? source.nativeBoxes : source.facadeBoxes));
  const transforms: number[] = [], tones: number[] = [], matrix = new Matrix4(), color = new Color();
  const scale = new Vector3(), pos = new Vector3(), quat = new Quaternion(), up = new Vector3(0, 1, 0);
  const emit = (x: number, y: number, z: number, w: number, h: number, d: number, yaw: number, tone: number) => {
    matrix.makeRotationY(yaw); matrix.scale(scale.set(w, h, d)); matrix.setPosition(x, y, z); transforms.push(...matrix.elements); color.setHex(tone); tones.push(color.r, color.g, color.b);
  };
  const patch = native ? front.native : front.drawn;
  const replacement = new Float32Array(bytes(patch.rows));
  function emitRows(values: Float32Array, recolor = false) {
    for (let i = 0; i < values.length; i += 8) emit(
      values[i], values[i + 1], values[i + 2], values[i + 3], values[i + 4], values[i + 5],
      native ? 0 : values[i + 6], recolor && frontShellCells.has(i / 8) ? front.color : values[i + 7],
    );
  }
  emitRows(rows.subarray(0, patch.start * 8), native);
  emitRows(replacement);
  emitRows(rows.subarray(patch.end * 8));
  const ribs = native ? [] : [
    ...source.ribSegments.slice(0, front.ribs.start),
    ...front.ribs.rows,
    ...source.ribSegments.slice(front.ribs.end),
  ] as Segment[];
  for (const [a, b, width, tone] of [...ribs, ...lettering(native)]) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], length = Math.hypot(dx, dy, dz);
    if (length < .00001) continue;
    if (native) {
      const n = Math.max(1, Math.ceil(length / .48));
      for (let i = 0; i < n; i++) { const t = (i + .5) / n; emit(a[0] + dx * t, a[1] + dy * t + .18, a[2] + dz * t, Math.max(width, Math.abs(dx) / n), Math.max(width, Math.abs(dy) / n), Math.max(width, Math.abs(dz) / n), 0, tone); }
    } else {
      quat.setFromUnitVectors(up, pos.set(dx, dy, dz).normalize()); matrix.compose(pos.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), quat, scale.set(width, length, width)); transforms.push(...matrix.elements); color.setHex(tone); tones.push(color.r, color.g, color.b);
    }
  }
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute('uv');
  const day = new MeshBasicMaterial({ color: 0xFFFFFF }), night = new MeshStandardMaterial({ color: 0xFFFFFF, roughness: .84, flatShading: true });
  const mesh = new InstancedMesh(geometry, day, 0); mesh.count = tones.length / 3; mesh.instanceMatrix = new InstancedBufferAttribute(new Float32Array(transforms), 16); mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(tones), 3); mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  mesh.name = native ? 'Independent orthogonal Lehrter source cells and recognition' : 'Lehrter source-bound three arch axes, facade relief and geometric venue signs';
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, nativeMinecraft: native, blockNative: native, keepInMinecraft: native, noHiddenSolidInfill: true }; return mesh;
}
/** Required replacement; no mode or mobile option drops a measured part. */
export function createLehrterV277(native = false, _options: { mobileLike?: boolean } = {}): Group {
  const root = new Group(); root.name = native ? 'Lehrter v277 independent native architecture' : 'Lehrter v277 complete measured architecture';
  root.userData = { textureFree: true, sourceEnvelopeRetained: true, sourcePartIds: source.sourcePartIds, nativeMinecraft: native, blockNative: native, keepInMinecraft: native, renderBudget: LEHRTER_V277_BUDGET, fullStaticDetailOnTouch: true };
  if (!native) root.add(shell()); root.add(batch(native)); return freezeStaticSceneTransforms(root);
}
