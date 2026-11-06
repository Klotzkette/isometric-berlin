import {expect,test} from "bun:test";
import {BoxGeometry,Group,InstancedMesh,Matrix4,MeshBasicMaterial} from "three";
import {createExactOwnersSourceV321,composeExactOwnersSourcesV321,stageExactOwnersV321,type ExactOwnersPlanV321} from "../src/ExactOwnersV321";
const bytes=(a:ArrayBufferView)=>Buffer.from(a.buffer,a.byteOffset,a.byteLength).toString("base64");
function control(p:unknown){let h=2166136261;for(const c of JSON.stringify(p))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h;}
function fixture(){
 const record={id:"two-real-intervals",ring:[[0,0],[40,0],[40,40],[0,40]],holes:[],y0_dm:10,h_dm:20,class:3};
 const geometry=new BoxGeometry(1,1,1),material=new MeshBasicMaterial(),owned=new InstancedMesh(geometry,material,2),host=new InstancedMesh(geometry,material,3),root=new Group();
 owned.name=host.name="Voxel building columns";
 for(let i=0;i<3;i++){const matrix=new Matrix4().makeScale(4,1,4);matrix.setPosition(i<2?2:18,i===1?2.5:1.5,2);host.setMatrixAt(i,matrix);if(i<2)owned.setMatrixAt(i,matrix);}
 root.add(host);
 const voxels={cell_m:4,grid:{min_x_idx:0,min_z_idx:0},building_rows:[[[0,1,10,20,3],[0,1,20,30,3],[4,1,10,20,3]]]};
 const plan:ExactOwnersPlanV321={schemaVersion:1,native:true,owners:[{id:record.id,sourcePrism:structuredClone(record),retireBody:true,components:[{name:owned.name,kind:"instances",retire:true,
  attributes:Object.fromEntries(Object.entries(geometry.attributes).map(([k,a])=>[k,{type:a.array.constructor.name,itemSize:a.itemSize,normalized:a.normalized,bytes:bytes(a.array)}])),index:{type:geometry.index!.array.constructor.name,bytes:bytes(geometry.index!.array)},instances:{count:2,matrix:bytes(owned.instanceMatrix.array),color:null}}]}],
  nativeSource:{cell:4,grid:{...voxels.grid},columns:[{source:[0,0,10,20,3],contributors:[record.id],retireBody:true},{source:[0,0,20,30,3],contributors:[record.id],retireBody:true}]}};
 return {record,rows:[record],plan,voxels,root,host};
}
const bind=(f:ReturnType<typeof fixture>)=>createExactOwnersSourceV321(f.plan,f.rows,control(f.plan),f.voxels);
test("all exact original intervals in one cell admit and preserve every foreign matrix word on rollback",()=>{
 const f=fixture(),source=bind(f);expect(source).not.toBeNull();const original=f.host.instanceMatrix,foreign=bytes(original.array.slice(32));
 const tx=stageExactOwnersV321(f.root,source!,true)!;expect(tx).not.toBeNull();expect(tx.commit(true)).toBeTrue();expect(tx.complete()).toBeTrue();expect(bytes(f.host.instanceMatrix.array.slice(32))).toBe(foreign);
 tx.rollback();expect(f.host.instanceMatrix).toBe(original);expect(bytes(original.array.slice(32))).toBe(foreign);
});
test("missing, additional, duplicate or changed full signatures close before any source swap",()=>{
 const mutations=[(f:ReturnType<typeof fixture>)=>f.plan.nativeSource!.columns.pop(),
  (f:ReturnType<typeof fixture>)=>f.voxels.building_rows[0].splice(1,1),
  (f:ReturnType<typeof fixture>)=>f.voxels.building_rows[0].push([0,1,30,40,3]),
  (f:ReturnType<typeof fixture>)=>f.voxels.building_rows[0].push([0,1,20,30,3]),
  (f:ReturnType<typeof fixture>)=>f.plan.nativeSource!.columns.push(structuredClone(f.plan.nativeSource!.columns[0])),
  (f:ReturnType<typeof fixture>)=>{f.plan.nativeSource!.columns[1].source[4]=4;},
  (f:ReturnType<typeof fixture>)=>{f.plan.nativeSource!.columns[1].retireBody=false;}];
 for(const change of mutations){const f=fixture(),original=f.host.instanceMatrix;change(f);expect(bind(f)).toBeNull();expect(f.host.instanceMatrix).toBe(original);}
});
test("a positive-area foreign contributor prevents retirement of every interval in the cell",()=>{
 const f=fixture(),other={...structuredClone(f.record),id:"foreign-building"};f.rows.push(other);for(const c of f.plan.nativeSource!.columns)c.contributors.push(other.id);
 expect(bind(f)).toBeNull();
});
test("appended, replaced or shifted live intervals revoke the private source and restore original host references",()=>{
 for(const change of[(f:ReturnType<typeof fixture>)=>f.voxels.building_rows[0].push([0,1,30,40,3]),
  (f:ReturnType<typeof fixture>)=>{f.voxels.building_rows[0][2]=[0,1,30,40,3];},
  (f:ReturnType<typeof fixture>)=>{f.voxels.building_rows[0][2][0]=0;}]){
  const f=fixture(),source=bind(f)!,original=f.host.instanceMatrix,tx=stageExactOwnersV321(f.root,source,true)!;expect(tx.commit(true)).toBeTrue();change(f);expect(tx.complete()).toBeFalse();tx.rollback();expect(f.host.instanceMatrix).toBe(original);
 }
});
test("composition retains distinct full intervals while deduplicating identical complete original tuples",()=>{
 const f=fixture(),other={...structuredClone(f.record),id:"other-proven-owner"};f.rows.push(other);f.plan.owners[0].retireBody=false;f.plan.owners[0].components[0].retire=false;
 for(const c of f.plan.nativeSource!.columns){c.retireBody=false;c.contributors.push(other.id);}
 const second=structuredClone(f.plan);second.owners[0].id=other.id;second.owners[0].sourcePrism=structuredClone(other);
 const source=composeExactOwnersSourcesV321([{plan:f.plan,control:control(f.plan)},{plan:second,control:control(second)}],f.rows,f.voxels);expect(source).not.toBeNull();
 const changed=fixture();changed.plan.nativeSource!.columns[1].contributors.push("unproved");expect(composeExactOwnersSourcesV321([{plan:changed.plan,control:control(changed.plan)}],changed.rows,changed.voxels)).toBeNull();
});

test("mixed two-owner plans pin selected single-cell Z lists as well as the multi-interval list",()=>{
 for(const change of["append","move-in"]){
  const f=fixture(),other={...structuredClone(f.record),id:"single-cell-body-owner",ring:[[0,40],[40,40],[40,80],[0,80]],h_dm:10};f.rows.push(other);
  const matrix=new Matrix4().makeScale(4,1,4);matrix.setPosition(2,1.5,6);f.host.setMatrixAt(2,matrix);
  const component=structuredClone(f.plan.owners[0].components[0]);component.instances={count:1,matrix:bytes(f.host.instanceMatrix.array.slice(32,48)),color:null};
  f.plan.owners.push({id:other.id,sourcePrism:structuredClone(other),retireBody:true,components:[component]});
  f.plan.nativeSource!.columns.push({source:[0,1,10,20,3],contributors:[other.id],retireBody:true});
  f.voxels.building_rows.push([[0,1,10,20,3]]);
  if(change==="move-in")f.voxels.building_rows[1].push([4,1,20,30,3]);
  const source=bind(f);expect(source).not.toBeNull();const original=f.host.instanceMatrix,originalWords=bytes(original.array),tx=stageExactOwnersV321(f.root,source!,true)!;expect(tx).not.toBeNull();expect(tx.activeOwners).toHaveLength(2);expect(tx.commit(true)).toBeTrue();expect(tx.complete()).toBeTrue();
  if(change==="append")f.voxels.building_rows[1].push([0,1,20,30,3]);else f.voxels.building_rows[1][1][0]=0;
  expect(tx.complete()).toBeFalse();tx.rollback();expect(f.host.instanceMatrix).toBe(original);expect(bytes(original.array)).toBe(originalWords);
 }
});
