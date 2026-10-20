import { describe, expect, test } from "bun:test";
import { appendNorthShopfrontsV254 } from "../src/NorthShopfrontsV254";
import data from "../src/data/northShopfrontsV254.json";
import { createNorthV185 } from "../src/NorthV185";
import { InstancedMesh, Matrix4 } from "three";

describe("northern shopfronts v254", () => {
  for (const native of [false, true]) test(`complete additive family, native=${native}`, () => {
    const rows: number[][] = [[123]];
    appendNorthShopfrontsV254(rows, native);
    expect(rows[0]).toEqual([123]);
    expect((rows.length - 1) * 76).toBeLessThan(200 * 1024);
    const again: number[][] = [];
    appendNorthShopfrontsV254(again, native);
    expect(again).toEqual(rows.slice(1));
    for (const row of again) {
      expect(row).toHaveLength(native ? 7 : 8);
      expect(row.every(Number.isFinite)).toBe(true);
      expect(row.slice(3, 6).every(v => v > 0)).toBe(true);
    }
    const root = createNorthV185(native);
    expect(root.children).toHaveLength(native ? 4 : 5);
    expect(root.userData.fullStaticDetailOnTouch).toBe(true);
    const batch = root.children.find(m => m.userData.northShopfrontsV254) as InstancedMesh;
    expect(batch.userData.northV185).toBe("hagenauer");
    expect(batch.userData.dayMaterial.map).toBeNull();
    if (native) {
      const matrix = new Matrix4();
      for (let i = 0; i < batch.count; i++) {
        batch.getMatrixAt(i, matrix);
        for (const axis of [1, 2, 4, 6, 8, 9]) expect(matrix.elements[axis]).toBe(0);
      }
    }
    for (const child of root.children as InstancedMesh[]) {
      child.geometry.dispose();
      child.userData.dayMaterial.dispose();
      child.userData.nightMaterial.dispose();
      child.dispose();
    }
  });
  test("both families retain every Tor pane and every positively bound storefront", () => {
    expect(data.drawn.length).toBe(297);
    expect(data.native.length).toBe(297);
    expect(data.drawn.filter(f => f.existing)).toHaveLength(220);
    expect(data.counts.newShopfronts).toEqual({"Danziger Straße": 60, "Kastanienallee": 17});
    expect(data.native.filter(f => !f.existing && f.out < 1).every(f => f.t[0] === 0 || f.t[1] === 0)).toBe(true);
  });
});
