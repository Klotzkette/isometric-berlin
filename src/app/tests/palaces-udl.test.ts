import { describe, expect, test } from "bun:test";
import { Box3, BufferGeometry, Group, InstancedMesh, Mesh, Raycaster, Vector3 } from "three";
import { createPalacesAndFriedrich, createMinecraftPalacesAndFriedrich } from "../src/PalacesAndFriedrich";
import { FRIEDRICH_MONUMENT_PROFILE as F, PALACES_UDL_SOURCES as S, PALACES_UDL_PRISM_IDS, PALACES_BRIDGE_ID, palacesUdlPartBaseAt, palacesUdlPartRoofAt, isPalacesUdlReplacementColumn, friedrichMonumentSolidAt, palacesUdlWalkableAt } from "../src/palacesUdlProfile";
function budget(root:Group) {
 let bytes=0,draws=0,instances=0;const seen=new Set<BufferGeometry>();
 root.traverse(o=>{if(!(o instanceof Mesh))return;draws++;expect(o.matrixAutoUpdate).toBeFalse();expect(o.userData.dayMaterial.map).toBeNull();expect(o.userData.nightMaterial.map).toBeNull();
 if(!seen.has(o.geometry)){seen.add(o.geometry);for(const a of Object.values(o.geometry.attributes)){bytes+=a.array.byteLength;expect(Array.from(a.array).every(Number.isFinite)).toBeTrue();}bytes+=o.geometry.index?.array.byteLength??0;}
 if(o instanceof InstancedMesh){instances+=o.count;bytes+=o.instanceMatrix.array.byteLength+(o.instanceColor?.array.byteLength??0);}});return{draws,instances,bytes};
}
describe("eastern Unter den Linden source-bound architecture",()=>{
 test("all seventeen parts and source roofs survive replacement of exactly three OSM prisms",()=>{
  expect(S.map(p=>p.parts.length)).toEqual([11,5,1]);expect([...PALACES_UDL_PRISM_IDS].sort()).toEqual(['-4284350','17728387','24247322']);
  expect(S.every(s=>s.parts.every(p=>p.surfaces.some(v=>v.kind==='RoofSurface')))).toBeTrue();
  expect(isPalacesUdlReplacementColumn(1686.65,242.36)).toBeTrue();
  expect(isPalacesUdlReplacementColumn(1722,280)).toBeFalse();
  expect(isPalacesUdlReplacementColumn(1740,223)).toBeFalse();
  expect(isPalacesUdlReplacementColumn(1720,207)).toBeFalse();
 });
 test("bridge uses one roof and a walkable arched opening in both representations",()=>{
  const part=S.flatMap(s=>s.parts).find(p=>p.id===PALACES_BRIDGE_ID)!;
  expect(palacesUdlWalkableAt(1686.65,6.6,242.36,PALACES_BRIDGE_ID)).toBeTrue();
  expect(palacesUdlWalkableAt(1686.65,16,242.36,PALACES_BRIDGE_ID)).toBeFalse();
  expect(palacesUdlWalkableAt(1706.05,6.6,216.72)).toBeFalse();
  expect(palacesUdlPartBaseAt(part,1686.65,242.36)).toBeCloseTo(14.1,4);
  expect(palacesUdlPartRoofAt(part,1686.65,242.36)).toBeGreaterThan(20);
  for(const root of [createPalacesAndFriedrich(),createMinecraftPalacesAndFriedrich()]) {
   root.updateMatrixWorld(true);const ray=new Raycaster(new Vector3(1686.35,6.3,234),new Vector3(.099875,0,.995).normalize(),0,16);
   expect(ray.intersectObject(root,true)).toHaveLength(0);
   const down=new Raycaster(new Vector3(1686.65,30,242.36),new Vector3(0,-1,0),0,15);
   expect(down.intersectObject(root,true).length).toBeGreaterThan(0);
  }
 });
 test("Friedrich keeps exact OSM anchor, 13.5m silhouette and clear streets around the fence",()=>{
  expect(F.osmKey).toBe('node/262455591');expect(F.anchor[0]).toBeCloseTo(1440.98647896654,8);expect(F.anchor[1]).toBeCloseTo(214.187920913,8);
  expect(F.publishedOverallHeightM).toBe(13.5);
  expect(friedrichMonumentSolidAt(F.anchor[0],F.anchor[1],5.2)).toBeTrue();
  for(let i=0;i<16;i++){const a=i*Math.PI/8;expect(friedrichMonumentSolidAt(F.anchor[0]+Math.cos(a)*7,F.anchor[1]+Math.sin(a)*7,5.2)).toBeFalse();}
  expect(friedrichMonumentSolidAt(F.anchor[0],F.anchor[1],19)).toBeFalse();
  const root=createPalacesAndFriedrich();root.updateMatrixWorld(true);
  const ray=new Raycaster(new Vector3(F.anchor[0],25,F.anchor[1]),new Vector3(0,-1,0));
  const hits=ray.intersectObject(root,true);expect(hits[0].point.y).toBeGreaterThan(18);expect(hits[0].point.y).toBeLessThanOrEqual(F.topY+.01);
 });
 test("static drawn and native batches stay bounded and image-free",()=>{
  const drawn=createPalacesAndFriedrich(),native=createMinecraftPalacesAndFriedrich();const d=budget(drawn),n=budget(native);
  console.log('palaces-v147 budgets',d,n,new Box3().setFromObject(drawn).min.toArray(),new Box3().setFromObject(drawn).max.toArray());
  expect(d.draws).toBe(6);expect(d.bytes).toBeLessThan(500_000);expect(d.instances).toBeGreaterThan(1800);
  expect(n.draws).toBe(1);expect(n.bytes).toBeLessThan(450_000);expect(native.userData.blockNative).toBeTrue();
  expect((native.children[0] as Mesh).geometry.getAttribute('position').count).toBe(24);
  expect(drawn.userData.fullStaticDetailOnTouch).toBeTrue();expect(drawn.userData.photographsBundled).toBeFalse();
 });
});
