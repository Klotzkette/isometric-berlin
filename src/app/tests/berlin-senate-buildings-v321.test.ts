import{describe,test,expect}from'bun:test';
import{readFileSync}from'node:fs';import path from'node:path';
import{BufferAttribute,BufferGeometry,Group,InstancedMesh,MeshBasicMaterial}from'three';
import{createBerlinSenateBuildingsV321,hasCompleteBerlinSenateBuildingsV321,berlinSenatePreviousPlanV321,berlinSenatePreviewPlanV321,berlinSenateNavigationV321,berlinSenatePreviousPrismV321}from'../src/BerlinSenateBuildingsV321';
import{createExactOwnersSourceV321,stageExactOwnersV321}from'../src/ExactOwnersV321';
const repo=path.resolve(import.meta.dir,'../../..'),load=(p:string)=>JSON.parse(readFileSync(path.join(repo,p),'utf8'));
const prisms=load('src/app/public/mesh/regierungsviertel/lod2-prisms.json').buildings,voxels=load('src/app/public/mesh/regierungsviertel/minecraft-voxels.json');
function cleanup(root:Group){root.traverse((o:any)=>{o.geometry?.dispose();for(const m of[o.material,o.userData.dayMaterial,o.userData.nightMaterial,o.userData.schwellenraumMaterial].flat())m?.dispose();});root.clear();}
function attr(v:any){const bytes=Buffer.from(v.bytes,'base64'),types={Float32Array,Uint8Array,Uint16Array,Uint32Array};const Type=types[v.type as keyof typeof types];return new BufferAttribute(new Type(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),v.itemSize,v.normalized);}
describe('complete Senate source bodies and finite roofs',()=>{
 test('complete roots use exact actual source inputs and preserve bounded independent navigation',()=>{
  for(const native of[false,true]){const root=createBerlinSenateBuildingsV321(native,{sourcePrisms:prisms,voxels})!;expect(root).not.toBeNull();expect(hasCompleteBerlinSenateBuildingsV321(root,native)).toBe(true);expect(hasCompleteBerlinSenateBuildingsV321(root,!native)).toBe(false);
   const nav=berlinSenateNavigationV321(root,native)!;expect(nav).not.toBeNull();const proof=load('src/app/src/data/berlinSenateBuildingsV321.json');
   expect(nav.solidAt(0,30,0)).toBe(false);expect(nav.groundAt(0,0,30)).toBeNull();
   const urban=proof.navigation[native?'native':'drawn'].find((r:any)=>r.site==='urban'),ux=urban.ring.reduce((s:number,p:number[])=>s+p[0],0)/urban.ring.length,uz=urban.ring.reduce((s:number,p:number[])=>s+p[1],0)/urban.ring.length;
   expect(nav.solidAt(ux,50,uz)).toBe(true);expect(nav.groundAt(ux,uz,urban.top)).toBeCloseTo(urban.top,5);
   root.position.x=1;expect(hasCompleteBerlinSenateBuildingsV321(root,native)).toBe(false);expect(nav.solidAt(ux,50,uz)).toBe(false);cleanup(root);
  }
 });
 test('actual captured native semantic tuples admit with complete exclusive source proof in full and touch',()=>{
  for(const mobileLike of[false,true]){const{plan,control}=berlinSenatePreviousPlanV321(true,mobileLike),receipt=createExactOwnersSourceV321(plan,prisms,control,voxels)!;expect(receipt).not.toBeNull();const root=new Group();
   for(const c of plan.owners[0].components){const g=new BufferGeometry();for(const[k,a]of Object.entries(c.attributes))g.setAttribute(k,attr(a));if(c.index)g.setIndex(attr({...c.index,itemSize:1,normalized:false}));const o=new InstancedMesh(g,new MeshBasicMaterial(),c.instances!.count);o.name=c.name;
    const mb=Buffer.from(c.instances!.matrix,'base64');o.instanceMatrix.array.set(new Float32Array(mb.buffer.slice(mb.byteOffset,mb.byteOffset+mb.byteLength)));o.instanceColor=attr({type:'Float32Array',itemSize:3,normalized:false,bytes:c.instances!.color!})as any;root.add(o);}
   const old=root.children.map((o:any)=>o.instanceMatrix),tx=stageExactOwnersV321(root,receipt,true)!;expect(tx).not.toBeNull();expect(tx.activeOwners).toEqual(['n-400426']);expect(tx.commit(true)).toBe(true);expect(tx.complete()).toBe(true);tx.rollback();for(let i=0;i<old.length;i++)expect((root.children[i]as InstancedMesh).instanceMatrix).toBe(old[i]);cleanup(root);
  }
 });
 test('unknown/changed inputs, foreign contributors and disposed model roots keep the old source',()=>{
  expect(createBerlinSenateBuildingsV321()).toBeNull();const bad=structuredClone(prisms);bad.find((p:any)=>p.id==='n-400426').h_dm++;expect(createBerlinSenateBuildingsV321(false,{sourcePrisms:bad})).toBeNull();
  const{plan,control}=berlinSenatePreviousPlanV321(true,false),column=plan.nativeSource!.columns[0].source,cell=voxels.cell_m;
  const foreign={id:'hostile-foreign',ring:[[column[0]*cell*10,column[1]*cell*10],[(column[0]+1)*cell*10,column[1]*cell*10],[(column[0]+1)*cell*10,(column[1]+1)*cell*10],[column[0]*cell*10,(column[1]+1)*cell*10]],holes:[],h_dm:100,y0_dm:52,class:0,roof:1000};
  expect(createExactOwnersSourceV321(plan,[...prisms,foreign],control,voxels)).toBeNull();expect(berlinSenatePreviousPrismV321(foreign)).toBe(false);
  const root=createBerlinSenateBuildingsV321(false,{sourcePrisms:prisms})!;expect(root).not.toBeNull();(root.children[0]as any).geometry.dispose();expect(hasCompleteBerlinSenateBuildingsV321(root,false)).toBe(false);cleanup(root);
  expect(berlinSenatePreviewPlanV321().plan.owners[0].components[0].name).toBe('LoD2 distant building shells');
 });
});
