import { describe, expect, test } from "bun:test";
import { luisenCorridorWalls, planLuisenCorridor, type LuisenBlock } from "../src/LuisenCorridorArchitecture";
import { LUISEN_CORRIDOR_SOURCE as S, LUISEN_STREET_REFINEMENTS_V218 as edges } from "../src/luisenCorridorProfile";
import prismJson from "../public/mesh/regierungsviertel/lod2-prisms.json";
import voxelJson from "../public/mesh/regierungsviertel/minecraft-voxels.json";

const context = { sourcePrisms: prismJson.buildings, voxels: voxelJson };
const walls = luisenCorridorWalls();
const selectedWalls = edges.map(edge => walls.find(w => w.part.id === edge.sourceId && w.a[0] === edge.a[0] && w.a[1] === edge.a[1])!);
function onEdge(block: LuisenBlock, index: number): boolean {
  const w = selectedWalls[index];
  return block.sourceId === w.part.id && Math.abs(block.normal[0] - w.nx) < 1e-8 && Math.abs(block.normal[1] - w.nz) < 1e-8;
}

describe("v218 exact Luisen corridor street refinements", () => {
  test("only four retained exterior edges receive named details", () => {
    expect(selectedWalls).toHaveLength(4);
    for (const w of selectedWalls) { expect(w).toBeDefined(); expect(w.street).toBeTrue(); }
    for (const minecraft of [false, true]) {
      const plan = planLuisenCorridor({ ...context, minecraft });
      for (const block of plan.filter(b => /^(Reinhardt19|Schumann19)/.test(b.role))) {
        expect(selectedWalls.some((_w, index) => onEdge(block, index)), block.role).toBeTrue();
        expect(block.position[1] + block.size[1] / 2).toBeLessThanOrEqual((S.facadeTops as Record<string, number>)[block.sourceId] + .06);
      }
    }
  });

  test("both representations align ten upper window axes and one panelled entrance", () => {
    for (const minecraft of [false, true]) {
      const plan = planLuisenCorridor({ ...context, minecraft });
      const upper = plan.filter(b => b.glass && b.position[1] > 10 && (onEdge(b, 0) || onEdge(b, 1)));
      const rows = new Map<number, number>();
      for (const pane of upper) rows.set(pane.position[1], (rows.get(pane.position[1]) ?? 0) + 1);
      expect([...rows.values()]).toEqual([10, 10, 10]);
      expect(plan.filter(b => b.role === "Reinhardt19 entrance glazing")).toHaveLength(1);
      expect(plan.filter(b => b.role === "Reinhardt19 panelled door leaf")).toHaveLength(2);
      expect(plan.filter(b => b.role === "Schumann19 corner bay glazing")).toHaveLength(6);
      expect(plan.filter(b => b.role === "Schumann19 corner bay metal post")).toHaveLength(12);
      // The reference front has plain narrow reveals, not generic projecting
      // individual window cornices/dentils copied from the historic family.
      expect(plan.filter(b => (onEdge(b, 0) || onEdge(b, 1)) && ["window cornice", "eaves dentil"].includes(b.role))).toHaveLength(0);
    }
  });

  test("touch and pointer retain identical full detail in each family", () => {
    const sourceBefore = JSON.stringify(S);
    for (const minecraft of [false, true]) {
      const pointer = planLuisenCorridor({ ...context, minecraft });
      const touch = planLuisenCorridor({ ...context, minecraft, mobileLike: true });
      expect(touch).toEqual(pointer);
    }
    expect(JSON.stringify(S)).toBe(sourceBefore);
  });
});
