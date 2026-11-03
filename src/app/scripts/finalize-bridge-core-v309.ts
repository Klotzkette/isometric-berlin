/** Pin only the explicit derived recipe; original controls never change. */
import {readFileSync,writeFileSync}from'node:fs';
import {resolve}from'node:path';
const root=resolve(import.meta.dir,'../../..'),base=JSON.parse(readFileSync(resolve(root,'src/app/src/data/coreTerrainContactV307.json'),'utf8'));
const path=resolve(root,'src/app/src/data/gesundbrunnenBridgeCoreV309Delta.json'),delta=JSON.parse(readFileSync(path,'utf8'));
const fnv=(value:unknown)=>{const text=JSON.stringify(value);let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619)>>>0;return h;};
for(const[key,control]of Object.entries(delta.baseVariantControls))if(fnv(base.variants[key])!==control)throw Error('The immutable original Core variant changed: '+key);
const variants={...base.variants};
for(const[key,patch]of Object.entries(delta.variants)as[string,{parts:any[]}][]){
 const original=base.variants[key];let matched=0;
 const parts=original.parts.map((part:any)=>{const p=patch.parts.find(p=>p.name===part.name&&p.parentName===part.parentName&&(p.batchId??null)===(part.batchId??null));if(!p)return part;matched++;p.basePartControl=fnv(part);const old=new Set(part.retire);if(p.retire.some((id:number)=>old.has(id)))throw Error('Overlapping old/new source retire ordinals');return{...part,retire:[...part.retire,...p.retire].sort((a:number,b:number)=>a-b),outsideAdditions:p.outsideAdditions};});
 if(matched!==patch.parts.length)throw Error('Missing or ambiguous complete base part');variants[key]={...original,parts};
}
delta.composedControls=Object.fromEntries(Object.entries(variants).map(([key,value])=>[key,fnv(value)]));writeFileSync(path,JSON.stringify(delta));console.log(JSON.stringify({baseVariantControls:delta.baseVariantControls,composedControls:delta.composedControls,parts:delta.variants['drawn-worker'].parts.map((p:any)=>({name:p.name,batchId:p.batchId,basePartControl:p.basePartControl,retire:p.retire,outsideTriangles:p.outsideAdditions.reduce((n:number,q:any)=>n+q.triangles,0)}))}));
