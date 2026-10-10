import { describe, expect, test } from "bun:test";
import receipt from "../src/data/prisonsMemorialsOwnershipV209.json";
import { transferPrisonsNavigationV209 } from "../src/prisonsNavigationTransferV209";
import { prisonsMemorialsV209SolidAt } from "../src/prisonsMemorialsV209Navigation";
import { surroundingBuildingSolidAt, type SurroundingNavigation } from "../src/SurroundingCityGeometry";

function navigation(buildings: SurroundingNavigation["buildings"], groundY = 3): SurroundingNavigation {
  return { buildings, groundY, ground: [], water: [], roads: [], bridges: [] };
}

describe("exact old prison navigation transfer", () => {
  test("both immutable mode families transfer their exact 22 rows without mutating any source", () => {
    expect(receipt.navigationRecords).toHaveLength(44);
    for (const mode of ["drawn", "minecraft"])
      for (const tile of ["outer187-15_1", "east200-17_-5"]) {
        const records = receipt.navigationRecords.filter(record => record.mode === mode && record.tile === tile);
        expect(records).toHaveLength(11);
        const unrelated = { ...structuredClone(records[0].original), sourceId: "same-position-foreign-owner" };
        const nav = navigation([...records.map(record => structuredClone(record.original)), unrelated], records[0].groundY);
        const before = JSON.stringify(nav), result = transferPrisonsNavigationV209(tile, nav);
        expect(result.buildings).toEqual([unrelated]);
        expect(result.buildings[0]).toBe(unrelated);
        expect(JSON.stringify(nav)).toBe(before);
        expect(result.ground).toBe(nav.ground);
        expect(result.water).toBe(nav.water);
        expect(result.roads).toBe(nav.roads);
      }
  });

  test("changed source identity, datum, height, rings, holes and metadata remain untouched", () => {
    for (const record of receipt.navigationRecords) {
      const change = (fn: (row: typeof record.original & { groundOffset?: number; extra?: string }) => void) => {
        const row = structuredClone(record.original); fn(row);
        const nav = navigation([row], record.groundY);
        expect(transferPrisonsNavigationV209(record.tile, nav)).toBe(nav);
      };
      change(row => { row.sourceId = "foreign"; });
      change(row => { row.height += .125; });
      change(row => { row.minHeight += .125; });
      change(row => { row.ring[0][0] += .125; });
      change(row => { row.holes.push([[0, 0], [1, 0], [1, 1], [0, 0]]); });
      change(row => { row.heightSource = "changed source"; });
      change(row => { row.groundOffset = 0; });
      change(row => { row.extra = "future source field"; });
      const shiftedGround = navigation([structuredClone(record.original)], record.groundY + .1);
      expect(transferPrisonsNavigationV209(record.tile, shiftedGround)).toBe(shiftedGround);
      const foreignTile = navigation([structuredClone(record.original)], record.groundY);
      expect(transferPrisonsNavigationV209("unrelated-tile", foreignTile)).toBe(foreignTile);
    }
  });

  test("the replaced Hohenschoenhausen roof no longer leaves an invisible collision slab", () => {
    const record = receipt.navigationRecords.find(r => r.owner === "DEBE11YYH0000Ffi" && r.mode === "drawn")!;
    const nav = navigation([structuredClone(record.original)], record.groundY);
    const [x, y, z] = [8782.364, 8.2, -2336.388];
    expect(surroundingBuildingSolidAt(nav, x - record.origin[0], y, z - record.origin[2])).toBe(true);
    expect(prisonsMemorialsV209SolidAt(x, y, z)).toBe(false);
    const result = transferPrisonsNavigationV209(record.tile, nav);
    expect(surroundingBuildingSolidAt(result, x - record.origin[0], y, z - record.origin[2])).toBe(false);
    expect(prisonsMemorialsV209SolidAt(x, 5, z)).toBe(true);
  });
});
