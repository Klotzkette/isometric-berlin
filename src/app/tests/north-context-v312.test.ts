import { expect, test } from "bun:test";
import { InstancedMesh, Matrix4 } from "three";
import { createNorthContextV312, northContextSolidAtV312 } from "../src/NorthContextV312";

test("the two retained city families get complete, separate v312 fittings", () => {
  for (const native of [false, true]) {
    const root = createNorthContextV312(native);
    const batches = root.children.filter((child) => child instanceof InstancedMesh);
    expect(batches.map((mesh) => mesh.name)).toEqual([
      "Stettiner Vorortbahnhof", "Stettiner Carrée", "MYJUMP fascia",
      "Park am Nordbahnhof retaining edge", "Helmholtzplatz table tennis", "Grundschule im Hofgarten",
    ]);
    expect(root.children.length).toBe(native ? 6 : 7);
    expect(root.matrixAutoUpdate).toBe(false);
    expect(batches[4].count).toBe(35);
    const station = batches[0].boundingBox!;
    expect(station.min.y).toBeGreaterThan(5.2);
    expect(station.max.y).toBeLessThan(16);
    if (native) {
      const matrix = new Matrix4();
      for (const mesh of batches) for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix);
        expect([1, 2, 4, 6, 8, 9].every((k) => matrix.elements[k] === 0)).toBe(true);
      }
    }
    root.traverse((object) => {
      if (!(object instanceof InstancedMesh)) return;
      object.geometry.dispose();
      object.userData.dayMaterial.dispose();
      object.userData.nightMaterial.dispose();
    });
  }
});

test("table collision follows the top and legs, keeping their gap and park paths clear", () => {
  for (const native of [false, true]) {
    expect(northContextSolidAtV312(3272.48, native ? 3.84 : 3.73, -2596.4, 0, native)).toBe(true);
    expect(northContextSolidAtV312(3272.48, 3.35, -2596.4, 0, native)).toBe(false);
    expect(northContextSolidAtV312(3273.22, 3.35, -2596.4, 0, native)).toBe(true);
    expect(northContextSolidAtV312(3272.48, 3.73, -2594, 0, native)).toBe(false);
    expect(northContextSolidAtV312(1106, 2, -1592, 0, native)).toBe(false);
    expect(northContextSolidAtV312(0, 4, 0, 0, native)).toBe(false);
  }
});
