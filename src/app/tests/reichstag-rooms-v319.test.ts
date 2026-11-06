import { expect, test } from "bun:test";
import {
  BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  PerspectiveCamera, Raycaster, Scene, Vector3,
} from "three";
import {
  createReichstagSectionFurnishingsV319, REICHSTAG_SECTION_LAYOUT_V319,
  reichstagSectionBoxFitsV319, reichstagSectionFootprintContainsV319,
  reichstagSectionMembersV319,
} from "../src/ReichstagRoomsV319";
import { createReichstagSectionRoomsV318, REICHSTAG_LEVELS_V318 } from "../src/ReichstagRoomsV318";
import { createReichstagSectionV318, reichstagSectionRemovedAtV318 } from "../src/ReichstagSectionV318";
import { parliamentRetainedPlanV295 } from "../src/ParliamentRetainedEnvelopeV295";
import {
  PARLIAMENT_LOCAL_AIR_V295, parliamentLocalPointV295 as L,
  parliamentWorldPointV295 as W,
} from "../src/parliamentInteriorsV295Profile";
import { interleaveStaticGeometry } from "../src/interleaveStaticGeometry";
import { parkStaticGeometrySteps } from "../src/losslessStaticStorage";
import { schwellenraumMaterialFor } from "../src/visual-modes/schwellenraum/materialGrade";
import {
  createMinecraftMaterialState, disposeMinecraftMaterialState,
  setMinecraftMaterialPresentation,
} from "../src/visual-modes/minecraft/materialMode";

function done<T>(steps: Generator<void,T>): T {
  for (;;) { const next=steps.next(); if (next.done) return next.value; }
}
function inside(x: number,z: number,ring: readonly (readonly number[])[]): boolean {
  let result=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const a=ring[i],b=ring[j];
    if((a[1]>z)!==(b[1]>z) && x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]) result=!result;
  }
  return result;
}
function instances(root: Group): number {
  let count=0;root.traverse(o=>{if(o instanceof InstancedMesh)count+=o.count;});return count;
}
function casts(root: Group,local: [number,number,number],distance=30) {
  const origin=new Vector3(...W("reichstag",local));
  const target=new Vector3(...W("reichstag",[local[0]+1,local[1],local[2]]));
  return new Raycaster(origin,target.sub(origin).normalize(),0,distance).intersectObject(root,true);
}

test("room types and all five levels remain explicit, bounded display estimates",()=>{
  expect(REICHSTAG_SECTION_LAYOUT_V319).toHaveLength(28);
  expect(new Set(REICHSTAG_SECTION_LAYOUT_V319.map(r=>r.kind))).toEqual(
    new Set(["service","reading","lounge","briefing","press","office","meeting","reception"]));
  for(const room of REICHSTAG_SECTION_LAYOUT_V319) {
    expect(room.floor).toBe(REICHSTAG_LEVELS_V318[room.level].y);
    expect(room.min[0]).toBeGreaterThanOrEqual(-7.6);
    expect(room.openWestFace).toBeTrue();
    expect(Math.min(Math.abs(room.min[2]),Math.abs(room.max[2]))).toBeGreaterThan(44);
    const rows=reichstagSectionMembersV319().filter(r=>r.room===room.id);
    expect(rows.some(r=>r.role==="rear room partition")).toBeTrue();
    expect(rows.some(r=>r.role==="open door lintel")).toBeTrue();
    expect(rows.some(r=>r.role==="continuous corridor runner")).toBeTrue();
    expect(rows.some(r=>r.role==="rear storage cabinet")).toBeTrue();
  }
});

test("whole footprint contract rejects enclosed courtyard, crossing edge, degenerate and foreign shapes",()=>{
  const local=(u0:number,v0:number,u1:number,v1:number)=>
    [[u0,v0],[u1,v0],[u1,v1],[u0,v1]].map(([u,v])=>{const p=W("reichstag",[u,0,v]);return [p[0],p[2]] as const;});
  expect(reichstagSectionFootprintContainsV319(local(-7,45,12,63))).toBeTrue();
  // All four corners clear this courtyard, but the box encloses its full void.
  expect(reichstagSectionFootprintContainsV319(local(-1,-43,13,-24))).toBeFalse();
  expect(reichstagSectionFootprintContainsV319(local(8,-43,14,-30))).toBeFalse();
  expect(reichstagSectionFootprintContainsV319(local(45,60,55,75))).toBeFalse();
  expect(reichstagSectionFootprintContainsV319([[0,0],[1,0],[2,0]])).toBeFalse();
  expect(reichstagSectionFootprintContainsV319([[NaN,0],[1,0],[1,1]])).toBeFalse();
  expect(reichstagSectionBoxFitsV319([0,20,0],[1,1,1])).toBeFalse();
  expect(reichstagSectionBoxFitsV319([-8,20,50],[1,1,1])).toBeFalse();
});

test.each([false,true])("every actual member volume clears source courts, public air and the removed cut, native=%s",native=>{
  const root=createReichstagSectionFurnishingsV319(native),rows=reichstagSectionMembersV319(native);
  const source=parliamentRetainedPlanV295(),outer=source.ring.map(p=>p.map(v=>v/10));
  const holes=source.holes!.map(h=>h.map(p=>p.map(v=>v/10)));
  expect(root.children).toHaveLength(1);expect(rows).toHaveLength(1060);
  expect(instances(root)).toBe(1060);expect(root.userData.sourceCourtyardCount).toBe(6);
  const mesh=root.children[0] as InstancedMesh,matrix=new Matrix4();
  root.updateMatrixWorld(true);
  for(let i=0;i<mesh.count;i++) {
    mesh.getMatrixAt(i,matrix);
    if(native)expect([1,2,4,6,8,9].every(j=>matrix.elements[j]===0)).toBeTrue();
    const corners:Vector3[]=[];
    for(const x of [-.5,.5])for(const y of [-.5,.5])for(const z of [-.5,.5]) {
      const p=new Vector3(x,y,z).applyMatrix4(matrix);corners.push(p);
      expect(inside(p.x,p.z,outer)).toBeTrue();
      expect(holes.some(h=>inside(p.x,p.z,h))).toBeFalse();
      expect(reichstagSectionRemovedAtV318(p.x,p.y,p.z)).toBeFalse();
    }
    const local=corners.map(p=>L("reichstag",p.x,p.y,p.z));
    const min=[0,1,2].map(j=>Math.min(...local.map(p=>p[j])));
    const max=[0,1,2].map(j=>Math.max(...local.map(p=>p[j])));
    expect(min[0]).toBeGreaterThan(-7.6);
    for(const air of PARLIAMENT_LOCAL_AIR_V295.reichstag)
      expect(min.some((v,j)=>v>=air.max[j] || max[j]<=air.min[j])).toBeTrue();
  }
  for(const h of holes) {
    const x=h.reduce((s,p)=>s+p[0],0)/h.length,z=h.reduce((s,p)=>s+p[1],0)/h.length;
    expect(new Raycaster(new Vector3(x,30,z),new Vector3(0,-1,0),0,30).intersectObject(root,true)).toHaveLength(0);
  }
});

test.each([false,true])("cut-open offices show monitors above seats and real corridor door openings, native=%s",native=>{
  const root=createReichstagSectionFurnishingsV319(native),rows=reichstagSectionMembersV319(native);
  root.updateMatrixWorld(true);
  for(const screen of rows.filter(r=>r.role==="monitor screen")) {
    const hit=casts(root,[-12,screen.position[1],screen.position[2]])[0];
    expect(hit).toBeDefined();expect(rows[hit.instanceId!].role).toBe("monitor screen");
    const seat=rows.find(r=>r.room===screen.room && r.role==="upholstered chair seat" && r.position[2]===screen.position[2])!;
    const back=rows.find(r=>r.room===screen.room && r.role==="upholstered chair back" && r.position[2]===screen.position[2])!;
    const desk=rows.find(r=>r.room===screen.room && r.role==="office desktop" && r.position[2]===screen.position[2])!;
    expect(back.position[0]+back.size[0]/2).toBeLessThan(desk.position[0]-desk.size[0]/2);
    expect(seat.position[1]+seat.size[1]/2).toBeLessThan(desk.position[1]-desk.size[1]/2);
  }
  for(const room of REICHSTAG_SECTION_LAYOUT_V319)
    expect(casts(root,[3.35,room.floor+1.05,room.doorZ],.9)).toHaveLength(0);
  const counts=root.userData.roleCounts;
  expect(counts["monitor screen"]).toBe(8);expect(counts["conference table"]).toBe(10);
  expect(counts["upholstered chair seat"]).toBe(76);expect(counts["bound books"]).toBe(84);
  expect(counts["lounge sofa seat"]).toBe(8);
});

test.each([false,true])("mobile storage and all lighting presentations retain complete member words, native=%s",native=>{
  const root=createReichstagSectionFurnishingsV319(native),mesh=root.children[0] as InstancedMesh;
  const matrices=mesh.instanceMatrix.array.slice(),colors=mesh.instanceColor!.array.slice();
  const attrs=Object.values(mesh.geometry.attributes),toon=createMinecraftMaterialState();
  expect(interleaveStaticGeometry(root).geometries).toBe(0);
  mesh.material=mesh.userData.nightMaterial;
  mesh.material=schwellenraumMaterialFor(mesh,mesh.userData.dayMaterial);
  setMinecraftMaterialPresentation(root,toon,true);
  setMinecraftMaterialPresentation(root,toon,false);disposeMinecraftMaterialState(toon);
  mesh.material=mesh.userData.dayMaterial;
  done(parkStaticGeometrySteps(root));
  expect(mesh.instanceMatrix.array).toEqual(matrices);expect(mesh.instanceColor!.array).toEqual(colors);
  expect(Object.values(mesh.geometry.attributes)).toEqual(attrs);
  expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
  expect(new Set(colors).size).toBeGreaterThan(25);
  expect(root.userData.fullStaticDetailOnTouch).toBeTrue();
});

test("section mount, family change, close and dispose retain existing slab/source buffers",()=>{
  const scene=new Scene(),body=new Mesh(new BoxGeometry(),new MeshBasicMaterial());scene.add(body);
  const source=body.geometry.getAttribute("position").array,roots:Group[]=[];
  let native=false,disposed=0;
  const controller=createReichstagSectionV318({scene,camera:new PerspectiveCamera(),
    canvas:{} as HTMLCanvasElement,renderer:{localClippingEnabled:false},ready:()=>true,
    invalidate:()=>{},native:()=>native,createRooms:n=>{
      const old=createReichstagSectionRoomsV318(n),root=new Group();
      expect(instances(old)).toBe(n?1844:421);
      root.add(old,createReichstagSectionFurnishingsV319(n));roots.push(root);return root;
    },disposeObject:()=>disposed++});
  controller.setOpen(true);expect(roots).toHaveLength(1);expect(roots[0].visible).toBeTrue();
  native=true;controller.sync();expect(roots).toHaveLength(2);
  expect(roots[0].visible).toBeFalse();expect(roots[1].visible).toBeTrue();
  controller.setOpen(false);expect(roots.every(r=>!r.visible)).toBeTrue();
  expect(body.geometry.getAttribute("position").array).toBe(source);
  expect((body.material as MeshBasicMaterial).clippingPlanes).toBeNull();
  controller.setOpen(true);native=false;controller.sync();expect(roots[0].visible).toBeTrue();
  controller.dispose();expect(disposed).toBe(2);expect(roots.every(r=>r.parent===null)).toBeTrue();
});
