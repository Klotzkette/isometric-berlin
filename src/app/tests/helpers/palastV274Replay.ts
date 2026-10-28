import { expect } from "bun:test";
import { Color, InstancedBufferAttribute, InstancedMesh, Matrix4, type Object3D, Quaternion, Vector3 } from "three";
import { FRIEDRICHSTADT_PALAST_GLASS_LAYER_NAME, FRIEDRICHSTADT_PALAST_ROOT_NAME, palastFacadePoint, planFriedrichstadtPalast } from "../../src/FriedrichstadtPalastDetails";
import source from "../../src/data/centralTheatresV274.json";
import audit from "../fixtures/palast-static-stage-v274-audit.json";
import { restoreLegacyInstances, type InstanceBufferDelta } from "./instanceBufferReplay";
import { staticGeometryAudit } from "./staticGeometryAudit";

type StageRow = { position: readonly number[]; size: readonly number[]; rotation: readonly number[]; color: number; role: string };
const hash = (rows: unknown) => new Bun.CryptoHasher("sha256").update(JSON.stringify(rows)).digest("hex");
const rowBytes = (row: StageRow) => {
  // Every old/new stage row is behind the foyer; the native factory's front
  // offset therefore leaves these exact positions unchanged.
  const origin = palastFacadePoint(0, 0, 0), outward = palastFacadePoint(0, 0, 1);
  expect((row.position[0] - origin[0]) * (outward[0] - origin[0]) +
    (row.position[2] - origin[2]) * (outward[2] - origin[2])).toBeLessThan(0);
  const data = new Float32Array(19);
  new Matrix4().compose(new Vector3().fromArray(row.position), new Quaternion().fromArray(row.rotation),
    new Vector3().fromArray(row.size)).toArray(data);
  new Color(row.color).toArray(data, 16);
  return Buffer.from(data.buffer).toString("base64");
};

/** v274's retained receipt and original plan ordering restore the old stage
 * in the live native batch. Every unrelated byte, material and transform is
 * still checked against the unchanged historical whole-model snapshot.
 * HEAD d72cbc44 has only the recorded v274 planner/roof hook changes relative
 * to audit.proof.beforeRef; the working factory and stage data match HEAD.
 */
function withNativePalastBeforeV274<T>(root: Object3D, profile: "full" | "mobile", inspect: () => T): T {
  const key = `${profile}:true` as const, plan = planFriedrichstadtPalast(profile, true);
  const previous = source.palastPrevious[key], proof = audit.plans[key];
  const stages = plan.stone.filter(row => row.role.startsWith("v274 stage"));
  const currentRows = stages.map(row => ({ position: row.position, size: row.size,
    rotation: row.rotation.toArray(), color: row.color, role: row.role }));
  for (const family of ["stone", "glass", "sign"] as const) {
    expect(previous[family]).toHaveLength(proof[family].beforeCount);
    expect(hash(previous[family])).toBe(proof[family].beforeSha256);
    const changed = family === "stone" ? currentRows : [];
    expect(changed).toHaveLength(proof[family].currentCount);
    expect(hash(changed)).toBe(proof[family].currentSha256);
    expect(plan[family].length - changed.length).toBe(proof[family].unrelatedCount);
  }
  const mesh = root.getObjectByName("Friedrichstadt-Palast Minecraft surface blocks");
  expect(mesh).toBeInstanceOf(InstancedMesh);
  const live = mesh as InstancedMesh;
  const bodyCount = live.count - plan.stone.length - plan.glass.length - plan.sign.length;
  expect(bodyCount).toBe(5_739);
  // The old planner inserts stage stone immediately before the first entrance
  // stair; native decorative conversion preserves this insertion boundary.
  // Its stage ventilation is the final glass run. v274 appends new stage stone.
  const stoneIndex = plan.stone.findIndex(row => row.role === "entrance-stair");
  expect(stoneIndex).toBeGreaterThan(0);
  expect(plan.stone.slice(stoneIndex, stoneIndex + 4).every(row => row.role === "entrance-stair")).toBeTrue();
  expect(plan.stone.slice(-stages.length)).toEqual(stages);
  // JSON cannot preserve the -0 components produced by the old negative-yaw
  // quaternion. The unmodified stair uses that exact same original box()
  // orientation, so retain its bits rather than normalize the frozen hash.
  const originalRotation = plan.stone[stoneIndex].rotation.toArray();
  const oldBytes = (row: StageRow) => {
    expect(JSON.stringify(originalRotation)).toBe(JSON.stringify(row.rotation));
    return rowBytes({ ...row, rotation: originalRotation });
  };
  const oldStoneCount = plan.stone.length - stages.length + previous.stone.length;
  const removed: InstanceBufferDelta["removed"] = [
    ...previous.stone.map((row, i) => ({ index: bodyCount + stoneIndex + i, data: oldBytes(row) })),
    ...previous.glass.map((row, i) => ({ index: bodyCount + oldStoneCount + plan.glass.length + i, data: oldBytes(row) })),
  ];
  const added = currentRows.map((row, i) => ({ index: bodyCount + plan.stone.length - stages.length + i, data: rowBytes(row) }));
  const delta = stages.length - removed.length;
  expect(delta).toBe(profile === "full" ? 2_553 : 2_556);
  const historical = restoreLegacyInstances(live, {
    beforeCount: live.count - delta, afterCount: live.count,
    retainedCount: live.count - added.length, removed, added,
  });
  const current = staticGeometryAudit(root), count = live.count, matrices = live.instanceMatrix, colors = live.instanceColor;
  try {
    live.count = historical.count;
    live.instanceMatrix = new InstancedBufferAttribute(historical.instanceMatrix.array, 16);
    live.instanceColor = new InstancedBufferAttribute(historical.instanceColor!.array, 3);
    const result = staticGeometryAudit(root);
    expect(current.budget.instances - result.budget.instances).toBe(delta);
    expect(current.budget.bytes - result.budget.bytes).toBe(delta * 76);
    expect(current.budget.draws).toBe(result.budget.draws);
    expect(current.budget.vertices).toBe(result.budget.vertices);
    return inspect();
  } finally { live.count = count; live.instanceMatrix = matrices; live.instanceColor = colors; }
}

export function auditPalastBeforeV274(root: Object3D, profile: "full" | "mobile") {
  return withNativePalastBeforeV274(root, profile, () => staticGeometryAudit(root));
}

/** The civic/palaces constructors contain both the drawn and hidden native
 * Palast. Replay only the independently receipted v274 stage in both, retaining
 * the historical whole-root hashes/budgets and every unrelated live byte. */
export function withPalacesBeforeV274<T>(root: Object3D, profile: "full" | "mobile", inspect: () => T): T {
  const drawn = root.getObjectByName(FRIEDRICHSTADT_PALAST_ROOT_NAME)!;
  expect(drawn).toBeDefined();
  expect(staticGeometryAudit(drawn)).toEqual(audit.current[profile]);
  const plan = planFriedrichstadtPalast(profile), key = `${profile}:false` as const;
  const previous = source.palastPrevious[key], proof = audit.plans[key];
  const stoneIndex = plan.stone.findIndex(row => row.role === "entrance-stair");
  expect(stoneIndex).toBeGreaterThan(0);
  const rotation = plan.stone[stoneIndex].rotation.toArray();
  const saved: { mesh: InstancedMesh; count: number; matrices: InstancedBufferAttribute; colors: InstancedBufferAttribute | null }[] = [];
  try {
    for (const [family, name] of [["stone", "Friedrichstadt-Palast concrete frames and roof"],
      ["glass", FRIEDRICHSTADT_PALAST_GLASS_LAYER_NAME]] as const) {
      const changed = plan[family].filter(row => row.role.startsWith("v274 stage"));
      const currentRows = changed.map(row => ({ position: row.position, size: row.size,
        rotation: row.rotation.toArray(), color: row.color, role: row.role }));
      expect(previous[family]).toHaveLength(proof[family].beforeCount);
      expect(hash(previous[family])).toBe(proof[family].beforeSha256);
      expect(currentRows).toHaveLength(proof[family].currentCount);
      expect(hash(currentRows)).toBe(proof[family].currentSha256);
      expect(plan[family].length - changed.length).toBe(proof[family].unrelatedCount);
      if (changed.length) expect(plan[family].slice(-changed.length)).toEqual(changed);
      const mesh = drawn.getObjectByName(name) as InstancedMesh;
      expect(mesh).toBeInstanceOf(InstancedMesh);
      expect(mesh.count).toBe(plan[family].length);
      const retainedCount = mesh.count - changed.length;
      const historical = restoreLegacyInstances(mesh, {
        beforeCount: retainedCount + previous[family].length, afterCount: mesh.count, retainedCount,
        removed: previous[family].map((row, i) => {
          // Preserve the original box quaternion's signed zero bits; JSON's
          // numeric stage receipt intentionally normalizes those zeros.
          expect(JSON.stringify(row.rotation)).toBe(JSON.stringify(rotation));
          return { index: (family === "stone" ? stoneIndex : retainedCount) + i,
            data: rowBytes({ ...row, rotation }) };
        }),
        added: currentRows.map((row, i) => ({ index: retainedCount + i, data: rowBytes(row) })),
      });
      saved.push({ mesh, count: mesh.count, matrices: mesh.instanceMatrix, colors: mesh.instanceColor });
      mesh.count = historical.count;
      mesh.instanceMatrix = new InstancedBufferAttribute(historical.instanceMatrix.array, 16);
      mesh.instanceColor = new InstancedBufferAttribute(historical.instanceColor!.array, 3);
    }
    expect(staticGeometryAudit(drawn)).toEqual(audit.before[profile]);
    expect(audit.current[profile].budget.instances - audit.before[profile].budget.instances).toBe(23);
    return withNativePalastBeforeV274(root, profile, inspect);
  } finally {
    for (const { mesh, count, matrices, colors } of saved) {
      mesh.count = count; mesh.instanceMatrix = matrices; mesh.instanceColor = colors;
    }
  }
}
