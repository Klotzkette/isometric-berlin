import { expect } from "bun:test";
import { Color, InstancedBufferAttribute, InstancedMesh, Matrix4, type Object3D, Vector3 } from "three";
import { planFriedrichstrasseArchitectureV281Control } from "../../src/FriedrichstrasseArchitecture";
import { refineEnsembleFrontagesV281 } from "../../src/mitteEnsembleV281Plan";
import { restoreLegacyInstances, type InstanceBufferDelta } from "./instanceBufferReplay";
import { staticGeometryAudit } from "./staticGeometryAudit";

/** Restore only the exact two retired generic grids, then audit every original
 * buffer, material and transform against the unchanged v219 fixture. The
 * complete historical planner supplies removed rows; live rows are untouched.
 */
export function auditFriedrichstrasseBeforeV281(root: Object3D, profile: "full" | "mobile", minecraft = true) {
  const expectedRemoved = minecraft ? 99 : 145;
  const before = planFriedrichstrasseArchitectureV281Control({ minecraft, mobileLike: profile === "mobile" });
  const retained = new Set(refineEnsembleFrontagesV281(before));
  expect(before.length - retained.size).toBe(expectedRemoved);
  const current = staticGeometryAudit(root);
  const restore: (() => void)[] = [];
  let removedCount = 0;
  try {
    for (const glass of [false, true]) {
      const mesh = root.getObjectByName(glass ? "Friedrichstrasse facade glazing" : "Friedrichstrasse masonry and metal");
      expect(mesh).toBeInstanceOf(InstancedMesh);
      const live = mesh as InstancedMesh;
      const removed: InstanceBufferDelta["removed"] = [];
      before.filter(row => row.glass === glass).forEach((row, index) => {
        if (retained.has(row)) return;
        expect(["YCHo1QS2", "K0000BQ7"]).toContain(row.sourceId);
        const matrix = new Matrix4().makeRotationY(row.yaw);
        if (row.roll) matrix.multiply(new Matrix4().makeRotationZ(row.roll));
        matrix.scale(new Vector3(...row.size)).setPosition(...row.position);
        const data = new Float32Array(19);
        matrix.toArray(data); new Color(row.color).toArray(data, 16);
        removed.push({ index, data: Buffer.from(data.buffer).toString("base64") });
      });
      removedCount += removed.length;
      const prior = restoreLegacyInstances(live, {
        beforeCount: live.count + removed.length, afterCount: live.count,
        retainedCount: live.count, removed, added: [],
      });
      const count = live.count, matrices = live.instanceMatrix, colors = live.instanceColor;
      restore.push(() => { live.count = count; live.instanceMatrix = matrices; live.instanceColor = colors; });
      live.count = prior.count;
      live.instanceMatrix = new InstancedBufferAttribute(prior.instanceMatrix.array, 16);
      live.instanceColor = new InstancedBufferAttribute(prior.instanceColor!.array, 3);
    }
    expect(removedCount).toBe(expectedRemoved);
    const historical = staticGeometryAudit(root);
    expect(historical.budget.instances - current.budget.instances).toBe(expectedRemoved);
    expect(historical.budget.bytes - current.budget.bytes).toBe(expectedRemoved * 76);
    expect(historical.budget.draws).toBe(current.budget.draws);
    expect(historical.budget.vertices).toBe(current.budget.vertices);
    return historical;
  } finally { for (const undo of restore) undo(); }
}
