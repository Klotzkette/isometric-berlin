import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { applyPrimaryColoursV273 } from "../src/primaryColoursV273";
import { primaryHousePaletteV273, PRIMARY_WALL_SWATCHES_V273 } from "../src/primaryHousePaletteV273";
import { surroundingColourOwners, surroundingGenericColour } from "../src/surroundingCityColourV184";
import { applyGreyClusterColoursV263 } from "../src/greyClusterColoursV263";
import { applyOuterMaterialsV232 } from "../src/outerMaterialsV232";
import { applyOuterMaterialsV254 } from "../src/outerMaterialsV254";
import { applyOuterMaterialsV263 } from "../src/outerMaterialsV263";
import { applyKollwitzMaterialsV271 } from "../src/kollwitzMaterialsV271";
import type { SurroundingCityChunk, SurroundingPackedMesh } from "../src/SurroundingCityGeometry";
const json = (file:string) => JSON.parse(readFileSync(new URL(file,import.meta.url),"utf8"));
function finish<T>(it:Generator<void,T>):T {let s=it.next();while(!s.done)s=it.next();return s.value;}
const manifest = json("../public/mesh/surrounding-berlin-v159/manifest.json");
function packet(mode:string,id:string):SurroundingCityChunk {
 const d=manifest.chunks.find((v:{id:string})=>v.id===id);
 return JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/${d[mode].url}`,import.meta.url))).toString());
}
function vertices(p:SurroundingPackedMesh):Uint16Array {
 const pos=Buffer.from(p.positions,"base64"),col=Buffer.from(p.colors,"base64"),out=new Uint16Array(pos.length);
 for(let i=0;i<pos.length/6;i++)for(let j=0;j<3;j++){out[i*6+j]=pos.readUInt16LE(i*6+j*2);out[i*6+3+j]=col[i*3+j]*257;}
 return out;
}
test("all retained corner receipts only write prescribed colours and leave source geometry and navigation intact",()=>{
 let packets=0,rows=0;
 const index=json("../src/data/primaryColoursV273Index.json");
 for(let shard=0;shard<32;shard++){
  const bank=json(`../src/data/primaryColoursV273_${String(shard).padStart(2,"0")}.json`);
  expect(Object.keys(bank.packets)).toEqual(bank.keys);
  for(const key of bank.keys){
   expect(index[key]).toBe(shard);
   const [mode,id]=key.split(":"),p=packet(mode,id),before=JSON.stringify(p),native=mode==="minecraft";
   for(const record of bank.packets[key].records){
    const part=p.meshes[record.mesh],values=vertices(part),expected=values.slice();
    for(const [v,owner,role,low,high] of record.rows){
     const palette=primaryHousePaletteV273(record.owners[owner]),tone=role?palette.roof:palette.wall;
     const wash=!native&&!role&&low>=0&&high>low?.88+.13*Math.max(0,Math.min(1,(values[v*6+1]-low)/(high-low))):1;
     for(let c=0;c<3;c++)expected[v*6+3+c]=Math.min(255,Math.round(tone[c]*wash))*257;
    }
    expect(finish(applyPrimaryColoursV273(p,id,native,record.mesh,values,0,values.length/6))).toBe(record.rows.length);
    expect(values).toEqual(expected);rows+=record.rows.length;
   }
   expect(JSON.stringify(p)).toBe(before);packets++;
  }
 }
 expect(packets).toBe(Object.keys(index).length);expect(packets).toBeGreaterThan(2000);expect(rows).toBeGreaterThan(1000000);
},120000);
test("known source materials retain precedence over both corner and unique-owner fallback paint",()=>{
 for(const id of ["-8_-3","ring182--9_8","city183--9_10","outer187--22_-5","north190-9_-9","east200-4_-15","marzahn230-30_-1"]){
  if(!manifest.chunks.some((v:{id:string})=>v.id===id))continue;
  for(const mode of ["drawn","minecraft"]){
   const p=packet(mode,id),native=mode==="minecraft";
   const owners=finish(surroundingColourOwners(p.nav.buildings,p.nav.groundY,p.origin[1],p.origin[0],p.origin[2],undefined,true,true,primaryHousePaletteV273));
   p.meshes.forEach((part,mesh)=>{
    if(part.kind!=="city")return;
    const old=vertices(part),current=old.slice(),baseline=old.slice(),count=old.length/6;
    for(let at=0;at<current.length;at+=6){
     const tone=surroundingGenericColour(owners,current[at],current[at+2],current[at+3]/257,current[at+4]/257,current[at+5]/257);
     if(tone)for(let c=0;c<3;c++)current[at+3+c]=tone[c]*257;
    }
    finish(applyGreyClusterColoursV263(p,id,native,mesh,current,0,count,undefined,primaryHousePaletteV273));
    finish(applyPrimaryColoursV273(p,id,native,mesh,current,0,count));
    for(const apply of [applyOuterMaterialsV232,applyOuterMaterialsV254,applyOuterMaterialsV263,applyKollwitzMaterialsV271]){
     finish(apply(id,native,part,mesh,baseline,0,count));finish(apply(id,native,part,mesh,current,0,count));
    }
    for(let at=3;at<old.length;at+=6)for(let c=0;c<3;c++)if(baseline[at+c]!==old[at+c]&&current[at+c]!==baseline[at+c])throw Error(`Known material overwritten ${mode}:${id}:${at}`);
   });
  }
 }
});
test("shared source IDs have stable separate wall/roof choices without allocating per-owner palettes",()=>{
 const walls=new Set<string>(),roofs=new Set<string>();
 for(let i=0;i<2000;i++){
  const a=primaryHousePaletteV273(`DEBE00${i}`);expect(primaryHousePaletteV273(`DEBE00${i}`)).toBe(a);
  walls.add(a.wall.join());roofs.add(a.roof.join());
  expect(Math.max(...a.roof)).toBeLessThan(Math.min(...a.wall));
 }
 expect(walls.size).toBe(PRIMARY_WALL_SWATCHES_V273.length);expect(roofs.size).toBe(8);
});
test("wrong family, changed source and authored meshes fail closed without writes",()=>{
 const index=json("../src/data/primaryColoursV273Index.json"),key=Object.keys(index)[0],[mode,id]=key.split(":"),p=packet(mode,id);
 const bank=json(`../src/data/primaryColoursV273_${String(index[key]).padStart(2,"0")}.json`),mesh=bank.packets[key].records[0].mesh;
 const values=vertices(p.meshes[mesh]),original=values.slice(),native=mode==="minecraft";
 for(const field of ["positions","colors","indices"] as const){
  const changed=structuredClone(p);changed.meshes[mesh][field]="!"+changed.meshes[mesh][field].slice(1);
  expect(finish(applyPrimaryColoursV273(changed,id,native,mesh,values,0,values.length/6))).toBe(0);expect(values).toEqual(original);
 }
 expect(finish(applyPrimaryColoursV273(p,"unknown",native,mesh,values,0,values.length/6))).toBe(0);
 const changed=structuredClone(p);changed.meshes[mesh].kind="authored";
 expect(finish(applyPrimaryColoursV273(changed,id,native,mesh,values,0,values.length/6))).toBe(0);expect(values).toEqual(original);
});
