import {
  BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group,
  InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Vector3,
} from 'three';
import data from './data/steppengartenShelterV283.json';
import { freezeStaticSceneTransforms } from './staticSceneTransforms';

/** Measured plan, explicitly estimated low stone shelter; no glass facade. */
export function createSteppengartenShelterV283(native = false): Group {
  const root = new Group();
  root.name = 'Steppengarten limestone shelter — v283';
  root.userData = { sourceId: data.sourceId, parentId: data.parentId,
    sourceEvidenceSha256: data.sourceSha256, textureFree: true,
    fullStaticDetailOnTouch: true, nativeMinecraft: native,
    blockNative: native, keepInMinecraft: native };
  if (!native) {
    const geometry = new BufferGeometry();
    const roof: number[] = [];
    const edges = new Map<string, { count: number; a: number[]; b: number[] }>();
    for (const triangle of data.roofs) {
      roof.push(...triangle.flat());
      roof.push(...triangle.slice().reverse().flatMap(([x, y, z]) => [x, y - .16, z]));
      for (let i = 0; i < 3; i++) {
        const a = triangle[i], b = triangle[(i + 1) % 3];
        const key = [a.join('/'), b.join('/')].sort().join('|');
        const edge = edges.get(key);
        if (edge) edge.count++; else edges.set(key, { count: 1, a, b });
      }
    }
    for (const { count, a, b } of edges.values()) if (count === 1) {
      const lowA = [a[0], a[1] - .16, a[2]], lowB = [b[0], b[1] - .16, b[2]];
      roof.push(...a, ...b, ...lowB, ...a, ...lowB, ...lowA);
    }
    geometry.setAttribute('position', new Float32BufferAttribute(roof, 3));
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const day = new MeshBasicMaterial({ color: 0x48493E, side: DoubleSide });
    const night = new MeshStandardMaterial({ color: 0x48493E, side: DoubleSide, roughness: .95 });
    const mesh = new Mesh(geometry, day);
    mesh.name = 'Shallow pitched roof on the complete measured plan';
    mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true };
    root.add(mesh);
  }
  const rows = native ? data.nativeBoxes : data.stones;
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute('uv');
  const day = new MeshBasicMaterial({ color: 0xFFFFFF });
  const night = new MeshStandardMaterial({ color: 0xFFFFFF, roughness: .94, flatShading: true });
  const mesh = new InstancedMesh(geometry, day, rows.length);
  const matrix = new Matrix4(), scale = new Vector3(), color = new Color();
  rows.forEach(([x, y, z, w, h, d, yaw, tone], i) => {
    matrix.makeRotationY(yaw).scale(scale.set(w, h, d)).setPosition(x, y, z);
    mesh.setMatrixAt(i, matrix); mesh.setColorAt(i, color.setHex(tone));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  mesh.name = native ? 'Independent orthogonal low shelter blocks' : 'Limestone courses and open west gable';
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true,
    nativeMinecraft: native, blockNative: native, keepInMinecraft: native };
  root.add(mesh);
  return freezeStaticSceneTransforms(root);
}
