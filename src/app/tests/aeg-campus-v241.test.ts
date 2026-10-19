import { expect, test } from "bun:test";
import { Group } from "three";
import { readFileSync } from "node:fs";
import { addAEGCampusV241 } from "../src/AEGCampusV241";
import { isAEGCampusCorePrismV241, createAEGCampusCoreColumnTesterV241 } from "../src/aegCampusV241CorePrevious";
import { aegCampusV241RoofAt, aegCampusV241GroundAt, aegCampusV241SolidAt, aegCampusNavigationV241 } from "../src/aegCampusV241Navigation";
import receipts from "../src/data/aegCampusV241CorePrevious.json";
import { staticGeometryAudit, disposeStaticAudit } from "./helpers/staticGeometryAudit";

test("complete campus models use three shared meshes, no per-window objects or textures", () => {
  for (const native of [false, true]) {
    const root = new Group();
    for (const _ of addAEGCampusV241(root, native)) { /* cooperative construction */ }
    const audit = staticGeometryAudit(root);
    expect(audit.budget.draws).toBe(3);
    expect(audit.budget.instances).toBe(0);
    expect(audit.budget.bytes).toBeLessThan(10_000_000);
    expect(root.children.every(child => child.userData.fullMobileIdentical)).toBe(true);
    root.traverse((object: any) => { if (object.material) expect(object.material.map).toBeFalsy(); });
    disposeStaticAudit(root);
  }
});

test("only six complete exact proxy rows yield, and native neighbours remain protected", () => {
  const prisms = JSON.parse(readFileSync(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url), "utf8")).buildings;
  expect(prisms.filter(isAEGCampusCorePrismV241).length).toBe(6);
  const testColumn = createAEGCampusCoreColumnTesterV241(prisms, 4);
  for (const owner of receipts.owners) {
    expect(isAEGCampusCorePrismV241(owner.prism)).toBe(true);
    expect(isAEGCampusCorePrismV241({ ...owner.prism, h_dm: owner.prism.h_dm + 1 })).toBe(false);
    for (const row of owner.columns) {
      expect(testColumn(row[0], row[1], row[2], row[3], row[4])).toBe(true);
      expect(testColumn(row[0], row[1], row[2], row[3] + 1, row[4])).toBe(false);
    }
  }
  const row = receipts.owners[0].columns[0], x=(row[0]+.5)*40, z=(row[1]+.5)*40;
  const neighbour = { id:"later-owner", y0_dm:52, h_dm:100, ring:[[x-10,z-10],[x+10,z-10],[x+10,z+10],[x-10,z+10]] };
  expect(createAEGCampusCoreColumnTesterV241([...prisms, neighbour],4)(row[0],row[1],row[2],row[3],row[4])).toBe(false);
  expect(createAEGCampusCoreColumnTesterV241(prisms,2)(row[0],row[1],row[2],row[3],row[4])).toBe(false);
});

test("measured tall DW roof supports from above and does not teleport pedestrians", () => {
  const dw = aegCampusNavigationV241.sites.find(s => s.key === "dw")!;
  const candidates = dw.roofTriangles.map(tri => tri.reduce((sum,p)=>sum+p[1],0)/3);
  const tri = dw.roofTriangles[candidates.indexOf(Math.max(...candidates))];
  const [x,y,z] = [0,1,2].map(axis => tri.reduce((sum,p)=>sum+p[axis],0)/3);
  expect(y).toBeGreaterThan(40);
  expect(aegCampusV241RoofAt(x,z)).toBeCloseTo(y,3);
  expect(aegCampusV241GroundAt(x,z,5.2)).toBeNull();
  expect(aegCampusV241GroundAt(x,z,y+.2)).toBeCloseTo(y,3);
  expect(aegCampusV241RoofAt(x,z,true)).toBe(Math.floor(y)+1);
  expect(aegCampusV241SolidAt(0,10,0)).toBe(false);
});
