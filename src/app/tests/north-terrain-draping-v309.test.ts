import {describe,expect,test} from "bun:test";
import {BoxGeometry,BufferAttribute,BufferGeometry,Group,InstancedBufferAttribute,InstancedMesh,InterleavedBufferAttribute,Matrix4,Mesh,MeshBasicMaterial} from "three";
import {createParkDetails,decodeTrees} from "../src/ParkDetails";
import type {ParkDetailsPayload} from "../src/ParkDetails";
import {prepareNorthTerrainDrapingV309Steps,restoreNorthTerrainDrapingV309,stageNorthTerrainDrapingV309Steps,syncNorthTerrainDrapingV309} from "../src/northTerrainDrapingV309";
import {interleaveStaticGeometry} from "../src/interleaveStaticGeometry";
import {parkStaticGeometrySteps} from "../src/losslessStaticStorage";
import catalog from "../src/data/northTerrainPropsV309.json";
const payload=await Bun.file(new URL("../public/mesh/regierungsviertel/park-details.json",import.meta.url)).json()as ParkDetailsPayload;
const tree=decodeTrees(payload.trees,payload.tree_vocabulary).find(t=>catalog.treeIds.includes(t.id))!;
function fixture(){return createParkDetails({...payload,trees:[tree],tree_vocabulary:undefined,paths:[],playgrounds:[],street_lights:[],wall_traces:[],hedges:[],shrub_patches:[]},{detailProfile:"full",settledDetail:true,exactPrimitiveIndex:false});}
const base={enabled:true,native:false,parkOffsetAt:()=>2,railGroundAt:()=>null,oldGroundAt:()=>tree.position[1]};
function matrices(root:Group){const map=new Map<InstancedMesh,Float32Array>();root.traverse(o=>{if(o instanceof InstancedMesh)map.set(o,new Float32Array(o.instanceMatrix.array));});return map;}
function dispose(root:Group){const seen=new Set<object>();root.traverse(o=>{if(o instanceof Mesh){for(const r of [o.geometry,...(Array.isArray(o.material)?o.material:[o.material])])if(!seen.has(r)){seen.add(r);r.dispose();}if(o instanceof InstancedMesh)o.dispose();}});root.clear();}
describe("retained north terrain props v309",()=>{
 test("exact source tree members translate together and retain every other matrix word",()=>{
  const root=fixture(),before=matrices(root);
  expect(syncNorthTerrainDrapingV309(root)).toBe(0);
  const count=syncNorthTerrainDrapingV309(root,base);expect(count).toBeGreaterThan(3);
  let changed=0;
  for(const[mesh,old]of before){for(let i=0;i<old.length;i++)if(mesh.instanceMatrix.array[i]!==old[i]){expect(i%16).toBe(13);expect(mesh.instanceMatrix.array[i]).toBe(Math.fround(old[i]+2));changed++;}}
  expect(changed).toBe(count);expect(syncNorthTerrainDrapingV309(root,base)).toBe(0);
  expect(restoreNorthTerrainDrapingV309(root)).toBe(count);
  for(const[mesh,old]of before)expect(Array.from(mesh.instanceMatrix.array)).toEqual(Array.from(old));
  dispose(root);
 });
 test("cooperative stage waits for the same synchronous live publisher gate",()=>{
  const root=fixture(),before=matrices(root),work=stageNorthTerrainDrapingV309Steps(root,base);
  let next=work.next();while(!next.done)next=work.next();const transaction=next.value;
  expect(transaction.complete()).toBe(false);expect(transaction.commit(false)).toBe(0);
  for(const[mesh,old]of before)expect(Array.from(mesh.instanceMatrix.array)).toEqual(Array.from(old));
  root.add(new Group());expect(transaction.commit(()=>true)).toBeGreaterThan(3);expect(transaction.complete()).toBe(true);
  expect(transaction.commit(true)).toBe(0);expect(transaction.rollback()).toBeGreaterThan(3);expect(transaction.complete()).toBe(false);
  for(const[mesh,old]of before)expect(Array.from(mesh.instanceMatrix.array)).toEqual(Array.from(old));dispose(root);
 });
 test("staged source-resource changes reject commit without partial translation",()=>{
  const root=fixture(),work=stageNorthTerrainDrapingV309Steps(root,base);let next=work.next();while(!next.done)next=work.next();
  const mesh=root.children.find(c=>c instanceof InstancedMesh)as InstancedMesh;
  mesh.instanceMatrix.needsUpdate=true;const before=matrices(root);
  expect(next.value.commit(true)).toBe(0);expect(next.value.complete()).toBe(false);next.value.rollback();
  for(const[mesh,old]of before)expect(Array.from(mesh.instanceMatrix.array)).toEqual(Array.from(old));dispose(root);
 });
 test("one exact detached parent adoption supports atomic deferred publication",()=>{
  const root=fixture(),before=matrices(root),scene=new Group(),work=stageNorthTerrainDrapingV309Steps(root,base);
  let step=work.next();while(!step.done)step=work.next();const plan=step.value;
  expect(plan.adoptParent(scene)).toBe(false);scene.add(root);
  expect(plan.adoptParent(scene)).toBe(true);expect(plan.adoptParent(scene)).toBe(false);
  expect(plan.commit(true)).toBeGreaterThan(3);expect(plan.complete()).toBe(true);
  expect(plan.rollback()).toBeGreaterThan(3);
  for(const[mesh,old]of before)expect(Array.from(mesh.instanceMatrix.array)).toEqual(Array.from(old));dispose(root);
 });
 test("absolute rail ground wins overlap; re-admission never compounds displacement",()=>{
  const root=fixture(),before=matrices(root),rail={...base,railGroundAt:()=>tree.position[1]+5};
  const count=syncNorthTerrainDrapingV309(root,base);expect(syncNorthTerrainDrapingV309(root,rail)).toBe(count);
  for(const[mesh,old]of before)for(let i=13;i<old.length;i+=16)if(mesh.instanceMatrix.array[i]!==old[i])expect(mesh.instanceMatrix.array[i]).toBe(Math.fround(old[i]+5));
  syncNorthTerrainDrapingV309(root,{enabled:false});for(const[mesh,old]of before)expect(Array.from(mesh.instanceMatrix.array)).toEqual(Array.from(old));dispose(root);
 });
 test("cancelled preparation leaves all original arrays and no partial placement",()=>{
  const root=fixture(),before=matrices(root),steps=prepareNorthTerrainDrapingV309Steps(root,base);
  expect(steps.next().done).toBe(false);steps.return(0);
  for(const[mesh,old]of before)expect(Array.from(mesh.instanceMatrix.array)).toEqual(Array.from(old));dispose(root);
 });
 test("exact source anchors can correct an older wrongly buried tree base",()=>{
  const root=fixture(),before=matrices(root),absolute=tree.position[1]+10;
  const count=syncNorthTerrainDrapingV309(root,{...base,oldGroundAt:()=>tree.position[1]+30,railGroundAt:()=>absolute});
  expect(count).toBeGreaterThan(3);
  for(const[mesh,old]of before)for(let i=13;i<old.length;i+=16)if(mesh.instanceMatrix.array[i]!==old[i])expect(mesh.instanceMatrix.array[i]).toBe(Math.fround(old[i]+10));
  restoreNorthTerrainDrapingV309(root);dispose(root);
 });
 test("interleaved parked batches preserve foreign rows, colours and exact rollback",()=>{
  const real=fixture(),original=real.children.find(c=>c instanceof InstancedMesh&&c.name==="OSM instanced granular tree trunks")as InstancedMesh;
  const root=new Group();root.name=real.name;
  const mesh=new InstancedMesh(original.geometry.clone(),new MeshBasicMaterial(),2000),matrix=new Matrix4();mesh.name=original.name+" [cell 0,0]";
  for(let i=0;i<2000;i++){matrix.makeScale(1,2,1).setPosition(9000+i,4,9000);mesh.setMatrixAt(i,matrix);}
  mesh.instanceMatrix.array.set(original.instanceMatrix.array.slice(0,16),0);
  mesh.instanceColor=new InstancedBufferAttribute(new Float32Array(6000).fill(.25),3);root.add(mesh);
  const before=new Float32Array(mesh.instanceMatrix.array),colors=new Float32Array(mesh.instanceColor.array);
  interleaveStaticGeometry(root);const work=parkStaticGeometrySteps(root,true);let step=work.next();while(!step.done)step=work.next();
  for(const a of Object.values(mesh.geometry.attributes)){const storage=a instanceof InterleavedBufferAttribute?a.data:a;storage.onUploadCallback();}mesh.instanceMatrix.onUploadCallback();mesh.instanceColor.onUploadCallback();
  expect(syncNorthTerrainDrapingV309(root,base)).toBe(1);
  for(let i=0;i<before.length;i++)if(i!==13)expect(mesh.instanceMatrix.array[i]).toBe(before[i]);
  expect(Array.from(mesh.instanceColor.array)).toEqual(Array.from(colors));
  expect(restoreNorthTerrainDrapingV309(root)).toBe(1);expect(Array.from(mesh.instanceMatrix.array)).toEqual(Array.from(before));dispose(root);dispose(real);
 });
 test("only exact source members and plausible path vertices may move",()=>{
  const root=new Group();root.name="Additive open-data park and civic surface details";
  const geometry=new BufferGeometry();geometry.setAttribute("position",new BufferAttribute(new Float32Array([1,4.1,1,2,4.1,1,1,4.1,2]),3));
  const path=new Mesh(geometry,new MeshBasicMaterial());path.name="Berlin park gravel batched path ribbons";
  const architecture=new Mesh(new BoxGeometry(),new MeshBasicMaterial());architecture.name="Railway bridge";root.add(path,architecture);
  const spoof=new InstancedMesh(new BoxGeometry(),new MeshBasicMaterial(),1);spoof.name="OSM instanced granular tree trunks";spoof.setMatrixAt(0,new Matrix4().makeTranslation(1,4,1));root.add(spoof);
  const old=new Float32Array(geometry.getAttribute("position").array),matrix=new Float32Array(spoof.instanceMatrix.array);
  expect(syncNorthTerrainDrapingV309(root,{...base,oldGroundAt:()=>4})).toBe(3);
  expect(architecture.position.y).toBe(0);expect(Array.from(spoof.instanceMatrix.array)).toEqual(Array.from(matrix));
  expect(restoreNorthTerrainDrapingV309(root)).toBe(3);expect(Array.from(geometry.getAttribute("position").array)).toEqual(Array.from(old));dispose(root);
 });
 test("changed foreign attributes prevent a rollback overwrite",()=>{
  const root=fixture(),before=matrices(root);syncNorthTerrainDrapingV309(root,base);
  const mesh=[...before.keys()].find(m=>m.name==="OSM instanced granular tree trunks")!;
  mesh.instanceMatrix.array[12]+=.25;mesh.instanceMatrix.needsUpdate=true;
  const changed=new Float32Array(mesh.instanceMatrix.array);restoreNorthTerrainDrapingV309(root);
  expect(Array.from(mesh.instanceMatrix.array)).toEqual(Array.from(changed));dispose(root);
 });
});
