import {describe,expect,test} from "bun:test";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {gunzipSync} from "node:zlib";
import {BufferAttribute,Group,Mesh} from "three";
import {createNorthSitesV306,hasCompleteNorthSitesV306} from "../src/NorthSitesV306";
import {northSchoolGroundAtV306,northSitesV306Solids} from "../src/northSitesV306Navigation";
import {northParkTerrainOffsetV306} from "../src/northParkTerrainV306";
import {parkStaticGeometrySteps} from "../src/losslessStaticStorage";
import {captureSourceQuarterPacketV303,prepareSourceQuarterPacketV303,sourceQuarterNavigationV303,type SourceQuarterSourceV303} from "../src/SourceQuarterPacketV303";
import {prepareSurroundingQuarterPredecessorV303,type SurroundingCityChunk} from "../src/SurroundingCityGeometry";
import quarters from "../src/data/northQuarterV306.json";
import ground from "../src/data/northSchoolGroundV306.json";
import terrain from "../src/data/northParkTerrainV306.json";
import {northGpuHostV309} from "./helpers/northGpuHostV309";

function done<T>(g:Generator<void,T>):T {let r=g.next();while(!r.done)r=g.next();return r.value;}
function dispose(root:Group) {const seen=new Set<object>();root.traverse(o=>{if(o instanceof Mesh){o.geometry.dispose();for(const m of [o.userData.dayMaterial,o.userData.nightMaterial,o.userData.schwellenraumMaterial])if(m&&!seen.has(m)){m.dispose();seen.add(m);}}});root.clear();}
const flags={neighbourhoodV300:true,westKiezV302:true,southFidelityV294:true,littenStadthausV297:true,wallGalleryV298:true,stralauSisyphosV299:true,tachelesFrontsV270:true};
describe("finite complete northern sites v306",()=>{
 test("real offscreen geometry retirement reuploads identical north-site words; authored disposal still revokes",()=>{
  for(const native of [false,true]){const root=createNorthSitesV306(native),h=northGpuHostV309(),mesh=root.children[0]as Mesh;
   try{h.scene.add(root);h.scene.updateMatrixWorld(true);h.register();h.draw(mesh);const original=h.uploads.map(a=>Buffer.from(a).toString("base64"));expect(original.length).toBeGreaterThan(0);expect(h.retire().geometry).toBeGreaterThan(0);expect(h.live.size).toBe(0);expect(hasCompleteNorthSitesV306(root,native)).toBe(true);h.draw(mesh);expect(h.uploads.slice(original.length).map(a=>Buffer.from(a).toString("base64"))).toEqual(original);expect(hasCompleteNorthSitesV306(root,native)).toBe(true);mesh.geometry.dispose();expect(hasCompleteNorthSitesV306(root,native)).toBe(false);}finally{h.dispose();dispose(root);}
  }
 },60000);
 test("disposed resources, changed local transforms and a wrong family revoke complete admission",()=>{
  for(const native of [false,true]) {
   const root=createNorthSitesV306(native);
   try{expect(hasCompleteNorthSitesV306(root,!native)).toBe(false);root.position.x+=1;expect(hasCompleteNorthSitesV306(root,native)).toBe(false);root.position.x-=1;expect(hasCompleteNorthSitesV306(root,native)).toBe(true);const mesh=root.children[0]as Mesh;mesh.scale.y=2;mesh.updateMatrix();expect(hasCompleteNorthSitesV306(root,native)).toBe(false);mesh.scale.y=1;mesh.updateMatrix();expect(hasCompleteNorthSitesV306(root,native)).toBe(true);}finally{dispose(root);}
   for(const key of ["geometry","dayMaterial","nightMaterial","schwellenraumMaterial"]){const model=createNorthSitesV306(native);try{const mesh=model.children[0]as Mesh;const resource=key==="geometry"?mesh.geometry:mesh.userData[key];resource.dispose();expect(hasCompleteNorthSitesV306(model,native)).toBe(false);}finally{dispose(model);}}
  }
 });
 for(const native of [false,true])test(`complete models, independent native planes and private storage admission (${native})`,()=>{
  const root=createNorthSitesV306(native);
  try {
   expect(root.children).toHaveLength(2);expect(hasCompleteNorthSitesV306(root,native)).toBe(true);expect(hasCompleteNorthSitesV306(new Group())).toBe(false);
   for(const o of root.children as Mesh[]) {
    expect(o.userData.fullStaticDetailOnTouch).toBe(true);
    if(native) {
     const p=o.geometry.getAttribute("position"),ix=o.geometry.index!;
     for(let i=0;i<ix.count;i+=3){const a=ix.getX(i),b=ix.getX(i+1),c=ix.getX(i+2);const ab=[p.getX(b)-p.getX(a),p.getY(b)-p.getY(a),p.getZ(b)-p.getZ(a)],ac=[p.getX(c)-p.getX(a),p.getY(c)-p.getY(a),p.getZ(c)-p.getZ(a)];const n=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];expect(n.filter(v=>Math.abs(v)>1e-6).length).toBeLessThanOrEqual(1);}
    }
    for(const material of [o.userData.dayMaterial,o.userData.nightMaterial,o.userData.schwellenraumMaterial]){o.material=material;expect(hasCompleteNorthSitesV306(root,native)).toBe(true);}o.material=o.userData.dayMaterial;
   }
   const first=root.children[0] as Mesh,original=first.geometry.getAttribute("position") as BufferAttribute;
   first.geometry.setAttribute("position",original.clone());expect(hasCompleteNorthSitesV306(root)).toBe(false);first.geometry.setAttribute("position",original);expect(hasCompleteNorthSitesV306(root)).toBe(true);
   done(parkStaticGeometrySteps(root,true));root.traverse(o=>{if(o instanceof Mesh){for(const a of Object.values(o.geometry.attributes))if(a instanceof BufferAttribute)a.onUploadCallback();o.geometry.index?.onUploadCallback();}});expect(hasCompleteNorthSitesV306(root,native)).toBe(true);
  }finally{dispose(root);}
 });
 test("school floor and roof navigation stay on the exact named parcel",()=>{
  const r=ground.nativeCells[0],x=(r[0]+r[2])/2,z=(r[1]+r[3])/2;
  expect(northSchoolGroundAtV306(x,z)).toBe(3.015);expect(northSchoolGroundAtV306(x,z,true)).toBe(3.015);
  for(const p of [[0,0],[-2200,-4500],[1000,-3000]])for(const n of [false,true])expect(northSchoolGroundAtV306(p[0],p[1],n)).toBeNull();
  expect(northSitesV306Solids().filter(s=>s.parentId==="lessing")).toHaveLength(9);
  for(const s of northSitesV306Solids(true)){expect(s.maxY).toBeGreaterThan(s.minY);expect(s.holes).toBeArray();}
 });
 test("four metre measured field interpolation and cardinal cell centres agree",()=>{
  expect(northParkTerrainOffsetV306(0,0)).toBe(0);expect(northParkTerrainOffsetV306(4500,-700)).toBe(0);
  for(const p of terrain.profiles){const [w,n]=p.bounds;let found=false;for(let j=1;j<p.offsets.length-1&&!found;j++)for(let i=1;i<p.offsets[j].length-1;i++)if(Math.abs(p.offsets[j][i])>.1){expect(northParkTerrainOffsetV306(w+i*4,n+j*4)).toBeCloseTo(p.offsets[j][i],5);found=true;break;}expect(found).toBe(true);}
 });
 test("all six full source-quarter predecessors admit only retained-body fittings",()=>{
  const source=quarters as unknown as SourceQuarterSourceV303;
  for(const key of source.keys){const [mode,id]=key.split(":"),native=mode==="minecraft";const raw=JSON.parse(gunzipSync(readFileSync(resolve(import.meta.dir,`../public/mesh/surrounding-berlin-v159/${id}.${mode}.json.gz`))).toString()) as SurroundingCityChunk;
   const ticket=done(captureSourceQuarterPacketV303(raw,id,native,true,source,"north-quarter-v306"));expect(ticket).toBeDefined();const prior=done(prepareSurroundingQuarterPredecessorV303(raw,id,native,flags));const next=done(prepareSourceQuarterPacketV303(prior,ticket));expect(next.meshes).toHaveLength(prior.meshes.length+1);expect(next.meshes.slice(0,-1)).toEqual(prior.meshes);expect(sourceQuarterNavigationV303(next,next.nav)).toEqual(prior.nav);
   const changed=structuredClone(raw);changed.meshes[0].colors=changed.meshes[0].colors.slice(0,-4)+"AAAA";expect(done(captureSourceQuarterPacketV303(changed,id,native,true,source,"north-quarter-v306"))).toBeUndefined();
  }
 });
});
