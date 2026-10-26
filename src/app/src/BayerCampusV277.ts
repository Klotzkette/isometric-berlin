import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Vector3,
} from 'three';
import data from './data/bayerCampusV277.json';
import { freezeStaticSceneTransforms } from './staticSceneTransforms';

export const BAYER_CAMPUS_V277_CAMERA = { position: [45, 135, -2520], target: [-145, 38, -2390], spanM: 230 };
export function decodeBayerFloatsV277(value: string): Float32Array {
  const raw = atob(value), bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return new Float32Array(bytes.buffer);
}
function materials() {
  return { day: new MeshBasicMaterial({ vertexColors: true, side: DoubleSide }),
    night: new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .89 }) };
}
function shell(): Mesh {
  const positions = decodeBayerFloatsV277(data.drawnPositions);
  const tones = new Uint32Array(decodeBayerFloatsV277(data.drawnColors).buffer);
  const colors = new Float32Array(positions.length), c = new Color();
  for (let i = 0; i < tones.length; i++) {
    c.setHex(tones[i]); for (let j = 0; j < 3; j++) c.toArray(colors, i * 9 + j * 3);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const { day, night } = materials(), mesh = new Mesh(geometry, day);
  mesh.name = 'Bayer S101/S102/S100 complete measured-height OSM architecture';
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true };
  return mesh;
}
function boxes(native: boolean): InstancedMesh {
  const rows = decodeBayerFloatsV277(native ? data.nativeDetails : data.drawnDetails);
  const count = rows.length / 8, matrices = new Float32Array(count * 16), colors = new Float32Array(count * 3);
  const m = new Matrix4(), v = new Vector3(), color = new Color();
  for (let i = 0; i < count; i++) {
    const p = i * 8;
    m.makeRotationY(native ? 0 : rows[p + 6]).scale(v.set(rows[p + 3], rows[p + 4], rows[p + 5])).setPosition(rows[p], rows[p + 1], rows[p + 2]);
    m.toArray(matrices, i * 16); color.setHex(rows[p + 7]).toArray(colors, i * 3);
  }
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute('uv');
  const normals = geometry.getAttribute('normal'), shades = new Float32Array(normals.count * 3);
  for (let i = 0; i < normals.count; i++) {
    const shade = normals.getY(i) > .5 ? 1 : normals.getX(i) > .5 ? .86 : .95;
    shades.set([shade, shade, shade], i * 3);
  }
  geometry.setAttribute('color', new BufferAttribute(shades, 3));
  const { day, night } = materials(), mesh = new InstancedMesh(geometry, day, 0);
  mesh.count = count; mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
  mesh.name = native ? 'Bayer independent orthogonal complete parts and public facade detail' : 'Bayer source-bound facade ribs, windows and roof courses';
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, blockNative: native, nativeMinecraft: native, keepInMinecraft: native };
  mesh.computeBoundingBox(); mesh.computeBoundingSphere(); return mesh;
}
/** Required atomic replacement of exactly K0004qx3; all other campus bodies remain. */
export function createBayerCampusV277(native = false, _options: { mobileLike?: boolean } = {}): Group {
  const root = new Group(); root.name = 'Bayer Schering administration — Müllerstraße 178 — v277';
  root.userData = { bayerCampusV277: true, sourceId: 'K0004qx3', osmId: 'way/420830351',
    sourceEvidenceSha256: data.sourceSha256, fullStaticDetailOnTouch: true, textureFree: true,
    nativeMinecraft: native, blockNative: native, keepInMinecraft: native, counts: { ...data.counts } };
  if (!native) root.add(shell()); root.add(boxes(native));
  return freezeStaticSceneTransforms(root);
}
