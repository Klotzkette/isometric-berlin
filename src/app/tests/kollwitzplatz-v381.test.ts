import { expect, test } from "bun:test";
import { Group, Mesh } from "three";
import central from "../src/data/centralNamedV230.json";
import {createCentralNamedV230} from "../src/CentralNamedV230";
import { attachKollwitzplatzV381 } from "../src/kollwitzplatzV381";
import { refineKollwitzDenkmalV381, appendKollwitzDenkmalV381 } from "../src/kollwitzDenkmalV381";
import { kollwitzplatzViewsV381 } from "../src/kollwitzplatzViewsV381";
import type { SurroundingChunkGeometry } from "../src/SurroundingCityGeometry";

const prior=central.sites.find(s=>s.key==="kollwitzplatz")!;
const controller=()=>new AbortController();
function empty():SurroundingChunkGeometry {
  return {root:new Group(),origin:[0,0,0],geometryBytes:0,bufferCount:0,nav:{groundY:0,ground:[],water:[],buildings:[]}};
}

test("nur die genau verifizierte alte Sitzfigur wird aus beiden alten Reihen gelöst",()=>{
  const current=refineKollwitzDenkmalV381(prior);
  expect(current.boxes).toEqual(prior.boxes.slice(0,-11));
  expect(current.nativeRows).toEqual(prior.nativeRows.slice(0,-41));
  const modified=structuredClone(prior);
  modified.boxes[167][1]+=.1;
  expect(refineKollwitzDenkmalV381(modified)).toBe(modified);
  const g=new Group();appendKollwitzDenkmalV381(g,modified,false);
  expect(g.children).toHaveLength(0);
  for (const native of [true,false]) {
    const deferred=createCentralNamedV230(native,true);
    expect(deferred.getObjectByName("Käthe Kollwitz · Gustav Seitz")).toBeUndefined();
    const group=new Group();
    appendKollwitzDenkmalV381(group,prior,native);
    appendKollwitzDenkmalV381(group,prior,native);
    expect(group.children).toHaveLength(1);
    const sculpture=group.children[0] as Mesh;
    expect(sculpture.geometry.index!.count).toBeGreaterThan(4500);
    expect(sculpture.userData.requiredBeforeNavigation).toBe(true);
    expect(sculpture.userData.siteKey).toBe("kollwitzplatz");
    expect(sculpture.userData.nativeMinecraft).toBe(native);
  }
});

test("Parkwege bleiben in beiden Darstellungen identisch und die Südhütte behält ihren eigenen Boden",async()=>{
  const same:Uint8Array[]=[];
  for(const native of [false,true]){
    const entry=empty(),signal=controller().signal;
    await Promise.all([attachKollwitzplatzV381(entry,"kollwitz381-platz",native,signal),attachKollwitzplatzV381(entry,"kollwitz381-platz",native,signal)]);
    expect(entry.root.children).toHaveLength(1);
    expect(entry.bufferCount).toBe(10);expect(entry.geometryBytes).toBeLessThan(680_000);
    expect(entry.root.getObjectByName("Käthe Kollwitz · Gustav Seitz")).toBeDefined();
    const surface=entry.root.getObjectByName("Platzwege, Spiel- und Sitzbereiche") as Mesh;
    same.push(new Uint8Array(surface.geometry.getAttribute("position").array.buffer));
    const floor=entry.root.userData.kollwitzplatzFloorV381;
    expect(floor(3157.2,-1874.7)).toBe(3.2);
    expect(floor(3131.5,-1795)).toBeNull();
    expect(floor(3230,-1850)).toBeNull();
  }
  expect(Buffer.compare(same[0],same[1])).toBe(0);
});

test("beide Zielnamen sind vorhanden und abgebrochene Parkpakete verwaisen nicht",async()=>{
  expect(Object.keys(kollwitzplatzViewsV381)).toEqual(["Kollwitzplatz","Käthe-Kollwitz-Denkmal am Kollwitzplatz"]);
  const entry=empty(),c=controller();
  const pending=attachKollwitzplatzV381(entry,"kollwitz381-platz",false,c.signal);
  c.abort();await pending;
  expect(entry.geometryBytes).toBe(0);expect(entry.root.children).toHaveLength(0);
});
