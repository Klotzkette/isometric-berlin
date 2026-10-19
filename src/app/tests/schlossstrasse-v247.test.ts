import { expect, test } from "bun:test";
import { InstancedMesh } from "three";
import details from "../src/data/schlossstrasseV247Details.json";
import { justicePalaceV183Boxes } from "../src/justicePalaceV183Batches";

for (const native of [false, true]) test(`v247 Schloßstraße ${native ? "native" : "drawn"} keeps exact finite rows and axes`, () => {
  const rows = native ? details.nativeRows : details.boxes;
  const mesh = justicePalaceV183Boxes(rows, native) as InstancedMesh;
  try {
    expect(mesh.count).toBe(native ? 240 : 69);
    expect(mesh.instanceMatrix.count).toBe(rows.length);
    expect(mesh.instanceColor!.count).toBe(rows.length);
    expect(mesh.instanceMatrix.array.byteLength + mesh.instanceColor!.array.byteLength).toBeLessThan(native ? 20_000 : 6_000);
    for (let i = 0; i < rows.length; i++) {
      const m = mesh.instanceMatrix.array, at = i * 16;
      for (const v of m.slice(at, at + 16)) expect(Number.isFinite(v)).toBeTrue();
      if (native) for (const n of [1, 2, 4, 6, 8, 9]) expect(m[at + n]).toBe(0);
      expect(m[at + 13] + rows[i][4] / 2).toBeLessThan(3.161);
      expect(m[at + 13] - rows[i][4] / 2).toBeGreaterThan(2.999);
    }
    expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
    expect(mesh.userData.dayMaterial.map).toBeNull();
    expect(mesh.userData.nightMaterial.map).toBeNull();
  } finally {
    mesh.dispose(); mesh.geometry.dispose();
    mesh.userData.dayMaterial.dispose(); mesh.userData.nightMaterial.dispose();
  }
});


test("v247 joint triangles close the measured corner on the same visible floor", () => {
  const triangles = details.surfaces.flatMap(surface => surface.triangles);
  expect(triangles.length).toBe(20);
  for (const surface of details.surfaces) {
    expect(surface.color).toBe(0x686d6c);
    for (const [a, b, c] of surface.triangles) {
      for (const p of [a, b, c]) {
        expect(p.every(Number.isFinite)).toBeTrue();
        expect(p[1]).toBe(3.09);
      }
      const up = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
      expect(up).toBeGreaterThan(0);
    }
  }
  // Three Float32 attributes in the existing drawn shell, no added draw call.
  expect(triangles.length * 3 * 3 * 4 * 3 + details.boxes.length * 76).toBeLessThan(8_000);
});
