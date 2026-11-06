import {describe,expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {mkdtemp,rm,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {build} from 'vite';
import {losslessJsonData} from '../losslessJsonData';
import {Group,InstancedMesh,MeshBasicMaterial} from 'three';
import profile from '../src/data/wilhelmStreetFrontsV325.json';
import sourceProof from '../src/data/wilhelmStreetFrontsV325Sources.json';
import {createWilhelmStreetFrontsV325Steps,disposeWilhelmStreetFrontsV325,hasCompleteWilhelmStreetFrontsV325} from '../src/WilhelmStreetFrontsV325';
import {interleaveStaticGeometry} from '../src/interleaveStaticGeometry';
import {parkStaticGeometrySteps,parkStaticInstancesSteps} from '../src/losslessStaticStorage';
import {freezeStaticSceneTransforms} from '../src/staticSceneTransforms';
import {retireSceneMaterialPrograms} from '../src/sceneMaterialPrograms';
import {createMinecraftMaterialState,disposeMinecraftMaterialState,restoreMinecraftMaterialPresentation,setMinecraftMaterialPresentation} from '../src/visual-modes/minecraft/materialMode';

const repo=resolve(import.meta.dir,'../../..');
const prisms=JSON.parse(readFileSync(resolve(repo,'src/app/public/mesh/regierungsviertel/lod2-prisms.json'),'utf8')).buildings;
const read=(p:string)=>JSON.parse(readFileSync(resolve(repo,p),'utf8'));
const nativeSource={core:{minecraftChunks:sourceProof.nativePackets.map(p=>({id:p.id,packet:read(p.file)}))},voxels:read('src/app/public/mesh/regierungsviertel/minecraft-voxels.json')};
function drain<T>(steps:Generator<void,T>):T{for(;;){const n=steps.next();if(n.done)return n.value;}}
function create(source=prisms){return drain(createWilhelmStreetFrontsV325Steps({native:false,sourcePrisms:source}));}
function fingerprint(root:Group):string{const h=createHash('sha256');for(const m of root.children as InstancedMesh[])for(const a of[m.instanceMatrix,m.instanceColor!,...Object.values(m.geometry.attributes),m.geometry.index!]){const v=('data'in a?a.data:a).array;h.update(new Uint8Array(v.buffer,v.byteOffset,v.byteLength));}return h.digest('hex');}
function inside(x:number,y:number,ring:number[][]):boolean{
 let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=ring[i],b=ring[j],cross=(x-a[0])*(b[1]-a[1])-(y-a[1])*(b[0]-a[0]);
  if(Math.abs(cross)<1e-5&&x>=Math.min(a[0],b[0])-1e-5&&x<=Math.max(a[0],b[0])+1e-5&&y>=Math.min(a[1],b[1])-1e-5&&y<=Math.max(a[1],b[1])+1e-5)return true;
  if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;
 }return yes;
}
describe('finite photographically composed Wilhelm street fronts v325',()=>{
 test('eleven exact families and every compiled corner remain inside complete original wall sheets',()=>{
  expect(profile.families).toHaveLength(11);expect(profile.families.reduce((n,q)=>n+q.parts.length,0)).toBe(89);
  expect(profile.runs).toHaveLength(22);expect(new Set(profile.runs.map(q=>q.family)).size).toBe(11);
  expect(profile.runs.reduce((n,q)=>n+q.patches.length,0)).toBe(163);
  expect(profile.runs.reduce((n,q)=>n+q.windowCount,0)).toBe(3364);
  let supported=0;
  for(const row of profile.drawn){
   const[x,y,z,w,h,,angle,,,id]=row as [number,number,number,number,number,number,number,number,string,number];
   const run=profile.runs.find(q=>q.id===id)!;
   const matches=run.patches.some(p=>{
    const u=x*p.d[0]+z*p.d[1],depth=x*p.n[0]+z*p.n[1]-p.c;
    if(depth<.01||depth>.7||Math.abs(Math.abs(Math.cos(angle)*p.d[0]-Math.sin(angle)*p.d[1])-1)>1e-5)return false;
    return[-1,1].every(a=>[-1,1].every(b=>inside(u+a*w/2,y+b*h/2,p.rings[0])&&!p.rings.slice(1).some(r=>inside(u+a*w/2,y+b*h/2,r))));
   });if(matches)supported++;
  }
  expect(supported).toBe(profile.drawn.length);expect(profile.drawn.length*76).toBeLessThan(8*1024*1024);
  expect(new Set(profile.families.map(q=>q.displayType)).size).toBe(9);expect(profile.references).toHaveLength(20);
  expect(profile.drawn).toHaveLength(20324);expect(profile.references.every(q=>typeof q==='string'&&q.startsWith('https://'))).toBe(true);
 });
 test('closed source admission rejects incomplete/changed/duplicate sources and public forged receipts',()=>{
  expect(drain(createWilhelmStreetFrontsV325Steps({native:false}))).toBeNull();
  expect(drain(createWilhelmStreetFrontsV325Steps({native:true,sourcePrisms:prisms}))).toBeNull();
  const actual=prisms.find((p:any)=>p.id===sourceProof.prisms[0].id),bad=prisms.map((p:any)=>p===actual?{...p,h_dm:p.h_dm+1}:p);
  expect(create(bad)).toBeNull();expect(create(prisms.filter((p:any)=>p!==actual))).toBeNull();expect(create([...prisms,actual])).toBeNull();
  expect(drain(createWilhelmStreetFrontsV325Steps({native:false,sourcePrisms:prisms,sourceReceipt:{source:true}as any}))).toBeNull();
  const fake=new Group();fake.userData={wilhelmStreetFrontsV325:true,sourceReceipt:{source:true},complete:true};expect(hasCompleteWilhelmStreetFrontsV325(fake,false)).toBe(false);
 });
 test('Day never reads native recipes; metadata and selected recipe edits close without retaining the other mode',()=>{
  const descriptor=Object.getOwnPropertyDescriptor(profile,'native')!,run=profile.runs[0],count=run.windowCount;
  let nativeReads=0;
  Object.defineProperty(profile,'native',{configurable:true,enumerable:true,get(){nativeReads++;throw Error('Day decoded native data');}});
  let root:Group|null=null;
  try{root=create();expect(root).not.toBeNull();expect(nativeReads).toBe(0);expect(hasCompleteWilhelmStreetFrontsV325(root!,false)).toBe(true);
   run.windowCount++;expect(hasCompleteWilhelmStreetFrontsV325(root!,false)).toBe(false);expect(create()).toBeNull();run.windowCount=count;
   expect(hasCompleteWilhelmStreetFrontsV325(root!,false)).toBe(true);
  }finally{run.windowCount=count;Object.defineProperty(profile,'native',descriptor);if(root)disposeWilhelmStreetFrontsV325(root);}
  const first=profile.drawn[0][0];profile.drawn[0][0]=Number(first)+.01;try{expect(create()).toBeNull();}finally{profile.drawn[0][0]=first;}
 });
 test('actual factory is cooperative, complete on touch, static, and accepts real presentation/parking passes',async()=>{
  let partial:Group|undefined,yields=0,maxStep=0;const start=performance.now(),steps=createWilhelmStreetFrontsV325Steps({native:false,sourcePrisms:prisms,mobileLike:true},q=>partial=q);
  let next=steps.next();while(!next.done){expect(partial?hasCompleteWilhelmStreetFrontsV325(partial,false):false).toBe(false);const t=performance.now();next=steps.next();maxStep=Math.max(maxStep,performance.now()-t);yields++;}
  const root=next.value!;try{
   expect(root).not.toBeNull();expect(yields).toBeGreaterThan(30);expect(maxStep).toBeLessThan(200);expect(performance.now()-start).toBeLessThan(1000);
   expect(root.children).toHaveLength(2);expect(root.children.reduce((n,m)=>n+(m as InstancedMesh).count,0)).toBe(profile.drawn.length);
   expect(hasCompleteWilhelmStreetFrontsV325(root,false)).toBe(true);expect(hasCompleteWilhelmStreetFrontsV325(root,true)).toBe(false);
   freezeStaticSceneTransforms(root);interleaveStaticGeometry(root);expect(hasCompleteWilhelmStreetFrontsV325(root,false)).toBe(true);
   for(const mode of['nightMaterial','schwellenraumMaterial','dayMaterial']){for(const m of root.children as InstancedMesh[])m.material=m.userData[mode];expect(hasCompleteWilhelmStreetFrontsV325(root,false)).toBe(true);}
   const state=createMinecraftMaterialState();setMinecraftMaterialPresentation(root,state,true);expect(hasCompleteWilhelmStreetFrontsV325(root,false)).toBe(true);restoreMinecraftMaterialPresentation(state);disposeMinecraftMaterialState(state);
   expect(retireSceneMaterialPrograms(root)).toBeGreaterThan(0);expect(hasCompleteWilhelmStreetFrontsV325(root,false)).toBe(true);
   drain(parkStaticGeometrySteps(root,true));drain(parkStaticInstancesSteps(root));
   for(const m of root.children as InstancedMesh[])m.instanceMatrix.onUploadCallback();await new Promise(r=>setTimeout(r,1));
   expect(hasCompleteWilhelmStreetFrontsV325(root,false)).toBe(true);
  }finally{disposeWilhelmStreetFrontsV325(root);}expect(hasCompleteWilhelmStreetFrontsV325(root,false)).toBe(false);
 });
 test('native independently covers every family/run and full/touch deliver identical cardinal buffers',()=>{
  expect(new Set(profile.native.map(r=>r[9])).size).toBe(21);expect(profile.native).toHaveLength(18649);expect(profile.native.every(r=>r[6]===0)).toBe(true);
  const nativeRuns=new Set(profile.native.map(r=>r[9]));expect(nativeRuns.has(11)).toBe(false);expect(nativeRuns.has(10)).toBe(true);expect(new Set(profile.runs.filter(r=>nativeRuns.has(r.id)).map(r=>r.family)).size).toBe(11);
  expect(profile.native.length*76).toBeLessThan(8*1024*1024);expect(profile.native.length).not.toBe(profile.drawn.length);
  const roots=[false,true].map(mobileLike=>drain(createWilhelmStreetFrontsV325Steps({native:true,sourcePrisms:prisms,nativeSource,mobileLike}))!);
  try{for(const root of roots){expect(root).not.toBeNull();expect(hasCompleteWilhelmStreetFrontsV325(root,true)).toBe(true);expect(hasCompleteWilhelmStreetFrontsV325(root,false)).toBe(false);
    for(const m of root.children as InstancedMesh[]){const a=m.instanceMatrix.array;for(let i=0;i<a.length;i+=16)for(const k of[1,2,3,4,6,7,8,9,11])if(a[i+k]!==0)throw Error('Native box contains a drawn rotation');}
   }expect(fingerprint(roots[0])).toBe(fingerprint(roots[1]));
   const held=roots[0].children[0]as InstancedMesh,night=held.userData.nightMaterial;held.material=night;night.emissive.setHex(0xE6C782);night.emissiveIntensity=.42;expect(hasCompleteWilhelmStreetFrontsV325(roots[0],true)).toBe(true);
   night.emissive.setHex(0);night.emissiveIntensity=0;expect(hasCompleteWilhelmStreetFrontsV325(roots[0],true)).toBe(true);
   retireSceneMaterialPrograms(roots[0]);expect(hasCompleteWilhelmStreetFrontsV325(roots[0],true)).toBe(true);
  }finally{roots.forEach(disposeWilhelmStreetFrontsV325);}
 });
 test('unversioned source and output word edits, foreign material/poses and authored disposal revoke privately',()=>{
  const root=create()!;try{
   const m=root.children[0]as InstancedMesh;
   const before=m.instanceMatrix.array[0];m.instanceMatrix.array[0]=before+.01;expect(hasCompleteWilhelmStreetFrontsV325(root,false)).toBe(false);m.instanceMatrix.array[0]=before;
   expect(hasCompleteWilhelmStreetFrontsV325(root,false)).toBe(true);m.position.x=.01;expect(hasCompleteWilhelmStreetFrontsV325(root,false)).toBe(false);m.position.x=0;
   const material=m.material,foreign=new MeshBasicMaterial();m.material=foreign;expect(hasCompleteWilhelmStreetFrontsV325(root,false)).toBe(false);m.material=material;foreign.dispose();
   m.userData.dayMaterial.opacity=0;expect(hasCompleteWilhelmStreetFrontsV325(root,false)).toBe(false);m.userData.dayMaterial.opacity=1;
   const source=prisms.find((p:any)=>p.id===sourceProof.prisms[0].id),height=source.h_dm;source.h_dm++;expect(hasCompleteWilhelmStreetFrontsV325(root,false)).toBe(false);source.h_dm=height;
   expect(hasCompleteWilhelmStreetFrontsV325(root,false)).toBe(true);m.geometry.dispose();expect(hasCompleteWilhelmStreetFrontsV325(root,false)).toBe(false);
  }finally{disposeWilhelmStreetFrontsV325(root);}
  const second=create()!;(second.children[0]as InstancedMesh).userData.nightMaterial.dispose();expect(hasCompleteWilhelmStreetFrontsV325(second,false)).toBe(false);disposeWilhelmStreetFrontsV325(second);
 });
 test('cancellation after every unpublished checkpoint disposes its partial family',()=>{
  const complete=create()!;const reference=complete.children.map(m=>(m as InstancedMesh).instanceMatrix.array.byteLength);disposeWilhelmStreetFrontsV325(complete);
  // Different phases cover source binding, split, buffer writes and published children.
  for(const checkpoint of[1,15,35,55,65]){let partial:Group|undefined;const g=createWilhelmStreetFrontsV325Steps({native:false,sourcePrisms:prisms},q=>partial=q);let next=g.next();for(let i=1;i<checkpoint&&!next.done;i++)next=g.next();g.return(null);expect(!partial||partial.children.length===0).toBe(true);expect(partial?hasCompleteWilhelmStreetFrontsV325(partial,false):false).toBe(false);}
  expect(reference.length).toBe(2);
 });
 test('actual production codec keeps metadata strong, Day native decoding at zero, and every selected value/negative zero exact',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'wilhelm-v325-codec-'));
  const file=resolve(repo,'src/app/src/data/wilhelmStreetFrontsV325.json'),before=readFileSync(file);
  try{
   const entry=join(directory,'entry.ts');
   await writeFile(entry,`import source,{runs,families}from${JSON.stringify(file)};export const metadata={schemaVersion:source.schemaVersion,runs:source.runs,families:source.families,runsAlias:runs===source.runs,familiesAlias:families===source.families,descriptor:Object.getOwnPropertyDescriptor(source,'runs')};export function selected(native){return native?source.native:source.drawn;}`);
   const result=await build({configFile:false,root:directory,publicDir:false,logLevel:'error',plugins:[losslessJsonData([])],build:{write:false,minify:true,rolldownOptions:{input:entry,preserveEntrySignatures:'allow-extension',output:{format:'es',entryFileNames:'entry.js'}}}});
   if(Array.isArray(result)||!('output'in result))throw Error('Missing bounded Vite output');
   for(const item of result.output)if(item.type==='chunk'){const target=join(directory,item.fileName);await mkdir(dirname(target),{recursive:true});await writeFile(target,item.code);}
   const child=`import{readFileSync}from'node:fs';const parse=JSON.parse,expected=parse(readFileSync(${JSON.stringify(file)},'utf8'));let eagerRuns=0,drawn=0,native=0;JSON.parse=function(...args){const q=Reflect.apply(parse,this,args);if(Array.isArray(q)&&q[0]?.patches)eagerRuns++;if(Array.isArray(q)&&q[0]?.length===10){if(q.length===expected.drawn.length)drawn++;if(q.length===expected.native.length)native++;}return q;};function same(a,b){if(typeof a==='number'||typeof b==='number')return Object.is(a,b);if(!a||typeof a!=='object')return a===b;if(Object.keys(a).join()!==Object.keys(b).join())return false;return Object.keys(a).every(k=>same(a[k],b[k]));}const m=await import(${JSON.stringify(join(directory,'entry.js'))});if(drawn||native)throw Error('metadata decoded a constructor field');if(eagerRuns!==1)throw Error('Runs must decode exactly once as ordinary eager strong data');if(!same(m.metadata.runs,expected.runs)||!same(m.metadata.families,expected.families)||!m.metadata.runsAlias||!m.metadata.familiesAlias)throw Error('metadata/source alias changed');const d=m.metadata.descriptor;if(!d||d.get||!d.writable||!d.enumerable||!d.configurable||d.value!==m.metadata.runs)throw Error('metadata stopped being ordinary eager strong data');const a=m.selected(false);if(drawn!==1||native||!same(a,expected.drawn))throw Error('Day recipe changed or read Native');const b=m.selected(true);if(drawn!==1||native!==1||!same(b,expected.native))throw Error('Native recipe changed');a[0][0]=-0;if(m.selected(false)!==a||!Object.is(m.selected(false)[0][0],-0)||m.selected(true)!==b)throw Error('held weak constructor identity/mutation changed');console.log(JSON.stringify({eagerRunsParses:eagerRuns,constructorMetadataParses:0,dayNativeParses:0,selectedParses:[drawn,native],fullValuesAndNegativeZero:true,eagerMetadata:true}));`;
   const run=Bun.spawnSync([process.execPath,'--eval',child],{cwd:directory});
   expect(run.exitCode).toBe(0);expect(run.stderr.toString()).toBe('');
   expect(JSON.parse(run.stdout.toString())).toEqual({eagerRunsParses:1,constructorMetadataParses:0,dayNativeParses:0,selectedParses:[1,1],fullValuesAndNegativeZero:true,eagerMetadata:true});
   expect(readFileSync(file).equals(before)).toBe(true);
  }finally{await rm(directory,{recursive:true,force:true});}
 });
});
