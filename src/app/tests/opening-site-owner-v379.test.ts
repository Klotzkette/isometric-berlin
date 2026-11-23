import { expect, test } from "bun:test";
import { charlottenburgerTorViewsV379 } from "../src/charlottenburgerTorViewsV379";
import { openingSiteOwnerV379 } from "../src/openingSiteOwnerV379";
import { tierparkEastIdsV379 } from "../src/tierparkEastIndexV379";
import { tierparkEastViewsV379 } from "../src/tierparkEastViewsV379";
import { zooWestIdsV379 } from "../src/zooWestIndexV379";
import { zooWestViewsV379 } from "../src/zooWestViewsV379";

test("all four gate links wait for the bridge ensemble", () => {
  for (const [name, view] of Object.entries(charlottenburgerTorViewsV379)) {
    const opening = openingSiteOwnerV379(name, view.target[0], view.target[2]);
    expect(opening.required).toEqual(["charlottenburger-tor-v379"]);
    expect(opening.meshName).toContain("Charlottenburger Brücke");
  }
});

test("each zoo link opens a tile containing that habitat in the released inventory", () => {
  for (const [views, hosts] of [[zooWestViewsV379, zooWestIdsV379], [tierparkEastViewsV379, tierparkEastIdsV379]] as const) {
    for (const [name, {target}] of Object.entries(views)) {
      const opening = openingSiteOwnerV379(name, target[0], target[2]);
      expect(opening.required).toHaveLength(1);
      expect(hosts.has(opening.required[0])).toBe(true);
      if (name.includes("Flusspferdhaus")) expect(opening.meshName).toContain("Doppelkuppel");
      if (name.startsWith("Giraffenpfad")) expect(opening.meshName).toContain("Holzstege");
    }
  }
});

test("ordinary places still accept the resident surface at the destination", () => {
  expect(openingSiteOwnerV379("Breitscheidplatz und Gedächtniskirche", -2480, 1519)).toEqual({required:[]});
});
