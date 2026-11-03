/** Capture actual delivered constructors, including v215's already filtered BWK rows. */
import {Mesh,InstancedMesh} from "three";
import {createHospitalRecognitionV228} from "../src/HospitalRecognitionV228";
import {createHospitalEnvelopesV228} from "../src/HospitalEnvelopesV228";
import {createBundeswehrHospitalV214} from "../src/BundeswehrHospitalV214";
import {correctedHospitalFittingsV215} from "../src/bundeswehrHospitalV215Profile";
import source from "../src/data/bundeswehrHospitalV214.json";
function bytes(a:ArrayBufferView){let h=2166136261;for(const b of new Uint8Array(a.buffer,a.byteOffset,a.byteLength))h=Math.imul(h^b,16777619)>>>0;return h;}
function pin(mesh:Mesh){
 const g=mesh.geometry;
 return {name:mesh.name,site:mesh.userData.siteKey??"bundeswehr",attributes:Object.fromEntries(Object.entries(g.attributes).map(([k,a])=>[k,{count:a.count,itemSize:a.itemSize,normalized:a.normalized,bytes:bytes(a.array)}])),
  index:g.index?{count:g.index.count,bytes:bytes(g.index.array)}:null,
  instanceCount:mesh instanceof InstancedMesh?mesh.count:null,
  matrix:mesh instanceof InstancedMesh?bytes(mesh.instanceMatrix.array):null,
  color:mesh instanceof InstancedMesh&&mesh.instanceColor?bytes(mesh.instanceColor.array):null};
}
const batches=[];
for(const native of [false,true]){
 const children=[];
 for(const root of [createHospitalRecognitionV228(native),createHospitalEnvelopesV228(native)]){
  root.traverse(o=>{if(o instanceof Mesh&&["benjamin-franklin","friedrichshain"].includes(o.userData.siteKey))children.push(pin(o));});
 }
 const root=createBundeswehrHospitalV214(native);
 const mesh=root.children.find(c=>c instanceof InstancedMesh) as InstancedMesh;
 if(!mesh)throw Error("Delivered BWK batch missing");
 const rows=correctedHospitalFittingsV215(native?source.blocks:source.boxes,native);
 const selected=rows.flatMap((row,index)=>{
  const role=row[native?7:8],face=typeof role==="string"?Number(role.split(":")[0]):-1;
  if(face<43||face>50)return [];
  return [{index,matrix:Array.from(mesh.instanceMatrix.array.slice(index*16,index*16+16))}];
 });
 if(!selected.length||rows.length!==mesh.count)throw Error("BWK source-face ownership missing");
 batches.push({native,children,bundeswehr:{...pin(mesh),rows:selected}});
}
await Bun.write(Bun.argv[2],JSON.stringify({schemaVersion:1,batches}));
