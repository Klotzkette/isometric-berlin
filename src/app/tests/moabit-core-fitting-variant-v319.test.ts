import { expect,test } from "bun:test";
import {
  BoxGeometry,BufferAttribute,BufferGeometry,Group,InstancedBufferAttribute,
  InstancedMesh,LineBasicMaterial,LineSegments,MeshBasicMaterial,
} from "three";
import receipts from "../src/data/moabitMitteV300CoreFittingReceipts.json";
import owners from "../src/data/moabitMitteV300Owners.json";
import { prepareMoabitMitteV300CoreFittingRetirement } from "../src/MoabitMitteV300CoreFittings";
import { moabitCoreFittingVariantV319 } from "../src/MoabitCoreFittingVariantV319";

const canonical=[-465.9246826171875,6.400000095367432,-1082.584716796875,
  -465.9246826171875,21.503223419189453,-1082.584716796875];
const alternative=[...canonical];alternative[4]=21.50322151184082;
const canonicalStrip=[-.2610611617565155,0,.10122779756784439,0,0,15.10322380065918,0,0,
  .36152786016464233,0,.9323613047599792,0,-465.9246826171875,13.951611518859863,-1082.584716796875,1];
const alternateStrip=[...canonicalStrip];alternateStrip[5]=15.103221893310547;alternateStrip[13]=13.951610565185547;
const args={sourceBodiesFiltered:true,buildings:owners.retainedPrisms};
function fixture(v8=false):Group {
  const root=new Group(),batches=new Map<string,{kind:string;rows:number[][]}>();
  for(const receipt of receipts.families.find(f=>f.kind==="moabit-mitte-v300")!.receipts)
    for(const batch of receipt.batches) {
      const row=batches.get(batch.name)??{kind:batch.kind,rows:[]};
      row.rows.push(...batch.records.map(r=>[...r]));batches.set(batch.name,row);
    }
  for(const [name,batch]of batches) {
    if(!batch.rows.length)continue;
    if(batch.kind==="lines") {
      const rows=batch.rows.map(r=>v8&&r.slice(0,6).every((v,i)=>v===canonical[i])?[...alternative,...r.slice(6)]:r);
      const geometry=new BufferGeometry();
      geometry.setAttribute("position",new BufferAttribute(new Float32Array([...rows.flatMap(r=>r.slice(0,6)),8888,12,8888,8899,12,8899]),3));
      geometry.setAttribute("lineDistance",new BufferAttribute(new Uint16Array([...rows.flatMap(r=>r.slice(6)),0,123]),1));
      const line=new LineSegments(geometry,new LineBasicMaterial());line.name=name;root.add(line);
    }else {
      const rows=batch.rows.map(r=>v8&&name==="LoD2 facade night strips"&&r.every((v,i)=>v===canonicalStrip[i])?alternateStrip:r);
      const mesh=new InstancedMesh(new BoxGeometry(),new MeshBasicMaterial(),batch.rows.length+1);
      mesh.instanceMatrix=new InstancedBufferAttribute(new Float32Array([...rows.flat(),1,0,0,0,0,1,0,0,0,0,1,0,8888,12,8888,1]),16);
      mesh.instanceColor=new InstancedBufferAttribute(new Float32Array(mesh.count*3).fill(.75),3);
      mesh.name=name;root.add(mesh);
    }
  }
  return root;
}
function line(root:Group):LineSegments{return root.getObjectByName("LoD2 facade axes") as LineSegments;}
function target(root:Group):number {
  const p=line(root).geometry.getAttribute("position");
  for(let i=0;i<p.count;i+=2)if(p.getX(i)===alternative[0]&&p.getZ(i)===alternative[2])return i;
  throw Error("Missing exact fixture target");
}
function snapshot(root:Group):Record<string,number[]> {
  const out:Record<string,number[]>={};root.traverse(o=>{
    if(!(o instanceof LineSegments||o instanceof InstancedMesh))return;
    for(const [name,a]of Object.entries(o.geometry.attributes))out[o.name+":"+name]=Array.from(a.array);
    if(o.geometry.index)out[o.name+":index"]=Array.from(o.geometry.index.array);
    if(o instanceof InstancedMesh){out[o.name+":matrix"]=Array.from(o.instanceMatrix.array);out[o.name+":instanceColor"]=Array.from(o.instanceColor!.array);}
  });return out;
}

test.each([false,true])("same exact transaction retires76/70 with every outside/source word retained, V8=%s",v8=>{
  const root=fixture(v8),before=snapshot(root),plan=prepareMoabitMitteV300CoreFittingRetirement(root,args)!;
  expect(plan).toBeDefined();expect([plan.lineSegments,plan.instances]).toEqual([76,70]);
  expect(snapshot(root)).toEqual(before);expect(plan.apply()).toBeTrue();expect(plan.apply()).toBeFalse();
  for(const o of root.children) {
    if(o instanceof LineSegments) {
      const p=Array.from(o.geometry.getAttribute("position").array),old=before[o.name+":position"];
      expect(p.slice(-6)).toEqual(old.slice(-6));
      for(let i=0;i<p.length-6;i+=6){expect(p.slice(i,i+3)).toEqual(old.slice(i,i+3));expect(p.slice(i+3,i+6)).toEqual(old.slice(i,i+3));}
      expect(Array.from(o.geometry.getAttribute("lineDistance").array)).toEqual(before[o.name+":lineDistance"]);
    }else if(o instanceof InstancedMesh) {
      const matrix=Array.from(o.instanceMatrix.array),old=before[o.name+":matrix"];
      expect(matrix.slice(-16)).toEqual(old.slice(-16));
      for(let i=0;i<matrix.length-16;i+=16){expect(matrix.slice(i,i+12)).toEqual(Array(12).fill(0));expect(matrix.slice(i+12,i+16)).toEqual(old.slice(i+12,i+16));}
      expect(Array.from(o.instanceColor!.array)).toEqual(before[o.name+":instanceColor"]);
      for(const [name,a]of Object.entries(o.geometry.attributes))expect(Array.from(a.array)).toEqual(before[o.name+":"+name]);
      expect(Array.from(o.geometry.index!.array)).toEqual(before[o.name+":index"]);
    }
  }
});

test("original default family guard is unchanged; alternate requires exact supplied owner and full original receipt",()=>{
  const original=fixture(),alternate=fixture(true);
  expect(prepareMoabitMitteV300CoreFittingRetirement(original,{sourceBodiesFiltered:true})).toBeDefined();
  expect(prepareMoabitMitteV300CoreFittingRetirement(alternate,{sourceBodiesFiltered:true})).toBeUndefined();
  expect(moabitCoreFittingVariantV319(alternate,owners.retainedPrisms,{...receipts,schemaVersion:2})).toBeUndefined();
  expect(moabitCoreFittingVariantV319(alternate,owners.retainedPrisms,receipts)).toBeDefined();
  expect(moabitCoreFittingVariantV319(original,owners.retainedPrisms,receipts)).toBeUndefined();
  const changed=owners.retainedPrisms.map(p=>p.id==="sN3KUQ9U"?{...p,h_dm:p.h_dm+1}:p);
  expect(prepareMoabitMitteV300CoreFittingRetirement(alternate,{...args,buildings:changed})).toBeUndefined();
  expect(prepareMoabitMitteV300CoreFittingRetirement(alternate,{...args,buildings:owners.retainedPrisms.filter(p=>p.id!=="sN3KUQ9U")} )!.lineSegments).toBe(70);
  expect(moabitCoreFittingVariantV319(alternate,[...owners.retainedPrisms,owners.retainedPrisms.find(p=>p.id==="sN3KUQ9U")!],receipts)).toBeUndefined();
});

test("wrong word, another ULP, wrong distance, duplicate alternate and hybrid pair reject without mutations",()=>{
  for(const mode of ["other-ulp","x-word","distance","duplicate","canonical-strip","strip-word","duplicate-strip"]){
    const root=fixture(true),geometry=line(root).geometry,p=geometry.getAttribute("position"),at=target(root);
    if(mode==="other-ulp")p.setY(at+1,21.503219604492188);
    if(mode==="x-word")p.setX(at+1,p.getX(at+1)+.01);
    if(mode==="distance")geometry.getAttribute("lineDistance").setX(at+1,1);
    if(mode==="duplicate") {
      geometry.setAttribute("position",new BufferAttribute(new Float32Array([...p.array,...alternative]),3));
      geometry.setAttribute("lineDistance",new BufferAttribute(new Uint16Array([...geometry.getAttribute("lineDistance").array,0,0]),1));
    }
    if(mode.includes("strip")) {
      const strip=root.getObjectByName("LoD2 facade night strips") as InstancedMesh;
      const values=strip.instanceMatrix.array;
      let row=-1;
      for(let i=0;i<strip.count;i++)if(values[i*16+12]===alternateStrip[12]&&values[i*16+14]===alternateStrip[14])row=i;
      expect(row).toBeGreaterThanOrEqual(0);
      if(mode==="canonical-strip")values.set(canonicalStrip,row*16);
      if(mode==="strip-word")values[row*16+5]=15.10322093963623;
      if(mode==="duplicate-strip") {
        strip.instanceMatrix=new InstancedBufferAttribute(new Float32Array([...values,...alternateStrip]),16);strip.count++;
        strip.instanceColor=new InstancedBufferAttribute(new Float32Array(strip.count*3).fill(.75),3);
      }
    }
    const before=snapshot(root);expect(prepareMoabitMitteV300CoreFittingRetirement(root,args)).toBeUndefined();expect(snapshot(root)).toEqual(before);
  }
});

test("alternate still requires all75 other lines and all69 other matrices, with strict apply-time identity/words",()=>{
  for(const mode of ["other-line","matrix","after-word","after-attribute"]){
    const root=fixture(true),geometry=line(root).geometry,p=geometry.getAttribute("position");
    if(mode==="other-line")p.setX(0,p.getX(0)+.25);
    if(mode==="matrix")((root.children.find(o=>o instanceof InstancedMesh))as InstancedMesh).instanceMatrix.setX(0,4);
    const plan=prepareMoabitMitteV300CoreFittingRetirement(root,args);
    if(mode.startsWith("after")) {
      expect(plan).toBeDefined();
      if(mode==="after-word")p.setY(target(root)+1,21.503219604492188);
      else geometry.setAttribute("position",new BufferAttribute(new Float32Array(p.array),3));
      const before=snapshot(root);expect(plan!.apply()).toBeFalse();expect(snapshot(root)).toEqual(before);
    }else expect(plan).toBeUndefined();
  }
});
