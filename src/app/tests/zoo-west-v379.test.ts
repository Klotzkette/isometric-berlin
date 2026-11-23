import {expect, test} from "bun:test";
import {Group,Mesh,Raycaster,Vector3} from "three";
import {surroundingBuildingSolidAt, type SurroundingChunkGeometry} from "../src/SurroundingCityGeometry";
import {attachZooWestV379} from "../src/zooWestV379";
import {zooWestHostsV379} from "../src/zooWestIndexV379";
import {zooWestReliefHeightV379} from "../src/zooWestReliefV379";
import {zooWestViewsV379} from "../src/zooWestViewsV379";
import {createZooWestColumnTesterV379,isZooWestSourceV379} from "../src/zooWestOwnersV379";
import owners from "../src/data/zooWestV379Ownership.json";
import {readFileSync} from "node:fs";

function entry():SurroundingChunkGeometry {
  return {root:new Group(),origin:[0,0,0],geometryBytes:0,bufferCount:0,nav:{groundY:0,buildings:[],ground:[],water:[]}};
}

test("startup and both global families yield the old slabs and fictitious mountain meshes", () => {
  for (const [file,call] of [["IsometricCityWorld.ts","createZooGroundsV165(true)"],
    ["ThreeViewer.tsx","zooGrounds.createZooGroundsV165(true)"],["MinecraftVoxelWorld.ts","createMinecraftZooGroundsV165(true)"]]) {
    expect(readFileSync(new URL("../src/"+file,import.meta.url),"utf8")).toContain(call);
  }
  for (const name of ["Gemsenhügel","Nilpferdhaus","Giraffenhaus"]) {
    expect(Object.keys(zooWestViewsV379).some(site=>site.includes(name))).toBe(true);
  }
});

test("only exact previous owners and exclusive voxel columns retire",()=>{
  expect(owners.previousPrisms.every(isZooWestSourceV379)).toBe(true);
  const first=owners.previousPrisms[0];
  expect(isZooWestSourceV379({...first,tone:[first.tone[0]+1,...first.tone.slice(1)]})).toBe(false);
  const edited={...owners.previousPrisms[0],h_dm:owners.previousPrisms[0].h_dm+1};
  expect(isZooWestSourceV379(edited)).toBe(false);
  const pristine=[...owners.previousPrisms,...owners.neighbours];
  const good=createZooWestColumnTesterV379(pristine,4);
  const changed=createZooWestColumnTesterV379([edited,...pristine.slice(1)],4);
  const [x,z,b,t,k]=owners.columns[0];
  expect(good(x,z,b,t,k)).toBe(true);
  expect(good(x,z,b,t+5,k)).toBe(false);
  expect(changed(x,z,b,t,k)).toBe(false);
});

test("both families attach and raycast at the double dome and measured crags",async()=>{
  for (const native of [false,true]) {
    const scene=new Group(), residents:SurroundingChunkGeometry[]=[];
    for (const host of zooWestHostsV379) {
      const e=entry();await attachZooWestV379(e,host.id,native,new AbortController().signal);scene.add(e.root);residents.push(e);
      expect(e.root.userData.zooWestV379).toBe(true);
      expect(e.geometryBytes).toBeGreaterThan(0);
      expect(e.geometryBytes).toBeLessThan(6_000_000);
      const count=e.root.children.length;await attachZooWestV379(e,host.id,native,new AbortController().signal);
      expect(e.root.children.length).toBe(count);
    }
    scene.updateMatrixWorld(true);
    const meshes:Mesh[]=[];scene.traverse(m=>{if(m instanceof Mesh)meshes.push(m);});
    expect(meshes.length).toBeLessThanOrEqual(2*zooWestHostsV379.length);
    for (const [x,z,roof] of [[-2410,1018,true],[-2381,1046,true],[-2426,1158,false],[-2380,1168,false]] as const) {
      const y=zooWestReliefHeightV379(x,z,native,roof);expect(y).not.toBeNull();
      const hits=new Raycaster(new Vector3(x,65,z),new Vector3(0,-1,0)).intersectObjects(meshes);
      expect(hits.some(hit=>Math.abs(hit.point.y-y!)<.8)).toBe(true);
    }
    expect(zooWestReliefHeightV379(-2500,700,native,false)).toBeNull();
    expect(residents.flatMap(e=>e.nav.water)).toHaveLength(7);
    const houses=residents.flatMap(e=>e.nav.buildings);
    expect(houses.length).toBeGreaterThan(42);
    for (const house of houses) {
      const surveyTop=house.height;
      expect(house.roofTriangles?.every(triangle=>triangle.every(([,y])=>y<=surveyTop+.02))).toBe(true);
    }
    const sloped=houses.find(b=>b.sourceId==="DEBE3DXnWX0r0nE6")!;
    const nav={...residents[0].nav,buildings:[sloped]};
    expect(surroundingBuildingSolidAt(nav,-2351.8,16.4,1220.2867)).toBe(true);
    expect(surroundingBuildingSolidAt(nav,-2351.8,16.74,1220.2867)).toBe(false);
    for (const m of meshes) {
      m.geometry.computeBoundingBox();
      expect(m.geometry.boundingBox!.max.y*m.scale.y).toBeLessThan(35);
    }
  }
  const cancelled=entry();await attachZooWestV379(cancelled,zooWestHostsV379[0].id,false,AbortSignal.abort());
  expect(cancelled.root.children).toHaveLength(0);
});
