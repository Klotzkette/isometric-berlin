import {expect,test} from 'bun:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {InstancedMesh,type Group} from 'three';
import data from '../src/data/universityRefinementV347.json';
import previous from '../src/data/universitiesArchitectureV322.json';
import {universityFitV347,universityRefinementRowsV347Steps,universityRefinementRowsV347} from '../src/universityRefinementV347';
import {createUniversitiesArchitectureV322,hasCompleteUniversitiesArchitectureV322} from '../src/UniversitiesArchitectureV322';
import {createTuWaterV168,createMinecraftTuWaterV168,TU_WATER_V168_RENDER_BUDGET} from '../src/TuWaterV168';
import {disposeStaticAudit} from './helpers/staticGeometryAudit';
const base=new URL('../../../',import.meta.url);
const evidence=JSON.parse(readFileSync(new URL('geo_data/regierungsviertel/university-refinement-v347-evidence.json',base),'utf8'));
const preservation=JSON.parse(readFileSync(new URL('geo_data/regierungsviertel/university-preservation-v347.json',base),'utf8'));
const prisms=JSON.parse(readFileSync(new URL('../public/mesh/regierungsviertel/lod2-prisms.json',import.meta.url),'utf8'));
const voxels=JSON.parse(readFileSync(new URL('../public/mesh/regierungsviertel/minecraft-voxels.json',import.meta.url),'utf8'));
const hash=(a:ArrayBufferView)=>createHash('sha256').update(Buffer.from(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
const drain=<T>(g:Generator<void,T>):T=>{for(;;){const n=g.next();if(n.done)return n.value;}};

test('complete previous university source, navigation, owners and TU data are byte-identical',()=>{
 for(const input of evidence.inputs)expect(createHash('sha256').update(readFileSync(new URL(input.path,base))).digest('hex')).toBe(input.sha256);
 expect(data.profiles.map(p=>p.key)).toEqual(['bht-wedding','hu-adlershof','hwr-schoeneberg','fu-henry-ford','tu-main']);
 expect(evidence.physicsHeightLimitation).toContain('only 3m');
 expect(previous.sites.flatMap(s=>s.partIds)).toHaveLength(485);
});

test('every small fitting lies inside its complete measured/cardinal sheet, including hole edges',()=>{
 const counts:Record<string,number[]>={};
 for(const p of data.profiles)for(const native of [false,true]){
  const roles=new Set<string>();let observed=0;
  const q=drain(universityRefinementRowsV347Steps(p.key,native,f=>{
   expect(universityFitV347(f.face,f.u,f.y,f.w,f.h)).toBeTrue();
   expect(f.out+f.depth/2).toBeLessThan(.8);roles.add(f.role);observed++;
  }));
  expect(observed).toBe(q.frames.length+q.glass.length);expect(observed).toBeGreaterThan(0);
  counts[p.key+(native?'-native':'-drawn')]=[q.frames.length,q.glass.length];
  if(native)for(const row of [...q.frames,...q.glass]){expect(row).toHaveLength(7);expect(row.every(Number.isFinite)).toBeTrue();}
  if(p.key==='hu-adlershof')expect(roles.has('summer-vine-leaves')).toBeTrue();
  if(p.key==='bht-wedding')expect(roles.has('window-transom')).toBeTrue();
 }
 expect(counts).toEqual({'bht-wedding-drawn':[3516,501],'bht-wedding-native':[2217,0],'hu-adlershof-drawn':[3347,327],'hu-adlershof-native':[460,0],'hwr-schoeneberg-drawn':[1918,0],'hwr-schoeneberg-native':[2422,0],'fu-henry-ford-drawn':[211,0],'fu-henry-ford-native':[52,0],'tu-main-drawn':[1706,0],'tu-main-native':[1717,0]});
 // This rectangle crosses a hole although its corners miss the hole.
 const face={owner:'mask-test',a:[0,0],d:[1,0],n:[0,1],range:[0,10,0,10],polygon:[[0,0],[10,0],[10,10],[0,10]],holes:[[[4,4],[6,4],[6,6],[4,6]]],voids:[]};
 expect(universityFitV347(face,5,5,8,8)).toBeFalse();expect(universityFitV347(face,2,2,1,1)).toBeTrue();
 expect(Object.isFrozen(data.profiles[0].faces[0].range)).toBeTrue();
 expect(()=>{data.profiles[0].faces[0].range[0]=999;}).toThrow();
});

test.each([false,true])('previous batch prefixes remain exact; no new batch and complete mobile equality native=%s',native=>{
 for(const kind of ['universities','tu']){
  const make=(mobileLike:boolean):Group=>kind==='universities'?createUniversitiesArchitectureV322(native,{sourcePrisms:prisms.buildings,voxels,mobileLike}):native?createMinecraftTuWaterV168({mobileLike}):createTuWaterV168({mobileLike});
  const root=make(false),mobile=make(true);
  try{
   const old=preservation.snapshots.find((s:any)=>s.kind===kind&&s.native===native);
   const batches=root.children.filter((q):q is InstancedMesh=>q instanceof InstancedMesh);
   const touch=mobile.children.filter((q):q is InstancedMesh=>q instanceof InstancedMesh);
   expect(batches).toHaveLength(old.batches.length);expect(root.children).toHaveLength(mobile.children.length);
   batches.forEach((batch,i)=>{
    const before=old.batches[i];expect(batch.name).toBe(before.name);expect(batch.count).toBeGreaterThanOrEqual(before.count);
    expect(hash(batch.instanceMatrix.array.subarray(0,before.count*16))).toBe(before.matrix);
    expect(hash(batch.instanceColor!.array.subarray(0,before.count*3))).toBe(before.color);
    expect(hash(batch.instanceMatrix.array)).toBe(hash(touch[i].instanceMatrix.array));
    expect(hash(batch.instanceColor!.array)).toBe(hash(touch[i].instanceColor!.array));
    expect(batch.geometry.attributes.uv).toBeUndefined();
    if(native)for(let j=0;j<batch.count;j++)for(const k of[1,2,4,6,8,9])expect(Math.abs(batch.instanceMatrix.array[j*16+k])).toBe(0);
   });
   if(kind==='universities'){
    const batch=batches.find(b=>b.name==='bht-wedding source-bound frames')!;
    expect(hasCompleteUniversitiesArchitectureV322(root,native)).toBeTrue();
    const before=batch.count;batch.count--;expect(hasCompleteUniversitiesArchitectureV322(root,native)).toBeFalse();batch.count=before;
    expect(hasCompleteUniversitiesArchitectureV322(root,native)).toBeTrue();
    // Alter a newly appended instance, not an old source row: private receipt
    // still rejects the actual backing buffer version change.
    batch.instanceMatrix.array[(batch.count-1)*16+12]+=.1;
    batch.instanceMatrix.needsUpdate=true;expect(hasCompleteUniversitiesArchitectureV322(root,native)).toBeFalse();
   }else{
    const detail=batches.at(-1)!;
    expect(detail.count).toBe(native?TU_WATER_V168_RENDER_BUDGET.nativeDetailInstances:TU_WATER_V168_RENDER_BUDGET.facadeInstances);
   }
  }finally{disposeStaticAudit(root);disposeStaticAudit(mobile);}
 }
},30000);

test('unrelated sites get no new fitting records',()=>{
 expect(universityRefinementRowsV347('hu-grimm-hegel',false)).toEqual({frames:[],glass:[]});
 expect(universityRefinementRowsV347('hwr-lichtenberg',true)).toEqual({frames:[],glass:[]});
});
