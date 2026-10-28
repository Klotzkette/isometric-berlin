import {
  BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute,
  Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh,
  MeshBasicMaterial, MeshStandardMaterial,
} from 'three';
import data from './data/brehmTropicalHallV282.json';
import { brehmTropicalHallSolidAtV282 } from './brehmTropicalHallV282Profile';
import { freezeStaticSceneTransforms } from './staticSceneTransforms';

const WALL = 0xA9B6AD, ROOF = 0x839E9C;

function materials(vertexColors: boolean) {
  const options = { color: 0xffffff, vertexColors, side: DoubleSide };
  return { day: new MeshBasicMaterial(options),
    night: new MeshStandardMaterial({ ...options, roughness: .7, flatShading: true }) };
}

function drawn(): Mesh {
  const positions: number[] = [], colors: number[] = [], color = new Color();
  const triangle = (a: number[], b: number[], c: number[], tint: number): void => {
    color.setHex(tint);
    for (const p of [a, b, c]) { positions.push(...p); colors.push(color.r, color.g, color.b); }
  };
  for (const [a, b, c] of data.roofIndices) triangle(data.roofVertices[a], data.roofVertices[b], data.roofVertices[c], ROOF);
  for (let i = 0; i < data.ring.length; i++) {
    const a = data.ring[i], b = data.ring[(i + 1) % data.ring.length];
    const lowA = [a[0], data.bottomY, a[1]], lowB = [b[0], data.bottomY, b[1]];
    const highA = [a[0], data.eaveY, a[1]], highB = [b[0], data.eaveY, b[1]];
    triangle(lowA, lowB, highB, WALL); triangle(lowA, highB, highA, WALL);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const { day, night } = materials(true), mesh = new Mesh(geometry, day);
  mesh.name = 'Source-sampled tropical roof and additive upper walls';
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true };
  return mesh;
}

function native(): InstancedMesh {
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute('uv');
  const { day, night } = materials(false), mesh = new InstancedMesh(geometry, day, 0);
  const matrices = new Float32Array(data.nativeRuns.length * 2 * 16);
  const colors = new Float32Array(data.nativeRuns.length * 2 * 3);
  const matrix = new Matrix4(), color = new Color();
  let index = 0;
  for (const [x, z, width, top] of data.nativeRuns) {
    // Separate visible half-metre roof cap and wall volume. Every primitive is
    // natively orthogonal; no transformed drawn triangles or hidden round body.
    for (const [low, high, tint] of [[data.nativeBottomY, top - .5, WALL], [top - .5, top, ROOF]]) {
      matrix.makeScale(width, high - low, 1).setPosition(x + width / 2, (low + high) / 2, z + .5).toArray(matrices, index * 16);
      color.setHex(tint).toArray(colors, index * 3); index++;
    }
  }
  mesh.count = index;
  mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
  mesh.name = 'Independent cardinal tropical-hall columns';
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true };
  mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  return mesh;
}

/** Additive, packet-owned upper hall. Original lower building sheets survive. */
export function createBrehmTropicalHallV282(isNative = false): Group {
  const group = new Group();
  group.name = `Regenwaldhaus source-supported upper hall v282 ${isNative ? 'native' : 'drawn'}`;
  group.add(isNative ? native() : drawn());
  group.userData = { brehmTropicalHallV282: true, sourceId: data.sourceId,
    packetId: data.packetId, parentId: data.parentId, native: isNative,
    fullStaticDetailOnTouch: true, textureFree: true, additiveOnly: true,
    solidAt: (x: number, y: number, z: number, radius = 0) => brehmTropicalHallSolidAtV282(isNative, x, y, z, radius) };
  freezeStaticSceneTransforms(group);
  return group;
}
