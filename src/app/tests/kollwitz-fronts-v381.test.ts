import {expect,test} from "bun:test";
import {readFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {Box3,Group,Mesh} from "three";
import {attachKollwitzFrontsV381} from "../src/kollwitzFrontsV381";
import {kollwitzFrontHostsV381} from "../src/kollwitzFrontsIndexV381";
import {kollwitzFrontViewsV381} from "../src/kollwitzFrontViewsV381";
import {disposeSurroundingCityRoot} from "../src/disposeSurroundingCityRootV323";
import type {SurroundingChunkGeometry,SurroundingCityChunk} from "../src/SurroundingCityGeometry";

function tile(host:string,native=false):SurroundingChunkGeometry {
  const family=native?"minecraft":"drawn";
  const url=new URL(`../public/mesh/surrounding-berlin-v159/${host}.${family}.json.gz`,import.meta.url);
  const q=JSON.parse(gunzipSync(readFileSync(url)).toString()) as SurroundingCityChunk;
  const root=new Group();
  root.position.fromArray(q.origin);
  return {root,origin:q.origin,nav:q.nav,bufferCount:0,geometryBytes:0};
}
test("the registered elevations follow the actual two receiving shells in both families",async()=>{
  const expectedOwners=new Set<string>();
  for(const native of [false,true]){
    const owners=new Set<string>();
    for(const host of kollwitzFrontHostsV381){
      const entry=tile(host,native), nav=entry.nav, signal=new AbortController().signal;
      await Promise.all([attachKollwitzFrontsV381(entry,host,native,signal),attachKollwitzFrontsV381(entry,host,native,signal)]);
      const parts:Mesh[]=[];
      entry.root.traverse(o=>{if(o instanceof Mesh)parts.push(o);});
      expect(parts.length).toBe(1);
      const mesh=parts[0],g=mesh.geometry,index=g.index!;
      expect(mesh.userData.keepInMinecraft).toBe(native);
      const ext=new Box3().setFromObject(mesh);
      expect(ext.min.x).toBeGreaterThanOrEqual(entry.origin[0]-.006);
      expect(ext.max.x).toBeLessThanOrEqual(entry.origin[0]+512.006);
      expect(ext.min.y).toBeGreaterThan(2.8); expect(ext.max.y).toBeLessThan(34);
      expect(entry.bufferCount).toBe(3); expect(entry.nav).toBe(nav);
      expect(entry.geometryBytes).toBe(index.array.byteLength+g.getAttribute("position").array.byteLength+g.getAttribute("color").array.byteLength);
      let max=0;
      for(let j=0;j<index.count;j++)max=Math.max(max,index.getX(j));
      expect(max).toBe(g.getAttribute("position").count-1);
      if(host==="6_-4"&&native)expect(max).toBeGreaterThan(65535);
      for(const id of mesh.userData.facadeOwners)owners.add(id);
      disposeSurroundingCityRoot(entry.root);
    }
    expect(owners.size).toBe(32);
    expect(owners.has("DEBE03YY600004DV")).toBeFalse();
    expect(owners.has("DEBE03YY600007vG")).toBeFalse();
    if(!native)for(const id of owners)expectedOwners.add(id);
    else expect([...owners].sort()).toEqual([...expectedOwners].sort());
  }
});
test("aborted, unrelated or stale owner sets never admit new surfaces",async()=>{
  const entry=tile("6_-4");
  await attachKollwitzFrontsV381(entry,"6_-4",false,AbortSignal.abort());
  await attachKollwitzFrontsV381(entry,"5_-5",false,new AbortController().signal);
  entry.nav={...entry.nav,buildings:[]};
  await attachKollwitzFrontsV381(entry,"6_-4",false,new AbortController().signal);
  expect(entry.root.children.length).toBe(0);expect(entry.geometryBytes).toBe(0);
  for(const pose of Object.values(kollwitzFrontViewsV381))expect(kollwitzFrontHostsV381.has(Math.floor(pose.target[0]/512)+"_"+Math.floor(pose.target[2]/512))).toBeTrue();
});
