import { expect, test } from "bun:test";
import { InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";
import { createMitteHistoricFrontsV340 } from "../src/MitteHistoricFrontsV340";
import receipts from "../src/data/mitteHistoricFrontsV340.json";
import type { PrismPayload } from "../src/IsometricCityWorld";
import type { VoxelPayload } from "../src/terrainPayload";

const terrain = "../public/mesh/regierungsviertel/";
const source = await Bun.file(new URL(terrain + "lod2-prisms.json", import.meta.url)).json() as PrismPayload;
const voxels = await Bun.file(new URL(terrain + "minecraft-voxels.json", import.meta.url)).json() as VoxelPayload;

test("all eight documented central frontages follow their retained street walls", () => {
  const model = createMitteHistoricFrontsV340(source.buildings);
  expect(model.userData.addresses).toEqual(receipts.map(front => front.address));
  expect(model.userData.windowCount).toBe(receipts.reduce((sum, front) => sum + front.bays * front.floors, 0));
  expect(model.children.every(child => child instanceof InstancedMesh && child.userData.nightMaterial)).toBe(true);
  const changed = source.buildings.map(part => part.id === "24054778" ? { ...part, h_dm: part.h_dm + 1 } : part);
  expect(createMitteHistoricFrontsV340(changed).userData.addresses).not.toContain("Auguststraße 19");
});

test("native street finishes follow independently pinned exposed cardinal columns", () => {
  const model = createMitteHistoricFrontsV340(source.buildings, voxels);
  expect(model.userData.blockNative).toBe(true);
  expect(model.userData.addresses).toEqual(receipts.map(front => front.address));
  expect(model.userData.nativeFaces).toBe(receipts.reduce((sum, front) => sum + front.native.length, 0));
  const finishes = model.children.find(child => child.name.endsWith(" stone")) as InstancedMesh;
  const matrix = new Matrix4(), position = new Vector3(), rotation = new Quaternion(), size = new Vector3();
  const normal = new Vector3();
  let faceCount = 0;
  for (let i = 0; i < finishes.count; i++) {
    finishes.getMatrixAt(i, matrix);
    matrix.decompose(position, rotation, size);
    if (size.y < 8 || Math.abs(size.z - .19) > .001) continue;
    normal.set(0, 0, 1).applyQuaternion(rotation);
    expect(Math.abs(normal.x) < 1e-5 || Math.abs(normal.z) < 1e-5).toBe(true);
    faceCount++;
  }
  expect(faceCount).toBe(model.userData.nativeFaces);
  const cell = receipts[0].native[0];
  const row = cell[1] - voxels.grid.min_z_idx;
  const building_rows = [...voxels.building_rows!];
  building_rows[row] = [];
  expect(createMitteHistoricFrontsV340(source.buildings, { ...voxels, building_rows }).userData.addresses)
    .not.toContain("Auguststraße 19");
});
