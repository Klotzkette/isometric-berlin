import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Quaternion, Vector3,
} from 'three';
import source from './data/westVenuesV260.json';
import { freezeStaticSceneTransforms } from './staticSceneTransforms';
import { letteringStrokePaths } from './drawnLettering';

type Vec = [number, number, number];
type Segment = [Vec, Vec, number, number, string];
export const WEST_VENUES_V260_BUDGET = Object.freeze({ ...source.counts, drawnBatches: 2, nativeBatches: 1, fullStaticDetailOnTouch: true });
function bytes(value: string): ArrayBuffer { const b = atob(value), a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a.buffer; }
function material() {
  return { dayMaterial: new MeshBasicMaterial({ vertexColors: true, side: DoubleSide }), nightMaterial: new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .84, flatShading: true }), textureFree: true };
}
function shell(): Mesh {
  const points = new Float32Array(bytes(source.sourcePositions)), tones = new Uint32Array(bytes(source.sourceColors));
  const colors = new Float32Array(points.length), c = new Color();
  for (let i = 0; i < tones.length; i++) { c.setHex(tones[i]); for (let j = 0; j < 3; j++) c.toArray(colors, i * 9 + j * 3); }
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new BufferAttribute(points, 3)); geometry.setAttribute('color', new BufferAttribute(colors, 3)); geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const data = material(), mesh = new Mesh(geometry, data.dayMaterial); mesh.name = 'Complete 88-part measured City West venue roofs and walls'; mesh.userData = data; return mesh;
}
function lettering(): Segment[] {
  const segments: Segment[] = [];
  function label(text: string, height: number, at: (u: number, y: number) => Vec, y: number, color: number) {
    const paths = letteringStrokePaths(text, height), pts = paths.flat();
    const mid = (Math.min(...pts.map(p => p[0])) + Math.max(...pts.map(p => p[0]))) / 2;
    for (const path of paths) for (let i = 1; i < path.length; i++) segments.push([at(path[i - 1][0] - mid, y + path[i - 1][1]), at(path[i][0] - mid, y + path[i][1]), height * .06, color, 'geometric-venue-lettering']);
  }
  const f = source.recognitionAnchors.delphiSign;
  const atDelphi = (u: number, y: number): Vec => [f.a[0] + f.d[0] * (f.length / 2 + u) + f.n[0] * .48, y, f.a[1] + f.d[1] * (f.length / 2 + u) + f.n[1] * .48];
  label('DELPHI', 1.6, atDelphi, 17.0, 0xC6AE68);
  label('FILMPALAST AM ZOO', .41, atDelphi, 15.7, 0xC6AE68);
  const atRenaissance = (u: number, y: number): Vec => { const angle = -Math.PI / 2 - u / 5.6; return [-3278.2 + Math.sin(angle + Math.PI / 2) * 5.6, y, 860.5 - Math.cos(angle + Math.PI / 2) * 5.6]; };
  label('RENAISSANCE THEATER', .62, atRenaissance, 18.7, 0xEAD9B2);
  return segments;
}
function batch(native: boolean): InstancedMesh {
  const rows = new Float32Array(bytes(native ? source.nativeBoxes : source.facadeBoxes));
  const transforms: number[] = [], tones: number[] = [], matrix = new Matrix4(), color = new Color();
  const scale = new Vector3(), pos = new Vector3(), quat = new Quaternion(), up = new Vector3(0, 1, 0);
  const emit = (x: number, y: number, z: number, w: number, h: number, d: number, yaw: number, tone: number) => {
    matrix.makeRotationY(yaw); matrix.scale(scale.set(w, h, d)); matrix.setPosition(x, y, z); transforms.push(...matrix.elements); color.setHex(tone); tones.push(color.r, color.g, color.b);
  };
  for (let i = 0; i < rows.length; i += 8) emit(rows[i], rows[i + 1], rows[i + 2], rows[i + 3], rows[i + 4], rows[i + 5], native ? 0 : rows[i + 6], rows[i + 7]);
  for (const [a, b, width, tone] of [...source.ribSegments as Segment[], ...lettering()]) {
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
  mesh.name = native ? 'Independent orthogonal West venue surface cells and recognition' : 'West venue source-bound metal ribs, facade glazing and geometric signs';
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, nativeMinecraft: native, blockNative: native, keepInMinecraft: native, noHiddenSolidInfill: true }; return mesh;
}
/** Required replacement; no mode or mobile option drops a measured part. */
export function createWestVenuesV260(native = false, _options: { mobileLike?: boolean } = {}): Group {
  const root = new Group(); root.name = native ? 'West venues v260 independent native architecture' : 'West venues v260 complete measured architecture';
  root.userData = { textureFree: true, sourceEnvelopeRetained: true, sourcePartIds: source.sourcePartIds, nativeMinecraft: native, blockNative: native, keepInMinecraft: native, renderBudget: WEST_VENUES_V260_BUDGET, fullStaticDetailOnTouch: true };
  if (!native) root.add(shell()); root.add(batch(native)); return freezeStaticSceneTransforms(root);
}
