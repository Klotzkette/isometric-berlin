import { expect, test } from "bun:test";
import { BoxGeometry, BufferAttribute, BufferGeometry, InstancedBufferAttribute, InterleavedBuffer, InterleavedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { clipFidelityGroundSurfaceV296, restoreFidelityGroundSlabsV296 } from "../src/FidelityGroundOpeningsV296";
import { installFidelityNavigationV296, type FidelityAdmissionV296 } from "../src/FidelityNavigationV296";
import type { PedestrianEnvironment } from "../src/pedestrianNavigation";
import { createParliamentaryDiningV296 } from "../src/ParliamentaryDiningV296";
import { prepareRequiredFidelityV288 } from "../src/RequiredFidelityV288";
import prisms from "../public/mesh/regierungsviertel/lod2-prisms.json";
import voxels from "../public/mesh/regierungsviertel/minecraft-voxels.json";
import { groundTopSampler, type VoxelPayload } from "../src/terrainPayload";
const ray=(o:Mesh,x:number,z:number,y=8)=>new Raycaster(new Vector3(x,y,z),new Vector3(0,-1,0)).intersectObject(o,true);
test("complete source-bound admissions remain attached and source changes keep dining closed",()=>{
 for(const native of[false,true]){const built=prepareRequiredFidelityV288(prisms,voxels,native);expect(built.parliamentaryDining).toBe(true);expect(built.southFidelity).toBe(true);expect(built.root.children.some(c=>c.userData.southFidelityV294===true)).toBe(true);expect(built.root.children.some(c=>c.userData.parliamentaryDiningV296===true)).toBe(true);expect(built.root.children.length).toBeGreaterThanOrEqual(8);}
 const changed={buildings:prisms.buildings.map(p=>p.id==='TAXdTj4D'?{...p,h_dm:p.h_dm+1}:p)};expect(prepareRequiredFidelityV288(changed,voxels).parliamentaryDining).toBe(false);
});
test("actual-height original ground run retains every outside box and exposes the lower Marie floor",()=>{
 const source=voxels as unknown as VoxelPayload,sample=groundTopSampler(source),x=394,z=-162,top=sample(Math.floor(x/source.cell_m)-source.grid.min_x_idx,Math.floor(z/source.cell_m)-source.grid.min_z_idx);expect(top).toBeCloseTo(4.1,6);
 const ground=new InstancedMesh(new BoxGeometry(1,1,1),new MeshBasicMaterial(),0),m=new Matrix4(),a=new Float32Array(32);m.makeScale(16,1,4);m.setPosition(394,top-.5,z);m.toArray(a,0);m.makeScale(16,1,4);m.setPosition(494,top-.5,z);m.toArray(a,16);ground.instanceMatrix=new InstancedBufferAttribute(a,16);ground.instanceColor=new InstancedBufferAttribute(new Float32Array([.4,.5,.6,.7,.8,.9]),3);ground.count=2;ground.updateMatrixWorld(true);
 expect(ray(ground,394,z)[0].point.y).toBeCloseTo(top,6);const before=ground.instanceMatrix.array;restoreFidelityGroundSlabsV296(ground);expect(ground.instanceMatrix.array).toBe(before);restoreFidelityGroundSlabsV296(ground,{dining:true});ground.updateMatrixWorld(true);
 expect(ground.count).toBe(1);expect(Array.from(ground.instanceMatrix.array)).toEqual(Array.from(a.slice(16)));expect(Array.from(ground.instanceColor!.array)).toEqual(Array.from(new Float32Array([.7,.8,.9])));expect(ray(ground,394,z)).toHaveLength(0);expect(ray(ground,494,z)[0].point.y).toBeCloseTo(top,6);
 ground.add(createParliamentaryDiningV296());ground.updateMatrixWorld(true);const hit=ray(ground,394,z,3)[0];expect(hit.object.name.startsWith('Parliamentary dining')).toBe(true);expect(hit.point.y).toBeCloseTo(.65,5);
});
test("draped ground clips only bounded triangles while retaining original indexed attributes",()=>{
 const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array([370,4,-180,410,4,-180,410,4,-150,470,4,-180,510,4,-180,510,4,-150]),3));g.setIndex([0,1,2,3,4,5]);const before=g.attributes.position.array.slice(),indices=g.index!.array.slice();expect(clipFidelityGroundSurfaceV296(g)).toBe(g);
 const opened=clipFidelityGroundSurfaceV296(g,{dining:true});expect(opened).not.toBe(g);expect(opened.attributes.position.count).toBeLessThan(40);expect(Array.from(opened.attributes.position.array.slice(0,before.length))).toEqual(Array.from(before));expect(Array.from(g.index!.array)).toEqual(Array.from(indices));const kept=Array.from(opened.index!.array);expect(kept.some((v,i)=>v===3&&kept[i+1]===4&&kept[i+2]===5)).toBe(true);
});
test("live navigation follows completed family admissions and only the matching dining source",()=>{
 let flags:FidelityAdmissionV296={};const env={groundAt:()=>4.1,interiorGroundAt:()=>2,interiorSolidAt:()=>false,walkableInteriorAt:()=>false} as unknown as PedestrianEnvironment;installFidelityNavigationV296(env,()=>flags);expect(env.interiorGroundAt!(390,-160,.65)).toBe(2);expect(env.walkableInteriorAt!(390,2,-160,'RdNEzXe9')).toBe(false);
 flags={dining:true};expect(env.interiorGroundAt!(390,-160,.65)).toBe(.65);expect(env.interiorGroundAt!(390,-171,.65)).toBe(.65);expect(env.interiorGroundAt!(390,-171,4.15)).toBe(4.15);expect(env.walkableInteriorAt!(390,2,-160,'RdNEzXe9')).toBe(true);expect(env.walkableInteriorAt!(390,2,-160,'foreign-neighbour')).toBe(false);expect(env.walkableInteriorAt!(390,2,-160)).toBe(false);expect(env.interiorGroundAt!(0,0,5)).toBe(2);expect(env.interiorSolidAt!(330.3,4.8,-100.7,.28)).toBe(true);
 flags={};expect(env.interiorGroundAt!(390,-160,.65)).toBe(2);expect(env.interiorSolidAt!(330.3,4.8,-100.7,.28)).toBe(false);
});

test("clipped ground preserves normalized integer paint, interleaved source fields and draw groups",()=>{
 const g=new BufferGeometry(),positions=new Float32Array([370,4,-180,410,4,-180,410,4,-150,470,4,-180,510,4,-180,510,4,-150]);
 g.setAttribute('position',new BufferAttribute(positions,3));g.setAttribute('color',new BufferAttribute(new Uint8Array(18).fill(128),3,true));g.setIndex(new BufferAttribute(new Uint32Array([0,1,2,3,4,5]),1));g.addGroup(0,3,2);g.addGroup(3,3,7);g.setDrawRange(3,3);
 const out=clipFidelityGroundSurfaceV296(g,{dining:true});expect(out.getAttribute('color').getX(3)).toBeCloseTo(128/255,7);expect(out.getAttribute('color').array).toBeInstanceOf(Uint8Array);expect(out.index!.array).toBeInstanceOf(Uint32Array);const group=out.groups.find(p=>p.materialIndex===7)!;expect(group.count).toBe(3);expect(Array.from(out.index!.array.slice(group.start,group.start+3))).toEqual([3,4,5]);expect(out.drawRange).toEqual({start:group.start,count:3});
 const stream=new Float32Array(36);for(let i=0;i<6;i++){stream.set(positions.slice(i*3,i*3+3),i*6);stream.set([.2,.3,.4],i*6+3);}
 const interleaved=new InterleavedBuffer(stream,6),mixed=new BufferGeometry();mixed.setAttribute('position',new InterleavedBufferAttribute(interleaved,3,0));mixed.setAttribute('color',new InterleavedBufferAttribute(interleaved,3,3));mixed.setIndex([0,1,2,3,4,5]);
 const result=clipFidelityGroundSurfaceV296(mixed,{dining:true});for(let i=3;i<6;i++)for(let c=0;c<3;c++){expect(result.getAttribute('position').getComponent(i,c)).toBe(positions[i*3+c]);expect(result.getAttribute('color').getComponent(i,c)).toBe(mixed.getAttribute('color').getComponent(i,c));}
});
