import { expect, test } from "bun:test";
import { Box3, Group, Mesh } from "three";
import { attachJannowitzV380, jannowitzHostsV380 } from "../src/jannowitzV380";
import { disposeSurroundingCityRoot } from "../src/disposeSurroundingCityRootV323";
import { jannowitzViewsV380 } from "../src/jannowitzViewsV380";
import type { SurroundingChunkGeometry } from "../src/SurroundingCityGeometry";

function tile(id: string): SurroundingChunkGeometry {
  const [x,z] = id.split("_").map(Number);
  const root = new Group();
  root.position.set(x*512, -10, z*512);
  return { root, origin: [x*512,-10,z*512], geometryBytes: 0, bufferCount: 0,
    nav: {groundY:3,ground:[],water:[],buildings:[]} };
}

test("both streamed families attach the measured elevations to the correct tile exactly once", async () => {
  const count: Record<string,number> = {};
  for (const native of [false,true]) for (const id of jannowitzHostsV380) {
    const entry=tile(id), signal=new AbortController().signal;
    await Promise.all([attachJannowitzV380(entry,id,native,signal),attachJannowitzV380(entry,id,native,signal)]);
    const parts: Mesh[]=[];
    entry.root.traverse(o=>{if(o instanceof Mesh)parts.push(o);});
    expect(parts.length).toBe(id==="6_1"?4:1);
    expect(entry.bufferCount).toBe(parts.length*3);
    expect(entry.geometryBytes).toBeGreaterThan(1500);
    for (const mesh of parts) {
      const g=mesh.geometry, ext=new Box3().setFromObject(mesh);
      expect(mesh.userData.keepInMinecraft).toBe(native);
      expect(g.index!.count%3).toBe(0);
      const xs=[ext.min.x,ext.max.x];
      if(mesh.name.startsWith("KitKatClub")){
        expect(xs[0]).toBeGreaterThan(3043);
        expect(xs[1]).toBeLessThan(3086);
        if(id==="5_1")expect(xs[1]).toBeLessThanOrEqual(3072.001);
        if(id==="6_1")expect(xs[0]).toBeGreaterThanOrEqual(3071.999);
      } else if(mesh.name.startsWith("Niederländische")){
        expect(xs[0]).toBeGreaterThan(2695); expect(xs[1]).toBeLessThan(2761);
        expect(ext.max.y).toBeGreaterThan(28);
      } else if(mesh.name.startsWith("Bahnhof")){
        expect(ext.min.y).toBeCloseTo(-1.15,2); expect(ext.max.y).toBeGreaterThan(18);
      } else if(mesh.name.startsWith("Jannowitzbrücke")){
        expect(ext.min.z).toBeGreaterThan(549); expect(ext.max.z).toBeLessThan(622);
      } else if(mesh.name.startsWith("Kraftwerk")){
        expect(ext.min.y).toBeGreaterThan(21); expect(ext.max.y).toBeLessThan(52);
      }
      count[id+native]=(count[id+native]??0)+g.index!.count;
    }
    if(id==="6_1"){
      expect(entry.nav.spreeBridgesV242!.solids).toHaveLength(41);
      expect(entry.nav.spreeBridgesV242!.floors).toHaveLength(24);
      expect(entry.nav.spreeBridgesV242!.solids.filter(s=>s.low===3.24)).toHaveLength(8);
    }
    disposeSurroundingCityRoot(entry.root);
  }
  for(const id of jannowitzHostsV380) expect(count[id+true]).not.toBe(count[id+false]);
});

test("cancellation, unrelated hosts and stale entries leave the scene and navigation untouched", async () => {
  const entry=tile("6_1");
  await attachJannowitzV380(entry,"6_1",false,AbortSignal.abort());
  await attachJannowitzV380(entry,"5_0",false,new AbortController().signal);
  await attachJannowitzV380(entry,"0_0",false,new AbortController().signal);
  expect(entry.root.children).toHaveLength(0);
  expect(entry.nav.spreeBridgesV242).toBeUndefined();
  expect(Object.keys(jannowitzViewsV380)).toHaveLength(5);
  for (const v of Object.values(jannowitzViewsV380)) {
    expect(jannowitzHostsV380.has(Math.floor(v.target[0]/512)+"_"+Math.floor(v.target[2]/512))).toBeTrue();
  }
});
