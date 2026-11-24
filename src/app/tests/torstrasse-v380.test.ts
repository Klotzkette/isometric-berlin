import {expect, test} from "bun:test";
import {readFileSync} from "node:fs";
import {Group, InstancedMesh, Mesh, Raycaster, Vector3} from "three";
import {attachTorstrasseV380, createTorstrasseV380, type TorstrassePacketV380} from "../src/torstrasseV380";
import {torstrasseHostsV380, torstrasseOpeningHostV380, torstrasseViewsV380} from "../src/torstrasseIndexV380";
import {ROSENTHALER_STAIRS_V228} from "../src/rosenthalerV228Profile";
import type {SurroundingChunkGeometry} from "../src/SurroundingCityGeometry";

function packet(host: string): TorstrassePacketV380 {
  return JSON.parse(readFileSync(new URL("../src/data/torstrasseV380-"+host.slice(7)+".json",import.meta.url),"utf8"));
}

test("both place names open the correct physical host on a continuous west–east street", () => {
  const ids=torstrasseHostsV380.map(row=>row.id);
  for (const [name,view] of Object.entries(torstrasseViewsV380)) {
    const id=torstrasseOpeningHostV380(name);
    const {bounds}=torstrasseHostsV380.find(row=>row.id===id)!;
    expect(view.target[0]).toBeGreaterThanOrEqual(bounds[0]);
    expect(view.target[2]).toBeLessThanOrEqual(bounds[3]);
    expect(ids).toContain(id!);
  }
  expect(torstrasseOpeningHostV380("Ostkreuz")).toBeUndefined();
  const shelters=new Set(), signals=new Set();
  let triangles=0, size=0;
  for (const id of ids) {
    const data=packet(id);
    triangles+=data.faces;
    size+=JSON.stringify(data).length;
    for (const [source] of data.shelters) {expect(shelters.has(source)).toBe(false);shelters.add(source);}
    for (const [source] of data.signals) {expect(signals.has(source)).toBe(false);signals.add(source);}
  }
  expect(ids.length).toBe(7);
  expect(shelters.size).toBe(3);
  expect(signals.size).toBe(72);
  expect(triangles).toBeGreaterThan(40000);
  expect(size).toBeLessThan(400000);
});

test("drawn and native pavements cover the five arms, leave all four U8 entrances open and join their landings",()=>{
  for(const native of [false,true]){
    const root=new Group();
    for(const host of torstrasseHostsV380){
      const part=createTorstrasseV380(packet(host.id),native);
      expect(part.children.length).toBeLessThanOrEqual(2);
      root.add(part);
    }
    root.updateMatrixWorld(true);
    const ray=new Raycaster(new Vector3(),new Vector3(0,-1,0));
    const ground:Mesh[]=[];
    root.traverse(object=>{if(object instanceof Mesh && !(object instanceof InstancedMesh))ground.push(object);});
    const hits=(x:number,z:number)=>{
      ray.ray.origin.set(x,20,z);
      return ray.intersectObjects(ground,false);
    };
    // Western, central, and eastern road samples plus openings left in the
    // 2014/15 carriageway survey at the actual signal-controlled crossings.
    for(const [x,z] of [[1084,-895],[1437,-1004],[1778,-1126],[1924,-1141],[2055,-1156],
      [2035.08,-1142.86],[2079.62,-1166.35],[2064.77,-1135.55],[2045.72,-1173.66],[2060.8,-1180.2],
      [2407,-1095],[2621,-1026],[2924,-897],[3010,-865]]){
      expect(hits(x,z).length).toBeGreaterThan(0);
    }
    for(const s of ROSENTHALER_STAIRS_V228){
      for(const along of [.1,.5,.9]) for(const across of [-.8,0,.8]){
        expect(hits(s.top[0]+s.ux*s.length*along+s.nx*across,s.top[1]+s.uz*s.length*along+s.nz*across)).toHaveLength(0);
      }
      const approach=hits(s.top[0]-s.ux*.55,s.top[1]-s.uz*.55);
      expect(approach.length).toBeGreaterThan(0);
      expect(Math.abs(approach[0].point.y-(native?s.nativeSurfaceY:s.surfaceY))).toBeLessThan(.25);
    }
  }
});

test("streamed detail counts its buffers, and cancellation leaves the physical host empty",async()=>{
  const entry={root:new Group(),origin:[2048,0,-1536],geometryBytes:0,bufferCount:0} as SurroundingChunkGeometry;
  await expect(attachTorstrasseV380(entry,"tor380-4_-3",false,AbortSignal.abort())).rejects.toThrow();
  expect(entry.root.children).toHaveLength(0);
  await attachTorstrasseV380(entry,"tor380-4_-3",false);
  expect(entry.root.children).toHaveLength(1);
  expect(entry.geometryBytes).toBeGreaterThan(100000);
  expect(entry.bufferCount).toBeGreaterThan(4);
});
