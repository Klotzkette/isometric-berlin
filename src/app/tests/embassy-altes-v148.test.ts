import {describe,expect,test} from 'bun:test';
import {Box3,InstancedMesh,Matrix4,Mesh,Raycaster,Vector3} from 'three';
import {createRussianEmbassySourceGeometry,createMinecraftRussianEmbassySourceGeometry,RUSSIAN_EMBASSY_SOURCE_PARTS as PARTS,RUSSIAN_EMBASSY_SOURCE_IDS,RUSSIAN_EMBASSY_SOURCE_DY,russianEmbassyRoofAt,russianEmbassyPartContains,isRussianEmbassyReplacementColumn} from '../src/RussianEmbassySourceGeometry';
import {ALTES_EQUESTRIAN_GROUPS,ALTES_PROFILE,altesWorld,domAltesExtraSolidAt} from '../src/domAltesMuseumProfile';
import {createDomAltesMuseum} from '../src/DomAltesMuseum';
import {UNTER_DEN_LINDEN_DETAILS_PROFILE} from '../src/unterDenLindenProfiles';
import {createUnterDenLindenDetails} from '../src/UnterDenLindenDetails';
function budget(root:ReturnType<typeof createDomAltesMuseum>){let bytes=0,draws=0,instances=0,vertices=0;const seen=new Set();root.traverse(o=>{if(!(o instanceof Mesh))return;draws++;vertices+=o.geometry.getAttribute('position').count*(o instanceof InstancedMesh?o.count:1);if(!seen.has(o.geometry)){seen.add(o.geometry);for(const a of Object.values(o.geometry.attributes))bytes+=a.array.byteLength;bytes+=o.geometry.index?.array.byteLength??0;}if(o instanceof InstancedMesh){instances+=o.count;bytes+=o.instanceMatrix.array.byteLength+(o.instanceColor?.array.byteLength??0);}});return{bytes,draws,instances,vertices};}
describe('v148 source-preserving Embassy and Altes Museum corrections',()=>{
 test('all sixteen original source parts now render with exact roofs and courtyard gaps',()=>{
  expect(PARTS).toHaveLength(16);expect(RUSSIAN_EMBASSY_SOURCE_IDS.size).toBe(16);
  const root=createRussianEmbassySourceGeometry();root.updateMatrixWorld(true);
  const roofs=root.getObjectByName('Russian Embassy original RoofSurface')!;
  let checks=0;
  for(const part of PARTS)for(const s of part.surfaces.filter(s=>s.kind==='RoofSurface')){
   const ring=s.rings[0],x=ring.reduce((n,p)=>n+p[0],0)/ring.length,z=ring.reduce((n,p)=>n+p[2],0)/ring.length,y=russianEmbassyRoofAt(x,z);
   if(y===null)continue;const hit=new Raycaster(new Vector3(x,100,z),new Vector3(0,-1,0)).intersectObject(roofs)[0];expect(hit.point.y).toBeCloseTo(y,2);checks++;
  }expect(checks).toBeGreaterThan(20);
  expect(PARTS.every(p=>p.ground_y_m+RUSSIAN_EMBASSY_SOURCE_DY===5.2)).toBeTrue();
  for(const [x,z]of[[805,309],[785,365],[838,364]])expect(PARTS.some(p=>russianEmbassyPartContains(p,x,z))).toBeFalse();
  expect(isRussianEmbassyReplacementColumn(740,300)).toBeFalse();expect(isRussianEmbassyReplacementColumn(785,365)).toBeFalse();
 });
 test('lantern moves from the rear chimney to DOP-established front risalit without dropping the chimney',()=>{
  const p=UNTER_DEN_LINDEN_DETAILS_PROFILE.buildings.russianEmbassy;
  expect(p.towerWorldXZ).toEqual([805.25,325.5]);expect(p.previousMistakenLanternWorldXZ).toEqual([797.78,357.151]);
  expect(PARTS.find(p=>p.id==='DEBE3DmaCMlAOled')?.top_y_m).toBe(31.991);
  const root=createUnterDenLindenDetails();root.updateMatrixWorld(true);const hit=new Raycaster(new Vector3(805.25,70,325.5),new Vector3(0,-1,0)).intersectObject(root,true)[0];expect(hit.point.y).toBeGreaterThan(45);
 });
 test('Ionic spirals are exposed beneath the corrected source-width overhang, and column gaps remain open',()=>{
  const root=createDomAltesMuseum();root.updateMatrixWorld(true);const normal=new Vector3(Math.sin(ALTES_PROFILE.yaw),0,Math.cos(ALTES_PROFILE.yaw));
  const u=-39.8+5*79.6/17,capital=altesWorld(u+1.063,21.8,3.22),start=new Vector3(...capital).addScaledVector(normal,8);
  const hit=new Raycaster(start,normal.clone().negate()).intersectObject(root,true)[0];expect(hit.distance).toBeLessThan(8.6);
  const outside=altesWorld(0,23,5.5);expect(domAltesExtraSolidAt(...outside)).toBeFalse();
  const gap=altesWorld(0,15,2.6);expect(domAltesExtraSolidAt(...gap)).toBeFalse();
 });
 test('Altes flutes form one closed shaft rather than depth-competing overlay strips',()=>{
  const root=createDomAltesMuseum(),mesh=root.getObjectByName('Museum island details ionic') as InstancedMesh;
  expect(mesh.count).toBe(18);expect(mesh.geometry.getAttribute('uv')).toBeUndefined();
  const positions=mesh.geometry.getAttribute('position'),index=mesh.geometry.index!;
  expect(positions.count).toBe(194);expect(index.count).toBe(1152);
  const edges=new Map<string,number>();for(let i=0;i<index.count;i+=3)for(let j=0;j<3;j++){
   const a=index.getX(i+j),b=index.getX(i+(j+1)%3),key=[Math.min(a,b),Math.max(a,b)].join(':');edges.set(key,(edges.get(key)??0)+1);
  }expect([...edges.values()].every(n=>n===2)).toBeTrue();
  for(let i=0;i<96;i+=4){const crest=Math.hypot(positions.getX(i),positions.getZ(i)),groove=Math.hypot(positions.getX(i+2),positions.getZ(i+2));expect(crest-groove).toBeCloseTo(.026,5);}
 });
 test('bronze combat groups keep distinct opponents and opposite-facing exact OSM anchors',()=>{
  expect(ALTES_EQUESTRIAN_GROUPS.map(p=>p.node)).toEqual(['4353173360','4353173363']);
  expect(ALTES_EQUESTRIAN_GROUPS.map(p=>p.material)).toEqual(['cast bronze','cast bronze']);
  expect(ALTES_EQUESTRIAN_GROUPS[0].yaw-ALTES_EQUESTRIAN_GROUPS[1].yaw).toBe(Math.PI);
  const root=createDomAltesMuseum(),mesh=root.getObjectByName('Museum island details bronze')as InstancedMesh;
  expect(mesh).toBeInstanceOf(InstancedMesh);expect(mesh.geometry.getAttribute('color')).toBeDefined();expect(mesh.geometry.getAttribute('uv')).toBeUndefined();
  const matrix=new Matrix4(),point=new Vector3();for(const p of ALTES_EQUESTRIAN_GROUPS){let count=0;for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);if(Math.hypot(point.x-p.worldXZ[0],point.z-p.worldXZ[1])<3)count++;}expect(count).toBeGreaterThan(70);}
 });
 test('bounded geometry is identical on drawn devices and native envelopes stay surface-only',()=>{
  expect(budget(createDomAltesMuseum())).toEqual({bytes:1037604,draws:16,instances:8670,vertices:353304});
  expect(budget(createDomAltesMuseum({mobileLike:true}))).toEqual(budget(createDomAltesMuseum()));
  expect(budget(createRussianEmbassySourceGeometry())).toEqual({bytes:28800,draws:2,instances:0,vertices:1200});
  for(const mobileLike of[false,true]){const root=createMinecraftRussianEmbassySourceGeometry({mobileLike});expect(root.userData.hiddenSolidInfill).toBeFalse();expect(root.children).toHaveLength(1);expect((root.children[0]as InstancedMesh).count).toBe(mobileLike?1747:2822);expect(new Box3().setFromObject(root).max.y).toBeLessThan(36);}
 });
});
