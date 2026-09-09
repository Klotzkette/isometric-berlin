import {describe,expect,test} from "bun:test";
import {Box3,InstancedMesh,Mesh,Raycaster,Vector3} from "three";
import ground from "../public/mesh/regierungsviertel/minecraft-voxels.json";
import {createDomAltesMuseum,createMinecraftDomAltesMuseum} from "../src/DomAltesMuseum";
import {ALTES_PROFILE as A,DOM_PROFILE as D,DOM_ALTES_SOURCE as S,GRANITE_BOWL_PROFILE as B,domWorld,altesWorld,domFrontVAt,domRoofAt,museumDisplayY,museumPartContains,isDomAltesReplacementColumn,domAltesExtraSolidAt,domAltesExtraGroundAt} from "../src/domAltesMuseumProfile";
import {smoothGroundTopSampler,type VoxelPayload} from "../src/MinecraftVoxelWorld";
function metrics(root:ReturnType<typeof createDomAltesMuseum>){let calls=0,instances=0,bytes=0;const geos=new Set();root.traverse(o=>{if(o instanceof Mesh){calls++;if(!geos.has(o.geometry)){geos.add(o.geometry);for(const a of Object.values(o.geometry.attributes))bytes+=a.array.byteLength;bytes+=o.geometry.index?.array.byteLength??0;}if(o instanceof InstancedMesh){instances+=o.count;bytes+=o.instanceMatrix.array.byteLength+(o.instanceColor?.array.byteLength??0);}}});return{calls,instances,bytes};}
describe("source-bound Berliner Dom, Altes Museum and granite bowl",()=>{
 test("preserves original source conflicts and architecture evidence",()=>{
  expect(S.dom.parent_id).toBe("DEBE01YYK000000D");expect(S.dom.parts[0].top_y_m).toBe(45.688);expect(S.dom.parts[0].surfaces.length).toBe(149);expect(S.altes.parts).toHaveLength(16);expect(S.altes.parts.find(p=>p.id.endsWith("Qc2wgOO"))?.top_y_m).toBe(39.416);expect(S.previous_context_prisms.map(p=>p.h_dm)).toEqual([90,980]);expect(A.columns).toBe(18);expect(B.material).toBe("red granite");expect(B.supportCount).toBe(3);expect(D.top-D.ground).toBe(98);
  for(const p of [...S.dom.parts,...S.altes.parts])expect(p.ring.every(([x,z])=>x>1800&&x<2060&&z> -70&&z<80)).toBe(true);
 });
 test("keeps two courts, portico gaps, steps and bowl cavity open",()=>{
  for(const u of[-23,23]){const p=altesWorld(u,0,-20);expect(S.altes.parts.some(s=>museumPartContains(s,p[0],p[2]))).toBe(false);}
  const gap=altesWorld(0,12,2.6),pillar=altesWorld(-39.8,12,2.6);expect(domAltesExtraSolidAt(...gap)).toBe(false);expect(domAltesExtraSolidAt(...pillar)).toBe(true);expect(domAltesExtraGroundAt(gap[0],gap[2],30)).toBe(A.entablatureTop);expect(domAltesExtraGroundAt(gap[0],gap[2],8)).toBe(A.deck);
  const sampler=smoothGroundTopSampler(ground as unknown as VoxelPayload);expect(sampler(B.centre[0]/ground.cell_m-ground.grid.min_x_idx,B.centre[1]/ground.cell_m-ground.grid.min_z_idx)).toBeCloseTo(B.ground,6);expect(domAltesExtraSolidAt(B.centre[0],7,B.centre[1])).toBe(false);expect(domAltesExtraSolidAt(B.centre[0],6.3,B.centre[1])).toBe(true);
 });
 test("all profiles retain cross and bowl within compact texture-free budgets",()=>{
  const values=[];for(const mobileLike of[false,true])for(const minecraft of[false,true]){const root=minecraft?createMinecraftDomAltesMuseum({mobileLike}):createDomAltesMuseum({mobileLike});root.updateMatrixWorld(true);const m=metrics(root);values.push(m);expect(m.calls).toBeLessThanOrEqual(14);expect(m.instances).toBeLessThan(21000);expect(m.bytes).toBeLessThan(1900000);root.traverse(o=>{if(o instanceof Mesh){expect(o.geometry.getAttribute("uv")).toBeUndefined();expect(o.userData.dayMaterial).toBeDefined();expect(o.userData.nightMaterial).toBeDefined();expect(o.userData.moonlitMaterial).toBeDefined();if(minecraft)expect(o instanceof InstancedMesh).toBe(true);}});expect(new Box3().setFromObject(root).max.y).toBeCloseTo(D.top,3);if(minecraft)expect(m.calls).toBe(1);else expect(root.getObjectByName("Granitschale hollow polished red-granite basin")).toBeDefined();}expect(values[2].bytes).toBeLessThan(values[0].bytes);expect(values[3].instances).toBeLessThan(values[1].instances);
 });
 test("roof callbacks match real cupola and cross geometry",()=>{
  const root=createDomAltesMuseum();root.updateMatrixWorld(true);for(const[u,v]of[[D.domeLocal[0]+8,D.domeLocal[1]],[D.domeLocal[0]+16,D.domeLocal[1]+3],[...D.domeLocal]]){const p=domWorld(u,120,v),ray=new Raycaster(new Vector3(...p),new Vector3(0,-1,0)),hit=ray.intersectObject(root,true)[0];expect(hit).toBeDefined();expect(Math.abs(hit.point.y-(domRoofAt(p[0],p[2])??0))).toBeLessThan(.35);}for(const p of S.altes.parts)expect(museumDisplayY(p,p.top_y_m)).toBeLessThanOrEqual(32.211);
 });
 test("projected west windows are outside the exact source wall",()=>{
  for(const mobileLike of[false,true]){const root=createDomAltesMuseum({mobileLike});root.updateMatrixWorld(true);const source=root.getObjectByName("Berliner Dom retained LoD2 footprint")!,details=root.getObjectByName("Museum island details box")!,n=new Vector3(Math.sin(D.yaw),0,Math.cos(D.yaw));for(const u of[-24.5,-15,9,18.5]){const p=domWorld(u,23.3,domFrontVAt(u)+.1),ray=new Raycaster(new Vector3(...p).addScaledVector(n,10),n.clone().negate()),wall=ray.intersectObject(source)[0],detail=ray.intersectObject(details)[0];expect(wall).toBeDefined();expect(detail).toBeDefined();expect(detail.distance).toBeLessThan(wall.distance);}}
 });
 test("removes old raster masses while retaining unrelated taller neighbours",()=>{
  let replaced=0;for(let zi=0;zi<ground.building_rows.length;zi++){const z=(ground.grid.min_z_idx+zi+.5)*ground.cell_m;if(z< -74||z>84)continue;for(const[xi,n,,hi]of ground.building_rows[zi])for(let i=0;i<n;i++){const x=(ground.grid.min_x_idx+xi+i+.5)*ground.cell_m;if(x<1796||x>2064)continue;if(isDomAltesReplacementColumn(x,z,hi/10))replaced++;}}expect(replaced).toBeGreaterThan(500);expect(isDomAltesReplacementColumn(2000,20,200)).toBe(false);expect(isDomAltesReplacementColumn(1880,90,20)).toBe(false);expect(isDomAltesReplacementColumn(1950,-65,18)).toBe(false);
 });
});
