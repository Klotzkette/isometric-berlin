import { expect, test } from "bun:test";
import { InstancedMesh, Matrix4, Vector3 } from "three";
import groundJson from "../public/mesh/regierungsviertel/ground-context.json";
import source from "../src/data/spreeRailings.json";
import { createSpreeRailings, SPREE_RAILING_MAX_INSTANCES } from "../src/SpreeRailings";
import type { VoxelPayload } from "../src/MinecraftVoxelWorld";

for (const blockMode of [false, true]) test(`mapped Spree rails remain source-bound and bounded (${blockMode})`, () => {
  const root = createSpreeRailings(groundJson as unknown as VoxelPayload, blockMode);
  expect(root.children.length).toBe(1);
  expect(root.userData.sourceRunIds).toEqual(source.rails.map(r => r.id));
  const mesh = root.children[0] as InstancedMesh;
  expect(mesh).toBeInstanceOf(InstancedMesh);
  expect(mesh.count).toBeGreaterThan(1000);
  expect(mesh.count).toBeLessThan(SPREE_RAILING_MAX_INSTANCES);
  expect(mesh.instanceMatrix.array.byteLength + (mesh.instanceColor?.array.byteLength ?? 0)).toBeLessThan(900000);
  const matrix = new Matrix4(), p = new Vector3();
  const segments = source.rails.flatMap(r => r.points_m.slice(1).map((b, i) => [r.points_m[i], b]));
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, matrix);
    expect(matrix.elements.every(Number.isFinite)).toBeTrue();
    p.setFromMatrixPosition(matrix);
    // Every piece is centred on an actual retained line: no cross-gap links.
    const distance = Math.min(...segments.map(([a, b]) => {
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.z - a[1]) * dz) / (dx * dx + dz * dz)));
      return Math.hypot(p.x - a[0] - t * dx, p.z - a[1] - t * dz);
    }));
    expect(distance).toBeLessThan(.001);
  }
  expect(mesh.geometry.getAttribute("position").count).toBe(24);
  expect(mesh.userData.dayMaterial.map).toBeNull();
});
