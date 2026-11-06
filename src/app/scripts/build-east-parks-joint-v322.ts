/** Compose only the actual, disjoint Archenhold/Treptow host retirements. */
import{readFileSync,writeFileSync}from"node:fs";
import{createHash}from"node:crypto";
import{Mesh,InstancedMesh,type BufferAttribute}from"three";
import{createEastParksV198}from"../src/EastParksV198";
import previous from"../src/data/archenholdPreviousV322.json";
import east from"../src/data/eastParksV198.json";
import navigation from"../src/data/eastParksV198Navigation.json";
const input=process.argv[2],output=process.argv[3],proof=process.argv[4];if(![input,output,proof].every(s=>s?.startsWith("/")))throw Error("Absolute capture/output/proof paths required");
const raw=readFileSync(input),capture=JSON.parse(raw.toString());const hash=(v:unknown)=>{const s=JSON.stringify(v);let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;return h;};
if(hash(previous)!==2832891587)throw Error("Original Archenhold receipt changed");
const bytes=(a:ArrayBufferView)=>{let h=2166136261;for(const b of new Uint8Array(a.buffer,a.byteOffset,a.byteLength))h=Math.imul(h^b,16777619)>>>0;return h;};
const attr=(a:BufferAttribute)=>({type:a.array.constructor.name,itemSize:a.itemSize,count:a.count,normalized:a.normalized,hash:bytes(a.array)});
const material=(m:any)=>({color:m.color.toArray(),type:m.type,vertexColors:m.vertexColors,side:m.side,...(m.isMeshStandardMaterial?{roughness:m.roughness,metalness:m.metalness}:{})});
const variants:any={},audits:any[]=[];
for(const native of[false,true]){const root=createEastParksV198(native);try{const record=capture.records.find((r:any)=>r.key==="treptow"&&r.native===native);if(!record||JSON.stringify(record.sourceRecord.cenotaphs)!==JSON.stringify(east.cenotaphs))throw Error("Treptow original source mismatch");
 const variant=native?"minecraft":"drawn-worker",base=previous.recipes.variants[variant],parts=structuredClone(base.parts)as any[];const retired=new Map<string,Set<number>>(parts.map(p=>[p.name,new Set(p.retire)]));
 for(const selected of record.selected){const found=root.children.filter(o=>o.name===selected.name);if(found.length!==1||!(found[0]instanceof InstancedMesh))throw Error("Exact original instance host missing");const m=found[0],g=m.geometry;if(m.count!==selected.actualHostCount)throw Error("Changed original count");
  let p=parts.find(p=>p.name===m.name);if(!p){p={name:m.name,parentName:root.name,matrix:m.matrix.toArray(),attributes:Object.fromEntries(Object.entries(g.attributes).map(([k,a])=>[k,attr(a as BufferAttribute)])),index:g.index?{type:g.index.array.constructor.name,count:g.index.count,hash:bytes(g.index.array)}:null,instances:{count:m.count,matrixHash:bytes(m.instanceMatrix.array),colorHash:m.instanceColor?bytes(m.instanceColor.array):null},materials:{day:material(m.userData.dayMaterial),night:material(m.userData.nightMaterial)},retireKind:"instances",retire:[],outside:null};parts.push(p);retired.set(m.name,new Set());}
  const set=retired.get(m.name)!;for(const r of selected.rows){if(!Number.isSafeInteger(r.index)||r.index<0||r.index>=m.count||set.has(r.index))throw Error("Duplicate/shared Archenhold/Treptow retirement");set.add(r.index);}p.retire=[...set].sort((a,b)=>a-b);
 }
 variants[variant]={captureSha256:createHash("sha256").update(raw).digest("hex"),parts};audits.push({native,originalCounts:record.selected.map((s:any)=>({name:s.name,count:s.actualHostCount,retired:s.rows.length})),unionParts:parts.map(p=>({name:p.name,retired:p.retire.length})),control:hash(variants[variant]),disjoint:true});
 }finally{const resources=new Set<any>();root.traverse((o:any)=>{if(o.geometry)resources.add(o.geometry);if(o.isInstancedMesh)resources.add(o);for(const m of[o.material,o.userData.dayMaterial,o.userData.nightMaterial].flat())if(m?.dispose)resources.add(m);});for(const r of resources)r.dispose();root.clear();}}
const oldNavigation=navigation.filter(p=>previous.sourceBuildings.some(q=>q.id===p.owner));if(oldNavigation.length!==3)throw Error("Complete old navigation family missing");
const value={schemaVersion:1,archenholdControl:2832891587,sourceBuildings:previous.sourceBuildings,sourceCenotaphs:east.cenotaphs,oldNavigation,recipes:{schemaVersion:1,variants}};
writeFileSync(output,JSON.stringify(value)+"\n");writeFileSync(proof,JSON.stringify({schemaVersion:1,inputSha256:createHash("sha256").update(raw).digest("hex"),profileControl:hash(value),audits},null,2)+"\n");console.log(JSON.stringify({control:hash(value),audits}));
