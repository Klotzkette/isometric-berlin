import { describe,expect,test } from "bun:test";
import { readFileSync } from "node:fs";
import { Box3, InstancedMesh, LineSegments, Mesh, Vector3 } from "three";
import source from "../src/czechEmbassyFacadeSource.json";
import { createAlterDessauerMonument, ALTER_DESSAUER_PROFILE as P } from "../src/AlterDessauerMonument";
import { createMinecraftWilhelmStresemannDetails,createWilhelmStresemannDetails } from "../src/WilhelmStresemannDetails";
import { WILHELM_REFINEMENT_PRISM_TONES } from "../src/wilhelmRefinementProfile";
const prisms=JSON.parse(readFileSync(new URL("../public/mesh/regierungsviertel/lod2-prisms.json",import.meta.url),"utf8")).buildings;
function metrics(root:ReturnType<typeof createAlterDessauerMonument>){let draws=0,bytes=0,verts=0;const seen=new Set<object>();root.traverse(o=>{if(!(o instanceof Mesh)&&!(o instanceof LineSegments))return;draws++;if(!seen.has(o.geometry)){for(const a of Object.values(o.geometry.attributes))bytes+=a.array.byteLength;if(o.geometry.index)bytes+=o.geometry.index.array.byteLength;seen.add(o.geometry);}if(o instanceof InstancedMesh){bytes+=o.instanceMatrix.array.byteLength;bytes+=o.instanceColor?.array.byteLength??0;}verts+=o.geometry.getAttribute("position").count*(o instanceof InstancedMesh?o.count:1);const materials=Array.isArray(o.material)?o.material:[o.material];for(const m of materials)expect((m as {map?:unknown}).map).toBeFalsy();});return{draws,bytes,verts};}
describe("Wilhelmstrasse v151 source-bound refinements",()=>{
 test("retains all fifteen Czech source identities and their exterior metric edges",()=>{
  expect(source.parts).toHaveLength(15);expect(source.parts.reduce((n,p)=>n+p.exterior_runs.length,0)).toBe(23);
  for(const p of source.parts){const prism=prisms.find((r:{id:string})=>r.id===p.short_id);expect(prism).toBeDefined();expect(p.height_m).toBeCloseTo(prism.h_dm/10,1);expect(WILHELM_REFINEMENT_PRISM_TONES.has(p.short_id)).toBeTrue();
   // The decimetre payload removes collinear vertices. Original millimetre
   // endpoints must still lie on the same source boundary (rounding < 8 cm).
   for(const edge of p.exterior_runs)for(const q of edge){
    let distance=Infinity;for(let i=0;i<prism.ring.length;i++){const a=prism.ring[i].map((v:number)=>v/10),b=prism.ring[(i+1)%prism.ring.length].map((v:number)=>v/10),dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((q[0]-a[0])*dx+(q[1]-a[1])*dz)/(dx*dx+dz*dz)));distance=Math.min(distance,Math.hypot(q[0]-a[0]-t*dx,q[1]-a[1]-t*dz));}
    expect(distance).toBeLessThan(.08);
   }
  }
 });
 test("drawn facade geometry does not disappear on merge and phones retain all details",()=>{
  const full=createWilhelmStresemannDetails("full"),mobile=createWilhelmStresemannDetails("mobile");
  const a=metrics(full),b=metrics(mobile);expect(a).toEqual(b);expect(a.draws).toBe(5);expect(a.verts).toBeGreaterThan(20000);expect(a.bytes).toBeLessThan(2_000_000);
  expect(metrics(createMinecraftWilhelmStresemannDetails()).draws).toBeLessThanOrEqual(2);
 });
 test("Dessauer is correctly anchored, finite, tightly bounded and has no original cone double",()=>{
  const drawn=createAlterDessauerMonument(),native=createAlterDessauerMonument(true);
  expect(P.osmNodeId).toBe("966034352");expect(P.world[0]).toBeCloseTo(812.540331818,8);expect(P.world[2]).toBeCloseTo(838.494576795,8);
  const bounds=new Box3().setFromObject(drawn),size=bounds.getSize(new Vector3());
  expect(size.y).toBeGreaterThan(6.3);expect(size.y).toBeLessThan(6.9);expect(size.x).toBeLessThan(4.3);expect(size.z).toBeLessThan(4.3);
  expect(drawn.userData.blockNative).toBeFalse();expect(native.userData.blockNative).toBeTrue();
  expect(metrics(drawn).draws).toBe(4);expect(metrics(drawn).bytes).toBeLessThan(120000);expect(metrics(native).draws).toBe(1);expect(metrics(native).bytes).toBeLessThan(80000);
  for(const model of[drawn,native])model.traverse(o=>{if(o instanceof Mesh){expect(o.matrixAutoUpdate).toBeFalse();for(const v of o.geometry.getAttribute("position").array)expect(Number.isFinite(v)).toBeTrue();if(model===native)expect(o.geometry.type).toBe("BoxGeometry");}});
 });
});
