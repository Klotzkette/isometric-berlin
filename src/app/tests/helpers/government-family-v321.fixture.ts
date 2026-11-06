/** Separate process: only regional WIP factories are adapted; real Gov and owner transactions execute. */
import {mock} from "bun:test";
import assert from "node:assert/strict";
import {fileURLToPath} from "node:url";
let cases=0,failures=0,assertions=0;
function expect(value:any){const methods=(negate=false)=>({
 toBeNull(){assertions++;if(negate)assert.notStrictEqual(value,null);else assert.strictEqual(value,null)},
 toBe(expected:any){assertions++;if(negate)assert.notStrictEqual(value,expected);else assert.strictEqual(value,expected)},
 toBeFalse(){assertions++;assert.strictEqual(value,false)},toBeTrue(){assertions++;assert.strictEqual(value,true)},
 toHaveLength(n:number){assertions++;assert.strictEqual(value.length,n)},
 });return Object.assign(methods(),{not:methods(true)})}
function test(name:string,run:()=>void){cases++;try{run()}catch(error){failures++;console.error(name,error)}}

import {BufferAttribute,BufferGeometry,Group,Mesh,MeshBasicMaterial} from 'three';
const repo=fileURLToPath(new URL('../../src/',import.meta.url));
const b64=(a:ArrayBufferView)=>Buffer.from(a.buffer,a.byteOffset,a.byteLength).toString('base64');
const records=[{id:'federal-a',ring:[[0,0],[30,0],[30,30],[0,30]],holes:[],y0_dm:0,h_dm:100,class:0},{id:'senate-b',ring:[[100,0],[130,0],[130,30],[100,30]],holes:[],y0_dm:0,h_dm:100,class:0}];
function geo(x:number){const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array([x,0,0,x+1,0,0,x,1,0]),3));g.setAttribute('normal',new BufferAttribute(new Float32Array([0,0,1,0,0,1,0,0,1]),3));g.setAttribute('color',new BufferAttribute(new Float32Array([.2,.3,.4,.2,.3,.4,.2,.3,.4]),3));g.setIndex([0,1,2]);return g;}
function control(p:unknown){let h=2166136261;for(const c of JSON.stringify(p))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h;}
function plan(index:number,native:boolean,preview=false){const g=geo(index*10),p={schemaVersion:1,native,owners:[{id:records[index].id,sourcePrism:structuredClone(records[index]),components:[{name:preview?'LoD2 distant building shells':'LoD2 prism buildings',kind:'mesh',retire:true,attributes:Object.fromEntries(Object.entries(g.attributes).map(([k,a])=>[k,{type:a.array.constructor.name,itemSize:a.itemSize,normalized:a.normalized,bytes:b64(a.array)}])),index:{type:g.index!.array.constructor.name,bytes:b64(g.index!.array)},instances:null}]}]};return{plan:p,control:control(p)};}
const mark=Symbol('mock actual regional receipt');let checks=0;
function region(index:number){return{create:(native:boolean)=>{const g=new Group();g.userData[mark]=index;g.userData.native=native;return g},has:(g:Group,native:boolean)=>{checks++;return g.userData[mark]===index&&g.userData.native===native},plan:(native:boolean)=>plan(index,native),nav:()=>({solidAt:()=>true,groundAt:()=>10}),previous:(p:any)=>p.id===records[index].id};}
const f=region(0),s=region(1);
mock.module(repo+'FederalMinistriesV321.ts',()=>({createFederalMinistriesV321:f.create,createFederalMinistriesV321Steps:function*(native:boolean,_options:any,onCreate?:any){const g=f.create(native);onCreate?.(g);yield;return g},hasCompleteFederalMinistriesV321:f.has,federalMinistryPreviousPlanV321:f.plan,federalMinistryNavigationV321:f.nav,federalMinistryPreviousPrismV321:f.previous,federalMinistryPreviewPlanV321:()=>plan(0,false,true)}));
mock.module(repo+'BerlinSenateBuildingsV321.ts',()=>({createBerlinSenateBuildingsV321:s.create,createBerlinSenateBuildingsV321Steps:function*(native:boolean,_options:any,onCreate?:any){const g=s.create(native);onCreate?.(g);yield;return g},hasCompleteBerlinSenateBuildingsV321:s.has,berlinSenatePreviousPlanV321:s.plan,berlinSenateNavigationV321:s.nav,berlinSenatePreviousPrismV321:s.previous,berlinSenatePreviewPlanV321:()=>plan(1,false,true)}));
let invalidPressReceipt=false;
function pressPlan(native:boolean){const entry=plan(0,native);entry.plan.owners[0].components[0].name='Actual separate PressQuarter fitting host';
 const sourceId=entry.plan.owners[0].sourcePrism.id;if(invalidPressReceipt)entry.plan.owners[0].sourcePrism.id='unknown-press-owner';
 return{plan:entry.plan,control:control(entry.plan),sourceId};}
mock.module(repo+'FederalMinistryPressQuarterV321.ts',()=>({federalMinistryPressQuarterPlanV321:pressPlan,
 verifiedFederalMinistryPressQuarterSourceV321:()=>null,prepareFederalMinistryPressQuarterSourceV321:async()=>true}));
// One deterministic checkpoint before the real post-commit parking method.
// Admission, geometry selection, commit, completion and rollback remain real;
// the small fixture need not allocate a whole city's retired source matrices.
const realOwners=await import(repo+'ExactOwnersV321.ts'),realStage=realOwners.stageExactOwnersV321Steps;
const parkingFamilies=new WeakSet<object>();
mock.module(repo+'ExactOwnersV321.ts',()=>({...realOwners,
 stageExactOwnersV321Steps:function*(...args:any[]){
  const tx=yield*realStage(...args as Parameters<typeof realStage>);if(!tx)return null;
  return{...tx,*parkRetiredSourcesSteps(){parkingFamilies.add(args[0]);try{yield;return yield*tx.parkRetiredSourcesSteps();}finally{parkingFamilies.delete(args[0]);}}};
 },
}));
const {createGovernmentOfficesV321,createGovernmentOfficesV321Steps}=await import(repo+'GovernmentOfficesV321.ts');
function drain<T>(g:Generator<void,T>){for(;;){const r=g.next();if(r.done)return r.value;}}
function fixture(){const bundle=createGovernmentOfficesV321({sourcePrisms:records as any,native:false,mobileLike:false})!;expect(bundle).not.toBeNull();const world=new Group();world.add(bundle.root);const families=[0,1].map(i=>{const family=new Group(),mesh=new Mesh(geo(i*10),new MeshBasicMaterial({vertexColors:true}));mesh.name='LoD2 prism buildings';family.add(mesh);world.add(family);return{family,mesh,original:mesh.geometry}});for(const x of families)expect(drain(bundle.stagePreviousSteps(x.family))).toBeTrue();expect(bundle.complete()).toBeTrue();return{bundle,world,families};}

test('hidden or detached regional replacement restores every original source family',()=>{
 for(const change of[(g:Group)=>g.visible=false,(g:Group)=>g.removeFromParent(),(g:Group)=>g.children[0].removeFromParent()]){const f=fixture();change(f.bundle.root);expect(f.bundle.complete()).toBeFalse();for(const x of f.families)expect(x.mesh.geometry).toBe(x.original);}
});
test('the Government container pose cannot move all new models while keeping source ownership',()=>{
 const f=fixture();f.bundle.root.position.x=4;expect(f.bundle.complete()).toBeFalse();for(const x of f.families)expect(x.mesh.geometry).toBe(x.original);
});
test('one invalid source transaction closes the whole bundle without leaving duplicated new masses',()=>{
 const f=fixture();f.families[0].mesh.geometry.dispose();expect(f.bundle.complete()).toBeFalse();for(const x of f.families)expect(x.mesh.geometry).toBe(x.original);expect(f.bundle.root.visible&&f.bundle.root.parent===f.world).toBeFalse();
});
test('explicit rollback remains closed and never admits an empty transaction array as ready',()=>{
 const f=fixture();f.bundle.rollback();expect(f.bundle.complete()).toBeFalse();for(const x of f.families)expect(x.mesh.geometry).toBe(x.original);expect(f.bundle.root.visible&&f.bundle.root.parent===f.world).toBeFalse();
});
test('repeated read-only navigation probes do not add a source transfer or a duplicate model',()=>{
 const f=fixture(),children=f.world.children.length;for(let i=0;i<20;i++){expect(f.bundle.complete()).toBeTrue();expect(f.bundle.groundAt(0,0,10)).toBe(10);}expect(f.world.children.length).toBe(children);expect(f.bundle.root.children).toHaveLength(2);
});

function workerFamily(index=1){const family=new Group(),mesh=new Mesh(geo(index*10),new MeshBasicMaterial({vertexColors:true}));mesh.name='LoD2 prism buildings';family.add(mesh);return{family,mesh,original:mesh.geometry};}
function preview(f:ReturnType<typeof fixture>){const family=new Group(),mesh=new Mesh(geo(0),new MeshBasicMaterial({vertexColors:true}));mesh.name='LoD2 distant building shells';const refinementGroup=new Group();refinementGroup.add(mesh);family.add(refinementGroup);f.world.add(family);const original=mesh.geometry;expect(drain(f.bundle.stagePreviewSteps(family))).toBeTrue();return{family,mesh,original,refinementGroup};}

test('a parentless Worker family stays privately pending without a false detached-model failure',()=>{
 const f=fixture(),p=preview(f),w=workerFamily();expect(drain(f.bundle.stagePreviousSteps(w.family))).toBeTrue();expect(w.family.parent).toBeNull();expect(w.mesh.geometry).not.toBe(w.original);
 expect(f.bundle.complete()).toBeTrue();expect(f.bundle.complete()).toBeTrue();expect(p.mesh.geometry).not.toBe(p.original);
 f.world.add(w.family);expect(f.bundle.activateFamily(w.family)).toBeTrue();expect(f.bundle.complete()).toBeTrue();
});
test('cancelling a staged Worker family restores only that family and keeps the persistent preview retired',()=>{
 const f=fixture(),p=preview(f),w=workerFamily();expect(drain(f.bundle.stagePreviousSteps(w.family))).toBeTrue();f.bundle.releaseFamily(w.family);expect(w.mesh.geometry).toBe(w.original);w.mesh.geometry.dispose();
 expect(f.bundle.complete()).toBeTrue();expect(p.mesh.geometry).not.toBe(p.original);expect(f.bundle.root.visible).toBeTrue();
});
test('release before legitimate eviction preserves the persistent Government and preview transactions',()=>{
 const f=fixture(),p=preview(f),w=workerFamily();expect(drain(f.bundle.stagePreviousSteps(w.family))).toBeTrue();f.world.add(w.family);expect(f.bundle.activateFamily(w.family)).toBeTrue();
 f.bundle.releaseFamily(w.family);w.family.removeFromParent();w.mesh.geometry.dispose();expect(f.bundle.complete()).toBeTrue();expect(p.mesh.geometry).not.toBe(p.original);expect(f.bundle.root.parent).toBe(f.world);
});
test('an active Worker family detached without release closes and restores every persistent family',()=>{
 const f=fixture(),p=preview(f),w=workerFamily();expect(drain(f.bundle.stagePreviousSteps(w.family))).toBeTrue();f.world.add(w.family);expect(f.bundle.activateFamily(w.family)).toBeTrue();w.family.removeFromParent();
 expect(f.bundle.complete()).toBeFalse();expect(p.mesh.geometry).toBe(p.original);expect(w.mesh.geometry).toBe(w.original);for(const x of f.families)expect(x.mesh.geometry).toBe(x.original);
});
test('active family reparenting or pose changes cannot retain an old source receipt',()=>{
 for(const change of[(family:Group,world:Group)=>{const other=new Group();world.add(other);other.add(family)},(family:Group)=>family.position.x=3]){
  const f=fixture(),w=workerFamily();expect(drain(f.bundle.stagePreviousSteps(w.family))).toBeTrue();f.world.add(w.family);expect(f.bundle.activateFamily(w.family)).toBeTrue();change(w.family,f.world);expect(f.bundle.complete()).toBeFalse();expect(w.mesh.geometry).toBe(w.original);
 }
});
test('repeated stage or activation uses one transaction and one GPU swap per family',()=>{
 const f=fixture(),w=workerFamily();let swaps=0;const hooks={beforeSwap(){swaps++}};expect(drain(f.bundle.stagePreviousSteps(w.family,hooks))).toBeTrue();expect(drain(f.bundle.stagePreviousSteps(w.family,hooks))).toBeTrue();
 f.world.add(w.family);expect(f.bundle.activateFamily(w.family)).toBeTrue();expect(f.bundle.activateFamily(w.family)).toBeTrue();expect(swaps).toBe(1);expect(f.bundle.complete()).toBeTrue();
});
test('cooperative cancellation before a Worker publication leaves the Government and old source intact',()=>{
 const f=fixture(),w=workerFamily(),steps=f.bundle.stagePreviousSteps(w.family);expect(steps.next().done).toBeFalse();steps.return(false);f.bundle.releaseFamily(w.family);expect(w.mesh.geometry).toBe(w.original);expect(f.bundle.complete()).toBeTrue();
});

test('ordinary refinement preview visibility toggles preserve the persistent preview transaction',()=>{
 const f=fixture(),p=preview(f);p.refinementGroup.visible=false;expect(f.bundle.complete()).toBeTrue();expect(p.mesh.geometry).not.toBe(p.original);p.refinementGroup.visible=true;expect(f.bundle.complete()).toBeTrue();expect(p.mesh.geometry).not.toBe(p.original);
});

test('cooperative creation exposes its provisional root and builds both regions in yielded steps',()=>{
 let provisional:Group|undefined;const steps=createGovernmentOfficesV321Steps({sourcePrisms:records as any,native:false,mobileLike:false},root=>{provisional=root});let step=steps.next(),yields=0;
 expect(provisional!==undefined).toBeTrue();while(!step.done){yields++;step=steps.next();}expect(yields>=2).toBeTrue();expect(step.value!==null).toBeTrue();expect(step.value!.root).toBe(provisional);expect(provisional!.children).toHaveLength(2);step.value!.rollback();
});
test('cancelling cooperative model creation clears unpublished regional children without touching source rows',()=>{
 let provisional:Group|undefined;const before=JSON.stringify(records),steps=createGovernmentOfficesV321Steps({sourcePrisms:records as any,native:false,mobileLike:false},root=>{provisional=root});let step=steps.next();while(!step.done&&provisional!.children.length===0)step=steps.next();expect(step.done).toBeFalse();expect(provisional!.children.length>0).toBeTrue();steps.return(null);expect(provisional!.children).toHaveLength(0);expect(JSON.stringify(records)).toBe(before);
});
test('cancelling post-commit parking restores only its registered pending family and preserves persistent owners',()=>{
 const f=fixture(),p=preview(f),w=workerFamily(),steps=f.bundle.stagePreviousSteps(w.family);
 let step=steps.next();while(!step.done&&!parkingFamilies.has(w.family))step=steps.next();
 expect(step.done).toBeFalse();expect(parkingFamilies.has(w.family)).toBeTrue();expect(w.mesh.geometry).not.toBe(w.original);
 expect(f.bundle.complete()).toBeTrue();steps.return(false);
 expect(w.mesh.geometry).toBe(w.original);expect(f.bundle.complete()).toBeTrue();expect(p.mesh.geometry).not.toBe(p.original);
 for(const source of f.families)expect(source.mesh.geometry).not.toBe(source.original);
 f.bundle.releaseFamily(w.family);expect(f.bundle.complete()).toBeTrue();expect(f.bundle.root.visible).toBeTrue();
});
test('a real replacement gate failure during post-commit parking restores every source family atomically',()=>{
 const f=fixture(),p=preview(f),w=workerFamily(),steps=f.bundle.stagePreviousSteps(w.family);
 let step=steps.next();while(!step.done&&!parkingFamilies.has(w.family))step=steps.next();
 expect(step.done).toBeFalse();f.bundle.root.visible=false;expect(drain(steps)).toBeFalse();
 expect(w.mesh.geometry).toBe(w.original);expect(p.mesh.geometry).toBe(p.original);expect(f.bundle.complete()).toBeFalse();
 for(const source of f.families)expect(source.mesh.geometry).toBe(source.original);
});
function pressFamily(world?:Group){const family=new Group(),mesh=new Mesh(geo(0),new MeshBasicMaterial({vertexColors:true}));
 family.name='Press quarter v272 complete measured architecture';mesh.name='Actual separate PressQuarter fitting host';family.add(mesh);world?.add(family);return{family,mesh,original:mesh.geometry};}
test('the separate PressQuarter family retires once without imposing its component on Core or Worker families',()=>{
 const f=fixture(),p=pressFamily(f.world),w=workerFamily();let swaps=0;
 expect(drain(f.bundle.stagePressQuarterSteps(p.family,{beforeSwap(){swaps++}}))).toBeTrue();expect(p.mesh.geometry).not.toBe(p.original);
 expect(drain(f.bundle.stagePressQuarterSteps(p.family))).toBeTrue();expect(swaps).toBe(1);
 expect(drain(f.bundle.stagePreviousSteps(w.family))).toBeTrue();expect(f.bundle.complete()).toBeTrue();f.bundle.releaseFamily(w.family);
 f.bundle.rollback();expect(p.mesh.geometry).toBe(p.original);for(const source of f.families)expect(source.mesh.geometry).toBe(source.original);
});
test('PressQuarter staging requires its literal host and an attached world path, never a parentless Worker',()=>{
 const f=fixture(),p=pressFamily();expect(drain(f.bundle.stagePressQuarterSteps(p.family))).toBeFalse();
 f.world.add(p.family);p.family.name='foreign public label';expect(drain(f.bundle.stagePressQuarterSteps(p.family))).toBeFalse();
 expect(p.mesh.geometry).toBe(p.original);expect(f.bundle.complete()).toBeTrue();
});
test('a missing or changed PressQuarter source receipt keeps the whole optional factory closed',()=>{
 invalidPressReceipt=true;try{expect(createGovernmentOfficesV321({sourcePrisms:records as any,native:false,mobileLike:false})).toBeNull();}finally{invalidPressReceipt=false;}
});
test('a static PressQuarter group cannot use the absent-owner exception allowed for unrelated Worker batches',()=>{
 const f=fixture(),p=pressFamily(f.world);p.mesh.name='unknown old fitting host';expect(drain(f.bundle.stagePressQuarterSteps(p.family))).toBeFalse();
 expect(p.mesh.geometry).toBe(p.original);expect(f.bundle.complete()).toBeFalse();for(const source of f.families)expect(source.mesh.geometry).toBe(source.original);
});
test('PressQuarter cancellation during source parking restores that family without closing persistent Core',()=>{
 const f=fixture(),p=pressFamily(f.world),steps=f.bundle.stagePressQuarterSteps(p.family);let step=steps.next();while(!step.done&&!parkingFamilies.has(p.family))step=steps.next();
 expect(step.done).toBeFalse();expect(p.mesh.geometry).not.toBe(p.original);expect(f.bundle.complete()).toBeTrue();steps.return(false);
 expect(p.mesh.geometry).toBe(p.original);expect(f.bundle.complete()).toBeTrue();for(const source of f.families)expect(source.mesh.geometry).not.toBe(source.original);
});
console.log(JSON.stringify({governmentFamilyV321Cases:cases,assertions,failures}));if(failures)process.exitCode=1;
