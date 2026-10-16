import { expect, test } from "bun:test";
import receipt from "../src/data/townhallV227Ownership.json";
import { transferTownhallNavigationV227 } from "../src/townhallPacketNavigationV227";
import type { SurroundingNavigation } from "../src/SurroundingCityGeometry";

test("only complete exact townhall navigation records yield; changed heights, courts and neighbours survive", () => {
  for (const r of receipt.navigationRecords) {
    const exact = structuredClone(r.original);
    const changed = { ...structuredClone(r.original), height: r.original.height + .1 };
    const other = { ...structuredClone(r.original), sourceId: "unrelated-neighbour" };
    const nav = { groundY: r.groundY, buildings: [exact, changed, other] } as SurroundingNavigation;
    const before = JSON.stringify(nav);
    const result = transferTownhallNavigationV227(r.tile, nav);
    expect(result.buildings).toEqual([changed, other]);
    expect(result.buildings[0]).toBe(changed);
    expect(JSON.stringify(nav)).toBe(before);
    expect(transferTownhallNavigationV227("unknown-tile", nav)).toBe(nav);
    const altered = { ...nav, groundY: r.groundY + .01 };
    expect(transferTownhallNavigationV227(r.tile, altered)).toBe(altered);
  }
  const allowed = new Set(receipt.authorizedOwners);
  expect(receipt.navigationRecords.every(r => allowed.has(r.owner))).toBeTrue();
});
