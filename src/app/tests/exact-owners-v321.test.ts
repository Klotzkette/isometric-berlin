import {describe,expect,test} from "bun:test";
import {BufferAttribute,BufferGeometry,BoxGeometry,Group,InstancedMesh,LineBasicMaterial,LineSegments,Matrix4,Mesh,MeshBasicMaterial} from "three";
import {createExactOwnersSourceV321,createExactOwnersSourceV321Steps,stageExactOwnersV321,stageExactOwnersV321Steps,type ExactOwnersPlanV321,type ExactComponentV321} from "../src/ExactOwnersV321";
import {interleaveStaticGeometry} from "../src/interleaveStaticGeometry";
import {parkStaticGeometrySteps,parkStaticInstancesSteps} from "../src/losslessStaticStorage";
const b64=(a:ArrayBufferView)=>Buffer.from(a.buffer,a.byteOffset,a.byteLength).toString("base64");
function drain<T>(g:Generator<void,T>):T{for(;;){const r=g.next();if(r.done)return r.value;}}
function control(p:unknown):number{const s=JSON.stringify(p);let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;return h;}
function component(o:Mesh|LineSegments,retire=true):ExactComponentV321{return {name:o.name,kind:o instanceof InstancedMesh?"instances":o instanceof LineSegments?"lines":"mesh",retire,
 attributes:Object.fromEntries(Object.entries(o.geometry.attributes).map(([key,a])=>[key,{type:a.array.constructor.name,itemSize:a.itemSize,normalized:a.normalized,bytes:b64(a.array)}])),
 index:o.geometry.index?{type:o.geometry.index.array.constructor.name,bytes:b64(o.geometry.index.array)}:null,
 instances:o instanceof InstancedMesh?{count:o.count,matrix:b64(o.instanceMatrix.array),color:o.instanceColor?b64(o.instanceColor.array):null}:null};}
const source={id:"exact-one",ring:[[0,0],[30,0],[30,30],[0,30]],holes:[],y0_dm:30,h_dm:100,class:0,roof:1000};
function geometry(offset=0){const g=new BufferGeometry();g.setAttribute("position",new BufferAttribute(new Float32Array([offset,-0,0,offset+1,0,0,offset,1,0]),3));g.setAttribute("normal",new BufferAttribute(new Float32Array([0,0,1,0,0,1,0,0,1]),3));g.setAttribute("color",new BufferAttribute(new Uint8Array([120,121,122,120,121,122,120,121,122]),3,true));return g;}
function fixture(){const root=new Group(),body=new Mesh(geometry(),new MeshBasicMaterial({vertexColors:true}));body.name="LoD2 prism buildings";
 const axis=new LineSegments(new BufferGeometry(),new LineBasicMaterial());axis.name="LoD2 facade axes";
 axis.geometry.setAttribute("position",new BufferAttribute(new Float32Array([0,3,0,0,9,0]),3));axis.geometry.setAttribute("lineDistance",new BufferAttribute(new Uint16Array([0,600]),1));
 const panes=new InstancedMesh(new BoxGeometry(1,1,1),new MeshBasicMaterial(),1);panes.name="LoD2 facade night strips";panes.setMatrixAt(0,new Matrix4().makeTranslation(3,4,5));
 root.add(body,axis,panes);const plan:ExactOwnersPlanV321={schemaVersion:1,native:false,owners:[{id:source.id,sourcePrism:structuredClone(source),components:[component(body),component(axis),component(panes)]}]};
 const bg=geometry(20),p=new Float32Array([...body.geometry.getAttribute("position").array,...bg.getAttribute("position").array]);body.geometry.setAttribute("position",new BufferAttribute(p,3));
 body.geometry.setAttribute("normal",new BufferAttribute(new Float32Array([...body.geometry.getAttribute("normal").array,...bg.getAttribute("normal").array]),3));
 body.geometry.setAttribute("color",new BufferAttribute(new Uint8Array([...body.geometry.getAttribute("color").array,...bg.getAttribute("color").array]),3,true));
 axis.geometry.setAttribute("position",new BufferAttribute(new Float32Array([0,3,0,0,9,0,20,0,20,21,0,21]),3));axis.geometry.setAttribute("lineDistance",new BufferAttribute(new Uint16Array([0,600,0,141]),1));
 return {root,body,axis,panes,plan,rows:[structuredClone(source)]};}
function receipt(f:ReturnType<typeof fixture>){return createExactOwnersSourceV321(f.plan,f.rows,control(f.plan))!;}

describe("exact finite owner transfer",()=>{
 test("stages without mutation, preserves every outside word, and restores exact refs",()=>{
  const f=fixture(),r=receipt(f),g=f.body.geometry,line=f.axis.geometry,m=f.panes.instanceMatrix;
  const oldPosition=f.body.geometry.getAttribute("position"),before=b64(oldPosition.array),calls:string[]=[];
  const tx=stageExactOwnersV321(f.root,r,true,{beforeSwap(o,k){calls.push(o.name+":"+k);return true;},afterSwap(){calls.push("queued");}})!;
  expect(tx).not.toBeNull();expect(tx.prepared()).toBe(true);expect(tx.complete()).toBe(false);expect(f.body.geometry).toBe(g);expect(f.axis.geometry).toBe(line);expect(f.panes.instanceMatrix).toBe(m);
  new Group().add(f.root);
  expect(tx.commit(true)).toBe(true);expect(tx.complete()).toBe(true);expect(tx.activeOwners).toEqual([source.id]);
  new Group().add(f.root);expect(tx.complete()).toBe(true);
  expect(f.body.geometry.getAttribute("position")).toBe(oldPosition);expect(b64(oldPosition.array)).toBe(before);
  expect([...f.body.geometry.index!.array]).toEqual([0,0,0,3,4,5]);expect([...f.axis.geometry.index!.array]).toEqual([0,0,2,3]);
  expect([...f.panes.instanceMatrix.array].slice(12)).toEqual([3,4,5,1]);expect([...f.panes.instanceMatrix.array].slice(0,12).every(v=>v===0)).toBe(true);
  tx.rollback();expect(tx.complete()).toBe(false);expect(f.body.geometry).toBe(g);expect(f.axis.geometry).toBe(line);expect(f.panes.instanceMatrix).toBe(m);expect(calls.filter(s=>s==="queued").length).toBe(2);
 });
 test("source binding rejects foreign/getter/duplicate/changed rows and wrong literal controls",()=>{
  for(const change of [(f:ReturnType<typeof fixture>)=>f.rows.push(f.rows[0]),(f:ReturnType<typeof fixture>)=>{f.rows[0].h_dm++;},(f:ReturnType<typeof fixture>)=>{Object.defineProperty(f.rows[0],"h_dm",{get:()=>100,enumerable:true});}]){
   const f=fixture();change(f);expect(createExactOwnersSourceV321(f.plan,f.rows,control(f.plan))).toBeNull();}
  const f=fixture();expect(createExactOwnersSourceV321(f.plan,f.rows,control(f.plan)^1)).toBeNull();expect(stageExactOwnersV321(f.root,{source:true},true)).toBeNull();
 });
 test("cooperative source binding yields and rechecks selected source words before issuing its private receipt",()=>{
  const populate=(f:ReturnType<typeof fixture>)=>{for(let i=0;i<1024;i++)f.rows.push({...structuredClone(source),id:"unrelated-"+i});return f;};
  const f=populate(fixture()),g=createExactOwnersSourceV321Steps(f.plan,f.rows,control(f.plan));
  expect(g.next().done).toBe(false);f.rows[0].ring[0][0]=1;expect(drain(g)).toBeNull();
  const original=populate(fixture()),steps=createExactOwnersSourceV321Steps(original.plan,original.rows,control(original.plan));
  expect(steps.next().done).toBe(false);const r=drain(steps);expect(r).not.toBeNull();
  const tx=stageExactOwnersV321(original.root,r!,true)!;expect(tx.commit(true)).toBe(true);tx.rollback();
  const cancelled=populate(fixture()),pending=createExactOwnersSourceV321Steps(cancelled.plan,cancelled.rows,control(cancelled.plan));
  expect(pending.next().done).toBe(false);pending.return(null);expect(cancelled.body.geometry.index).toBeNull();
 });
 test("absent legitimate batch succeeds empty; any incomplete, changed or duplicate family closes",()=>{
  const f=fixture(),r=receipt(f),empty=new Group(),tx=stageExactOwnersV321(empty,r,true)!;expect(tx.activeOwners).toEqual([]);expect(tx.commit(true)).toBe(true);tx.rollback();
  f.axis.removeFromParent();expect(stageExactOwnersV321(f.root,r,true)).toBeNull();
  const a=fixture();a.body.geometry.getAttribute("normal").setX(0,1);expect(stageExactOwnersV321(a.root,receipt(a),true)).toBeNull();
  const d=fixture();d.root.add(d.body.clone());expect(stageExactOwnersV321(d.root,receipt(d),true)).toBeNull();
 });
 test("cancellation/stale raw word/gate change/manual disposal cannot publish; failed callbacks roll back",()=>{
  const f=fixture(),r=receipt(f),original=f.body.geometry,g=stageExactOwnersV321Steps(f.root,r,true);expect(g.next().done).toBe(false);g.return(null);expect(f.body.geometry).toBe(original);
  const staged=stageExactOwnersV321(f.root,r,true)!;f.body.geometry.getAttribute("position").setX(0,.25);expect(staged.commit(true)).toBe(false);expect(f.body.geometry).toBe(original);
  const n=fixture(),nr=receipt(n),nt=stageExactOwnersV321(n.root,nr,true)!;n.body.geometry.dispose();expect(nt.commit(true)).toBe(false);
  const fail=fixture(),old=fail.body.geometry,ft=stageExactOwnersV321(fail.root,receipt(fail),true,{beforeSwap(){return false;}})!;expect(ft.commit(true)).toBe(false);expect(fail.body.geometry).toBe(old);
  const closed=fixture();expect(stageExactOwnersV321(closed.root,receipt(closed))).toBeNull();
 });
 test("real interleave and parked storage preserve exact canonical tuple admission",()=>{
  const f=fixture();f.panes.geometry.userData.exactIndexPending=false;interleaveStaticGeometry(f.root);
  drain(parkStaticGeometrySteps(f.root));drain(parkStaticInstancesSteps(f.root));const tx=stageExactOwnersV321(f.root,receipt(f),true)!;
  expect(tx).not.toBeNull();expect(tx.commit(true)).toBe(true);expect(tx.complete()).toBe(true);f.root.position.x=1;expect(tx.complete()).toBe(false);tx.rollback();
 });
});
