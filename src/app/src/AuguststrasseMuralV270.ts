import { BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from 'three';
import data from './data/auguststrasseMuralV270.json';
import { AUGUSTSTRASSE_MURAL_V270_PROFILE } from './AuguststrasseMuralV270Profile';
import { freezeStaticSceneTransforms } from './staticSceneTransforms';

const decoded = (text: string): ArrayBuffer => Uint8Array.from(atob(text), c => c.charCodeAt(0)).buffer;

/** Complete measured upper gable plus hand-authored vector interpretation of the
 * user's photographed mural. One static batch, identical full detail on mobile. */
export function createAuguststrasseMuralV270(native = false): Group {
  const p = native ? data.native : data.drawn, geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Uint16Array(decoded(p.positions)), 3));
  geometry.setAttribute('color', new BufferAttribute(new Uint8Array(decoded(p.colors)), 3, true));
  geometry.setIndex(new BufferAttribute(new Uint32Array(decoded(p.indices)), 1));
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const normals = geometry.getAttribute('normal');
  if (native) {
    const compact = new Int8Array(normals.count * 3);
    for (let i = 0; i < normals.count; i++) {
      compact[i * 3] = Math.round(normals.getX(i) * 127);
      compact[i * 3 + 1] = Math.round(normals.getY(i) * 127);
      compact[i * 3 + 2] = Math.round(normals.getZ(i) * 127);
    }
    geometry.setAttribute('normal', new BufferAttribute(compact, 3, true));
  }
  const day = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  const night = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .92 });
  const mesh = new Mesh(geometry, day);
  mesh.name = 'Auguststraße 92 measured upper gable and Bring Them Home mural';
  mesh.position.set(...data.origin as [number, number, number]); mesh.scale.setScalar(.01);
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, blockNative: native,
    nativeMinecraft: native, keepInMinecraft: native, requiredBeforeNavigation: true };
  const root = new Group(); root.name = 'Auguststraße mural and retained complete upper source v270';
  root.userData = { ...AUGUSTSTRASSE_MURAL_V270_PROFILE, textureFree: true,
    blockNative: native, nativeMinecraft: native, keepInMinecraft: native,
    requiredBeforeNavigation: true, receipt: 'auguststrasse-mural-v270-evidence.json.gz' };
  root.add(mesh); return freezeStaticSceneTransforms(root);
}
