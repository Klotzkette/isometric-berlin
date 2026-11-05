import {expect,test} from 'bun:test';
import {BoxGeometry,DoubleSide,Group,InstancedMesh,Mesh,MeshBasicMaterial,PerspectiveCamera,Plane,Raycaster,Scene,Vector3} from 'three';
import {createReichstagSectionV318,reichstagSectionPlanesV318,reichstagSectionRemovedAtV318} from '../src/ReichstagSectionV318';
import {createReichstagSectionRoomsV318,REICHSTAG_LEVELS_V318} from '../src/ReichstagRoomsV318';
import {parliamentRetainedPlanV295} from '../src/ParliamentRetainedEnvelopeV295';
import {parliamentWorldPointV295 as W} from '../src/parliamentInteriorsV295Profile';
import {schwellenraumMaterialFor} from '../src/visual-modes/schwellenraum/materialGrade';
import {createReichstagLawnV318,reichstagGrassAtV318} from '../src/ReichstagLawnV318';

test('six intersection halfspaces remove exactly one finite longitudinal volume',()=>{
 const planes=reichstagSectionPlanesV318();
 for(let x=-89.875;x<90;x+=7)for(let z=-89.875;z<90;z+=7)for(const y of [3,5.2,7,20,48,100]){
 const p=W('reichstag',[x,y,z]);expect(planes.every(plane=>plane.distanceToPoint(new Vector3(...p))<0)).toBe(reichstagSectionRemovedAtV318(...p));
 }
 expect(reichstagSectionRemovedAtV318(...W('reichstag',[-30,20,0]))).toBe(true);
 expect(reichstagSectionRemovedAtV318(...W('reichstag',[10,20,0]))).toBe(false);
 expect(reichstagSectionRemovedAtV318(0,20,0)).toBe(false);
});
test('tap cuts existing shared source buffers reversibly; late native owner inherits cut; disposal restores exact material state',()=>{
 const scene=new Scene(),camera=new PerspectiveCamera(43,1,1,5000);camera.position.set(...W('reichstag',[-200,90,170]));camera.lookAt(...W('reichstag',[0,18,0]));camera.updateMatrixWorld(true);
 const canvas={getBoundingClientRect:()=>({left:0,top:0,right:800,bottom:800,width:800,height:800})} as HTMLCanvasElement;
 const renderer={localClippingEnabled:false},m=new MeshBasicMaterial(),body=new Mesh(new BoxGeometry(),m),buffer=body.geometry.attributes.position.array;scene.add(body);
 let ready=false,changes:boolean[]=[],native=false,removed=0;
 const c=createReichstagSectionV318({scene,camera,canvas,renderer,ready:()=>ready,native:()=>native,onChange:v=>changes.push(v),invalidate:()=>{},createRooms:n=>createReichstagSectionRoomsV318(n),disposeObject:()=>removed++});
 expect(c.hit(400,400)).toBe(false);ready=true;expect(c.hit(400,400)).toBe(true);expect(c.hit(-1,5)).toBe(false);
 c.tap(400,400);expect(c.open).toBe(true);expect(m.clippingPlanes).toHaveLength(6);expect(m.clipIntersection).toBe(true);expect(m.clipShadows).toBe(true);expect(renderer.localClippingEnabled).toBe(true);expect(body.geometry.attributes.position.array).toBe(buffer);
 c.tap(400,400);expect(changes).toEqual([true]);
 const n=new MeshBasicMaterial();scene.add(new Mesh(new BoxGeometry(),n));native=true;c.sync();expect(n.clippingPlanes).toHaveLength(6);
 const grade=schwellenraumMaterialFor(body,m);expect(grade.clippingPlanes).toBeNull();body.material=grade;c.sync();expect(grade.clippingPlanes).toHaveLength(6);
 c.setOpen(false);expect(grade.clippingPlanes).toBeNull();expect(grade.clipIntersection).toBe(false);expect(m.clippingPlanes).toBeNull();expect(n.clippingPlanes).toBeNull();expect(m.clipIntersection).toBe(false);expect(m.clipShadows).toBe(false);expect(renderer.localClippingEnabled).toBe(false);
 c.setOpen(true);c.dispose();expect(m.clippingPlanes).toBeNull();expect(renderer.localClippingEnabled).toBe(false);expect(removed).toBe(2);expect(scene.children.filter(o=>o.userData.sectionOnly)).toHaveLength(0);
});
test('inside furniture and unready or disposed city do not become exhibit clicks; preexisting authored clipping remains exact',()=>{
 const scene=new Scene(),camera=new PerspectiveCamera();camera.position.set(...W('reichstag',[0,10,0]));camera.lookAt(...W('reichstag',[20,10,0]));camera.updateMatrixWorld(true);
 const planes=[new Plane(new Vector3(0,1,0),-2)],material=new MeshBasicMaterial({clippingPlanes:planes});scene.add(new Mesh(new BoxGeometry(),material));
 const canvas={getBoundingClientRect:()=>({left:0,top:0,right:800,bottom:800,width:800,height:800})} as HTMLCanvasElement;
 const c=createReichstagSectionV318({scene,camera,canvas,renderer:{localClippingEnabled:true},ready:()=>true,invalidate:()=>{}});expect(c.hit(400,400)).toBe(false);c.setOpen(true);expect(material.clippingPlanes).toBe(planes);c.dispose();expect(c.tap(400,400)).toBe(false);
});
test('source-clipped floors preserve six actual courtyard holes at every level in both independent families',()=>{
 const src=parliamentRetainedPlanV295();expect(src.holes).toHaveLength(6);
 for(const native of [false,true]){
  const root=createReichstagSectionRoomsV318(native);root.updateMatrixWorld(true);expect(root.userData.sourceCourtyardCount).toBe(6);
  let instances=0;root.traverse(o=>{if(o instanceof InstancedMesh){instances+=o.count;for(let i=0;i<o.count;i++){const a=o.instanceMatrix.array;expect(a[i*16+1]).toBe(0);expect(a[i*16+2]).toBe(0);expect(a[i*16+4]).toBe(0);expect(a[i*16+6]).toBe(0);expect(a[i*16+8]).toBe(0);expect(a[i*16+9]).toBe(0);}}});expect(instances).toBeLessThan(2200);
  for(const hole of src.holes??[]){const x=hole.reduce((s,p)=>s+p[0],0)/hole.length/10,z=hole.reduce((s,p)=>s+p[1],0)/hole.length/10;for(const l of REICHSTAG_LEVELS_V318){const r=new Raycaster(new Vector3(x,l.y+.25,z),new Vector3(0,-1,0),0,.6);expect(r.intersectObjects(root.children,true)).toHaveLength(0);}}
 }
});
test('mown grass is bounded by original lawn and roads, follows actual ground, and keeps one texture-free family batch',()=>{
 expect(reichstagGrassAtV318(50,20)).toBe(true);expect(reichstagGrassAtV318(300,20)).toBe(false);
 for(const native of [false,true]){const root=createReichstagLawnV318(()=>5.2,native);expect(root.children).toHaveLength(1);expect(root.userData.grassClumps).toBeGreaterThan(2500);expect(root.userData.grassClumps).toBeLessThan(7500);const mesh=root.children[0] as Mesh;expect(mesh.geometry.getAttribute('uv')).toBeUndefined();expect(mesh.matrixAutoUpdate).toBe(false);}
 expect(createReichstagLawnV318(()=>null).userData.grassClumps).toBe(0);
});
