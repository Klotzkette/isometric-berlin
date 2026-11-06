/** Separate-process instrumentation of real private parking and GC boundaries. */
import {mock} from "bun:test";
import assert from "node:assert/strict";
import {fileURLToPath} from "node:url";
let cases=0,failures=0,assertions=0;const work:Promise<void>[]=[];
function expect(value:any){return{
 toBe(expected:any){assertions++;assert.strictEqual(value,expected)},toBeTrue(){assertions++;assert.strictEqual(value,true)},
 toBeGreaterThan(expected:number){assertions++;assert.ok(value>expected)},toBeFunction(){assertions++;assert.strictEqual(typeof value,"function")}
}}
function test(name:string,run:()=>Promise<void>){work.push((async()=>{cases++;try{await run()}catch(error){failures++;console.error(name,error)}})())}

import {BufferAttribute,BufferGeometry,Group,Mesh,MeshBasicMaterial} from 'three';
const base=fileURLToPath(new URL('../../',import.meta.url));
const fflate=await import(base+'node_modules/three/examples/jsm/libs/fflate.module.js');const originalInflate=fflate.inflateSync;let inflates=0,inflatedBytes=0;
mock.module(base+'node_modules/three/examples/jsm/libs/fflate.module.js',()=>({...fflate,inflateSync(data:any,options:any){inflates++;inflatedBytes+=options?.out?.byteLength??0;return originalInflate(data,options)}}));
const {parkStaticGeometrySteps}=await import(base+'src/losslessStaticStorage.ts');
const {createExactOwnersSourceV321,stageExactOwnersV321}=await import(base+'src/ExactOwnersV321.ts');
const b64=(a:ArrayBufferView)=>Buffer.from(a.buffer,a.byteOffset,a.byteLength).toString('base64');
const digest=(p:unknown)=>{let h=2166136261;for(const c of JSON.stringify(p))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h;};
function drain<T>(g:Generator<void,T>){for(;;){const r=g.next();if(r.done)return r.value;}}
function geom(n:number){const g=new BufferGeometry(),p=new Float32Array(n*9),normal=new Float32Array(n*9),color=new Float32Array(n*9);for(let i=0;i<n;i++){const x=i===0?0:50;p.set([x,0,0,x+1,0,0,x,1,0],i*9);normal.set([0,0,1,0,0,1,0,0,1],i*9);color.set([.2,.3,.4,.2,.3,.4,.2,.3,.4],i*9);}g.setAttribute('position',new BufferAttribute(p,3));g.setAttribute('normal',new BufferAttribute(normal,3));g.setAttribute('color',new BufferAttribute(color,3));g.setIndex(new BufferAttribute(Uint32Array.from({length:n*3},(_,i)=>i),1));return g;}
test('readiness probes leave losslessly parked city index arrays compressed',async()=>{
 const root=new Group(),small=geom(1),body=new Mesh(geom(12001),new MeshBasicMaterial({vertexColors:true}));body.name='LoD2 prism buildings';root.add(body);
 const source={id:'one',ring:[[0,0],[30,0],[30,30],[0,30]],holes:[],y0_dm:0,h_dm:100,class:0};
 const plan:any={schemaVersion:1,native:false,owners:[{id:source.id,sourcePrism:structuredClone(source),components:[{name:body.name,kind:'mesh',retire:true,attributes:Object.fromEntries(Object.entries(small.attributes).map(([k,a])=>[k,{type:a.array.constructor.name,itemSize:a.itemSize,normalized:a.normalized,bytes:b64(a.array)}])),index:{type:'Uint32Array',bytes:b64(small.index!.array)},instances:null}]}]};
 const receipt=createExactOwnersSourceV321(plan,[source],digest(plan))!,tx=stageExactOwnersV321(root,receipt,true)!;expect(tx.commit(true)).toBeTrue();
 const saved=drain(parkStaticGeometrySteps(root));expect(saved).toBeGreaterThan(64000);expect(Object.getOwnPropertyDescriptor(body.geometry.index!,'array')?.get).toBeFunction();
 inflates=0;inflatedBytes=0;
 for(let frame=0;frame<3;frame++){await new Promise(r=>setTimeout(r,0));Bun.gc(true);expect(tx.complete()).toBeTrue();}
 console.log({frames:3,readinessInflateCalls:inflates,readinessInflatedBytes:inflatedBytes,parkedSavings:saved});
 expect(inflates).toBe(0);tx.rollback();
});

await Promise.all(work);console.log(JSON.stringify({exactOwnersParkV321Cases:cases,assertions,failures}));if(failures)process.exitCode=1;
