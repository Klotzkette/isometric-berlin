import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { clipEastRailSegmentV288, eastStadtbahnRailYV288, prepareEastStadtbahnV288, EAST_STADTBAHN_V288_KIND } from "../src/EastStadtbahnV288";
import type { SurroundingCityChunk } from "../src/SurroundingCityGeometry";
function finish<T>(g: Generator<void,T>): T { for(;;){const r=g.next();if(r.done)return r.value;} }
function chunk(id:string,native=false): SurroundingCityChunk { return JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/${id}.${native?'minecraft':'drawn'}.json.gz`,import.meta.url))).toString()); }
test("station-fit heights retain a coherent elevated interstation course",()=>{
  expect(eastStadtbahnRailYV288(-50)).toBe(13.08);expect(eastStadtbahnRailYV288(515)).toBe(10.65);
  let previous=20;for(let z=-50;z<=515;z++){const y=eastStadtbahnRailYV288(z);expect(y).toBeLessThanOrEqual(previous);expect(y).toBeGreaterThan(10.6);expect(eastStadtbahnRailYV288(z,true)).toBeGreaterThanOrEqual(11.25);previous=y;}
  expect(clipEastRailSegmentV288([-2,3],[7,3],[0,0,5,5])).toEqual([[0,3],[5,3]]);
  expect(clipEastRailSegmentV288([-2,-3],[7,-3],[0,0,5,5])).toBeNull();
});
test("real delivered packets gain raised rails while retaining every previous mesh/owner",()=>{
  for(const native of [false,true])for(const id of ['5_-1','5_0','6_0','6_1']){
    const old=chunk(id,native),made=finish(prepareEastStadtbahnV288(old,id,native));
    if(made===old){expect(id).toBe('6_1');continue;}
    expect(made.meshes.slice(0,-1)).toEqual(old.meshes);expect(made.nav.buildings).toBe(old.nav.buildings);expect(made.nav.ground).toBe(old.nav.ground);expect(made.nav.roads).toBe(old.nav.roads);
    const last=made.meshes.at(-1)!;expect(last.kind).toBe(EAST_STADTBAHN_V288_KIND);
    const b=Buffer.from(last.positions,'base64'),p=new Uint16Array(b.buffer,b.byteOffset,b.length/2);
    expect(p.length/3+old.meshes.reduce((n,m)=>n+Buffer.from(m.positions,'base64').length/6,0)).toBeLessThanOrEqual(400000);
    for(let i=1;i<p.length;i+=3)expect(p[i]/100+old.origin[1]).toBeGreaterThan(10.1);
    expect(finish(prepareEastStadtbahnV288(made,id,native))).toBe(made);
  }
});
test("changed actual source preserves its complete fallback",()=>{
  const old=chunk('5_0');const altered={...old,meshes:old.meshes.map(m=>m.kind==='alt-mitte-v169'?{...m,colors:m.colors.slice(0,-4)+'AAAA'}:m)};
  expect(finish(prepareEastStadtbahnV288(altered,'5_0'))).toBe(altered);
});
