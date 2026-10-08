import { expect, test } from "bun:test";
import { InstancedMesh, Material } from "three";
import { createAltMitteEdgesV186 } from "../src/AltMitteEdgesV186";
import { createMinecraftAltMitteEdgesV186 } from "../src/MinecraftAltMitteEdgesV186";
import { nativeContourRows } from "../src/altMitteEdgesV186Batches";
import data from "../src/data/altMitteEdgesV186.json";

test("Alt-Mitte edges use frozen exact-sized independently culled surface cells", () => {
  for (const native of [false, true]) {
    const root = native ? createMinecraftAltMitteEdgesV186() : createAltMitteEdgesV186();
    expect(root.children.length).toBe(54);
    expect(root.userData.additiveOnly).toBe(true);
    let count = 0, bytes = 0;
    for (const object of root.children) {
      const mesh = object as InstancedMesh;
      expect(mesh.frustumCulled).toBe(true);
      expect(mesh.matrixAutoUpdate).toBe(false);
      expect(mesh.instanceMatrix.count).toBe(mesh.count);
      expect(mesh.instanceColor!.count).toBe(mesh.count);
      expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
      expect(mesh.boundingSphere!.radius).toBeLessThan(450);
      count += mesh.count;
      bytes += mesh.instanceMatrix.array.byteLength + mesh.instanceColor!.array.byteLength;
      if (native) for (let i = 0; i < mesh.count; i++) for (const n of [1, 2, 4, 6, 8, 9]) expect(mesh.instanceMatrix.array[i * 16 + n]).toBe(0);
      mesh.geometry.dispose(); mesh.dispose();
      for (const material of new Set([mesh.material, mesh.userData.dayMaterial, mesh.userData.nightMaterial])) if (material instanceof Material) material.dispose();
    }
    expect(count).toBe(native ? 28032 : 3560);
    expect(bytes).toBe(count * 76);
    expect(bytes).toBeLessThan(native ? 2_200_000 : 280_000);
    root.clear();
  }
});

test("native contour uses the same source normal and height without a smooth double", () => {
  for (const cell of data.cells) for (const row of cell.rows) {
    const native = nativeContourRows([row]);
    const dx = Math.cos(row[6]), dz = -Math.sin(row[6]);
    const nx = -dz * row[8], nz = dx * row[8];
    const center = native.reduce((sum, r) => [sum[0] + r[0], sum[1] + r[2]], [0, 0]).map(v => v / native.length);
    expect((center[0] - row[0]) * nx + (center[1] - row[2]) * nz).toBeCloseTo(1.15 - row[5] / 2 - .035, 6);
    expect((center[0] - row[0]) * dx + (center[1] - row[2]) * dz).toBeCloseTo(0, 6);
    expect(native.every(r => r[1] === row[1] && r[4] === row[4] && r[3] > 0 && r[5] > 0)).toBe(true);
  }
});
