import { expect, test } from "bun:test";
import { InstancedMesh } from "three";
import source from "../src/data/townhallV227Profile.json";
import { createDistrictTownhallsV227, nativeTownhallRowsV227, townhallFittingsV227 } from "../src/DistrictTownhallsV227";
import { DISTRICT_TOWNHALL_RECIPES_V227, type TownhallSiteV227 } from "../src/districtTownhallProfileV227";
import { disposeStaticAudit, staticGeometryAudit } from "./helpers/staticGeometryAudit";

const sites = source.sites as unknown as TownhallSiteV227[];
test("all former district identities receive their own bounded facade recipe", () => {
  expect(sites.length).toBe(23);
  expect(Object.keys(DISTRICT_TOWNHALL_RECIPES_V227).sort()).toEqual(sites.map(s => s.key).sort());
  for (const site of sites) {
    const drawn = townhallFittingsV227(site), native = townhallFittingsV227(site, true);
    expect(drawn.windowCount).toBeGreaterThan(0);
    expect(native.windowCount).toBe(drawn.windowCount);
    expect(native.clocks).toBe(drawn.clocks);
    expect(native.windows.length).toBe(0);
    expect(drawn.windows.length).toBe(drawn.windowCount);
    for (const row of [...drawn.rows, ...native.rows]) {
      expect(row.every(Number.isFinite)).toBeTrue();
      expect(row.slice(3,6).every(v => v > 0)).toBeTrue();
    }
    for (const window of drawn.windows) {
      expect(window.y - window.h/2).toBeGreaterThanOrEqual(Math.min(...site.parts.map(p => p.ground_y_m)));
      expect(window.y + window.h).toBeLessThan(Math.max(...site.parts.map(p => p.top_y_m)) + .1);
    }
  }
  for (const key of ["tiergarten", "zehlendorf", "wedding", "mitte", "marzahn", "weissensee", "hohenschoenhausen"]) {
    expect(DISTRICT_TOWNHALL_RECIPES_V227[key].clock).toBeFalse();
    expect(townhallFittingsV227(sites.find(s => s.key === key)!).clocks).toBe(0);
  }
});

test("a sloped native cornice becomes bounded staircase fragments, never a filled diagonal rectangle", () => {
  const rows = nativeTownhallRowsV227([[10,5,20,40,.2,.12,Math.PI/4,0xffffff]]);
  expect(rows.length).toBe(27);
  expect(rows.every(r => r.length === 7 && r[3] < 1.2 && r[5] < 1.2)).toBeTrue();
  expect(rows[0][0]).toBeLessThan(rows.at(-1)![0]);
  expect(rows[0][2]).toBeGreaterThan(rows.at(-1)![2]);
  expect(nativeTownhallRowsV227([[10,5,20,40,.2,.12,0,0xffffff]])).toEqual([[10,5,20,40,.2,.12,0xffffff]]);
});

test("oblique native window glass remains visible beyond its reveal, and Pankow keeps ordinary rectangular windows", () => {
  const site: TownhallSiteV227 = { key:"wedding",name:"Angled source wall",anchor:[0,0],parts:[{
    id:"fixture",ground_y_m:0,top_y_m:6,ring:[[0,0],[10,10],[10,0]],holes:[],
    wallEdges:[{a:[0,0],b:[10,10],base:0,eave:6,normal:[-Math.SQRT1_2,Math.SQRT1_2]}],
  }] };
  const r=DISTRICT_TOWNHALL_RECIPES_V227.wedding, rows=townhallFittingsV227(site,true).rows;
  const glass=rows.filter(row=>row[6]===r.glass);
  expect(glass.length).toBeGreaterThan(0);
  for(const pane of glass) {
    const index=rows.indexOf(pane),frame=rows[index-1];
    expect(frame[6]).toBe(r.trim);
    expect(pane[2]+pane[5]/2).toBeGreaterThan(frame[2]+frame[5]/2+.03);
  }
  expect(townhallFittingsV227(sites.find(s=>s.key==="pankow")!).windows.some(w=>w.arch)).toBeFalse();
});

for (const native of [false,true]) test(`${native ? "native" : "drawn"}: deterministic, bounded, texture-free construction without retained source objects`, () => {
  const first = createDistrictTownhallsV227(native), second = createDistrictTownhallsV227(native);
  try {
    expect(staticGeometryAudit(first)).toEqual(staticGeometryAudit(second));
    const audit = staticGeometryAudit(first);
    expect(audit.budget.bytes).toBeLessThan(native ? 3_600_000 : 1_300_000);
    expect(audit.budget.draws).toBeLessThanOrEqual(native ? 23 : 50);
    expect(first.userData.fullStaticDetailOnTouch).toBeTrue();
    expect(first.userData.requiredBeforeNavigation).toBeTrue();
    expect(new Set(first.children.map(c => c.userData.siteKey)).size).toBe(23);
    first.traverse((object: any) => {
      expect(object.userData.source === undefined).toBeTrue();
      if (!(object instanceof InstancedMesh)) return;
      expect(object.geometry.getAttribute("uv")).toBeUndefined();
      expect(object.userData.textureFree).toBeTrue();
      expect(object.instanceMatrix.array.length).toBe(object.count * 16);
      if (native) for (let i=0;i<object.count;i++) {
        const m=object.instanceMatrix.array, offset=i*16;
        expect([1,2,4,6,8,9].every(j=>m[offset+j]===0)).toBeTrue();
      }
    });
  } finally { disposeStaticAudit(first); disposeStaticAudit(second); }
});
