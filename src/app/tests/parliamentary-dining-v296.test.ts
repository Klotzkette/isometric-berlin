import {describe,expect,test} from 'bun:test';
import {BoxGeometry,BufferGeometry,ExtrudeGeometry,Group,InstancedMesh,Matrix4,Mesh,MeshBasicMaterial,Raycaster,Shape,Vector3} from 'three';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createParliamentaryDiningV296,applyDiningAuthoredOpeningsV296,prepareDiningAuthoredFacadeV296} from '../src/ParliamentaryDiningV296';
import {PARLIAMENTARY_DINING_V296 as P,diningOriginalPrismV296,diningSourceOpeningsV296,createDiningColumnOpeningsV296,diningNativeBoxFragmentsV296,diningFloorAtV296,DINING_GROUND_OPENINGS_V296,diningSolidAtV296} from '../src/parliamentaryDiningV296Profile';
import {parliamentClipGeometryV295} from '../src/ParliamentRetainedEnvelopeV295';
import {createBundestagSpreeConnection} from '../src/CentralCivicDetails';
import {createMinecraftArchitecturalLandmarks} from '../src/MinecraftArchitecturalLandmarks';
import data from '../src/data/parliamentaryDiningV296.json';
import groundData from '../public/mesh/regierungsviertel/minecraft-voxels.json';
import {groundTopSampler,type VoxelPayload} from '../src/terrainPayload';
import {disposeSurroundingCityRoot} from '../src/SurroundingCity';
const source=JSON.parse(readFileSync(new URL('../public/mesh/regierungsviertel/lod2-prisms.json',import.meta.url),'utf8')).buildings;
function oldSource(open=false):Group{
 const root=new Group();for(const p of data.originalPrisms){const shape=new Shape();p.ring.forEach(([x,z],i)=>i?shape.lineTo(x/10,-z/10):shape.moveTo(x/10,-z/10));const g=new ExtrudeGeometry(shape,{bevelEnabled:false,depth:p.h_dm/10});g.rotateX(-Math.PI/2);g.translate(0,p.y0_dm/10,0);const clipped=parliamentClipGeometryV295(g,diningSourceOpeningsV296(p,open));if(clipped!==g)g.dispose();root.add(new Mesh(clipped,new MeshBasicMaterial()));}return root;
}
function oldNative(open=false):Group{
 const root=new Group(),cuts=createDiningColumnOpeningsV296(source,4,open);for(const c of data.nativeColumns){const[x,z,b,t,k]=c.row,box={min:[x*4,b/10,z*4]as[number,number,number],max:[(x+1)*4,t/10,(z+1)*4]as[number,number,number]};for(const p of diningNativeBoxFragmentsV296(box,cuts(x,z,b,t,k))){const g=new BoxGeometry(...p.max.map((v,i)=>v-p.min[i])as[number,number,number]),mesh=new Mesh(g,new MeshBasicMaterial());mesh.position.set(...p.min.map((v,i)=>(v+p.max[i])/2)as[number,number,number]);root.add(mesh);}}return root;
}
function hits(root:Group,x:number,y:number,z:number,dx:number,dz:number,far=50){root.updateMatrixWorld(true);return new Raycaster(new Vector3(x,y,z),new Vector3(dx,0,dz).normalize(),0,far).intersectObject(root,true).filter(h=>!(h.object instanceof Mesh&&((h.object.material as MeshBasicMaterial).transparent)));}
describe('v296 current parliamentary dining and bounded original surface complements',()=>{
 test('complete primary-source identities and6exact retained owners guard every opening',()=>{
  expect(data.originalPrisms).toHaveLength(6);for(const p of data.originalPrisms){expect(diningOriginalPrismV296(p)).toBe(true);expect(diningSourceOpeningsV296(p)).toHaveLength(0);expect(diningSourceOpeningsV296(p,true)).toHaveLength(1);for(const bad of[{...p,h_dm:p.h_dm+1},{...p,unreceipted:true}])expect(diningSourceOpeningsV296(bad,true)).toHaveLength(0);}
  for(const[path,sha]of Object.entries(data.inputSha256))expect(createHash('sha256').update(readFileSync(new URL('../../../'+path,import.meta.url))).digest('hex')).toBe(sha);
  expect(data.nativeColumns.filter(c=>c.exclusiveFullCell)).toHaveLength(88);
 });
 test('full room detail is bounded and the native interpretation remains independently cardinal',()=>{
  for(const n of[false,true]){const r=createParliamentaryDiningV296(n);expect(r.userData.instanceCount).toBeLessThan(n?P.maxNativeInstances:P.maxDrawnInstances);expect(r.userData.roles['pardo:illustrative-lamp-count']).toBe(129);expect(r.userData.roles['marie:lower-terrace']).toBe(1);expect(r.userData.roles['marie:upper-terrace']).toBe(1);expect(r.userData.fullStaticDetailOnTouch).toBe(true);let bytes=0;r.traverse(o=>{if(!(o instanceof InstancedMesh))return;bytes+=o.instanceMatrix.array.byteLength+o.instanceColor!.array.byteLength;expect(o.count).toBe(o.instanceMatrix.count);const m=new Matrix4();for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);if(n)for(const k of[1,2,4,6,8,9])expect(Math.abs(m.elements[k])).toBe(0);}});expect(bytes).toBeLessThan(P.maxGpuBytes);}
 });
 test('actual old source and native columns mask the PLH lamps before and expose them after guarded complements',()=>{
  for(const n of[false,true]){const before=n?oldNative():oldSource(),after=n?oldNative(true):oldSource(true),room=createParliamentaryDiningV296(n);expect(hits(before,349,6.2,-100.7,-1,0,30).length).toBeGreaterThan(0);const scene=new Group().add(after,room);const visible=hits(scene,349,6.2,-100.7,-1,0,30);expect(visible.length).toBeGreaterThan(0);expect(visible[0].object.name.startsWith('Parliamentary dining')).toBe(true);}
 });
 test('MELH real opaque old facade/native band opens only after the complete dining group is enabled',()=>{
  for(const n of[false,true]){const old=n?createMinecraftArchitecturalLandmarks():createBundestagSpreeConnection();const unrelated=old.children.filter(c=>c.name!=='Minecraft parliamentary band block signature'&&c.name!=='Marie-Elisabeth-Lüders-Haus Spree facade');const arrays=unrelated.map(o=>o instanceof InstancedMesh?o.instanceMatrix.array:(o as Mesh).geometry?.attributes.position?.array);const sourceBefore=n?oldNative():oldSource();const sceneBefore=new Group().add(old,sourceBefore);expect(hits(sceneBefore,370,5.95,-159,1,0,35).length).toBeGreaterThan(0);const count=old.children.length;applyDiningAuthoredOpeningsV296(old,n);expect(old.children.length).toBe(count);applyDiningAuthoredOpeningsV296(old,n,true);unrelated.forEach((o,i)=>expect(o instanceof InstancedMesh?o.instanceMatrix.array:(o as Mesh).geometry?.attributes.position?.array).toBe(arrays[i]));const scene=new Group().add(old,n?oldNative(true):oldSource(true),createParliamentaryDiningV296(n));const visible=hits(scene,370,5.95,-159,1,0,35);expect(visible.length).toBeGreaterThan(0);expect(visible[0].object.name.startsWith('Parliamentary dining')).toBe(true);}
 });
 test('native rows reject missing source, altered height, any newly overlapping foreign owner and wrong cell size',()=>{
  const row=data.nativeColumns.find(c=>c.exclusiveFullCell&&c.row[0]>79&&c.row[0]<84&&c.row[1]===-26)!;const[x,z,b,t,k]=row.row;expect(createDiningColumnOpeningsV296(source,4,true)(x,z,b,t,k).length).toBe(1);expect(createDiningColumnOpeningsV296(source,4)(x,z,b,t,k)).toHaveLength(0);expect(createDiningColumnOpeningsV296(source.filter((p:{id:string})=>p.id!=='TAXdTj4D'),4,true)(x,z,b,t,k)).toHaveLength(0);expect(createDiningColumnOpeningsV296(source,2,true)(x,z,b,t,k)).toHaveLength(0);const foreign={id:'unseen',ring:[[x*40,z*40],[(x+1)*40,z*40],[(x+1)*40,(z+1)*40],[x*40,(z+1)*40]],y0_dm:40,h_dm:280};expect(createDiningColumnOpeningsV296([...source,foreign],4,true)(x,z,b,t,k)).toHaveLength(0);expect(createDiningColumnOpeningsV296(source,4,true)(x,z,b,t+1,k)).toHaveLength(0);
 });
 test('the actual original4.1m native-ground tile must yield its exact bounded complement for the lower room',()=>{
  const sample=groundTopSampler(groundData as unknown as VoxelPayload),xi=Math.floor(392/4)-groundData.grid.min_x_idx,zi=Math.floor(-164/4)-groundData.grid.min_z_idx,y=sample(xi,zi);expect(y).toBeCloseTo(4.1,3);
  const old=new BoxGeometry(4,1,4);old.translate(394,y-.5,-162);const before=new Mesh(old,new MeshBasicMaterial()),g=parliamentClipGeometryV295(old,DINING_GROUND_OPENINGS_V296);expect(g).not.toBe(old);const room=createParliamentaryDiningV296(),scene=new Group().add(new Mesh(g,new MeshBasicMaterial()),room);scene.updateMatrixWorld(true);
  expect(new Raycaster(new Vector3(394,8,-162),new Vector3(0,-1,0)).intersectObject(before,true)[0]).toBeDefined();const floorHits=new Raycaster(new Vector3(394,3,-162),new Vector3(0,-1,0)).intersectObject(scene,true);expect(floorHits.length).toBeGreaterThan(0);expect(floorHits[0].object.name.startsWith('Parliamentary dining')).toBe(true);expect(floorHits[0].point.y).toBeCloseTo(.65,4);
 });
 test('terrace staircase rendered tread tops and support connect both existing room levels',()=>{
  for(const n of[false,true]){const r=createParliamentaryDiningV296(n);r.updateMatrixWorld(true);for(let i=0;i<20;i++){const x=378,z=-160.53-i*.26,y=P.marie.floor+(i+1)*(P.marie.upper-P.marie.floor)/20;expect(diningFloorAtV296(x,z,y,0)).toBeCloseTo(y,6);const ray=new Raycaster(new Vector3(x,y+.1,z),new Vector3(0,-1,0),0,.3).intersectObject(r,true)[0];expect(ray).toBeDefined();expect(ray.point.y).toBeCloseTo(y,4);}}
  expect(diningSolidAtV296(P.lampenladen.cx+4.2,P.lampenladen.cz,P.lampenladen.floor)).toBe(true);expect(diningSolidAtV296(0,0,0)).toBe(false);
 });
 test('two-level support does not promote lower visitors onto the upper balcony',()=>{expect(diningFloorAtV296(390,-171,.65,4.1)).toBe(.65);expect(diningFloorAtV296(390,-171,4.15,4.1)).toBe(4.15);expect(diningFloorAtV296(380,-160,.65,4.1)).toBe(.65);expect(diningFloorAtV296(0,0,1,3)).toBe(3);expect(diningFloorAtV296(P.lampenladen.cx,P.lampenladen.cz,4.24,3)).toBe(4.24);});
});


test('physical ceiling and balcony point probes coincide with actual drawn/native slabs and preserve doors/stair headroom',()=>{
 for(const native of[false,true]){
  const root=createParliamentaryDiningV296(native);root.updateMatrixWorld(true);
  // Vertical rays prove that these points fall in actual rendered slabs; no
  // source footprint bypass can silently turn the ceiling into walkable air.
  for(const[x,y,z,underside]of[[391,7.35,-163,7.3],[391,4.08,-170,3.99],[382,4.05,-170,3.95],[326.1,7.13,-100.7,7.08]]){
   const hit=new Raycaster(new Vector3(x,y-.2,z),new Vector3(0,1,0),0,.4).intersectObject(root,true)[0];
   expect(hit).toBeDefined();expect(hit.point.y).toBeCloseTo(underside,5);expect(diningSolidAtV296(x,z,y,0,.28)).toBe(true);
  }
  for(const[x,z,y]of[[391,-163,7.47],[391,-170,P.marie.upper],[382,-170,P.marie.upper],[326.1,-100.7,7.19]])expect(diningSolidAtV296(x,z,y,0,.28)).toBe(false);
  // Walkable door sectors stay open for all three capsule-height probes.
  const pardoAngle=Math.PI/48,pardoX=P.lampenladen.cx+Math.cos(pardoAngle)*P.lampenladen.radius,pardoZ=P.lampenladen.cz+Math.sin(pardoAngle)*P.lampenladen.radius;
  const marieDoorZ=P.marie.room[2]+6.5*(P.marie.room[3]-P.marie.room[2])/10;
  for(const offset of[0,.82,1.64]){
   expect(diningSolidAtV296(pardoX,pardoZ,P.lampenladen.floor+offset,0,.28)).toBe(false);
   expect(diningSolidAtV296(P.marie.room[0],marieDoorZ,P.marie.floor+offset,0,.28)).toBe(false);
  }
  // Every actual staircase tread still supports a standing capsule; the
  // north/south plate ends do not block the final approach to the upper terrace.
  for(let i=0;i<20;i++){
   const x=378,z=-160.53-i*.26,y=P.marie.floor+(i+1)*(P.marie.upper-P.marie.floor)/20;
   expect(diningFloorAtV296(x,z,y,NaN)).toBeCloseTo(y,6);
   for(const offset of[0,.82,1.64])expect(diningSolidAtV296(x,z,y+offset,0,.28)).toBe(false);
  }
 }
});


test('drawn dining facade stages a complete detached owner, leaves predecessor and unrelated owners untouched, and abort-disposes independently',()=>{
 const original=createBundestagSpreeConnection(),facade=original.getObjectByName('Marie-Elisabeth-Lüders-Haus Spree facade')!;
 const arrays:unknown[]=[];const objects:Mesh[]=[];let originalDisposals=0;
 original.traverse(o=>{if(o instanceof Mesh){objects.push(o);arrays.push(o.geometry.attributes.position.array);o.geometry.addEventListener('dispose',()=>originalDisposals++);for(const m of Array.isArray(o.material)?o.material:[o.material])m.addEventListener('dispose',()=>originalDisposals++);}});
 expect(prepareDiningAuthoredFacadeV296(original)).toBe(null);expect(prepareDiningAuthoredFacadeV296(new Group(),true)).toBe(null);
 const before=hits(original,370,5.95,-159,1,0,35);expect(before.length).toBeGreaterThan(0);
 const staged=prepareDiningAuthoredFacadeV296(original,true)!;expect(staged.predecessor).toBe(facade);expect(staged.group.parent).toBe(null);expect(staged.group.userData.parliamentaryDiningFacadeV296).toBe(true);expect(facade.visible).toBe(true);
 expect(hits(staged.group,370,5.95,-159,1,0,35)).toHaveLength(0);expect(hits(original,370,5.95,-159,1,0,35).length).toBe(before.length);
 const oldOutside=hits(facade as Group,370,12,-159,1,0,35),newOutside=hits(staged.group,370,12,-159,1,0,35);expect(oldOutside.length).toBeGreaterThan(0);expect(newOutside.length).toBe(oldOutside.length);expect(newOutside[0].point.distanceTo(oldOutside[0].point)).toBeLessThan(.0001);
 objects.forEach((o,i)=>expect(o.geometry.attributes.position.array).toBe(arrays[i]));disposeSurroundingCityRoot(staged.group);expect(originalDisposals).toBe(0);expect(facade.visible).toBe(true);objects.forEach((o,i)=>expect(o.geometry.attributes.position.array).toBe(arrays[i]));disposeSurroundingCityRoot(original);
});

test('staged facade retains ancestor world transforms and deeply rebound day/night material handles without sharing original disposal',()=>{
 const sourceRoot=new Group();sourceRoot.position.set(50,0,20);sourceRoot.rotation.y=.27;sourceRoot.updateMatrixWorld(true);
 const facade=new Group();facade.name='Marie-Elisabeth-Lüders-Haus Spree facade';sourceRoot.add(facade);
 const g=new BoxGeometry(20,12,30);g.translate(391,5,-163);g.applyMatrix4(sourceRoot.matrixWorld.clone().invert());
 const day=new MeshBasicMaterial({color:0x887766}),night=new MeshBasicMaterial({color:0x223344}),mesh=new Mesh(g,day);mesh.userData={dayMaterial:day,nightMaterial:night,alternate:{day,night:[night]}};facade.add(mesh);
 let disposed=0;for(const owner of[g,day,night])owner.addEventListener('dispose',()=>disposed++);
 const raw=g.getAttribute('position').array.slice(),local=sourceRoot.matrix.clone(),before=hits(sourceRoot,370,2,-159,1,0,35);expect(before.length).toBeGreaterThan(0);
 const staged=prepareDiningAuthoredFacadeV296(sourceRoot,true)!;expect(hits(staged.group,370,2,-159,1,0,35)).toHaveLength(0);
 const cloned=staged.group.children[0]as Mesh;expect(cloned.userData.dayMaterial).not.toBe(day);expect(cloned.userData.nightMaterial).not.toBe(night);expect(cloned.userData.alternate.day).toBe(cloned.userData.dayMaterial);expect(cloned.userData.alternate.night[0]).toBe(cloned.userData.nightMaterial);
 expect(cloned.geometry).not.toBe(g);expect(cloned.material).not.toBe(day);expect(g.getAttribute('position').array).toEqual(raw);expect(sourceRoot.matrix).toEqual(local);expect(mesh.userData.dayMaterial).toBe(day);expect(mesh.userData.nightMaterial).toBe(night);
 const oldTop=hits(sourceRoot,370,10,-159,1,0,35),newTop=hits(staged.group,370,10,-159,1,0,35);expect(newTop[0].point.distanceTo(oldTop[0].point)).toBeLessThan(.0001);
 disposeSurroundingCityRoot(staged.group);expect(disposed).toBe(0);expect(hits(sourceRoot,370,2,-159,1,0,35).length).toBe(before.length);disposeSurroundingCityRoot(sourceRoot);
});
