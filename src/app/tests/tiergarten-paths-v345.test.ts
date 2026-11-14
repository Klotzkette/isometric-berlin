import {expect,test} from "bun:test";
import {BoxGeometry,Color,Group,InstancedMesh,Matrix4,Mesh,MeshBasicMaterial} from "three";
import {gunzipSync} from "node:zlib";
import {restoreTiergartenPathsV345} from "../src/TiergartenPathsV345";
import {tiergartenPathSourceGuardV345} from "../src/tiergartenPathSourceGuardV345";
import {compactStaticGeometry} from "../src/compactStaticGeometry";
import type {VoxelPayload} from "../src/terrainPayload";
import type {SurfacePayload} from "../src/IsometricCityWorld";
import groundData from "../public/mesh/regierungsviertel/ground-context.json";
import surfaceData from "../public/mesh/regierungsviertel/surface-polygons.json";
import ownership from "../src/data/tiergartenPathsV345.json";
const ground=groundData as unknown as VoxelPayload,surfaces=surfaceData as unknown as SurfacePayload;
const source=JSON.parse(gunzipSync(await Bun.file(new URL("../../../geo_data/regierungsviertel/tiergarten-paths-v345-source.json.gz",import.meta.url)).arrayBuffer()).toString());
function hosts(){
 const records=[...source.records,[9000,9000,9004,9004,5,3]] as number[][];
 const slabs=new InstancedMesh(new BoxGeometry(1,1,1),new MeshBasicMaterial(),records.length);
 records.forEach(([x0,z0,x1,z1,top,depth],i)=>{const m=new Matrix4().makeScale(x1-x0,depth,z1-z0);m.setPosition((x0+x1)/2,top-depth/2,(z0+z1)/2);slabs.setMatrixAt(i,m);slabs.setColorAt(i,new Color(.2,.3,.4));});
 slabs.userData.roadGroundCellsV343=6623;
 return slabs;
}
test("actual path source rejects changed course, material and terrain",()=>{
 expect(tiergartenPathSourceGuardV345(ground,surfaces)).toBe(ownership.sourceGuard);
 const changed=structuredClone(surfaces);changed.roads![0].ring[0][0]++;
 expect(tiergartenPathSourceGuardV345(ground,changed)).not.toBe(ownership.sourceGuard);
 const slabs=hosts(),before=Array.from(slabs.instanceMatrix.array);
 expect(restoreTiergartenPathsV345(slabs,ground,changed)).toBeFalse();
 expect(Array.from(slabs.instanceMatrix.array)).toEqual(before);
 expect(slabs.children).toHaveLength(0);
 delete slabs.userData.roadGroundCellsV343;
 expect(restoreTiergartenPathsV345(slabs,ground,surfaces)).toBeFalse();
});
test("retained land preserves paint, prior children, exact foreign matrices and repeat safety",()=>{
 const slabs=hosts(),sentinel=Array.from(slabs.instanceMatrix.array).slice(-16),old=new Group();slabs.add(old);
 const start=performance.now();
 expect(restoreTiergartenPathsV345(slabs,ground,surfaces)).toBeTrue();
 expect(slabs.userData.tiergartenPathsV345.cells).toBe(2898);
 expect(slabs.children).toContain(old);
 expect(Array.from(slabs.instanceMatrix.array).slice(-16)).toEqual(sentinel);
 let bytes=0,meshes=0;
 slabs.children.filter(c=>c!==old).forEach(c=>c.traverse(o=>{if(!(o instanceof Mesh))return;meshes++;compactStaticGeometry(o);bytes+=(o.geometry.index?.array.byteLength??0)+Object.values(o.geometry.attributes).reduce((n,a)=>n+a.array.byteLength,0);const color=o.geometry.getAttribute("color");for(let i=0;i<color.count;i++){expect(color.getX(i)).toBeCloseTo(.2,2);expect(color.getY(i)).toBeCloseTo(.3,2);}}));
 expect(bytes).toBeLessThan(5*1024*1024);expect(meshes).toBeLessThan(55);
 console.log({tiergartenV345:{bytes,meshes,ms:performance.now()-start}});
 const count=slabs.count,children=slabs.children.length;
 expect(restoreTiergartenPathsV345(slabs,ground,surfaces)).toBeFalse();expect(slabs.count).toBe(count);expect(slabs.children).toHaveLength(children);
});
test("correction stays out of Worker and Native imports, after the existing ground owner",async()=>{
 const worker=await Bun.file(new URL("../src/progressiveWorld.worker.ts",import.meta.url)).text(),core=await Bun.file(new URL("../src/IsometricCityWorld.ts",import.meta.url)).text();
 expect(worker).not.toContain("TiergartenPathsV345");expect(core).not.toContain('from "./TiergartenPathsV345"');
 const viewer=await Bun.file(new URL("../src/ThreeViewer.tsx",import.meta.url)).text();
 expect(viewer.indexOf("tiergartenPathsV345.restoreTiergartenPathsV345")).toBeGreaterThan(viewer.indexOf("roadGroundV343.restoreRoadGroundV343(slabs"));
});

test("reused source identity cannot admit an in-place changed path on a new root",()=>{
 const changed=structuredClone(surfaces);
 expect(restoreTiergartenPathsV345(hosts(),ground,changed)).toBeTrue();
 changed.roads![0].ring[0][0]++;
 const second=hosts(),before=Array.from(second.instanceMatrix.array);
 expect(restoreTiergartenPathsV345(second,ground,changed)).toBeFalse();
 expect(Array.from(second.instanceMatrix.array)).toEqual(before);
});
