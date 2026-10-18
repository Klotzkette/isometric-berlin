import { expect, test } from "bun:test";
import { Color, Mesh } from "three";
import { gunzipSync } from "node:zlib";
import { createSurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { disposeSurroundingCityRoot } from "../src/SurroundingCity";
import { surroundingColourOwners, surroundingGenericColour } from "../src/surroundingCityColourV184";
import { refineOuterRoofsV230 } from "../src/outerHousePresentationV230";
const finish = <T>(g: Generator<void,T>): T => {let n=g.next();while(!n.done)n=g.next();return n.value;};

test("remaining outer roof paint preserves original walls, authored colours and ambiguous corners",()=>{
  const b={sourceId:"DEBEordinary",ring:[[0,0],[10,0],[10,10],[0,10]],holes:[],height:20,minHeight:0};
  const a=finish(surroundingColourOwners([b],3,-10,0,0,()=>false));
  const c=finish(surroundingColourOwners([b],3,-10,0,0,()=>false,true));
  const read=(o:typeof a,hex:number)=> {const rgb=new Color(hex).toArray().map(v=>Math.round(v*255));return surroundingGenericColour(o,0,0,...rgb as [number,number,number]);};
  expect(read(a,0xd3d0c3)).toEqual(read(c,0xd3d0c3));
  expect(read(a,0x9d978c)).not.toEqual(read(c,0x9d978c));
  expect(read(c,0x782345)).toBeUndefined();
  const ambiguous=finish(surroundingColourOwners([b,{...b,sourceId:"other"}],3,-10,0,0,()=>false,true));
  expect(read(ambiguous,0x9d978c)).toBeUndefined();
  expect(refineOuterRoofsV230("outer187-1_2")).toBeTrue();
  expect(refineOuterRoofsV230("alt-mitte-v169-1")).toBeFalse();
  expect(refineOuterRoofsV230("city183-1_2")).toBeFalse();
});

test("actual peripheral decoder retains every geometry index and allocated byte; new facade packets dispose",async()=>{
  const manifest=await Bun.file(new URL('../public/mesh/surrounding-berlin-v159/manifest.json',import.meta.url)).json();
  const descriptors=manifest.chunks.filter((c:any)=>c.id.startsWith('outerfacade230-')).slice(0,4);
  for(const desc of descriptors)for(const native of [false,true]){
    const f=desc[native?'minecraft':'drawn'];const p=JSON.parse(gunzipSync(await Bun.file(new URL('../public/mesh/surrounding-berlin-v159/'+f.url,import.meta.url)).arrayBuffer()).toString());
    const before=JSON.stringify(p),made=createSurroundingCityChunk(p,desc.id,native);
    try{
      expect(JSON.stringify(p)).toBe(before);expect(made.bufferCount).toBeLessThanOrEqual(2);
      expect(made.nav.buildings).toHaveLength(0);
      if(p.meshes.length){expect(made.root.userData.outerHousePanesV230).toBeGreaterThan(0);expect((made.root.children[0] as Mesh).geometry.index!.count).toBe(Buffer.from(p.meshes[0].indices,'base64').byteLength/4);}
    }finally{disposeSurroundingCityRoot(made.root);}
  }
});
