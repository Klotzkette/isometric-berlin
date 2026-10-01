import {
  BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { paintGeometry } from "./drawnKit";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import source from "./data/breitscheidTowersSource.json";

export const BREITSCHEID_TOWER_RENDER_BUDGET = /* @__PURE__ */ Object.freeze({
  sourceParts: 30, sourceSurfaces: 455, facadeInstances: 15610, nativeBlocks: 15890,
});
export const BREITSCHEID_TOWER_GROUP = "Zoofenster and Upper West exact source architecture";
export const BREITSCHEID_TOWER_NATIVE_GROUP = "Zoofenster and Upper West native surface blocks";

function instanceBatch(rows: readonly number[][], native: boolean): InstancedMesh {
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
  const day = new MeshBasicMaterial({ color: 0xffffff });
  const night = new MeshStandardMaterial({ color: 0xffffff, roughness: .82, flatShading: true });
  const mesh = new InstancedMesh(geometry, day, 0);
  const matrices = new Float32Array(rows.length * 16), colors = new Float32Array(rows.length * 3);
  const matrix = new Matrix4(), color = new Color();
  rows.forEach((r, i) => {
    if (native) matrix.makeScale(2, 2, 2);
    else { matrix.makeRotationY(r[6]); matrix.scale(new Vector3(r[3], r[4], r[5])); }
    matrix.setPosition(r[0], r[1], r[2]); matrix.toArray(matrices, i * 16);
    color.setHex(r[native ? 3 : 7]).toArray(colors, i * 3);
  });
  mesh.count = rows.length;
  mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, blockNative: native, nativeMinecraft: native };
  mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  return mesh;
}

/** Pointer and touch always build the same complete measured source detail. */
export function createBreitscheidTowers(_options: { mobileLike?: boolean } = {}): Group {
  const root = new Group(); root.name = BREITSCHEID_TOWER_GROUP;
  root.userData.renderBudget = BREITSCHEID_TOWER_RENDER_BUDGET;
  root.userData.sourcePartIds = source.parts.map(p => p.id);
  const parts: BufferGeometry[] = [];
  for (const surface of source.surfaces) {
    const g = new BufferGeometry().setAttribute("position", new Float32BufferAttribute(surface.triangles.flat(2), 3));
    paintGeometry(g, surface.color); parts.push(g);
  }
  const geometry = mergeGeometries(parts, false)!; parts.forEach(p => p.dispose());
  geometry.computeVertexNormals();
  const day = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  const night = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .9, flatShading: true });
  const mesh = new Mesh(geometry, day); mesh.name = "Thirty retained LoD2 tower parts";
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true };
  root.add(mesh);
  const detail = instanceBatch(source.facadeBoxes, false);
  detail.name = "Source-clipped limestone windows glass crown and staggered aluminium facade";
  root.add(detail);
  freezeStaticSceneTransforms(root);
  return root;
}

/** Independent surface voxels, including facade colours; no smooth overlay. */
export function createMinecraftBreitscheidTowers(_options: { mobileLike?: boolean } = {}): Group {
  const root = new Group(); root.name = BREITSCHEID_TOWER_NATIVE_GROUP;
  const mesh = instanceBatch(source.nativeBlocks, true);
  mesh.name = "Breitscheid tower source-native skin with glass windows";
  root.add(mesh); root.userData.renderBudget = BREITSCHEID_TOWER_RENDER_BUDGET;
  freezeStaticSceneTransforms(root);
  return root;
}
