/** Build the actual Worker once for both engines; retain no generated fixture. */
import{readFileSync,mkdtempSync,rmSync}from"node:fs";
import{spawnSync}from"node:child_process";
import{tmpdir}from"node:os";
import{join}from"node:path";
import{fileURLToPath}from"node:url";
import{createHash}from"node:crypto";
import{BufferAttribute,BufferGeometry,Group,Mesh}from"three";
import type{NorthCoreTerrainRecipesV309}from"../../src/NorthCoreTerrainV309";
import profile from"../../src/data/coreWorkerV8V311.json";
const sha=(b:Uint8Array)=>createHash("sha256").update(b).digest("hex");
export function installActualV8Park1V311(world:Group,source:NorthCoreTerrainRecipesV309){
 const directory=mkdtempSync(join(tmpdir(),"berlin-v8-source-v311-"));
 try{
  const script=fileURLToPath(new URL("../../scripts/capture-core-worker-engines-v311.ts",import.meta.url));
  const run=spawnSync(process.execPath,[script,directory],{encoding:"utf8",timeout:45000,maxBuffer:2*1024*1024});if(run.status!==0)throw Error("Real V8/JSC worker reproduction failed: "+run.stderr+run.stdout);
  const positions=readFileSync(join(directory,"node-v8-park1.positions.bin")),indices=readFileSync(join(directory,"node-v8-park1.indices.bin"));
  if(sha(positions)!==profile.part.positionSha256||sha(indices)!==profile.part.indexSha256)throw Error("V8 production buffers differ from actual-browser full-byte witness");
  const candidates:Mesh[]=[];world.traverse(o=>{if(o instanceof Mesh&&o.name===profile.part.name&&o.parent?.userData.progressiveWorldBatchId===profile.part.batchId)candidates.push(o);});if(candidates.length!==1)throw Error("Unique actual Park1 source required");
  const mesh=candidates[0],old=source.variants["drawn-worker"].parts.find(p=>p.name===profile.part.name&&p.batchId===profile.part.batchId)!;
  const p=new Float32Array(positions.buffer,positions.byteOffset,positions.byteLength/4).slice(),ix=new Uint32Array(indices.buffer,indices.byteOffset,indices.byteLength/4).slice(),a=mesh.geometry.getAttribute("position").array,oldWords=new Uint32Array(a.buffer,a.byteOffset,a.byteLength/4),newWords=new Uint32Array(p.buffer),oldIndex=mesh.geometry.index!.array,local=new Uint32Array(old.retire.length*9);let at=0,shifted=0;
  for(const triangle of old.retire){if(triangle>=profile.part.oldTriangleInterval[0]&&triangle<profile.part.oldTriangleInterval[1])throw Error("Changed V8 interval contains a retired face");const mapped=triangle>=profile.part.retireShift.fromOrdinal?(shifted++,triangle+profile.part.retireShift.delta):triangle;for(let vertex=0;vertex<3;vertex++)for(let c=0;c<3;c++){const left=oldWords[Number(oldIndex[triangle*3+vertex])*3+c],right=newWords[ix[mapped*3+vertex]*3+c];if(left!==right)throw Error("V8 local source XYZ word/winding changed");local[at++]=left;}}
  const localSha=sha(new Uint8Array(local.buffer));if(localSha!==profile.part.retiredXYZWordsSha256||shifted!==profile.part.retireShift.count)throw Error("V8 complete local source witness differs");
  const geometry=new BufferGeometry();geometry.setAttribute("position",new BufferAttribute(p,3));geometry.setIndex(new BufferAttribute(ix,1));geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.userData={...mesh.geometry.userData};const previous=mesh.geometry;mesh.geometry=geometry;previous.dispose();
  return{positionSha256:sha(positions),indexSha256:sha(indices),localSha256:localSha,retiredTriangles:old.retire.length,shifted};
 }finally{rmSync(directory,{recursive:true,force:true});}
}
