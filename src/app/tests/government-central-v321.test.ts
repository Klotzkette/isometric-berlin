import {expect,test} from "bun:test";
import {readFileSync} from "node:fs";
import {BufferAttribute,BufferGeometry,Group,LineBasicMaterial,LineSegments,Mesh,MeshBasicMaterial,MeshStandardMaterial} from "three";
import {createGovernmentCentralV321} from "../src/GovernmentCentralV321";
import {federalMinistryCentralPlanV321} from "../src/federalMinistryPreviousV321";
import type {ExactAttributeV321} from "../src/ExactOwnersV321";
import {interleaveStaticGeometry} from "../src/interleaveStaticGeometry";
import {parkStaticGeometrySteps} from "../src/losslessStaticStorage";
import type {PrismBuilding} from "../src/IsometricCityWorld";

const all=JSON.parse(readFileSync(new URL("../public/mesh/regierungsviertel/lod2-prisms.json",import.meta.url),"utf8")).buildings as PrismBuilding[];
const plan=federalMinistryCentralPlanV321().plan;
const actual=plan.owners.map(owner=>all.find(p=>p.id===owner.id)!);
const bytes=(a:ArrayBufferView)=>Buffer.from(a.buffer,a.byteOffset,a.byteLength).toString("base64");
function drain<T>(steps:Generator<void,T>):T{for(;;){const step=steps.next();if(step.done)return step.value;}}
function decode(a:ExactAttributeV321):BufferAttribute{
  const types={Float32Array,Uint8Array,Uint16Array,Uint32Array};
  const Type=types[a.type as keyof typeof types],raw=Uint8Array.from(Buffer.from(a.bytes,"base64"));
  return new BufferAttribute(new Type(raw.buffer),a.itemSize,a.normalized);
}
function fixture(){
  const scene=new Group(),drawn=new Group(),native=new Group(),root=new Group();scene.add(drawn,native,root);
  root.updateMatrix();root.matrixAutoUpdate=false;
  const objects=plan.owners.flatMap(owner=>owner.components.map(component=>{
    const geometry=new BufferGeometry(),size=component.kind==="lines"?2:3;
    for(const[key,a]of Object.entries(component.attributes)){
      const field=decode(a),Type=field.array.constructor as typeof Float32Array,extra=new Type(size*field.itemSize);
      for(let i=0;i<size;i++)for(let j=0;j<field.itemSize;j++)extra[i*field.itemSize+j]=field.array[j]+(key==="position"?1000+i:0);
      geometry.setAttribute(key,new BufferAttribute(new Type([...field.array,...extra]),field.itemSize,field.normalized));
    }
    if(component.index){const index=decode({...component.index,itemSize:1,normalized:false}),Type=index.array.constructor as typeof Uint16Array,n=geometry.getAttribute("position").count-size;geometry.setIndex(new BufferAttribute(new Type([...index.array,...Array.from({length:size},(_,i)=>n+i)]),1));}
    const day=component.kind==="lines"?new LineBasicMaterial({vertexColors:true}):new MeshBasicMaterial({vertexColors:true});
    const night=component.kind==="lines"?new LineBasicMaterial({vertexColors:true}):new MeshStandardMaterial({vertexColors:true});
    const object=component.kind==="lines"?new LineSegments(geometry,day):new Mesh(geometry,day);object.name=component.name;object.userData={dayMaterial:day,nightMaterial:night};root.add(object);
    return{object,original:geometry,attributes:Object.fromEntries(Object.entries(geometry.attributes).map(([k,a])=>[k,{object:a,bytes:bytes(a.array)}])),size};
  }));
  let ready=true,world:Group|null=drawn;
  const manager=createGovernmentCentralV321({scene,ready:()=>ready,activeWorld:()=>world});
  expect(manager.prepare(actual)).toBeTrue();
  return{scene,drawn,native,root,manager,objects,setReady:(value:boolean)=>{ready=value},setWorld:(value:Group|null)=>{world=value}};
}

test("the literal five-band and ink plan binds actual original BMB source and leaves every foreign word unchanged",()=>{
  expect(plan.owners).toHaveLength(1);expect(actual[0]).toEqual(plan.owners[0].sourcePrism);expect(plan.native).toBeFalse();
  const f=fixture();let swaps=0;expect(drain(f.manager.stageSteps(f.root,{beforeSwap(){swaps++}}))).toBeTrue();expect(f.manager.sync()).toBeTrue();expect(swaps).toBe(2);
  for(const row of f.objects){
    for(const[k,pin]of Object.entries(row.attributes)){expect(row.object.geometry.getAttribute(k)).toBe(pin.object);expect(bytes(pin.object.array)).toBe(pin.bytes);}
    const index=row.object.geometry.index!,n=row.object.geometry.getAttribute("position").count-row.size;
    expect(Array.from(index.array.slice(-row.size))).toEqual(Array.from({length:row.size},(_,i)=>n+i));
  }
  f.manager.release();for(const row of f.objects)expect(row.object.geometry).toBe(row.original);
});

test("one shared central transaction survives a ready Drawn to Native switch and restores when the active model is missing",()=>{
  const f=fixture();let swaps=0;expect(drain(f.manager.stageSteps(f.root,{beforeSwap(){swaps++}}))).toBeTrue();const live=f.objects.map(r=>r.object.geometry);
  f.setWorld(f.native);expect(f.manager.sync()).toBeTrue();expect(drain(f.manager.stageSteps(f.root))).toBeTrue();expect(swaps).toBe(2);f.objects.forEach((r,i)=>expect(r.object.geometry).toBe(live[i]));
  f.setReady(false);expect(f.manager.sync()).toBeFalse();for(const row of f.objects)expect(row.object.geometry).toBe(row.original);
  f.setReady(true);expect(drain(f.manager.stageSteps(f.root))).toBeTrue();f.manager.dispose();
});

test("only the exact zero-frame Scene sibling can acquire the central owner",()=>{
  for(const change of[(f:ReturnType<typeof fixture>)=>f.root.position.x=1,(f:ReturnType<typeof fixture>)=>f.drawn.position.y=1,(f:ReturnType<typeof fixture>)=>f.drawn.add(f.root)]){
    const f=fixture();change(f);expect(drain(f.manager.stageSteps(f.root))).toBeFalse();for(const row of f.objects)expect(row.object.geometry).toBe(row.original);
  }
  const f=fixture();expect(drain(f.manager.stageSteps(f.root))).toBeTrue();f.root.position.x=2;expect(f.manager.sync()).toBeFalse();for(const row of f.objects)expect(row.object.geometry).toBe(row.original);
});

test("a second runtime manager cannot mutate the same central host until the first owner releases",()=>{
  const f=fixture(),other=createGovernmentCentralV321({scene:f.scene,ready:()=>true,activeWorld:()=>f.drawn});expect(other.prepare(actual)).toBeTrue();expect(drain(f.manager.stageSteps(f.root))).toBeTrue();expect(drain(other.stageSteps(f.root))).toBeFalse();expect(f.manager.sync()).toBeTrue();
  f.manager.release(f.root);expect(drain(other.stageSteps(f.root))).toBeTrue();other.dispose();for(const row of f.objects)expect(row.object.geometry).toBe(row.original);
});

test("missing, partial and duplicated legacy components never obtain the absent progressive exception",()=>{
  const empty=fixture();empty.root.clear();expect(drain(empty.manager.stageSteps(empty.root))).toBeFalse();
  const partial=fixture();partial.objects[1].object.removeFromParent();expect(drain(partial.manager.stageSteps(partial.root))).toBeFalse();expect(partial.objects[0].object.geometry).toBe(partial.objects[0].original);
  const duplicate=fixture();duplicate.root.add(duplicate.objects[0].object.clone());expect(drain(duplicate.manager.stageSteps(duplicate.root))).toBeFalse();
});

test("source mutation and cancellation restore only the exact five bands while normal release is reusable",()=>{
  const f=fixture();expect(drain(f.manager.stageSteps(f.root))).toBeTrue();expect(f.manager.prepare([{...actual[0],h_dm:actual[0].h_dm+1}])).toBeFalse();for(const row of f.objects)expect(row.object.geometry).toBe(row.original);
  expect(f.manager.prepare(actual)).toBeTrue();const steps=f.manager.stageSteps(f.root);expect(steps.next().done).toBeFalse();f.manager.release(f.root);expect(drain(steps)).toBeFalse();for(const row of f.objects)expect(row.object.geometry).toBe(row.original);
  expect(drain(f.manager.stageSteps(f.root))).toBeTrue();f.manager.release(f.root);expect(drain(f.manager.stageSteps(f.root))).toBeTrue();f.manager.dispose();expect(drain(f.manager.stageSteps(f.root))).toBeFalse();
});

test("normal interleave, lighting and parking transitions preserve the same central transaction",()=>{
  const f=fixture();interleaveStaticGeometry(f.root);expect(drain(f.manager.stageSteps(f.root))).toBeTrue();
  for(const row of f.objects)row.object.material=row.object.userData.nightMaterial;
  drain(parkStaticGeometrySteps(f.root));expect(f.manager.sync()).toBeTrue();f.setWorld(f.native);expect(f.manager.sync()).toBeTrue();f.manager.release();for(const row of f.objects)expect(row.object.geometry).toBe(row.original);
});

test("fresh verified source input can recover after the previously bound original source changed",()=>{
  const f=fixture(),first=structuredClone(actual);expect(f.manager.prepare(first)).toBeTrue();expect(drain(f.manager.stageSteps(f.root))).toBeTrue();
  first[0].h_dm++;expect(f.manager.sync()).toBeFalse();for(const row of f.objects)expect(row.object.geometry).toBe(row.original);
  expect(f.manager.prepare(actual)).toBeTrue();expect(drain(f.manager.stageSteps(f.root))).toBeTrue();f.manager.dispose();
});
