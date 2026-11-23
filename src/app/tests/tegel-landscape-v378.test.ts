import { expect, test } from "bun:test";
import { Group, InstancedMesh, Mesh } from "three";
import { attachTegelLandscapeV378 } from "../src/tegelLandscapeV378";
import { createWestLakesV194 } from "../src/WestLakesV194";
import { tegelHostsV378 } from "../src/tegelLandscapeIndexV378";
import { westLakesV194SolidAt, westLakesV194WaterAt } from "../src/westLakesV194Navigation";
import type { SurroundingChunkGeometry } from "../src/SurroundingCityGeometry";
import { disposeSurroundingCityRoot } from "../src/disposeSurroundingCityRootV323";

function entry(): SurroundingChunkGeometry {
  return {root:new Group(),origin:[0,0,0],geometryBytes:0,bufferCount:0,
    nav:{groundY:0,ground:[],buildings:[],water:[]}};
}

test("both render families retain the measured peaks, real roof owners and walkable beach slopes", async () => {
  for (const native of [false,true]) {
    const ready=new AbortController(), entries:SurroundingChunkGeometry[]=[];
    const buildings=new Set<string>();
    let crowns=0, walks=0;
    for (const host of tegelHostsV378) {
      const e=entry();entries.push(e);
      await attachTegelLandscapeV378(e,host.id,native,ready.signal);
      expect(e.geometryBytes).toBeGreaterThan(0);
      for (const b of e.nav.buildings) buildings.add(b.sourceId);
      e.root.traverse(o=>{
        if (o instanceof InstancedMesh && o.name.includes("gemessene Kronenhöhen")) crowns+=o.count/3;
        if (o instanceof Mesh) expect(o.geometry.boundingSphere?.radius).toBeGreaterThan(0);
      });
      if (e.root.userData.tegelLandscapeFloorV378) walks++;
    }
    const ground=(x:number,z:number)=>entries.map(e=>e.root.userData.tegelLandscapeFloorV378?.(x,z))
      .filter((n):n is number=>typeof n==="number");
    expect(crowns).toBe(29);
    // All thirteen measured peaks outside the previous forest floor have ground in both styles.
    for (const [x,z] of [[-6928.5,-8484.5],[-6927.5,-8493.5],[-6994.5,-8496.5],
      [-7017.5,-8459.5],[-7008.5,-8448.5],[-6930.5,-8504.5],[-7030.5,-8443.5],
      [-6976.5,-8524.5],[-6953.5,-8480.5],[-6976.5,-8474.5],[-6978.5,-8504.5],
      [-6968.5,-8508.5],[-6968.5,-8481.5]]) expect(ground(x,z).length).toBeGreaterThan(0);
    expect(buildings.size).toBe(7);
    expect(buildings.has("DEBE12YYJ0001sVZ")).toBe(true);
    expect(walks).toBeGreaterThan(9);
    const near=ground(-8402.98,-6695.49), inland=ground(-8423,-6735);
    expect(near.length).toBeGreaterThan(0);
    expect(Math.max(...near)).toBeLessThan(.1);
    expect(Math.max(...inland)).toBeGreaterThan(2.9);
    expect(ground(-20000,-20000)).toHaveLength(0);
    const lakes=createWestLakesV194(native);
    const owner=lakes.children.find(o=>o.userData.siteKey==="tegel-water")!;
    const mesh=owner.children.find(o=>o instanceof Mesh) as Mesh;
    expect(mesh.userData.surveyedBeachShoreFacesV378).toBe(native?580:234);
    expect(westLakesV194WaterAt(-8200,-6800,native)).toBe(-1.15);
    expect(westLakesV194SolidAt(-6258.7,17.6,-8637.1,0,native)).toBe(true);
    expect(westLakesV194SolidAt(-6258.7,22,-8637.1,0,native)).toBe(false);
    for (const e of entries) disposeSurroundingCityRoot(e.root);
    disposeSurroundingCityRoot(lakes);
  }
});

test("aborted landscape attachment does not publish partial geometry or navigation",async()=>{
  const e=entry(), cancel=new AbortController();
  cancel.abort();
  await expect(attachTegelLandscapeV378(e,tegelHostsV378[0].id,false,cancel.signal)).rejects.toThrow();
  expect(e.root.children).toHaveLength(0);expect(e.nav.ground).toHaveLength(0);
});
