import {describe,expect,test} from "bun:test";
import {Box3,Group,InstancedMesh,Mesh,MeshStandardMaterial,Raycaster,Vector3} from "three";
import {createDbTowerArchitecture,createMinecraftDbTowerArchitecture, type DbTowerBlock} from "../src/DbTowerArchitecture";
import {DB_TOWER_PROFILE as P,DB_TOWER_SOURCE as S,DB_TOWER_PRISM_IDS,dbTowerDisplayY,dbTowerRoofAt,isDbTowerReplacementColumn} from "../src/dbTowerProfile";
import {applyLightingToRoot} from "../src/ThreeViewer";
import {setIsoNightPresentation} from "../src/IsometricCityWorld";
import {serializeObject3DForTransfer,deserializeTransferredObject3D} from "../src/transferableObject3D";
import oldPrisms from "../public/mesh/regierungsviertel/lod2-prisms.json";
import voxels from "../public/mesh/regierungsviertel/minecraft-voxels.json";
const create=(mobileLike=false,minecraft=false)=>minecraft?createMinecraftDbTowerArchitecture({mobileLike,diagnostics:true}):createDbTowerArchitecture({mobileLike,diagnostics:true});
function metrics(root:Group){let calls=0,instances=0,bytes=0;const g=new Set();root.traverse(o=>{if(o instanceof Mesh){calls++;if(!g.has(o.geometry)){g.add(o.geometry);for(const a of Object.values(o.geometry.attributes))bytes+=a.array.byteLength;bytes+=o.geometry.index?.array.byteLength??0;}if(o instanceof InstancedMesh){instances+=o.count;bytes+=o.instanceMatrix.array.byteLength+(o.instanceColor?.array.byteLength??0);}}});return{calls,instances,bytes};}
describe("BahnTower source, exterior glazing and full-height night signature",()=>{
 test("retains three exact source parts and their unchanged existing world anchor",()=>{
  expect(S.parent_id).toBe("DEBE01YYK0002KhX");expect(S.source_created).toBe("2026-03-02");expect(S.parts).toHaveLength(3);expect(S.parts.reduce((n,p)=>n+p.surfaces.length,0)).toBe(99);
  expect(S.prisms).toEqual(oldPrisms.buildings.filter(p=>DB_TOWER_PRISM_IDS.has(p.id)));
  for(const p of S.parts){expect(DB_TOWER_PRISM_IDS.has(p.id.slice(-8))).toBe(true);expect(p.ground_y_m).toBe(P.sourceGround);expect(dbTowerDisplayY(p.ground_y_m)).toBeCloseTo(P.ground,6);}
  expect(P.floors).toBe(26);expect(P.top-P.ground).toBeCloseTo(103.193,5);expect(P.mainTop).toBeCloseTo(dbTowerDisplayY(S.parts[1].top_y_m),6);
 });
 test("all 26 storeys and the red/white DB glyph survive full/mobile smooth and native blocks",()=>{
  const budgets=[];
  for(const mobile of[false,true])for(const mc of[false,true]){
   const root=create(mobile,mc),blocks=root.userData.blocks as DbTowerBlock[],m=metrics(root);budgets.push(m);
   const floorSet=new Set(blocks.filter(b=>b.role==="office glazing"||b.role==="transparent lobby").map(b=>b.floor));expect([...floorSet].sort((a,b)=>a-b)).toEqual(Array.from({length:26},(_,i)=>i));
   for(const role of["DB red sign field","DB letter D","DB letter B","DB white border","open upper glass wind screen"])expect(blocks.some(b=>b.role===role)).toBe(true);
   const red=blocks.find(b=>b.role==="DB red sign field")!,right=new Vector3(red.normal[1],0,-red.normal[0]);const glyphCentre=(role:string)=>{const glyph=blocks.filter(b=>b.role===role);return glyph.reduce((sum,b)=>sum+new Vector3(...b.position).dot(right),0)/glyph.length;};expect(glyphCentre("DB letter D")).toBeLessThan(glyphCentre("DB letter B"));
   expect(blocks.every(b=>b.position.every(Number.isFinite)&&b.size.every(v=>v>0&&Number.isFinite(v)))).toBe(true);
   expect(m.calls).toBe(mc?5:6);expect(m.instances).toBeLessThan(13000);expect(m.bytes).toBeLessThan(1100000);
   root.traverse(o=>{if(o instanceof Mesh){expect(o.geometry.getAttribute("uv")).toBeUndefined();expect(o.userData.dayMaterial).toBeDefined();expect(o.userData.nightMaterial).toBeDefined();expect(o.userData.moonlitMaterial).toBeDefined();if(mc)expect(o instanceof InstancedMesh).toBe(true);}});
   expect(new Box3().setFromObject(root).max.y).toBeLessThanOrEqual(P.top+.02);
  }
  expect(budgets[2].bytes).toBeLessThan(budgets[0].bytes);expect(budgets[3].instances).toBeLessThan(budgets[1].instances);
 });
 test("window rays hit new glazing before the exact source body at low, middle and top levels",()=>{
  for(const mobile of[false,true])for(const mc of[false,true]){
   const root=create(mobile,mc);root.updateMatrixWorld(true);const panes=(root.userData.blocks as DbTowerBlock[]).filter(b=>b.role==="office glazing");
   for(const floor of Array.from({length:25},(_,i)=>i+1))for(const index of[.04,.45,.9]){
    const onFloor=panes.filter(b=>b.floor===floor),b=onFloor[Math.floor(onFloor.length*index)],target=new Vector3(...b.position),n=new Vector3(b.normal[0],0,b.normal[1]);target.y+=b.size[1]*.1;
    const hit=new Raycaster(target.addScaledVector(n,1.4),n.clone().negate(),0,2).intersectObject(root,true)[0];expect(hit?.object.name,`${mobile} ${mc} floor ${floor}`).toBe("BahnTower glass");
   }
  }
 });
 test("source roofs land on the original planes without a single full-height box",()=>{
  const root=create();root.updateMatrixWorld(true);
  for(const[x,z,id]of[[218,1043,"xpXBjoqL"],[213,1035,"VHDXBTJj"],[224,1031,"NKE26iHe"]] as const){const y=dbTowerRoofAt(x,z,id);expect(y).not.toBeNull();const hit=new Raycaster(new Vector3(x,125,z),new Vector3(0,-1,0)).intersectObject(root,true)[0];expect(hit).toBeDefined();expect(hit.point.y).toBeCloseTo(y!,2);}
 });
 test("only the tower's original tall raster columns are substituted",()=>{
  let matches=0;for(let zi=0;zi<voxels.building_rows.length;zi++){const z=(voxels.grid.min_z_idx+zi+.5)*voxels.cell_m;if(z<1015||z>1050)continue;for(const[xi,n,,hi]of voxels.building_rows[zi])for(let i=0;i<n;i++){const x=(voxels.grid.min_x_idx+xi+i+.5)*voxels.cell_m;if(isDbTowerReplacementColumn(x,z,hi/10,voxels.cell_m))matches++;}}
  expect(matches).toBeGreaterThan(50);expect(isDbTowerReplacementColumn(220,1034,10)).toBe(false);expect(isDbTowerReplacementColumn(220,1034,130)).toBe(false);expect(isDbTowerReplacementColumn(267,1034,101.3)).toBe(false);expect(isDbTowerReplacementColumn(220,990,101.3)).toBe(false);
 });
 test("actual material switching preserves bright all-floor lighting, lights-off and day after worker transfer",()=>{
  const original=create(),transfer=serializeObject3DForTransfer(original),copy=deserializeTransferredObject3D(structuredClone(transfer.object)) as Group;
  for(const root of[original,copy]){
   const glass=root.getObjectByName("BahnTower glass") as Mesh,logo=root.getObjectByName("BahnTower logo-red") as Mesh;
   applyLightingToRoot(root,"night",true);setIsoNightPresentation(root,true,true);expect(glass.material).toBe(glass.userData.nightMaterial);expect((glass.material as MeshStandardMaterial).emissiveIntensity).toBe(P.windowNightIntensity);expect((glass.material as MeshStandardMaterial).emissive.getHex()).toBe(0xdceedd);expect((logo.material as MeshStandardMaterial).emissiveIntensity).toBeGreaterThan(1);
   applyLightingToRoot(root,"night",false);expect((glass.userData.nightMaterial as MeshStandardMaterial).emissiveIntensity).toBe(0);expect((logo.userData.nightMaterial as MeshStandardMaterial).emissiveIntensity).toBe(0);setIsoNightPresentation(root,true,false);expect(glass.material).toBe(glass.userData.moonlitMaterial);expect(logo.material).toBe(logo.userData.moonlitMaterial);
   applyLightingToRoot(root,"day",true);setIsoNightPresentation(root,false);expect(glass.material).toBe(glass.userData.dayMaterial);expect(logo.material).toBe(logo.userData.dayMaterial);
   applyLightingToRoot(root,"night",true);setIsoNightPresentation(root,true,true);expect(glass.material).toBe(glass.userData.nightMaterial);
  }
 });
});
