import { expect, test } from "bun:test";
import { InstancedMesh } from "three";
import data from "../src/data/hermannEhlersFountainV248.json";
import { justicePalaceV183Boxes } from "../src/justicePalaceV183Batches";

for (const native of [false, true]) test(`v248 fountain ${native ? "native" : "drawn"} is finite and texture-free`, () => {
  const rows = native ? data.nativeRows : data.boxes;
  const mesh = justicePalaceV183Boxes(rows, native) as InstancedMesh;
  try {
    expect(mesh.count).toBe(native ? 217 : 88);
    const surfaceBytes = native ? 0 : data.surfaces.reduce((sum, s) => sum + s.triangles.length * 108, 0);
    expect(mesh.instanceMatrix.array.byteLength + mesh.instanceColor!.array.byteLength + surfaceBytes).toBeLessThanOrEqual(native ? 18_000 : 12_000);
    for (let i = 0; i < rows.length; i++) {
      const a = mesh.instanceMatrix.array, at = i * 16;
      for (const value of a.slice(at, at + 16)) expect(Number.isFinite(value)).toBeTrue();
      if (native) for (const index of [1, 2, 4, 6, 8, 9]) expect(a[at + index]).toBe(0);
      expect(a[at + 13] + rows[i][4] / 2).toBeLessThanOrEqual(4.251);
      expect(a[at + 13] - rows[i][4] / 2).toBeGreaterThanOrEqual(3.024);
    }
    expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
    expect(mesh.userData.dayMaterial.map).toBeNull();
    expect(mesh.userData.nightMaterial.map).toBeNull();
  } finally {
    mesh.dispose(); mesh.geometry.dispose();
    mesh.userData.dayMaterial.dispose(); mesh.userData.nightMaterial.dispose();
  }
});
