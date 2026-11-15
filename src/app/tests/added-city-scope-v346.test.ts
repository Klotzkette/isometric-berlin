import {expect,test} from "bun:test";
import {readFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {addedCityScopeGroundAtV346,surroundingScopeGroundAt} from "../src/surroundingCityScope";
import {outlineNavigationEnvelopeBounds} from "../src/outlineNavigationEnvelope";
import added from "../src/data/addedCityScopeV346.json";

const folder=new URL("../public/mesh/surrounding-berlin-v159/",import.meta.url);
const manifest=JSON.parse(readFileSync(new URL("manifest.json",folder),"utf8"));
const points=[[-15619.6,6956.1],[-15504.7,4599.7],[-16861.5,5032.1],[-5495.8,-4256.3]];

test("new-only scope retains every appended footprint and hole inside the already approved camera envelope",()=>{
 expect(added.footprint).toEqual(manifest.footprint.slice(2907));
 expect(added.footprint).toHaveLength(27);expect(added.footprint.reduce((n,p)=>n+p.holes.length,0)).toBe(31);
 const bounds=outlineNavigationEnvelopeBounds();
 for(const polygon of added.footprint)for(const [x,z]of polygon.ring){
  expect(x).toBeGreaterThanOrEqual(bounds.minX);expect(x).toBeLessThanOrEqual(bounds.maxX);
  expect(z).toBeGreaterThanOrEqual(bounds.minZ);expect(z).toBeLessThanOrEqual(bounds.maxZ);
 }
 for(const [x,z]of [[-16360.290958,4734.335],[-16384,4751.85],[-16475.167593,4736.58],[-15449.459749,4746.12],[0,0],[90000,90000]])expect(addedCityScopeGroundAtV346(x,z)).toBeNull();
 // A hole in the new scope can still have a retained earlier ground owner.
 expect(surroundingScopeGroundAt(-15449.459749,4746.12)).toBe(3);
});

test("both families retain the exact three-metre rendered source datum before a district request or remount",()=>{
 for(const native of [false,true])for(const [x,z]of points){expect(addedCityScopeGroundAtV346(x,z)).toBe(3);expect(surroundingScopeGroundAt(x,z,native)).toBe(3);}
 const chunks=manifest.chunks.filter((c:{id:string})=>c.id.startsWith("kladow346-")||c.id.startsWith("tegel346-"));expect(chunks).toHaveLength(83);
 for(const c of chunks)for(const family of ["drawn","minecraft"]){
  const packet=JSON.parse(gunzipSync(readFileSync(new URL(c[family].url,folder))).toString());
  expect(packet.nav.groundY).toBe(added.groundY);
 }
 // The first boundary tile of each supplement has actual horizontal ground at
 // that datum in both representations, not just a matching navigation label.
 for(const prefix of ["kladow346-","tegel346-"])for(const family of ["drawn","minecraft"]){
  const c=chunks.find((c:{id:string})=>c.id.startsWith(prefix));
  const packet=JSON.parse(gunzipSync(readFileSync(new URL(c[family].url,folder))).toString());
  let groundFaces=0;
  for(const mesh of packet.meshes){const p=Buffer.from(mesh.positions,"base64"),ix=Buffer.from(mesh.indices,"base64");
   for(let i=0;i<ix.length;i+=12){const vertices=[0,1,2].map(j=>ix.readUInt32LE(i+j*4));if(vertices.every(v=>p.readUInt16LE(v*6+2)/100+packet.origin[1]===3))groundFaces++;}
  }
  expect(groundFaces).toBeGreaterThan(0);
 }
});

test("earlier core ownership, established outer ground and outside-world rejection keep precedence",()=>{
 for(const native of [false,true]){
  for(const [x,z]of [[3060,-1910],[-5150,2170],[5100,2390],[-1450,3730]])expect(surroundingScopeGroundAt(x,z,native)).toBe(3);
  for(const [x,z]of [[0,0],[-200,-800],[1500,300],[9000,9000]])expect(surroundingScopeGroundAt(x,z,native)).toBeNull();
 }
});
