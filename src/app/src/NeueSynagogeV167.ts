import {
  BoxGeometry, BufferGeometry, Color, CylinderGeometry, DoubleSide,
  BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh,
  Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3,
} from "three";
import source from "./data/neueSynagogeV167Source.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const NEUE_SYNAGOGE_V167_GROUP = "Neue Synagoge preserved building and gilded crowns";
export const NEUE_SYNAGOGE_V167_NATIVE_GROUP = "Neue Synagoge independent native blocks";
export const NEUE_SYNAGOGE_V167_RENDER_BUDGET = /* @__PURE__ */ (() => Object.freeze({
  parents: source.parents.length, parts: source.parts.length,
  sourceBoundaryPolygons: source.surfaces.length,
  facadeInstances: source.facadeBoxes.length, ribAndArchInstances: source.detailRods.length,
  get nativeBlocks() { return source.nativeBlocks.length; }, drawnBatches: 3, nativeBatches: 1,
}))();

type Surface = { color: number; triangles: number[][][] };
function surfacesMesh(surfaces: readonly Surface[]): Mesh {
  const count = surfaces.reduce((n, s) => n + s.triangles.length * 9, 0);
  const positions = new Float32Array(count), colors = new Float32Array(count);
  const color = new Color(); let offset = 0;
  for (const s of surfaces) {
    color.setHex(s.color);
    for (const t of s.triangles) for (const p of t) {
      positions.set(p, offset); colors.set([color.r, color.g, color.b], offset); offset += 3;
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const day = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  const night = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .84, flatShading: true });
  const mesh = new Mesh(geometry, day);
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true };
  return mesh;
}

function instances(rows: readonly number[][], kind: "box" | "rod" | "native"): InstancedMesh {
  const geometry = kind === "rod" ? new CylinderGeometry(1, 1, 1, 6, 1, true) : new BoxGeometry(1, 1, 1);
  geometry.deleteAttribute("uv");
  const day = new MeshBasicMaterial({ color: 0xffffff });
  const night = new MeshStandardMaterial({ color: 0xffffff, roughness: kind === "rod" ? .50 : .88, flatShading: true });
  const mesh = new InstancedMesh(geometry, day, 0), matrix = new Matrix4(), color = new Color();
  const matrices = new Float32Array(rows.length * 16), colors = new Float32Array(rows.length * 3);
  const position = new Vector3(), direction = new Vector3(), scale = new Vector3();
  const rotation = new Quaternion(), up = new Vector3(0, 1, 0);
  rows.forEach((r, i) => {
    if (kind === "native") matrix.makeScale(r[4], r[4], r[4]).setPosition(r[0], r[1], r[2]);
    else if (kind === "box") {
      matrix.makeRotationY(r[6]); matrix.scale(scale.set(r[3], r[4], r[5])); matrix.setPosition(r[0], r[1], r[2]);
    } else {
      direction.set(r[3] - r[0], r[4] - r[1], r[5] - r[2]);
      const length = direction.length(); rotation.setFromUnitVectors(up, direction.multiplyScalar(1 / length));
      position.set((r[0] + r[3]) / 2, (r[1] + r[4]) / 2, (r[2] + r[5]) / 2);
      matrix.compose(position, rotation, scale.set(r[6], length, r[6]));
    }
    matrix.toArray(matrices, i * 16); color.setHex(r[kind === "native" ? 3 : 7]).toArray(colors, i * 3);
  });
  mesh.count = rows.length; mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true,
    blockNative: kind === "native", nativeMinecraft: kind === "native" };
  mesh.computeBoundingBox(); mesh.computeBoundingSphere(); return mesh;
}

/** Touch and pointer intentionally receive the same complete static geometry. */
export function createNeueSynagogeV167(_options: { mobileLike?: boolean } = {}): Group {
  const root = new Group(); root.name = NEUE_SYNAGOGE_V167_GROUP;
  root.userData = { textureFree: true, sourceEnvelopeRetained: true,
    sourcePartIds: source.parts.map(p => p.id), renderBudget: NEUE_SYNAGOGE_V167_RENDER_BUDGET,
    currentPreservedBuildingOnly: true, estimatedHeroCrowns: true, historicalRearHallRebuilt: false };
  const shell = surfacesMesh([...source.surfaces, ...source.authoredSurfaces]);
  shell.name = "Neue Synagoge complete official walls roofs and additive dark dome panels";
  const boxes = instances(source.facadeBoxes, "box");
  boxes.name = "Neue Synagoge brick bands terracotta rosettes cornices and paired lancets";
  const ribs = instances(source.detailRods, "rod");
  ribs.name = "Neue Synagoge gold ribs roundels horseshoe arches and three star finials";
  root.add(shell, boxes, ribs); return freezeStaticSceneTransforms(root);
}

/** Orthogonal cells are generated independently; no smooth ornament is reused. */
export function createMinecraftNeueSynagogeV167(_options: { mobileLike?: boolean } = {}): Group {
  const root = new Group(); root.name = NEUE_SYNAGOGE_V167_NATIVE_GROUP;
  root.userData = { textureFree: true, nativeMinecraft: true, blockNative: true,
    keepInMinecraft: true, noHiddenSolidInfill: true,
    sourcePartIds: source.parts.map(p => p.id), currentPreservedBuildingOnly: true };
  const mesh = instances(source.nativeBlocks, "native");
  mesh.name = "Independent Neue Synagoge source skin gilded crowns and orthogonal facade";
  root.add(mesh); return freezeStaticSceneTransforms(root);
}
