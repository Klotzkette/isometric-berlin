import {expect,test} from "bun:test";
import {readFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {Mesh,Raycaster,Vector3} from "three";
import {createSurroundingCityChunk,surroundingBuildingSolidAt,type SurroundingCityChunk} from "../src/SurroundingCityGeometry";
import {captureSourceQuarterPacketV303,type SourceQuarterSourceV303} from "../src/SourceQuarterPacketV303";
import {disposeSurroundingCityRoot} from "../src/disposeSurroundingCityRootV323";
import {estrelTowerSolidsV345} from "../src/EstrelTowerV345Navigation";
import recipe from "../src/data/estrelTowerV345Packets.json";
import {doneV342,optionsV342} from "./helpers/neukoellnPredecessorV342";
import {transformLosslessJsonData} from "../losslessJsonData";
import {decodeLosslessGzipJson} from "../src/losslessGzipJson";
const ID="ring182-11_10",OWNERS=["OSM-way-1535834585","OSM-relation-21070307"];
const input=(native:boolean):SurroundingCityChunk=>JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/${ID}.${native?"minecraft":"drawn"}.json.gz`,import.meta.url))).toString());
test("Estrel production packet atomically supersedes exactly two old bodies and their navigation",async()=>{
 for(const native of[false,true]){
  const raw=input(native),snapshot=JSON.stringify(raw),options=await optionsV342(ID,native),out=createSurroundingCityChunk(raw,ID,native,options);
  try{
   const baselineOptions={...options,sourceQuarterSourcesV303:options.sourceQuarterSourcesV303?.filter(e=>e.kind!=="estrel-tower-v345")};
   const before=createSurroundingCityChunk(input(native),ID,native,baselineOptions);
   try{
    expect(out.root.userData.sourceQuarterOwnersV303).toContain(OWNERS[0]);expect(out.root.userData.sourceQuarterOwnersV303).toContain(OWNERS[1]);
    expect(out.nav.buildings.filter(b=>OWNERS.includes(b.sourceId))).toHaveLength(0);
    expect(out.nav.buildings.filter(b=>!b.sourceId.startsWith("estrel-v345-"))).toEqual(before.nav.buildings.filter(b=>!OWNERS.includes(b.sourceId)));
    for(const key of["ground","roads","water","bridges","groundY"]as const)expect(out.nav[key]).toEqual(before.nav[key]);
    expect(JSON.stringify(raw)).toBe(snapshot);expect(out.geometryBytes).toBeLessThan(6*1024*1024);
    out.root.updateMatrixWorld(true);before.root.updateMatrixWorld(true);
    // The invented solid parent wing becomes the real thin elevated glass roof.
    const x=5815.217,z=5352.653,lx=x-raw.origin[0],lz=z-raw.origin[2];
    expect(surroundingBuildingSolidAt(before.nav,lx,4.5,lz)).toBeTrue();
    expect(surroundingBuildingSolidAt(out.nav,lx,4.5,lz)).toBeFalse();
    const ray=new Raycaster(new Vector3(x,30,z),new Vector3(0,-1,0));
    expect(ray.intersectObject(before.root,true).filter(h=>h.object instanceof Mesh)[0].point.y).toBeGreaterThan(10);
    const downward=ray.intersectObject(out.root,true).filter(h=>h.object instanceof Mesh)[0].point.y;
    const upward=new Raycaster(new Vector3(x,4.5,z),new Vector3(0,1,0)).intersectObject(out.root,true).filter(h=>h.object instanceof Mesh)[0].point.y;
    expect(downward-upward).toBeLessThan(.27);expect(upward).toBeGreaterThan(7.5);
    const solids=estrelTowerSolidsV345(native),sample=solids.filter((_,i)=>i%Math.max(1,Math.floor(solids.length/40))===0);
    for(const s of sample){const points=native?s.ring:s.roofTriangles[0].map(p=>[p[0],p[2]]);const x=points.reduce((n,p)=>n+p[0],0)/points.length,z=points.reduce((n,p)=>n+p[1],0)/points.length,top=s.topAt(x,z),bottom=s.bottomAt(x,z);
     const hits=new Raycaster(new Vector3(x,220,z),new Vector3(0,-1,0)).intersectObject(out.root,true).filter(h=>h.object instanceof Mesh);
     expect(hits.length).toBeGreaterThan(0);expect(Math.abs(hits[0].point.y-top)).toBeLessThan(.20);
     expect(surroundingBuildingSolidAt(out.nav,x-raw.origin[0],(top+bottom)/2,z-raw.origin[2])).toBeTrue();
     if(bottom>3)expect(surroundingBuildingSolidAt(out.nav,x-raw.origin[0],bottom-.25,z-raw.origin[2])).toBeFalse();
     expect(surroundingBuildingSolidAt(out.nav,x-raw.origin[0],top+.25,z-raw.origin[2])).toBeFalse();
    }
   }finally{disposeSurroundingCityRoot(before.root);}
  }finally{disposeSurroundingCityRoot(out.root);}
 }
},30000);
test("Estrel exact old owners cannot retire with altered packet, missing recipe geometry or wrong family",()=>{
 for(const native of[false,true]){
  const raw=input(native),source=recipe as SourceQuarterSourceV303,key=`${native?"minecraft":"drawn"}:${ID}`;
  expect(doneV342(captureSourceQuarterPacketV303(raw,ID,native,true,source,"estrel-tower-v345"))).toBeDefined();
  expect(doneV342(captureSourceQuarterPacketV303(raw,ID,!native,true,source,"estrel-tower-v345"))).toBeUndefined();
  expect(doneV342(captureSourceQuarterPacketV303(raw,"ring182-11_9",native,true,source,"estrel-tower-v345"))).toBeUndefined();
  for(const edit of[(p:SurroundingCityChunk)=>p.origin[0]++,(p:SurroundingCityChunk)=>p.nav.buildings.pop(),(p:SurroundingCityChunk)=>p.meshes[0].positions="AAAA"+p.meshes[0].positions.slice(4)]){
   const bad=input(native);edit(bad);expect(doneV342(captureSourceQuarterPacketV303(bad,ID,native,true,source,"estrel-tower-v345"))).toBeUndefined();
  }
  const bad=structuredClone(source);delete bad.packets[key].append;
  expect(doneV342(captureSourceQuarterPacketV303(raw,ID,native,true,bad,"estrel-tower-v345"))).toBeUndefined();
  if(!native){const malformed=structuredClone(source),canopy=malformed.packets[key].appendNav.find(b=>b.bottomRoofTriangles)!;canopy.bottomRoofTriangles![0][0][1]=NaN;expect(doneV342(captureSourceQuarterPacketV303(raw,ID,native,true,malformed,"estrel-tower-v345"))).toBeUndefined();}
 }
});
test("Estrel complete model recipe stays lazy per exact packet with lossless weak reconstruction",()=>{
 const file=new URL("../src/data/estrelTowerV345Packets.json",import.meta.url),raw=readFileSync(file,"utf8"),original=JSON.parse(raw),result=transformLosslessJsonData(raw,file.pathname)!;
 expect(result).toBeDefined();expect(result.code.length).toBeLessThan(raw.length*.6);
 const code=result.code.replace(/^import[^\n]+\n/,"").replace(/export \{[^}]*\};?\n/g,"").replace("export default","return");
 class ExpiredWeakRef{deref(){return undefined;}}
 let reads=0;const decoded=new Function("__decodeLosslessGzip","WeakRef",code)((value:string)=>{reads++;return decodeLosslessGzipJson(value);},ExpiredWeakRef);
 expect(reads).toBe(0);expect(decoded.keys).toEqual(original.keys);
 for(const key of original.keys){const a=decoded.packets[key],b=decoded.packets[key];expect(a).toEqual(original.packets[key]);expect(b).toEqual(a);expect(b).not.toBe(a);}
 expect(reads).toBe(4);console.log({estrelRaw:raw.length,estrelStored:result.code.length});
});
