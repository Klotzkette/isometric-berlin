import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { DynamicDrawUsage, Group, InstancedMesh, Mesh, PerspectiveCamera } from "three";
import { createAlexanderNorthV166, createMinecraftAlexanderNorthV166 } from "../src/AlexanderNorthV166";
import { ALEXANDER_NORTH_V272, createPressehausCrownV272, PRESSEHAUS_CROWN_V272 } from "../src/AlexanderNorthV272";
import { parkStaticInstancesSteps } from "../src/losslessStaticStorage";
import { disposeStaticAudit } from "./helpers/staticGeometryAudit";
import { verifyAlexanderNorthRetentionV281 } from "./helpers/alexanderRetentionV281";

function camera() {
  const c = new PerspectiveCamera(55, 1, .1, 20000);
  c.position.set(2780, 95, -515); c.lookAt(2756.45, 78.6, -553.15); c.updateMatrixWorld(true);
  return c;
}
function retainedRows(mesh: InstancedMesh, count: number) {
  return Array.from({ length: count }, (_, i) => [
    ...mesh.instanceMatrix.array.slice(i * 16, i * 16 + 16),
    ...mesh.instanceColor!.array.slice(i * 3, i * 3 + 3),
  ]);
}

describe("source-retained north Alexander v272", () => {
  test("the exact complement of the retired sign survives byte for byte", () => {
    for (const native of [false, true]) {
      const root = native ? createMinecraftAlexanderNorthV166() : createAlexanderNorthV166();
      const receipt = ALEXANDER_NORTH_V272.retiredSignReceipt[native ? "unrelatedNative" : "unrelatedDrawn"];
      const mesh = root.children[native ? 1 : 2] as InstancedMesh;
      const rows = retainedRows(mesh, receipt.count);
      expect(root.userData.alexanderNorthV272.retainedRecognitionCount).toBe(receipt.count);
      expect(createHash("sha256").update(JSON.stringify(rows)).digest("hex")).toBe(receipt.sha256);
      // Keep the published v272 limits on its exact retained geometry. The one
      // separately frozen v274 Tor batch is checked by the same replay helper.
      const audit = verifyAlexanderNorthRetentionV281(root,native).retained;
      expect(audit.budget.draws).toBe(native ? 3 : 4);
      expect(audit.budget.bytes).toBeLessThan(native ? 1600000 : 3600000);
      expect(root.userData.fullStaticDetailOnTouch).toBe(true);
      root.traverse(o => {
        if (!(o instanceof Mesh)) return;
        expect(o.userData.textureFree).toBe(true);
        if (!native || !(o instanceof InstancedMesh)) return;
        for (let i = 0; i < o.count; i++) for (const k of [1, 2, 4, 6, 8, 9])
          expect(Math.abs(o.instanceMatrix.array[i * 16 + k])).toBe(0);
      });
      disposeStaticAudit(root);
    }
  });
  test("crown reuses bounded buffers and never advances while hidden, offscreen, reduced or disposed", () => {
    for (const native of [false, true]) {
      const parent = new Group(), root = createPressehausCrownV272(native), c = camera();
      parent.add(root); parent.updateMatrixWorld(true);
      const mesh = root.children[0] as InstancedMesh, matrices = mesh.instanceMatrix.array, colors = mesh.instanceColor!.array;
      const update = root.userData.updatePressehausV272;
      expect(update(0, c)).toBe(true);
      expect(update(100, c)).toBe(true);
      expect(update(150, c)).toBe(false);
      const movingTime = root.userData.elapsedSeconds;
      expect(movingTime).toBeGreaterThan(0);
      expect(update(200, c, false, true)).toBe(false);
      expect(update(30000, c, true)).toBe(false);
      expect(root.userData.elapsedSeconds).toBe(movingTime);
      parent.visible = false; expect(update(40000, c)).toBe(false);
      parent.visible = true;
      c.lookAt(0, 0, 0); c.updateMatrixWorld(true);
      expect(update(50000, c)).toBe(false);
      c.lookAt(2756.45, 78.6, -553.15); c.updateMatrixWorld(true);
      expect(update(60000, c)).toBe(true);
      expect(root.userData.elapsedSeconds - movingTime).toBeLessThanOrEqual(.051);
      expect(mesh.instanceMatrix.array).toBe(matrices);
      expect(mesh.instanceColor!.array).toBe(colors);
      if (native) for (let i = 0; i < mesh.count; i++) for (const k of [1, 2, 4, 6, 8, 9])
        expect(Math.abs(matrices[i * 16 + k])).toBe(0);
      root.userData.disposePressehausV272();
      expect(update(60100, c)).toBe(false);
      disposeStaticAudit(root);
    }
  });
  test("production storage parking and frozen transforms preserve crown motion", () => {
    for (const native of [false, true]) {
      const root = native ? createMinecraftAlexanderNorthV166() : createAlexanderNorthV166();
      const crown = root.getObjectByName(PRESSEHAUS_CROWN_V272)!;
      const mesh = crown.children[0] as InstancedMesh, matrices = mesh.instanceMatrix.array;
      const parking = parkStaticInstancesSteps(root);
      let step = parking.next();
      while (!step.done) step = parking.next();
      expect(step.value).toBeGreaterThan(0);
      root.updateMatrixWorld(true);
      const before = mesh.matrixWorld.clone(), beforeX = matrices[12], beforeZ = matrices[14], c = camera();
      expect(root.userData.updatePressehausV272(0, c)).toBe(true);
      expect(root.userData.updatePressehausV272(100, c)).toBe(true);
      root.updateMatrixWorld();
      expect(mesh.matrixAutoUpdate).toBe(false);
      expect(mesh.matrixWorldAutoUpdate).toBe(true);
      expect(mesh.instanceMatrix.array).toBe(matrices);
      expect(matrices.byteLength).toBeGreaterThan(0);
      expect(Object.getOwnPropertyDescriptor(mesh.instanceMatrix, "array")?.get).toBeUndefined();
      if (native) {
        expect(mesh.instanceMatrix.usage).toBe(DynamicDrawUsage);
        expect(matrices[12] !== beforeX || matrices[14] !== beforeZ).toBe(true);
        for (let i = 0; i < mesh.count; i++) for (const k of [1, 2, 4, 6, 8, 9])
          expect(Math.abs(matrices[i * 16 + k])).toBe(0);
      } else expect(mesh.matrixWorld.equals(before)).toBe(false);
      disposeStaticAudit(root);
    }
  });
});
