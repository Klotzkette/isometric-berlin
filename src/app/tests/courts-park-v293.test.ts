import {describe,expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {InstancedMesh,Matrix4,Mesh,Raycaster,Vector3} from 'three';
import {createCourtsParkV293} from '../src/CourtsParkV293';
import {COURTS_PARK_V293_PROFILE as P,ROLLERACHT_V293 as R,ROLLERACHT_V293_APPROACHES as A,courtsParkV293GroundAt as ground,courtsParkV293SolidAt as solid} from '../src/courtsParkV293Profile';
import evidence from '../../../geo_data/regierungsviertel/courts-park-v293-evidence.json';
import data from '../src/data/courtsParkV293.json';
const roots=[createCourtsParkV293(false),createCourtsParkV293(true)];
for(const r of roots)r.updateMatrixWorld(true);
describe('v293 exact courts, two distinct park churches and real Rolleracht crossing',()=>{
 test('retains every original court, church, source path and generic source owner byte',()=>{
  for(const [path,sha]of Object.entries(evidence.sourceFiles))expect(createHash('sha256').update(readFileSync(new URL('../../../'+path,import.meta.url))).digest('hex')).toBe(sha);
  expect(data.neighbours.filter(n=>n.site==='charlottenburg')).toHaveLength(4);
  expect(new Set(data.neighbours.map(n=>n.owner)).size).toBe(12);
  expect(data.bridge.id).toBe('way/116946775');expect(data.track.id).toBe('way/116946778');
  expect(data.track.geometry.coordinates[0]).toEqual(data.bridge.geometry.coordinates[1]);
  expect(data.track.geometry.coordinates.at(-1)).toEqual(data.bridge.geometry.coordinates[0]);
  expect(data.church.filter(p=>p.owner==='DEBE01YYK0002JWo')).toHaveLength(7);
  expect(data.church.filter(p=>p.owner==='DEBE01YYK0002MC8')).toHaveLength(2);
 });
 test('all requested sites have compact texture-free additions; native matrices are cardinal and independent',()=>{
  for(const [i,r]of roots.entries()){
   const mesh=r.children[0] as InstancedMesh;expect(mesh.count).toBeLessThan(i?P.maxNativeInstances:P.maxDrawnInstances);expect(mesh.instanceMatrix.count).toBe(mesh.count);expect(mesh.instanceColor!.count).toBe(mesh.count);
   expect(r.userData.fullStaticDetailOnTouch).toBe(true);expect(r.userData.requiredBeforeNavigation).toBe(true);
   for(const key of['wedding:four-leaf-window','charlottenburg:four-leaf-window','moabit:stone-window-mullion','johannis:round-arch','heiland:bell-louvre','rolleracht:arched-tube-portal'])expect(r.userData.roles[key]).toBeGreaterThan(0);
   let bytes=mesh.instanceMatrix.array.byteLength+mesh.instanceColor!.array.byteLength;
   r.traverse(o=>{if(o instanceof Mesh)for(const a of Object.values(o.geometry.attributes))bytes+=a.array.byteLength;});expect(bytes).toBeLessThan(P.maxGpuBytes);
   if(i){const m=new Matrix4();for(let j=0;j<mesh.count;j++){mesh.getMatrixAt(j,m);for(const k of[1,2,4,6,8,9])expect(Math.abs(m.elements[k])).toBe(0);}}
  }
  expect(roots[0].children.length).toBe(2);expect(roots[1].children.length).toBe(1);
  expect(roots[1].userData.roles['johannis:cardinal-upper-wall']).toBeGreaterThan(40);
 });
 test('both actual mesh families have a continuous adult-clear lower tube, not just a navigation exemption',()=>{
  for(const root of roots)for(const u of[-.45,0,.45])for(const y of[5.55,6.2,7.02]){
   const from=new Vector3(R.cx+R.ux*u+R.uz*4,y,R.cz+R.uz*u-R.ux*4);
   const hits=new Raycaster(from,new Vector3(-R.uz,0,R.ux),0,8).intersectObject(root,true);expect(hits.length).toBe(0);
  }
  for(let v=-5;v<=5;v+=.25){const x=R.cx-R.uz*v,z=R.cz+R.ux*v;expect(solid(x,z,P.groundY)).toBe(false);expect(ground(x,z,P.groundY,P.groundY)).toBe(P.groundY);}
  const x=R.cx+R.ux*2.6,z=R.cz+R.uz*2.6;expect(solid(x,z,P.groundY)).toBe(true);
  expect(solid(R.cx,R.cz,P.groundY+.7)).toBe(true);
 });
 test('mapped curved upper approaches connect with actual represented slabs and never teleport lower visitors',()=>{
  expect(A.filter(s=>s.run===0)).toHaveLength(2);
  for(const [i,root]of roots.entries()){
   let floor=P.groundY;
   const sequences=[A.filter(s=>Math.hypot(s.a[0]-P.bridgeEnds[0][0],s.a[1]-P.bridgeEnds[0][1])<.001),A.filter(s=>Math.hypot(s.a[0]-P.bridgeEnds[1][0],s.a[1]-P.bridgeEnds[1][1])<.001)];expect(sequences.every(s=>s.length===1)).toBe(true);
   for(const seg of A)for(const t of[.2,.6,.9]){const x=seg.a[0]+(seg.b[0]-seg.a[0])*t,z=seg.a[1]+(seg.b[1]-seg.a[1])*t,y=ground(x,z,20,-10,!!i);expect(y).toBeGreaterThanOrEqual(P.groundY);const hit=new Raycaster(new Vector3(x,20,z),new Vector3(0,-1,0)).intersectObject(root,true)[0];expect(hit).toBeDefined();expect(Math.abs(hit.point.y-y)).toBeLessThan(i?.14:.075);floor=Math.max(floor,y);}
   expect(floor).toBeGreaterThan(P.groundY+2.2);
   expect(ground(R.cx,R.cz,P.groundY,3,!!i)).toBe(3);expect(ground(R.cx,R.cz,7.745,3,!!i)).toBe(7.745);
   expect(ground(0,0,100,9,!!i)).toBe(9);expect(solid(0,0,5)).toBe(false);
  }
 });
});
