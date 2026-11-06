/** Capture exact original authored members in actual JSC/V8 constructors.
 * Output is external evidence; no retained model or source is rewritten. */
import {readFileSync,writeFileSync,mkdirSync,existsSync,lstatSync} from "node:fs";
import {resolve,dirname,isAbsolute,relative} from "node:path";
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";

const repo=resolve(import.meta.dir,"../../.."),requested=process.argv[2];
if(!requested||!isAbsolute(requested)||requested.split("/").includes(".."))throw Error("Fresh absolute external output required");
const output=resolve(requested);
if(!relative(repo,output).startsWith("..")||existsSync(output)||!existsSync(dirname(output)))throw Error("New output outside repository required");
for(let p=dirname(output);;p=dirname(p)){if(lstatSync(p).isSymbolicLink())throw Error("Symlink parent rejected");if(p===dirname(p))break;}
mkdirSync(output);
const entry=output+"/entry.ts";
// Instrument only source-row ownership, then prove every emitted old word
// against a separate unmodified real constructor in both engines.
let east=readFileSync(repo+"/src/app/src/EastParksV198.ts","utf8");
east=east.replace('q?: Quaternion','q?: Quaternion; captureOwner?:string').replace('const cells = new Map','let captureOwner:string|undefined;\n  const cells = new Map');
east=east.replaceAll('.boxes.push({','.boxes.push({captureOwner,').replaceAll('.rounds.push({','.rounds.push({captureOwner,');
east=east.replace('if(len>3){ // restrained relief rhythm; no reproduced inscription or invented text','if(len>3){ captureOwner=c.id; // exact authored relief row capture');
east=east.replace('rounded([a[0]+dx*t,4.77,a[1]+dz*t],[.25,.25,.25],0xb2aa96);}','rounded([a[0]+dx*t,4.77,a[1]+dz*t],[.25,.25,.25],0xb2aa96);}captureOwner=undefined;');
east=east.replace('const lo=last.p[axis]-last.size[axis]/2','if(last.captureOwner!==row.captureOwner)throw Error("Mixed-owner native merge");const lo=last.p[axis]-last.size[axis]/2');
east=east.replace('mesh.computeBoundingBox();mesh.computeBoundingSphere();mesh.name=`East parks v198 ${id} ${type}`;','mesh.computeBoundingBox();mesh.computeBoundingSphere();mesh.name=`East parks v198 ${id} ${type}`;root.userData.captureRows??={};root.userData.captureRows[mesh.name]=rows.map((r,i)=>({index:i,owner:r.captureOwner})).filter(r=>r.owner);');
east=east.replace(/from '(.\/[^']+)'/g,(_,path)=>"from "+JSON.stringify(resolve(repo,"src/app/src",path)));
east=east.replace("from 'three'","from "+JSON.stringify(repo+"/src/app/node_modules/three/build/three.module.js"));
writeFileSync(output+"/EastParksCapturedV322.ts",east,{flag:"wx"});

const code=String.raw`
import {readFileSync,writeFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {createTiergartenMonuments} from "__REPO__/src/app/src/TiergartenMonuments";
import {createEastParksV198} from "__REPO__/src/app/src/EastParksV198";
import {createEastParksV198 as createCapturedEast} from "__OUTPUT__/EastParksCapturedV322";
import eastSource from "__REPO__/src/app/src/data/eastParksV198.json";
import {createNorthParksV198} from "__REPO__/src/app/src/NorthParksV198";
import {correctParkTerrainV229} from "__REPO__/src/app/src/parkTerrainGeometryV229";
import drawnA from "__REPO__/src/app/src/data/northParksV198Drawn0.json";
import drawnB from "__REPO__/src/app/src/data/northParksV198Drawn1.json";
import nativeA from "__REPO__/src/app/src/data/northParksV198Native0.json";
import nativeB from "__REPO__/src/app/src/data/northParksV198Native1.json";
const R="__REPO__",E="__OUTPUT__",sha=(b:any)=>createHash("sha256").update(b).digest("hex"),raw=(a:any)=>Buffer.from(a.buffer,a.byteOffset,a.byteLength).toString("base64");
const street=JSON.parse(readFileSync(R+"/src/app/public/mesh/regierungsviertel/street-details.json","utf8")),ground=JSON.parse(readFileSync(R+"/src/app/public/mesh/regierungsviertel/ground-context.json","utf8"));
const byteControl=(v:any)=>{let h=2166136261;for(const c of JSON.stringify(v))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h;};
const component=(mesh:any,rows?:number[])=>{
 const instances=mesh.isInstancedMesh?rows??Array.from({length:mesh.count},(_,i)=>i):null;
 const matrix=instances?new Float32Array(instances.length*16):null,color=instances&&mesh.instanceColor?new Float32Array(instances.length*3):null;
 if(instances)for(let i=0;i<instances.length;i++){matrix!.set(mesh.instanceMatrix.array.subarray(instances[i]*16,instances[i]*16+16),i*16);if(color)color.set(mesh.instanceColor.array.subarray(instances[i]*3,instances[i]*3+3),i*3);}
 return {name:mesh.name,kind:instances?"instances":mesh.isLineSegments?"lines":"mesh",retire:true,
  attributes:Object.fromEntries(Object.entries(mesh.geometry.attributes).map(([k,a]:any)=>[k,{type:a.array.constructor.name,itemSize:a.itemSize,normalized:a.normalized,bytes:raw(a.array)}])),
  index:mesh.geometry.index?{type:mesh.geometry.index.array.constructor.name,bytes:raw(mesh.geometry.index.array)}:null,
  instances:instances?{count:instances.length,matrix:raw(matrix),color:color?raw(color):null}:null};
};
function release(root:any){const resources=new Set<any>();root.traverse((o:any)=>{if(o.geometry)resources.add(o.geometry);if(o.isInstancedMesh)resources.add(o);for(const m of[o.material,o.userData.dayMaterial,o.userData.nightMaterial,o.userData.schwellenraumMaterial].flat())if(m?.dispose)resources.add(m);});for(const r of resources)r.dispose();root.clear();}
const records:any[]=[];
for(const [key,id]of[["berlin","node/313826576"],["pyramide","node/4224142271"]]){
const poi=street.monuments.find((p:any)=>p.osm_key===id);
if(!poi||street.monuments.filter((p:any)=>p.osm_key===id).length!==1)throw Error("Changed exact artwork POI");
const berlin=createTiergartenMonuments({...street,monuments:[poi]},ground)!;
try{const components:any[]=[];berlin.traverse((o:any)=>{if(o.geometry)components.push(component(o));});
 records.push({key,native:false,groupName:berlin.name,sourceRecord:{id:poi.osm_key,poi},components,
  sourceControls:{street:byteControl(street),ground:byteControl(ground)},otherSameNamedPOIs:street.monuments.filter((p:any)=>p.name===poi.name&&p.osm_key!==poi.osm_key).map((p:any)=>p.osm_key)});
}finally{release(berlin);}
}
const colours=new Set([0x4C615A,0x53675E,0x506158]);
for(const native of[false,true]){
 const root=createNorthParksV198(native),modelA=native?nativeA:drawnA,modelB=native?nativeB:drawnB,selected:any[]=[];
 try{
  for(const model of[modelA,modelB])for(const original of model.cells){
   const ordinals=original.boxes.flatMap((r:number[],i:number)=>colours.has(r[native?6:7])?[i]:[]);if(!ordinals.length)continue;
   const corrected=correctParkTerrainV229(original,native),name="North parks v198 "+original.id+": bounded architecture and mapped barriers",matches=root.children.filter(o=>o.name===name);
   if(matches.length!==1)throw Error("Missing or duplicated actual Mother host");const mesh=matches[0]as any;
   selected.push({name,originalRows:ordinals.map(i=>original.boxes[i]),correctedRows:ordinals.map(i=>corrected.boxes[i]),globalRows:ordinals,
    actualHostCount:mesh.count,component:component(mesh,ordinals),
    fullMatrixSha256:sha(Buffer.from(mesh.instanceMatrix.array.buffer,mesh.instanceMatrix.array.byteOffset,mesh.instanceMatrix.array.byteLength)),
    fullColorSha256:sha(Buffer.from(mesh.instanceColor.array.buffer,mesh.instanceColor.array.byteOffset,mesh.instanceColor.array.byteLength))});
  }
  if(selected.length!==1||selected[0].globalRows.length!==3)throw Error("Exactly three old Mother sculpture members required");
  records.push({key:"schoenholz-mother",native,groupName:root.name,sourceRecord:{id:"node/2274670443",sourceRows:selected[0].originalRows,correctedRows:selected[0].correctedRows},components:selected.map(r=>r.component),selected});
 }finally{release(root);}
}

for(const native of[false,true]){
 const actual=createEastParksV198(native),tagged=createCapturedEast(native);
 try{
  if(actual.children.length!==tagged.children.length)throw Error("Instrumentation child mismatch");
  const components:any[]=[],selected:any[]=[];
  for(let i=0;i<actual.children.length;i++){
   const a=actual.children[i]as any,b=tagged.children[i]as any;
   if(a.name!==b.name||a.count!==b.count||JSON.stringify(Object.keys(a.geometry.attributes))!==JSON.stringify(Object.keys(b.geometry.attributes)))throw Error("Instrumentation host mismatch");
   const arrays=(o:any)=>[...Object.values(o.geometry.attributes).map((v:any)=>v.array),o.geometry.index?.array,o.instanceMatrix?.array,o.instanceColor?.array].filter(Boolean);
   const aa=arrays(a),bb=arrays(b);if(aa.some((v:any,j:number)=>raw(v)!==raw(bb[j])))throw Error("Instrumentation changes actual old bytes");
   const captured=tagged.userData.captureRows[a.name]??[];if(!captured.length)continue;
   const rows=captured.map((r:any)=>r.index);components.push(component(a,rows));selected.push({name:a.name,actualHostCount:a.count,rows:captured,fullStreamsSha256:aa.map((v:any)=>sha(Buffer.from(v.buffer,v.byteOffset,v.byteLength)))});
  }
  const actualOwners=new Set(selected.flatMap(s=>s.rows.map((r:any)=>r.owner)));if(actualOwners.size!==16||eastSource.cenotaphs.some(c=>!actualOwners.has(c.id)))throw Error("All sixteen exact cenotaph owners required");
  records.push({key:"treptow",native,groupName:actual.name,sourceRecord:{id:eastSource.memorialId,cenotaphs:eastSource.cenotaphs},components,selected});
 }finally{release(actual);release(tagged);}
}
const sources=["src/app/src/EastParksV198.ts","src/app/src/data/eastParksV198.json","src/app/src/TiergartenMonuments.ts","src/app/src/NorthParksV198.ts","src/app/src/parkTerrainGeometryV229.ts","src/app/src/data/parkTerrainV229Changes.json","src/app/src/data/northParksV198Drawn0.json","src/app/src/data/northParksV198Drawn1.json","src/app/src/data/northParksV198Native0.json","src/app/src/data/northParksV198Native1.json","src/app/public/mesh/regierungsviertel/street-details.json","src/app/public/mesh/regierungsviertel/ground-context.json"];
writeFileSync(E+"/"+(process.argv[2]??"unknown")+".json",JSON.stringify({schemaVersion:1,engine:process.versions,sources:Object.fromEntries(sources.map(p=>[p,sha(readFileSync(R+"/"+p))])),records}));
console.log("captured",records.map(r=>({key:r.key,native:r.native,components:r.components.length,selected:r.components.reduce((n:any,c:any)=>n+(c.instances?.count??0),0)})));
`;
writeFileSync(entry,code.replaceAll("__REPO__",repo).replaceAll("__OUTPUT__",output),{flag:"wx"});
const built=await Bun.build({entrypoints:[entry],target:"node",format:"esm",outdir:output+"/bundle",plugins:[{name:"actual-constructor-assets",setup(b){b.onResolve({filter:/\?(raw|url)$/},a=>({path:resolve(a.resolveDir,a.path),namespace:"asset"}));b.onLoad({filter:/.*/,namespace:"asset"},a=>{const i=a.path.lastIndexOf("?");return{loader:"js",contents:"export default "+JSON.stringify(a.path.slice(i+1)==="raw"?readFileSync(a.path.slice(0,i),"utf8"):a.path.slice(0,i))};});}}]});
if(!built.success)throw Error(String(built.logs));
const results=[];
for(const engine of["bun","node"]){const result=spawnSync(engine,[output+"/bundle/entry.js",engine],{encoding:"utf8",maxBuffer:1024*1024});writeFileSync(output+"/"+engine+".log",result.stdout+result.stderr,{flag:"wx"});if(result.status!==0)throw Error(engine+" constructor failed: "+result.stderr);const bytes=readFileSync(output+"/"+engine+".json");results.push({engine,bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex")});}
writeFileSync(output+"/capture-receipt.json",JSON.stringify({schemaVersion:1,results})+"\n",{flag:"wx"});console.log(JSON.stringify(results));
