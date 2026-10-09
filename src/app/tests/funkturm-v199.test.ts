import { expect, test } from "bun:test";
import { InstancedMesh, Matrix4, Mesh } from "three";
import { createFunkturmV199 } from "../src/FunkturmV199";
import { staticGeometryAudit } from "./helpers/staticGeometryAudit";

test("Funkturm fittings allocate only the selected frozen bounded texture-free representation", () => {
  for (const native of [false, true]) {
    const root = createFunkturmV199(native), matrix = new Matrix4();
    const audit = staticGeometryAudit(root);
    expect(audit.budget.bytes).toBeLessThan(700000);
    expect(audit.budget.draws).toBe(native ? 4 : 6);
    expect(audit.budget.instances).toBe(native ? 4186 : 1479);
    expect(root.children).toHaveLength(4);
    root.traverse(o => {
      expect(o.matrixAutoUpdate).toBe(false);
      if (!(o instanceof Mesh)) return;
      expect(o.geometry.getAttribute("uv")).toBeUndefined();
      expect(o.geometry.boundingBox).not.toBeNull();
      expect(o.geometry.boundingSphere).not.toBeNull();
      expect(o.frustumCulled).toBe(true);
      expect(o.userData.dayMaterial.map).toBeNull(); expect(o.userData.nightMaterial.map).toBeNull();
      if (native) expect(o.userData.blockNative).toBe(true);
      if (o instanceof InstancedMesh) {
        expect(o.count).toBe(o.instanceMatrix.count); expect(o.count).toBe(o.instanceColor!.count);
        expect(o.boundingSphere).not.toBeNull(); expect(o.boundingBox).not.toBeNull();
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, matrix); expect(matrix.elements.every(Number.isFinite)).toBe(true);
          if (native) for (const j of [1, 2, 4, 6, 8, 9]) expect(matrix.elements[j]).toBe(0);
        }
      }
    });
  }
});
