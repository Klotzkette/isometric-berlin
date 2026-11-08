import {expect,test} from "bun:test";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {InterleavedBufferAttribute,Mesh} from "three";
import index from "../src/data/publicInstitutionsV326Index.json";
import {publicInstitutionsManifestV326 as manifest} from "../src/PublicInstitutionsV326";
import {buildSurroundingCityChunk,validNavigation,type SurroundingCityChunk} from "../src/SurroundingCityGeometry";
import {disposeSurroundingCityRoot} from "../src/disposeSurroundingCityRootV323";

const sha=(b:Uint8Array)=>createHash("sha256").update(b).digest("hex");
function drain<T>(steps:Generator<void,T>):T{for(;;){const next=steps.next();if(next.done)return next.value;}}
function packet(entry:typeof index.chunks[number],native:boolean):SurroundingCityChunk{
 const d=native?entry.minecraft:entry.drawn,bytes=readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/${d.url}`,import.meta.url));
 expect(bytes.byteLength).toBe(d.bytes);expect(sha(bytes)).toBe(d.sha256);
 const raw=gunzipSync(bytes);expect(raw.byteLength).toBe(d.decodedBytes);return JSON.parse(raw.toString());
}

test("finite source-family manifest retains separate exact packet hashes and original unbuffered footprint",()=>{
 expect(manifest.chunks).toBe(index.chunks);expect(manifest.footprint).toBe(index.footprint);
 expect(new Set(index.chunks.map(p=>p.id)).size).toBe(index.chunks.length);
 expect(index.counts.families).toBeGreaterThan(3000);expect(index.counts.parts).toBeGreaterThan(7000);
 expect(index.chunks.every(p=>p.id.startsWith("publicInstitutions326-")&&p.bounds[2]-p.bounds[0]===512&&p.bounds[3]-p.bounds[1]===512)).toBeTrue();
 for(const p of index.chunks)for(const d of [p.drawn,p.minecraft]){expect(d.decodedBytes).toBeLessThanOrEqual(12*1024*1024);expect(d.sha256).toMatch(/^[a-f0-9]{64}$/);}
});

test("largest actual Drawn and Native packets use the real bounded decoder without mutating source sheets or navigation",()=>{
 const selected=new Map<string,typeof index.chunks[number]>();
 for(const mode of ["drawn","minecraft"] as const){const sorted=[...index.chunks].sort((a,b)=>b[mode].decodedBytes-a[mode].decodedBytes);for(const q of sorted.slice(0,2))selected.set(q.id,q);}
 for(const entry of selected.values())for(const native of [false,true]){
  const raw=packet(entry,native),before=JSON.stringify(raw);
  expect(validNavigation(raw.nav)).toBeTrue();
  const built=drain(buildSurroundingCityChunk(raw,entry.id,native,false));
  try{
   expect(JSON.stringify(raw)).toBe(before);expect(built.nav).toEqual(raw.nav);expect(built.geometryBytes).toBeLessThanOrEqual(24*1024*1024);
   for(const object of built.root.children){if(!(object instanceof Mesh))continue;
    const p=object.geometry.getAttribute("position");expect(p instanceof InterleavedBufferAttribute).toBeTrue();
    const ix=object.geometry.index!;expect(ix.count).toBeLessThanOrEqual(2400000);expect(p.count).toBeLessThanOrEqual(400000);
    if(native){for(let n=0;n<ix.count;n+=3){const a=ix.getX(n),b=ix.getX(n+1),c=ix.getX(n+2);
     const axes=[p.getX(a)===p.getX(b)&&p.getX(b)===p.getX(c),p.getY(a)===p.getY(b)&&p.getY(b)===p.getY(c),p.getZ(a)===p.getZ(b)&&p.getZ(b)===p.getZ(c)];expect(axes.filter(Boolean).length).toBeGreaterThanOrEqual(1);
    }}
   }
   for(const b of built.nav.buildings){expect(b.sourceId).toMatch(/^DEBE/);if(native){expect(b.nativeRoofCaps?.length).toBeGreaterThan(0);expect(b.roofTriangles).toBeUndefined();}else expect(b.roofTriangles?.length).toBeGreaterThan(0);}
  }finally{disposeSurroundingCityRoot(built.root);}
 }
},30000);

test("cancellation and malformed new packet admission preserve the complete original",()=>{
 const entry=index.chunks.find(p=>p.drawn.decodedBytes>50000)!,raw=packet(entry,false),before=JSON.stringify(raw);
 const iterator=buildSurroundingCityChunk(raw,entry.id,false,false);expect(iterator.next().done).toBeFalse();iterator.return(undefined as never);expect(JSON.stringify(raw)).toBe(before);
 const bad=structuredClone(raw);bad.nav.buildings[0].height=NaN;
 expect(()=>drain(buildSurroundingCityChunk(bad,entry.id,false,false))).toThrow("Invalid surrounding-city chunk");expect(JSON.stringify(raw)).toBe(before);
});
