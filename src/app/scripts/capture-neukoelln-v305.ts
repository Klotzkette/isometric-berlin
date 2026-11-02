/** Offline actual predecessor replay, before the v305 required replacements. */
import {readFileSync,writeFileSync} from "node:fs";
import {gzipSync,gunzipSync}from "node:zlib";
import {resolve}from "node:path";
import {BufferAttribute,InstancedMesh,Mesh}from "three";
import {prepareSurroundingQuarterPredecessorV303}from "../src/SurroundingCityGeometry";
import {createDistrictTownhallsV227}from "../src/DistrictTownhallsV227";
import {surroundingPacketFingerprint}from "../src/surroundingPacketFingerprint";
const repo=resolve(import.meta.dir,"../../.."), raw=resolve(repo,"geo_data/regierungsviertel/raw/neukoelln-v305");
function finish<T>(g:Generator<void,T>):T{let r=g.next();while(!r.done)r=g.next();return r.value;}
function hash(texts:readonly string[]){let h=2166136261;for(const s of texts)for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;return h;}
function bytes(a:ArrayBufferView){let h=2166136261;for(const b of new Uint8Array(a.buffer,a.byteOffset,a.byteLength))h=Math.imul(h^b,16777619)>>>0;return h;}
const parts=(p:{meshes:{kind:string;positions:string;colors:string;indices:string}[]})=>p.meshes.map((m,mesh)=>({mesh,kind:m.kind,fingerprint:finish(surroundingPacketFingerprint(m))}));
const pins:Record<string,unknown>={};
for(const id of["ring182-7_8","ring182-8_8"])for(const mode of["drawn","minecraft"]){
 const path=resolve(repo,`src/app/public/mesh/surrounding-berlin-v159/${id}.${mode}.json.gz`),p=JSON.parse(gunzipSync(readFileSync(path)).toString());
 const original={records:parts(p),navGuard:hash([JSON.stringify(p.nav)]),lineGuard:p.lines?hash([p.lines.positions,p.lines.colors??""]):null};
 const prepared=finish(prepareSurroundingQuarterPredecessorV303(p,id,mode==="minecraft",{neighbourhoodV300:true,westKiezV302:true,southFidelityV294:true,tachelesFrontsV270:true,littenStadthausV297:true,wallGalleryV298:true,stralauSisyphosV299:true}));
 writeFileSync(resolve(raw,`${id}.${mode}.prepared.json.gz`),gzipSync(JSON.stringify(prepared)+"\n",{level:9}));
 pins[`${mode}:${id}`]={...original,preparedRecords:parts(prepared),preparedNavGuard:hash([JSON.stringify(prepared.nav)]),preparedLineGuard:prepared.lines?hash([prepared.lines.positions,prepared.lines.colors??""]):null};
}
writeFileSync(resolve(raw,"prepared-pins.json"),JSON.stringify(pins)+"\n");
const batches=[];
for(const native of[false,true]){
 const group=createDistrictTownhallsV227(native);
 const selected=group.children.filter(c=>c.userData.siteKey==="neukoelln");
 const rows=selected.map(c=>{
  if(!(c instanceof Mesh))throw Error("Unexpected legacy townhall child");
  const attributes=Object.fromEntries(Object.entries(c.geometry.attributes).map(([k,a])=>[k,{itemSize:a.itemSize,normalized:a.normalized,count:a.count,bytes:bytes(a.array)}]));
  return {name:c.name,attributes,index:c.geometry.index?{count:c.geometry.index.count,bytes:bytes(c.geometry.index.array)}:null,instanceCount:c instanceof InstancedMesh?c.count:0,matrix:c instanceof InstancedMesh?bytes(c.instanceMatrix.array):null,color:c instanceof InstancedMesh&&c.instanceColor?bytes(c.instanceColor.array):null};
 });
 batches.push({native,children:rows});
 group.traverse(c=>{if(c instanceof Mesh){c.geometry.dispose();for(const m of Array.isArray(c.material)?c.material:[c.material])m.dispose();if(c instanceof InstancedMesh)c.dispose();}});group.clear();
}
writeFileSync(resolve(repo,"src/app/src/data/neukoellnLandmarksV305Previous.json"),JSON.stringify({schemaVersion:1,batches})+"\n");
console.log(JSON.stringify({packets:Object.keys(pins),legacy:batches.map(b=>({native:b.native,children:b.children.map(c=>({name:c.name,count:c.instanceCount}))}))}));
