import { expect } from "bun:test";
import { Group, InstancedBufferAttribute, InstancedMesh, type Object3D } from "three";
import receipt from "../fixtures/outline-warschauer-v225.json";
import { outlineSignature } from "./outlineConstructionSignature";
import { restoreWeddingStationPreviousV229 } from "./weddingStationPreviousV229";

/** Reinsert only the independently captured obsolete roof span while checking
 * old fixtures. Every other current rail byte is pinned before this projection. */
export function restoreWarschauerRoofAccentV225ForTest(root: Object3D, native = false): () => void {
  expect(receipt.releasedBase).toBe("ee082a820c45e1b7ae3057915f1f4473c0e8ace1");
  const record = receipt.modes[native ? "minecraft" : "day"];
  const rails: Object3D[] = [];
  root.traverse(object => {
    if (object.name === "Complete Ring and Stadtbahn source station accents v190") rails.push(object);
  });
  expect(rails).toHaveLength(1);
  const rail = rails[0];
  expect(outlineSignature(rail)).toEqual(record.after);
  const meshes: Object3D[] = [];
  rail.traverse(object => { if (object.name === record.meshName) meshes.push(object); });
  expect(meshes).toHaveLength(1);
  expect(meshes[0]).toBeInstanceOf(InstancedMesh);
  const mesh = meshes[0] as InstancedMesh;
  expect(outlineSignature(mesh)).toEqual(record.afterMesh);
  const matrix = mesh.instanceMatrix, color = mesh.instanceColor!, count = mesh.count;
  const restore = () => { mesh.instanceMatrix = matrix; mesh.instanceColor = color; mesh.count = count; };
  const insert = (attribute: InstancedBufferAttribute, hex: string) => {
    expect(attribute.array).toBeInstanceOf(Float32Array);
    const source = new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength);
    const removed = Buffer.from(hex, "hex"), offset = record.start * attribute.itemSize * 4;
    expect(removed.byteLength).toBe(record.removedCount * attribute.itemSize * 4);
    const expanded = new Uint8Array(source.byteLength + removed.byteLength);
    expanded.set(source.subarray(0, offset)); expanded.set(removed, offset);
    expanded.set(source.subarray(offset), offset + removed.byteLength);
    return new InstancedBufferAttribute(new Float32Array(expanded.buffer), attribute.itemSize, attribute.normalized);
  };
  try {
    mesh.instanceMatrix = insert(matrix, record.matrixHex);
    mesh.instanceColor = insert(color, record.colorHex);
    mesh.count += record.removedCount;
    expect(outlineSignature(mesh)).toEqual(record.beforeMesh);
    expect(outlineSignature(rail)).toEqual(record.before);
  } catch (error) { restore(); throw error; }
  return restore;
}

/** Exactly one new direct optional family, plus the exact roof correction.
 * This does not omit a pre-existing node or edit any frozen historical fixture. */
export function projectOutlineV225ForTest(root: Group, mode: "day" | "minecraft"): () => void {
  const native = mode === "minecraft", name = "Arena and Warschauer station v225 recognition fittings" + (native ? " native" : "");
  const additions: Object3D[] = [];
  root.traverse(object => {
    if (object.name.startsWith("Arena and Warschauer station v225") || object.userData.arenaStationV225)
      additions.push(object);
  });
  expect(additions).toHaveLength(1);
  const addition = additions[0];
  expect(addition).toBeInstanceOf(Group);
  expect(addition.name).toBe(name);
  expect(addition.parent).toBe(root);
  expect(addition.userData.arenaStationV225).toBe(true);
  expect(addition.userData.requiredBeforeNavigation).toBe(false);
  expect(addition.userData.nativeMinecraft).toBe(native);
  const index = root.children.indexOf(addition);
  const restoreWedding = restoreWeddingStationPreviousV229(root);
  let restoreRoof: () => void;
  try { restoreRoof = restoreWarschauerRoofAccentV225ForTest(root, native); }
  catch (error) { restoreWedding(); throw error; }
  root.remove(addition);
  return () => {
    restoreRoof(); restoreWedding(); root.add(addition);
    root.children.splice(root.children.indexOf(addition), 1);
    root.children.splice(index, 0, addition);
  };
}
