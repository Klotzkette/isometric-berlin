/** Bounded test-only before/after capture. Never changes production or old fixtures.
 * Run with --before/--mobile combinations, then --merge. Captures only the owned
 * source cells and one neighbour halo, not whole million-instance buffers. */
import { plugin } from "bun";
import type { InstancedMesh } from "three";
import source from "../src/data/elevatedCoreOwnersV238.json";
import hansa from "../tests/fixtures/minecraft-payload-only-v237-delta.json";
import baseline from "../tests/fixtures/minecraft-payload-only-v202.json";
import urania from "../tests/fixtures/minecraft-payload-only-v206-delta.json";
import { replayLegacyInstanceHash, restoreLegacyInstances, type InstanceBufferDelta } from "../tests/helpers/instanceBufferReplay";
import { auditElevatedStationsNativeDeltaV238 } from "../tests/helpers/elevatedStationsNativeDeltaV238";

const before=process.argv.includes('--before'),profile=process.argv.includes('--mobile')?'mobile':'full';
const capturePath=(prior:boolean,p:string)=>`/tmp/elevated-v238-${prior?'before':'after'}-${p}.json`;
if(process.argv.includes('--merge')) {
  const profiles:Record<string,unknown>={},previous:Record<string,unknown>={};
  let audit:unknown;
  for(const p of ['full','mobile'] as const) {
    const old=await Bun.file(capturePath(true,p)).json(),now=await Bun.file(capturePath(false,p)).json();
    audit=old.audit;
    if(JSON.stringify(old.audit)!==JSON.stringify(now.audit)) throw Error('Source audit changed between captures');
    const changes:Record<string,unknown>={},hashes:Record<string,unknown>={};
    for(const [name,a] of Object.entries(old.meshes) as [string,any][]) {
      const b=now.meshes[name]; hashes[name]=a?{count:a.count,sha256:a.sha256}:null;
      if(JSON.stringify(a)===JSON.stringify(b)) continue;
      if(!a||!b||!['Voxel building columns','Voxel facade windows'].includes(name)) throw Error('Unexpected changed mesh '+name);
      const oldData=new Set(a.records.map((r:any)=>r.data)),newData=new Set(b.records.map((r:any)=>r.data));
      if(oldData.size!==a.records.length||newData.size!==b.records.length) throw Error('Ambiguous duplicate local record');
      const removed=a.records.filter((r:any)=>!newData.has(r.data)),added=b.records.filter((r:any)=>!oldData.has(r.data));
      if(a.count-removed.length!==b.count-added.length) throw Error('Unexplained nonlocal count change');
      changes[name]={beforeCount:a.count,afterCount:b.count,retainedCount:a.count-removed.length,removed,added};
    }
    profiles[p]=changes;previous[p]=hashes;
  }
  const inputSha256:Record<string,string>={};
  for(const path of ['public/mesh/regierungsviertel/minecraft-voxels.json','public/mesh/regierungsviertel/lod2-prisms.json','src/data/elevatedCoreOwnersV238.json'])
    inputSha256[path]=new Bun.CryptoHasher('sha256').update(await Bun.file(new URL('../'+path,import.meta.url)).arrayBuffer()).digest('hex');
  await Bun.write(new URL('../tests/fixtures/minecraft-payload-only-v238-delta.json',import.meta.url),JSON.stringify({
    schemaVersion:1,sourceOwners:source.prismIds,
    policy:'Disable only the exact elevated-station column predicate for before capture; every before buffer must replay through unchanged v237/v206 into immutable v202 hashes. Preserve all retained matrix/color bytes and order. No whole buffer snapshots.',
    encoding:'base64 of 16 Float32 matrix values followed by 3 Float32 color values; exact original bits',
    inputSha256,audit,previous,profiles,
  },null,2)+'\n');
  console.log('Wrote bounded elevated-station v238 receipt');process.exit(0);
}
if(before) plugin({name:'counterfactual-before-exact-elevated-station-substitution',setup(build){
  build.onLoad({filter:/\/MinecraftVoxelWorld\.ts$/},async args=>{
    const code=await Bun.file(args.path).text(),guard='isElevatedStationReplacementColumnV238(x, z) ||';
    if(code.split(guard).length!==2) throw Error('Elevated source-column guard is not unique');
    return {contents:code.replace(guard,'false ||'),loader:'ts'};
  });
}});
const {preloadAltMitteNativeV169Source}=await import('../src/AltMitteNativeCoreV169');
await preloadAltMitteNativeV169Source();
const {createMinecraftVoxelWorld,decodeVoxelBuildingColumns}=await import('../src/MinecraftVoxelWorld');
const payload=(await import('../public/mesh/regierungsviertel/minecraft-voxels.json')).default;
const audit=auditElevatedStationsNativeDeltaV238(decodeVoxelBuildingColumns(payload as any),payload.cell_m,source.previousPrisms);
const local=new Set<string>();
for(const [x,z] of audit.removedColumns) for(const [dx,dz] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]) local.add(`${x+dx},${z+dz}`);
const root=createMinecraftVoxelWorld(payload as any,null,null,{detailProfile:profile});
const meshes:Record<string,unknown>={};
for(const [name,expected] of Object.entries(baseline[profile])) {
  const mesh=root.getObjectByName(name) as InstancedMesh|undefined;
  if(!mesh){if(expected!==null)throw Error('Missing '+name);meshes[name]=null;continue;}
  const matrices=mesh.instanceMatrix.array,colors=mesh.instanceColor?.array;
  if(!colors)throw Error('Missing colors '+name);
  const hash=new Bun.CryptoHasher('sha256').update(matrices).update(colors).digest('hex');
  if(before) {
    const prior=(hansa.profiles[profile] as Record<string,InstanceBufferDelta>)[name];
    const restored=prior?restoreLegacyInstances(mesh,prior):mesh;
    const delta=(urania.profiles[profile] as Record<string,InstanceBufferDelta>)[name];
    const priorHash=new Bun.CryptoHasher('sha256').update(restored.instanceMatrix.array).update(restored.instanceColor!.array).digest('hex');
    if((delta?replayLegacyInstanceHash(restored,delta):priorHash)!==expected!.sha256) throw Error('Historical baseline mismatch '+name);
  }
  const records:{index:number,data:string}[]=[];
  if(['Voxel building columns','Voxel facade windows'].includes(name)) {
    const pane=name==='Voxel facade windows';
    for(let i=0;i<mesh.count;i++) {
      const at=i*16,x=Math.round((matrices[at+12]-(pane?matrices[at+8]*2.08:0))/4-.5),z=Math.round((matrices[at+14]-(pane?matrices[at+10]*2.08:0))/4-.5);
      if(!local.has(`${x},${z}`))continue;
      const row=new Float32Array(19);row.set(matrices.subarray(at,at+16));row.set(colors.subarray(i*3,i*3+3),16);
      records.push({index:i,data:Buffer.from(row.buffer).toString('base64')});
    }
  }
  meshes[name]={count:mesh.count,sha256:hash,records};
}
await Bun.write(capturePath(before,profile),JSON.stringify({audit,meshes}));
console.log(capturePath(before,profile));
