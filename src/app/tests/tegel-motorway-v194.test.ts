import { expect, test } from "bun:test";
import { LineDashedMaterial, LineSegments } from "three";
import { createTegelMotorwayV194 } from "../src/TegelMotorwayV194";

test("northern A111 is bounded, static, texture-free and identifies its tunnel route", () => {
  for (const native of [false, true]) {
    const root = createTegelMotorwayV194(native);
    expect(root.children).toHaveLength(2);
    let bytes = 0;
    root.traverse(o => expect(o.matrixAutoUpdate).toBeFalse());
    for (const item of root.children) {
      const line = item as LineSegments;
      expect(line.geometry.boundingSphere?.radius).toBeGreaterThan(0);
      expect(line.geometry.boundingBox?.min.z).toBeLessThan(-3500);
      for (const attribute of Object.values(line.geometry.attributes)) bytes += attribute.array.byteLength;
      expect(line.userData.nightMaterial).toBeDefined();
    }
    const tunnel = root.children[1] as LineSegments;
    expect(tunnel.material).toBeInstanceOf(LineDashedMaterial);
    expect(tunnel.geometry.getAttribute("lineDistance").count).toBe(118);
    expect(bytes).toBeLessThan(45000);
  }
});
