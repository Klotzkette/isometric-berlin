import {
  BoxGeometry, Color, CylinderGeometry, Group, InstancedBufferAttribute,
  InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Quaternion,
  SphereGeometry, Vector3,
} from "three";
import source from "./data/humboldtMainV168Source.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const HUMBOLDT_MAIN_V168_GROUP = "HU main building additive facade ornament";
export const HUMBOLDT_MAIN_V168_NATIVE_GROUP = "HU main building independent native ornament";
export const HUMBOLDT_MAIN_V168_RENDER_BUDGET = /* @__PURE__ */ (() => Object.freeze({
  drawnBatches: 3, nativeBatches: 1,
  boxes: source.boxes.length, rods: source.rods.length, reliefInstances: source.beads.length,
  get nativeBoxes() { return source.nativeBoxes.length; }, replacedOwners: 0,
}))();

type Kind = "box" | "rod" | "relief" | "native";
function batch(rows: readonly number[][], kind: Kind): InstancedMesh {
  const geometry = kind === "rod" ? new CylinderGeometry(1, 1, 1, 6, 1, true) :
    kind === "relief" ? new SphereGeometry(.5, 8, 6) : new BoxGeometry(1, 1, 1);
  geometry.deleteAttribute("uv");
  const day = new MeshBasicMaterial({ color: 0xffffff });
  const night = new MeshStandardMaterial({ color: 0xffffff, roughness: .84, metalness: .05, flatShading: true });
  const mesh = new InstancedMesh(geometry, day, 0);
  const matrices = new Float32Array(rows.length * 16), colors = new Float32Array(rows.length * 3);
  const matrix = new Matrix4(), color = new Color(), scale = new Vector3();
  const position = new Vector3(), direction = new Vector3(), up = new Vector3(0, 1, 0), rotation = new Quaternion();
  rows.forEach((r, i) => {
    if (kind === "rod") {
      direction.set(r[3] - r[0], r[4] - r[1], r[5] - r[2]);
      const length = direction.length();
      rotation.setFromUnitVectors(up, direction.multiplyScalar(1 / length));
      position.set((r[0] + r[3]) / 2, (r[1] + r[4]) / 2, (r[2] + r[5]) / 2);
      matrix.compose(position, rotation, scale.set(r[6], length, r[6]));
    } else if (kind === "box") {
      matrix.makeRotationY(r[6]); matrix.scale(scale.set(r[3], r[4], r[5])); matrix.setPosition(r[0], r[1], r[2]);
    } else matrix.makeScale(r[3], r[4], r[5]).setPosition(r[0], r[1], r[2]);
    matrix.toArray(matrices, i * 16);
    color.setHex(r[kind === "relief" || kind === "native" ? 6 : 7]).toArray(colors, i * 3);
  });
  mesh.count = rows.length;
  mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true,
    blockNative: kind === "native", nativeMinecraft: kind === "native" };
  mesh.computeBoundingBox(); mesh.computeBoundingSphere(); return mesh;
}

/** An additive detail root: the previous source shell and facade remain owners. */
export function createHumboldtMainV168Details(_options: { mobileLike?: boolean } = {}): Group {
  const root = new Group(); root.name = HUMBOLDT_MAIN_V168_GROUP;
  root.userData = { textureFree: true, facadeOnly: true, additiveOnly: true,
    sourceParent: source.lod2ParentId, sourceGeometryUnchanged: true,
    fullStaticDetailOnTouch: true, renderBudget: HUMBOLDT_MAIN_V168_RENDER_BUDGET };
  const boxes = batch(source.boxes, "box"); boxes.name = "HU plaster joints pilasters dentils and panelled doors";
  const rods = batch(source.rods, "rod"); rods.name = "HU column flutes fanlights garlands and capital volutes";
  const relief = batch(source.beads, "relief"); relief.name = "HU acanthus leaves keystones and turned balustrades";
  root.add(boxes, rods, relief); return freezeStaticSceneTransforms(root);
}

/** Block-native ornament is separate from the retained existing native building. */
export function createMinecraftHumboldtMainV168Details(_options: { mobileLike?: boolean } = {}): Group {
  const root = new Group(); root.name = HUMBOLDT_MAIN_V168_NATIVE_GROUP;
  root.userData = { textureFree: true, nativeMinecraft: true, blockNative: true,
    keepInMinecraft: true, additiveOnly: true, facadeOnly: true,
    sourceParent: source.lod2ParentId, sourceGeometryUnchanged: true };
  const mesh = batch(source.nativeBoxes, "native");
  mesh.name = "Independent orthogonal HU capitals arch relief balusters and door panels";
  root.add(mesh); return freezeStaticSceneTransforms(root);
}
