import {expect,test} from "bun:test";
import {BoxGeometry,InstancedMesh,Mesh,MeshBasicMaterial} from "three";
import {createRailSseArchitectureV307,hasCompleteRailSseArchitectureV307} from "../src/RailSseArchitectureV307";
import {isSceneGeometryGpuRetirementV309} from "../src/sceneGeometryGpuResidency";
import {createSceneGpuResidency,isSceneInstanceGpuRetirementV309} from "../src/sceneGpuResidency";
import {disposeSurroundingCityRoot} from "../src/SurroundingCity";
import {geometryGpuHostV309} from "./helpers/geometryGpuHostV309";
const digest=(array:ArrayBufferView)=>new Bun.CryptoHasher("sha256").update(new Uint8Array(array.buffer,array.byteOffset,array.byteLength)).digest("hex");

test("actual offscreen geometry eviction preserves complete source provenance and identical reupload",()=>{
  const h=geometryGpuHostV309({budgetBuffers:0,budgetBytes:0,graceMs:0}),root=createRailSseArchitectureV307(false);
  h.scene.add(root);h.scene.updateMatrixWorld(true);
  const mesh=root.children.reduce((best,c)=>((c as Mesh).geometry.getAttribute("position").count>best.geometry.getAttribute("position").count?c as Mesh:best),root.children[0]as Mesh),geometry=mesh.geometry;
  const before=Object.entries(geometry.attributes).map(([name,a])=>[name,digest(a.array)]),indices=digest(geometry.index!.array),events:boolean[]=[];
  geometry.addEventListener("dispose",()=>events.push(isSceneGeometryGpuRetirementV309(geometry)));
  try{
    expect(isSceneGeometryGpuRetirementV309(geometry)).toBeFalse();h.residency.enqueue(root);h.draw(mesh);const allocated=h.live.size;expect(allocated).toBeGreaterThan(0);
    expect(h.residency.refresh(1,true)).toBe(1);expect(h.live.size).toBe(0);expect(events).toEqual([true]);expect(isSceneGeometryGpuRetirementV309(geometry)).toBeFalse();
    expect(hasCompleteRailSseArchitectureV307(root,false)).toBeTrue();
    h.draw(mesh);expect(h.live.size).toBe(allocated);expect(Object.entries(geometry.attributes).map(([name,a])=>[name,digest(a.array)])).toEqual(before);expect(digest(geometry.index!.array)).toBe(indices);
    geometry.dispose();expect(events).toEqual([true,false]);expect(hasCompleteRailSseArchitectureV307(root,false)).toBeFalse();
  }finally{h.residency.release(root);h.residency.dispose();disposeSurroundingCityRoot(root);}
});

test("instance retirement scope belongs only to a registered observed eligible resource",()=>{
  const h=geometryGpuHostV309(),mesh=new InstancedMesh(new BoxGeometry(),new MeshBasicMaterial(),2),foreign=new InstancedMesh(new BoxGeometry(),new MeshBasicMaterial(),1);
  mesh.position.x=100;h.scene.add(mesh);h.scene.updateMatrixWorld(true);
  const manager=createSceneGpuResidency(h.renderer,h.camera,{budgetBytes:0,budgetBuffers:0,graceMs:0,now:()=>0}),observed:boolean[]=[],foreignEvents:boolean[]=[];
  mesh.addEventListener("dispose",()=>{observed.push(isSceneInstanceGpuRetirementV309(mesh));foreign.dispose();});foreign.addEventListener("dispose",()=>foreignEvents.push(isSceneInstanceGpuRetirementV309(foreign)));
  try{
    mesh.userData.retainedGpuRetirementV309=true;mesh.dispose();expect(observed).toEqual([false]);expect(foreignEvents).toEqual([false]);
    manager.enqueue(mesh);h.draw(mesh);expect(manager.refresh(1,true)).toBe(1);expect(observed).toEqual([false,true]);expect(foreignEvents).toEqual([false,false]);
    expect(isSceneInstanceGpuRetirementV309(mesh)).toBeFalse();mesh.dispose();expect(observed).toEqual([false,true,false]);
  }finally{manager.release(mesh);manager.dispose();mesh.geometry.dispose();(mesh.material as MeshBasicMaterial).dispose();foreign.geometry.dispose();(foreign.material as MeshBasicMaterial).dispose();}
});
