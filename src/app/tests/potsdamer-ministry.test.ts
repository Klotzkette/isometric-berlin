import { describe, expect, test } from "bun:test";
import { Box3, InstancedMesh, Mesh } from "three";
import { createPotsdamerMinistryArchitecture, createMinecraftPotsdamerMinistryArchitecture, POTSDAMER_STREET_WING_FACADES } from "../src/PotsdamerMinistryArchitecture";
import { POTSDAMER_MINISTRY_BUILDINGS, potsdamerMinistryRoofAt } from "../src/potsdamerMinistrySourceProfile";
import { POTSDAMER_MINISTRY_REPLACEMENT_IDS, POTSDAMER_MINISTRY_OWNERSHIP, isPotsdamerMinistryReplacementCell } from "../src/potsdamerMinistryProfile";
function stats(group:ReturnType<typeof createPotsdamerMinistryArchitecture>){
 let drawables=0,instances=0,bytes=0,vertices=0;const seen=new Set();
 group.traverse(o=>{expect(o.matrixAutoUpdate).toBe(false);if(!(o instanceof Mesh))return;drawables++;
 if(o instanceof InstancedMesh){instances+=o.count;bytes+=o.instanceMatrix.array.byteLength+(o.instanceColor?.array.byteLength??0);}
 if(!seen.has(o.geometry)){seen.add(o.geometry);for(const a of Object.values(o.geometry.attributes))bytes+=a.array.byteLength;bytes+=o.geometry.index?.array.byteLength??0;vertices+=o.geometry.getAttribute("position").count;}
 for(const m of [o.material].flat())expect((m as any).map??null).toBeNull();
 for(const v of o.geometry.getAttribute("position").array)expect(Number.isFinite(v)).toBe(true);
 });return {drawables,instances,bytes,vertices};
}
describe("Potsdamer ministry source architecture",()=>{
 test("retains all 45 official parts with exact ownership",()=>{
 expect(POTSDAMER_MINISTRY_BUILDINGS.reduce((n,b)=>n+b.officialParts.length,0)).toBe(45);
 expect(POTSDAMER_MINISTRY_REPLACEMENT_IDS.size).toBe(45);
 for(const id of ["TJkToj3v","K00006XH","K00008P4"])expect(POTSDAMER_MINISTRY_REPLACEMENT_IDS.has(id)).toBe(true);
 for(const b of POTSDAMER_MINISTRY_BUILDINGS){const h=b.officialParts.flatMap(p=>p.surfaces.flatMap(s=>s.rings.flatMap(r=>r.map(q=>q[1]))));
 expect(Math.max(...h)).toBeCloseTo(Math.max(...b.officialParts.map(p=>p.top_y_m)),3);
 expect(b.officialParts.every(p=>p.surfaces.some(s=>s.kind==="RoofSurface"))).toBe(true);}
 });
 test("ownership leaves plazas and unrelated towers untouched",()=>{
 expect(isPotsdamerMinistryReplacementCell(264,1116,4)).toBe(true);
 for(const [x,z]of [[290,1080],[220,1028],[260,960],[1000,500]])expect(isPotsdamerMinistryReplacementCell(x,z,4)).toBe(false);
 const b=POTSDAMER_MINISTRY_BUILDINGS.find(b=>b.key==="forumTower")!;
 expect(potsdamerMinistryRoofAt(b,274,1113)).toBeGreaterThan(70);expect(potsdamerMinistryRoofAt(b,300,1090)).toBeNull();
 });
 test("native replacement keeps every shared boundary column with its original roof and material",()=>{
 const native=POTSDAMER_MINISTRY_OWNERSHIP.native;
 expect(native.safeWholeCells.length).toBe(483);expect(native.retainedBoundaryCells.length).toBe(183);
 for(const [x,z] of native.safeWholeCells)expect(isPotsdamerMinistryReplacementCell(x,z,4)).toBe(true);
 for(const [x,z] of native.retainedBoundaryCells)expect(isPotsdamerMinistryReplacementCell(x,z,4)).toBe(false);
 for(const [x,z,size] of [[28,1160,4],[236,1134,4],[264,1116,2],[264,1116,0],[264,1116,NaN]])expect(isPotsdamerMinistryReplacementCell(x,z,size)).toBe(false);
 });
 test("all 68 facade-only street-wing parts retain their original source owners",()=>{
 const source=POTSDAMER_STREET_WING_FACADES;
 expect(source.facadeOnly).toBe(true);expect(source.sourceSuppression).toBe(false);expect(source.roofModification).toBe(false);
 const ids=source.buildings.flatMap(b=>b.prismIds);expect(ids.length).toBe(68);
 expect(new Set(ids).size).toBe(68);
 for(const id of ids)expect(POTSDAMER_MINISTRY_REPLACEMENT_IDS.has(id)).toBe(false);
 for(const b of source.buildings)for(const e of b.streetFronts){
 expect(b.prismIds.includes(e.prismId)).toBe(true);expect(e.wallTopY).toBeGreaterThan(e.wallBaseY);
 expect(e.sourceWallRings[0].length).toBeGreaterThanOrEqual(4);
 }
 });
 test("frozen drawn shells match complete source bounds and stay within memory budget",()=>{
 const root=createPotsdamerMinistryArchitecture(),s=stats(root);
 expect(s.drawables).toBeLessThanOrEqual(11);expect(s.instances).toBeLessThan(22000);expect(s.bytes).toBeLessThan(1900000);
 for(const b of POTSDAMER_MINISTRY_BUILDINGS){const mesh=root.children.find(c=>c.userData.buildingKey===b.key)!;const bounds=new Box3().setFromObject(mesh);
 expect(bounds.min.x).toBeCloseTo(b.bbox[0],2);expect(bounds.max.x).toBeCloseTo(b.bbox[2],2);
 expect(bounds.min.z).toBeCloseTo(b.bbox[1],2);expect(bounds.max.z).toBeCloseTo(b.bbox[3],2);
 expect(bounds.max.y).toBeCloseTo(Math.max(...b.officialParts.map(p=>p.top_y_m))+b.displayYTranslationM,2);}
 console.log("Potsdamer drawn",s);
 });
 test("Minecraft has its own source-roof surface skin without buried solid fill",()=>{
 const root=createMinecraftPotsdamerMinistryArchitecture(),s=stats(root);
 expect(root.userData.surfaceOnly).toBe(true);expect(root.userData.blockNative).toBe(true);
 expect(s.drawables).toBeLessThanOrEqual(3);expect(s.instances).toBeLessThan(21000);expect(s.bytes).toBeLessThan(1900000);
 console.log("Potsdamer Minecraft",s);
 });
});
