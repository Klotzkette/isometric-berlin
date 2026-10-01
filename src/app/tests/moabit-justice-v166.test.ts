import { describe, expect, test } from "bun:test";
import { InstancedMesh, Mesh } from "three";
import { createMoabitJusticeV166, createMinecraftMoabitJusticeV166 } from "../src/MoabitJusticeV166";
import { MOABIT_JUSTICE_V166_PARENT_IDS, MOABIT_JUSTICE_V166_PRISM_IDS, moabitJusticeV166RoofAt, moabitJusticeV166SourceColumn } from "../src/moabitJusticeV166Profile";
import source from "../src/data/moabitJusticeV166Source.json";
import { staticGeometryAudit, disposeStaticAudit } from "./helpers/staticGeometryAudit";

describe("complete measured Moabit justice exterior", () => {
  test("draws every retained source triangle and the same full touch detail", () => {
    const root = createMoabitJusticeV166();
    const positions = (root.children[0] as Mesh).geometry.attributes.position.array;
    expect(Array.from(positions)).toEqual(Array.from(new Float32Array(source.surfaces.flatMap(s => s.triangles).flat(2))));
    expect((root.children[1] as InstancedMesh).count).toBe(48611);
    expect(root.userData.sourcePartIds).toHaveLength(139);
    expect(root.userData.fullStaticDetailOnTouch).toBe(true);
    expect(root.userData.barredWindowCount).toBe(3200);
    const { budget } = staticGeometryAudit(root);
    expect(budget.draws).toBe(2);
    expect(budget.bytes).toBeLessThan(5_000_000);
    disposeStaticAudit(root);
  });
  test("native retains the independent surface skin and visible orthogonal grilles", () => {
    const root = createMinecraftMoabitJusticeV166();
    root.traverse(o => {
      expect(o.matrixAutoUpdate).toBe(false);
      if (!(o instanceof Mesh)) return;
      expect(o instanceof InstancedMesh).toBe(true);
      if (o instanceof InstancedMesh) for (let i = 0; i < o.count; i++) for (const j of [1, 2, 4, 6, 8, 9]) expect(Math.abs(o.instanceMatrix.array[16 * i + j])).toBe(0);
    });
    expect((root.children[0] as InstancedMesh).count).toBe(18072);
    expect((root.children[1] as InstancedMesh).count).toBe(35200);
    const { budget } = staticGeometryAudit(root);
    expect(budget.draws).toBe(2);
    expect(budget.bytes).toBeLessThan(4_100_000);
    disposeStaticAudit(root);
  });
  test("exact ownership replaces the low court fallback and keeps courtyards open", () => {
    expect(MOABIT_JUSTICE_V166_PARENT_IDS.size).toBe(48);
    expect(MOABIT_JUSTICE_V166_PRISM_IDS.size).toBe(45);
    expect(MOABIT_JUSTICE_V166_PRISM_IDS.has("-7721745")).toBe(true);
    for (const [x, z] of [[-1139.477, -814.368], [-1201.675, -807.466], [-1099.211, -824.888], [-1250.603, -804.86]]) {
      expect(moabitJusticeV166RoofAt(x, z)).toBe(null);
      expect(moabitJusticeV166RoofAt(x, z, true)).toBe(null);
    }
    expect(moabitJusticeV166RoofAt(-900, -800)).toBe(null);
    expect(moabitJusticeV166SourceColumn(-900, -800, 5.2, 17.2)).toBe(false);
  });
});
