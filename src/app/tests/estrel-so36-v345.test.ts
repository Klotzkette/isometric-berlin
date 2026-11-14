import {expect,test} from "bun:test";
import {readFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {Group,InstancedMesh,Mesh,Box3,Raycaster,Vector3} from "three";
import {createEstrelTowerV345,hasCompleteEstrelTowerV345} from "../src/EstrelTowerV345";
import {estrelTowerSolidsV345,estrelRoofYV345,estrelNativeCellsV345} from "../src/EstrelTowerV345Navigation";
import data from "../src/data/estrelTowerV345.json";
import recipe from "../src/data/so36FrontV345.json";
import {captureSourceQuarterPacketV303,prepareSourceQuarterPacketV303,type SourceQuarterSourceV303} from "../src/SourceQuarterPacketV303";
import {captureNeighbourhoodPacketV300,type NeighbourhoodSourceV300} from "../src/NeighbourhoodPacketV300";
import {prepareSurroundingQuarterPredecessorV303,groundOverlayKindsV329} from "../src/SurroundingCityGeometry";
import {doneV342,optionsV342} from "./helpers/neukoellnPredecessorV342";

test("Estrel retains eight mapped footprints, 176m sloping tower and independent cardinal navigation",()=>{
 expect(data.parts).toHaveLength(8);const tower=data.parts.find(p=>p.kind==="tower")!;
 expect(tower.id).toBe("1017413851");expect(tower.height).toBe(176);
 const heights=tower.ring.map(([x,z])=>estrelRoofYV345(tower,x,z));expect(Math.max(...heights)).toBe(179);expect(Math.min(...heights)).toBe(153);
 for(const native of[false,true]){
  const root=createEstrelTowerV345(native);expect(hasCompleteEstrelTowerV345(root,native)).toBeTrue();expect(hasCompleteEstrelTowerV345(root,!native)).toBeFalse();
  const count=estrelTowerSolidsV345(native).length;expect(count).toBe(native?data.parts.reduce((n,p)=>n+estrelNativeCellsV345(p).size,0):8);
  let bytes=0,instances=0;root.traverse(node=>{if(node instanceof InstancedMesh){instances+=node.count;bytes+=node.instanceMatrix.array.byteLength+(node.instanceColor?.array.byteLength??0);if(native)for(let i=0;i<node.count;i++)for(const at of[1,2,4,6,8,9])expect(node.instanceMatrix.array[i*16+at]).toBe(0);}if(node instanceof Mesh){expect(node.geometry.getAttribute("uv")).toBeUndefined();for(const a of Object.values(node.geometry.attributes))bytes+=a.array.byteLength;}});
  expect(instances).toBeGreaterThan(1000);expect(bytes).toBeLessThan(2*1024*1024);
  root.updateMatrixWorld(true);const box=new Box3().setFromObject(root);expect(box.max.y).toBeLessThan(179.2);expect(box.min.y).toBeGreaterThanOrEqual(2.99);
  const family=new Group();family.add(root);expect(hasCompleteEstrelTowerV345(root,native)).toBeTrue();root.position.x=.1;expect(hasCompleteEstrelTowerV345(root,native)).toBeFalse();root.position.x=0;root.children[0].visible=false;expect(hasCompleteEstrelTowerV345(root,native)).toBeFalse();
 }
});

test("Estrel private completeness closes on removed members, changed buffers and disposed geometry",()=>{
 for(const change of[(r:Group)=>r.children.pop(),(r:Group)=>{const mesh=r.children[0]as Mesh;mesh.geometry.drawRange.count=0;},(r:Group)=>{(r.children[0]as Mesh).geometry.dispose();}]){
  const r=createEstrelTowerV345();change(r);expect(hasCompleteEstrelTowerV345(r,false)).toBeFalse();
 }
});

test("SO36 exact packet transaction retains every older mesh, roof, navigation and path",async()=>{
 for(const native of[false,true]){
  const mode=native?"minecraft":"drawn",raw=JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/6_4.${mode}.json.gz`,import.meta.url))).toString());
  const options=await optionsV342("6_4",native),tickets=[];
  for(const entry of options.sourceQuarterSourcesV303??[]){if(entry.kind==="so36-front-v345"||groundOverlayKindsV329.has(entry.kind))continue;const plan=entry.source.packets[`${mode}:6_4`];if(!plan)continue;const t=plan.preparedRecords?doneV342(captureSourceQuarterPacketV303(raw,"6_4",native,true,entry.source,entry.kind,entry.requiredReplacement)):doneV342(captureNeighbourhoodPacketV300(raw,"6_4",native,true,entry.source as unknown as NeighbourhoodSourceV300,entry.kind));if(t)tickets.push(t);}
  let prepared=doneV342(prepareSurroundingQuarterPredecessorV303(raw,"6_4",native,options));for(const t of tickets)prepared=doneV342(prepareSourceQuarterPacketV303(prepared,t));
  const ticket=doneV342(captureSourceQuarterPacketV303(raw,"6_4",native,true,recipe as SourceQuarterSourceV303,"so36-front-v345"));expect(ticket).toBeDefined();
  const after=doneV342(prepareSourceQuarterPacketV303(prepared,ticket));expect(after.meshes.length).toBe(prepared.meshes.length+1);expect(after.meshes.slice(0,-1)).toEqual(prepared.meshes);expect(after.nav).toEqual(prepared.nav);expect(after.lines).toEqual(prepared.lines);
  const altered=structuredClone(raw);altered.meshes[1].positions="AA==";expect(doneV342(captureSourceQuarterPacketV303(altered,"6_4",native,true,recipe as SourceQuarterSourceV303,"so36-front-v345"))).toBeUndefined();
  expect(doneV342(captureSourceQuarterPacketV303(raw,"6_5",native,true,recipe as SourceQuarterSourceV303,"so36-front-v345"))).toBeUndefined();
 }
});


test("both glass canopy parts stay raised and the concave plinth is triangulated without filling its recess",()=>{
 const canopyIds=["1390408048","1535834586"];
 for(const native of[false,true]){
  const root=createEstrelTowerV345(native);root.updateMatrixWorld(true);
  const solids=estrelTowerSolidsV345(native);
  for(const id of canopyIds){
   const part=data.parts.find(p=>p.id===id)!;expect(part.kind).toBe("canopy");
   const candidates=solids.filter(s=>s.sourceId.startsWith(`estrel-v345-way-${id}`));expect(candidates.length).toBeGreaterThan(0);
   for(const solid of candidates.filter((_,i)=>i%Math.max(1,Math.floor(candidates.length/4))===0)){
    const x=solid.ring.reduce((n,p)=>n+p[0],0)/solid.ring.length,z=solid.ring.reduce((n,p)=>n+p[1],0)/solid.ring.length,top=solid.topAt(x,z),bottom=solid.bottomAt(x,z);
    expect(bottom).toBeGreaterThan(7.7);expect(top-bottom).toBeCloseTo(native?.25:.18,5);
    const up=new Raycaster(new Vector3(x,bottom-.5,z),new Vector3(0,1,0),0,1).intersectObject(root,true);
    expect(up.length).toBeGreaterThan(0);expect(up[0].point.y).toBeCloseTo(bottom,2);
   }
  }
 }
 const plinth=estrelTowerSolidsV345(false).find(s=>s.sourceId==="estrel-v345-way-1390408051")!;
 const area=(r:number[][])=>Math.abs(r.reduce((n,p,i)=>{const q=r[(i+1)%r.length];return n+p[0]*q[1]-q[0]*p[1];},0))/2;
 expect(plinth.roofTriangles.reduce((n,t)=>n+area(t.map(p=>[p[0],p[2]])),0)).toBeCloseTo(area(plinth.ring),5);
 expect(plinth.maxY).toBe(6);expect(plinth.minY).toBe(3);
});
