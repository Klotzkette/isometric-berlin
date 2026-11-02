import { describe, expect, it } from "bun:test";
import { BoxGeometry, BufferAttribute, BufferGeometry, Group, InstancedBufferAttribute, InstancedMesh, LineBasicMaterial, LineSegments, MeshBasicMaterial } from "three";
import data from "../src/data/moabitMitteV300CoreFittingReceipts.json";
import owners from "../src/data/moabitMitteV300Owners.json";
import { prepareMoabitMitteV300CoreFittingRetirement, prepareWestKiezV302CoreFittingRetirement } from "../src/MoabitMitteV300CoreFittings";
function fixture(){
 const root=new Group(),rows=new Map<string,{kind:string;values:number[][]}>();
 for(const r of data.families.find(f=>f.kind==='moabit-mitte-v300')!.receipts)for(const b of r.batches){const entry=rows.get(b.name)??{kind:b.kind,values:[]};entry.values.push(...b.records);rows.set(b.name,entry);}
 for(const[name,b]of rows){if(!b.values.length)continue;if(b.kind==='lines'){
  const geometry=new BufferGeometry(),p=b.values.flatMap(r=>r.slice(0,6)),d=b.values.flatMap(r=>r.slice(6));p.push(8888,12,8888,8899,12,8899);d.push(0,123);
  geometry.setAttribute('position',new BufferAttribute(new Float32Array(p),3));geometry.setAttribute('lineDistance',new BufferAttribute(new Uint16Array(d),1));const object=new LineSegments(geometry,new LineBasicMaterial());object.name=name;root.add(object);
 }else{const mesh=new InstancedMesh(new BoxGeometry(),new MeshBasicMaterial(),b.values.length+1);mesh.instanceMatrix=new InstancedBufferAttribute(new Float32Array([...b.values.flat(),1,0,0,0,0,1,0,0,0,0,1,0,8888,12,8888,1]),16);mesh.name=name;root.add(mesh);}}
 return root;
}
function snapshot(root:Group){const result:Record<string,number[]>={};root.traverse(o=>{if(o instanceof LineSegments){result[o.name]=Array.from(o.geometry.getAttribute('position').array);result[o.name+' distances']=Array.from(o.geometry.getAttribute('lineDistance').array);}else if(o instanceof InstancedMesh)result[o.name]=Array.from(o.instanceMatrix.array);});return result;}
function release(root:Group){root.traverse(o=>{if(o instanceof LineSegments||o instanceof InstancedMesh){o.geometry.dispose();(o.material as LineBasicMaterial).dispose();if(o instanceof InstancedMesh)o.dispose();}});root.clear();}
describe('actual core fitting receipt transaction v300',()=>{
 it('keeps all outside bytes and every translation, retires the complete captured76/70 exactly once',()=>{
  const root=fixture(),before=snapshot(root);expect(prepareMoabitMitteV300CoreFittingRetirement(root)).toBeUndefined();const plan=prepareMoabitMitteV300CoreFittingRetirement(root,{sourceBodiesFiltered:true});expect(plan).toBeDefined();expect(plan!.lineSegments).toBe(76);expect(plan!.instances).toBe(70);expect(plan!.apply()).toBe(true);expect(plan!.apply()).toBe(false);
  for(const o of root.children){if(o instanceof LineSegments){const p=Array.from(o.geometry.getAttribute('position').array),prior=before[o.name];expect(p.slice(-6)).toEqual(prior.slice(-6));expect(Array.from(o.geometry.getAttribute('lineDistance').array)).toEqual(before[o.name+' distances']);for(let at=0;at<p.length-6;at+=6){expect(p.slice(at,at+3)).toEqual(prior.slice(at,at+3));expect(p.slice(at+3,at+6)).toEqual(p.slice(at,at+3));}}else if(o instanceof InstancedMesh){const p=Array.from(o.instanceMatrix.array),prior=before[o.name];expect(p.slice(-16)).toEqual(prior.slice(-16));for(let at=0;at<p.length-16;at+=16){expect(p.slice(at,at+12)).toEqual(Array(12).fill(0));expect(p.slice(at+12,at+16)).toEqual(prior.slice(at+12,at+16));}}}
  const west=prepareWestKiezV302CoreFittingRetirement(root,{sourceBodiesFiltered:true});expect([west!.lineSegments,west!.instances]).toEqual([0,0]);release(root);
 });
 it('resolves only complete exact owners actually present in a progressive core batch',()=>{
  const root=fixture(),owner=owners.retainedPrisms.find(p=>p.id==='K0002SES')!;
  const plan=prepareMoabitMitteV300CoreFittingRetirement(root,{sourceBodiesFiltered:true,buildings:[owner]});expect([plan!.lineSegments,plan!.instances]).toEqual([12,1]);
  expect(prepareMoabitMitteV300CoreFittingRetirement(root,{sourceBodiesFiltered:true,buildings:[{...owner,h_dm:owner.h_dm+1}]})).toBeUndefined();
  const before=snapshot(root);expect(plan!.apply()).toBe(true);const after=snapshot(root);expect(Object.keys(after).some(k=>JSON.stringify(after[k])!==JSON.stringify(before[k]))).toBe(true);release(root);
 });
 it('rejects any missing or changed actual predecessor before touching another batch',()=>{
  const root=fixture(),line=root.getObjectByName('LoD2 facade axes') as LineSegments;line.geometry.getAttribute('position').setX(0,999);const before=snapshot(root);expect(prepareMoabitMitteV300CoreFittingRetirement(root,{sourceBodiesFiltered:true})).toBeUndefined();expect(snapshot(root)).toEqual(before);release(root);
 });
 it('rechecks buffer identity and affected bytes between prepare and atomic apply',()=>{
  for(const change of ['array','value']){const root=fixture(),plan=prepareMoabitMitteV300CoreFittingRetirement(root,{sourceBodiesFiltered:true})!,line=root.getObjectByName('LoD2 facade axes')as LineSegments,p=line.geometry.getAttribute('position');if(change==='array')line.geometry.setAttribute('position',new BufferAttribute(new Float32Array(p.array),3));else p.setY(0,p.getY(0)+.25);const before=snapshot(root);expect(plan.apply()).toBe(false);expect(snapshot(root)).toEqual(before);release(root);}
 });
});
