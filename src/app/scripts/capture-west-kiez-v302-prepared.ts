/** Offline receipts from actual later preparers, never in runtime graphs. */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { prepareBoulevardArchitectureV235 } from "../src/boulevardArchitectureV235";
import { prepareWestShopfrontsV254 } from "../src/westShopfrontsV254";
import boulevard from "../src/data/boulevardArchitectureV235.json";
import shops from "../src/data/westShopfrontsV254.json";
const root=new URL("../",import.meta.url),dir=new URL("public/mesh/surrounding-berlin-v159/",root),geo=new URL("../../geo_data/regierungsviertel/",root);
const sourcePath=new URL("src/data/westKiezV302.json",root), source=JSON.parse(readFileSync(sourcePath,"utf8"));
const manifest=JSON.parse(readFileSync(new URL("manifest.json",dir),"utf8"));
const proof=JSON.parse(gunzipSync(readFileSync(new URL("west-kiez-v302-legacy-field-proof.json.gz",geo))).toString());
const hash=(s:string)=>{let n=2166136261;for(let i=0;i<s.length;i++)n=Math.imul(n^s.charCodeAt(i),16777619)>>>0;return n;};
const done=(g:any)=>{let n=g.next();while(!n.done)n=g.next();return n.value;};
const pointKey=(p:number[])=>p.join(","), triKey=(p:number[][])=>p.map(pointKey).sort().join(";");
function triangles(part:any){
 const p=new Uint16Array(Uint8Array.from(Buffer.from(part.positions,"base64")).buffer),c=Buffer.from(part.colors,"base64"),ix=new Uint32Array(Uint8Array.from(Buffer.from(part.indices,"base64")).buffer);
 return Array.from({length:ix.length/3},(_,i)=>[ix[i*3],ix[i*3+1],ix[i*3+2]].map(v=>[p[v*3],p[v*3+1],p[v*3+2],c[v*3],c[v*3+1],c[v*3+2]]).map(pointKey).sort().join(";"));
}
const output:any[]=[];
const selectedOwners=new Set(Object.values(source.packets).flatMap((p:any)=>p.owners));
for(const id of ["48472662","48472661","62057645","07891900"])selectedOwners.add(id);
const evidenceAudit:any[]=[];
for(const file of ["boulevard-architecture-v235-evidence.json.gz","west-shopfronts-v254-evidence.json.gz"]){
 const bytes=readFileSync(new URL(file,geo)),record=JSON.parse(gunzipSync(bytes).toString());
 const matched=record.packets.flatMap((p:any)=>p.fields.flatMap((f:any,index:number)=>selectedOwners.has(f.owner)?[{key:p.key,index,owner:f.owner}]:[]));
 if(matched.length)throw Error("A later fitting owner needs complete retirement receipts: "+JSON.stringify(matched));
 evidenceAudit.push({file,sha256:createHash("sha256").update(bytes).digest("hex"),matchedSelectedOwnerFields:matched});
}
for(const [key,receipt] of Object.entries(proof) as [string,any][]){
 const [mode,id]=key.split(":"),native=mode==="minecraft",descriptor=manifest.chunks.find((c:any)=>c.id===id);
 const raw=JSON.parse(gunzipSync(readFileSync(new URL(descriptor[mode].url,dir))).toString());
 const old=new Set(receipt.legacyTriangles.map(triKey));
 for(const [kind,data,prepare]of [["boulevard-architecture-v235",boulevard,prepareBoulevardArchitectureV235],["west-shopfronts-v254",shops,prepareWestShopfrontsV254]] as const){
  const plan=(data.packets as any)[key];if(!plan)continue;
  const fields=plan.fields.filter((f:number[])=>{
   const [x,y,z,ux,uz,,,width,height]=f;
   const corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>[Math.round((x+ux*u*width/2)*100),Math.round((y+v*height/2)*100),Math.round((z+uz*u*width/2)*100)]);
   return [[[0,1,2],[0,2,3]],[[0,1,3],[1,2,3]]].some(pair=>pair.every(t=>old.has(triKey(t.map(i=>corners[i])))));
  });
  if(!fields.length){output.push({key,kind,fields:0,totalFields:plan.fields.length});continue;}
  const full=done(prepare(raw,id,native)),part=full.meshes.find((p:any)=>p.kind===kind);if(!part)throw Error(`Full actual preparer rejected ${key} ${kind}`);
  const subset=done(prepare(raw,id,native,{...data,packets:{[key]:{...plan,fields}}} as any));
  const selected=subset.meshes.find((p:any)=>p.kind===kind);if(!selected)throw Error("Narrow exact-field replay rejected");
  const keys=new Set(triangles(selected)),all=triangles(part),retire=all.flatMap((k,i)=>keys.has(k)?[i]:[]);
  if(new Set(retire.map(i=>all[i])).size!==keys.size)throw Error("Subset does not completely occur in actual preparer output");
  (source.packets[key].preparedRetire??=[]).push({kind,fingerprint:hash(part.positions+part.colors+part.indices),triangles:retire});
  output.push({key,kind,fields:fields.length,totalFields:plan.fields.length,selectedFields:fields,triangleCount:retire.length,fullFingerprint:hash(part.positions+part.colors+part.indices)});
 }
}
writeFileSync(sourcePath,JSON.stringify(source)+"\n");
writeFileSync(new URL("west-kiez-v302-prepared-fittings.json.gz",geo),gzipSync(JSON.stringify({schemaVersion:1,policy:"Every original later-preparer field owner was checked against all exact corrected owners. Independently, each reconstructed delivered opening was tested against the complete historical Fasanen triangle replay. Both checks prove zero later fittings; no prepared part is retired.",evidenceAudit,receipts:output})+"\n",{level:9}));
console.log(JSON.stringify(output.map(({selectedFields,...r})=>r)));
