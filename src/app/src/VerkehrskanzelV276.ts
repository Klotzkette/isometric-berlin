import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Vector3,
} from 'three';
import { VERKEHRSKANZEL_V276_DATA as data } from './VerkehrskanzelV276Data';
import { freezeStaticSceneTransforms } from './staticSceneTransforms';

export const VERKEHRSKANZEL_V276_BUDGET = Object.freeze({ ...data.counts, drawnBatches: 2, nativeBatches: 1, fullStaticDetailOnTouch: true });
function bytes(value: string): ArrayBuffer {
  const raw = atob(value), array = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) array[i] = raw.charCodeAt(i);
  return array.buffer;
}
function shell(): Mesh {
  const points = new Float32Array(bytes(data.drawnPositions));
  const tones = new Uint32Array(bytes(data.drawnColors));
  const colors = new Float32Array(points.length), color = new Color();
  for (let i = 0; i < tones.length; i++) {
    color.setHex(tones[i]);
    for (let j = 0; j < 3; j++) color.toArray(colors, i * 9 + j * 3);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(points, 3));
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const day = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  const night = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .92, flatShading: true });
  const mesh = new Mesh(geometry, day);
  mesh.name = 'Verkehrskanzel retained kiosk, open canopy and estimated glass cabin';
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true };
  return mesh;
}
function boxes(native: boolean): InstancedMesh {
  const detail = new Float32Array(bytes(native ? data.nativeDetails : data.drawnDetails));
  const nativeBodyCount = 0;
  const count = detail.length / 8 + nativeBodyCount;
  const matrices = new Float32Array(count * 16), colors = new Float32Array(count * 3);
  const matrix = new Matrix4(), scale = new Vector3(), color = new Color();
  let at = 0;
  const emit = (x: number, y: number, z: number, w: number, h: number, d: number, yaw: number, tone: number) => {
    matrix.makeRotationY(native ? 0 : yaw); matrix.scale(scale.set(w, h, d)); matrix.setPosition(x, y, z);
    matrix.toArray(matrices, at * 16); color.setHex(tone).toArray(colors, at * 3); at++;
  };
  for (let i = 0; i < detail.length; i += 8) emit(detail[i], detail[i + 1], detail[i + 2], detail[i + 3], detail[i + 4], detail[i + 5], detail[i + 6], detail[i + 7]);
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute('uv');
  const day = new MeshBasicMaterial({ color: 0xFFFFFF }), night = new MeshStandardMaterial({ color: 0xFFFFFF, roughness: .9, flatShading: true });
  const mesh = new InstancedMesh(geometry, day, 0); mesh.count = count;
  mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16); mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
  mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  mesh.name = native ? 'Verkehrskanzel independently orthogonal pavilion, glass shell and frames' : 'Verkehrskanzel slender supports, kiosk window and cabin frames';
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, nativeMinecraft: native, blockNative: native, keepInMinecraft: native };
  return mesh;
}
/** The full compound is one atomic required owner in both modes and on mobile. */
export function createVerkehrskanzelV276(native = false, _options: { mobileLike?: boolean } = {}): Group {
  const root = new Group(); root.name = 'Verkehrskanzel — Joachimsthaler Platz — v276';
  root.userData = { sourceId: 'way/709164073', parentIds: ['DEBE04YY5000041M', 'DEBE04YY50002cND'], sourceEvidenceSha256: data.sourceSha256, textureFree: true, fullStaticDetailOnTouch: true, nativeMinecraft: native, blockNative: native, keepInMinecraft: native, renderBudget: VERKEHRSKANZEL_V276_BUDGET };
  if (!native) root.add(shell()); root.add(boxes(native));
  return freezeStaticSceneTransforms(root);
}
