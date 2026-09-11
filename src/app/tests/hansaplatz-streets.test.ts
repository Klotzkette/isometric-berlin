import { expect, test } from "bun:test";
import { InstancedMesh, Matrix4, MeshBasicMaterial, Vector3 } from "three";
import groundJson from "../public/mesh/regierungsviertel/ground-context.json";
import { type VoxelPayload, groundTopSampler } from "../src/MinecraftVoxelWorld";
import { createHansaplatzBlockStreets } from "../src/HansaplatzBlockStreets";
import source from "../src/data/hansaplatzBlockStreets.json";
import { pointInDistrictStreetScope } from "../src/districtStreetScope";

test("includes the school, Hand mit Uhr and GRIPS in the street presentation scope", () => {
  for (const [x,z] of [[-2147.5,-78.7], [-2137.1,-78.37], [-2149.18,-70.7], [-2040,-20], [-1930,-23.6]]) {
    expect(pointInDistrictStreetScope(x,z)).toBeTrue();
  }
  expect(pointInDistrictStreetScope(3000,3000)).toBeFalse();
});

test("keeps native pavement and open kerbs in one shallow, finite, image-free batch", () => {
  const ground = groundJson as unknown as VoxelPayload;
  const root = createHansaplatzBlockStreets(ground);
  expect(root.children).toHaveLength(1);
  expect(root.userData.keepInMinecraft).toBeTrue();
  expect(root.userData.hiddenSolidInfill).toBeFalse();
  const mesh = root.children[0] as InstancedMesh;
  expect(mesh).toBeInstanceOf(InstancedMesh);
  expect(mesh.count).toBeGreaterThan(1000);
  expect(mesh.count).toBeLessThan(8500);
  expect(mesh.geometry.getAttribute("position").count).toBe(24);
  expect(mesh.instanceMatrix.array.byteLength + mesh.instanceColor!.array.byteLength).toBeLessThan(650_000);
  expect(mesh.material).toBeInstanceOf(MeshBasicMaterial);
  expect((mesh.material as MeshBasicMaterial).map).toBeNull();
  expect(mesh.userData.nightMaterial.map).toBeNull();
  const matrix = new Matrix4(), p = new Vector3(), size = new Vector3();
  const sample = groundTopSampler(ground);
  let cellCount = 0;
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, matrix);
    p.setFromMatrixPosition(matrix);
    size.setFromMatrixScale(matrix);
    expect(matrix.elements.every(Number.isFinite)).toBeTrue();
    expect(size.z).toBe(1);
    expect(size.y).toBeLessThan(0.15);
    cellCount += Math.round(size.x);
    const surface = p.y + size.y / 2;
    for (const x of [p.x - size.x / 2 + 0.5, p.x + size.x / 2 - 0.5]) {
      const height = sample(x / ground.cell_m - ground.grid.min_x_idx, p.z / ground.cell_m - ground.grid.min_z_idx);
      expect(surface - height).toBeGreaterThan(0.17);
      expect(surface - height).toBeLessThan(0.33);
    }
  }
  expect(cellCount).toBe(source.cell_count);
});
