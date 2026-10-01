import { describe, expect, test } from "bun:test";
import { InstancedMesh, Mesh } from "three";
import { createZooGroundsV165, createMinecraftZooGroundsV165 } from "../src/ZooGroundsV165";
import { ZOO_GROUNDS_V165_PRISM_IDS, zooGroundsV165RoofAt, zooGroundsV165SourceColumn } from "../src/zooGroundsV165Profile";
import source from "../src/data/zooGroundsV165Source.json";
import nav from "../src/data/zooGroundsV165Navigation.json";

describe("Zoo Berlin complete source architecture and current mapped grounds",()=>{
  test("renders every source triangle including the transparent animal-house shells",()=>{
    const root=createZooGroundsV165();
    for(const [name,glass] of [["Zoo complete official animal-house walls and roofs",false],["Zoo glass hippo house and birdhouse aviary shell",true]] as const){
      const mesh=root.getObjectByName(name) as Mesh;
      const expected=new Float32Array(source.surfaces.filter(s=>s.glass===glass).flatMap(s=>s.triangles).flat(2));
      expect(mesh.geometry.attributes.position.array).toEqual(expected);
    }
    const ground=root.getObjectByName("Zoo exact mapped paths ponds and habitat grounds") as Mesh;
    expect(ground.geometry.attributes.position.count).toBe(source.groundSurfaces.reduce((n,s)=>n+s.triangles.length*3,0));
    expect(root.userData.mappedHabitats).toBe(104);
    expect(root.userData.condorAviary).toBe("way/32995989");
    expect(root.userData.schleusenkrugTables).toBe(21);
  });
  test("has fixed instanced texture-free budgets and identical full detail on touch",()=>{
    for(const native of [false,true]){
      const root=native?createMinecraftZooGroundsV165():createZooGroundsV165();
      let calls=0,bytes=0,axisAligned=true;
      root.traverse(o=>{
        expect(o.matrixAutoUpdate).toBe(false);
        if(!(o instanceof Mesh))return;calls++;
        expect(o.userData.dayMaterial.map).toBeNull();expect(o.userData.nightMaterial.map).toBeNull();
        for(const a of Object.values(o.geometry.attributes))bytes+=a.array.byteLength;
        bytes+=o.geometry.index?.array.byteLength??0;
        if(o instanceof InstancedMesh){bytes+=o.instanceMatrix.array.byteLength+(o.instanceColor?.array.byteLength??0);
          if(native)for(let i=0;i<o.count;i++)for(const k of [1,2,4,6,8,9])axisAligned&&=Math.abs(o.instanceMatrix.array[i*16+k])===0;
        }else expect(native).toBe(false);
      });
      expect(root.userData.fullStaticDetailOnTouch).toBe(true);
      expect(calls).toBe(native?3:6);expect(bytes).toBeLessThan(native?7_500_000:3_300_000);
      expect(axisAligned).toBe(true);
    }
  });
  test("native rooftop navigation is the exact merged source shell ceiling",()=>{
    for(const [start,end,z,y] of nav.nativeRoofRuns){expect(zooGroundsV165RoofAt(start+.5,z+.5,true)).toBe(y);expect(zooGroundsV165RoofAt(end-.5,z+.5,true)).toBe(y);}
    expect(ZOO_GROUNDS_V165_PRISM_IDS.size).toBe(18);
    expect(zooGroundsV165RoofAt(0,0,true)).toBeNull();expect(zooGroundsV165RoofAt(0,0)).toBeNull();
    expect(zooGroundsV165SourceColumn(0,0,5.2,13.2)).toBe(false);
  });
  test("condor and marsh-bird source envelopes remain present but never opaque",()=>{
    for(const suffix of ["gD00006I","gD00006J"]){
      expect(ZOO_GROUNDS_V165_PRISM_IDS.has(suffix)).toBe(true);
      const surfaces=source.surfaces.filter(s=>s.partId.endsWith(suffix));
      expect(surfaces.length).toBeGreaterThan(20);expect(surfaces.every(s=>s.glass)).toBe(true);
    }
    const root=createMinecraftZooGroundsV165();
    const glass=root.getObjectByName("Zoo native transparent aviary shell blocks") as InstancedMesh;
    expect(glass.count).toBeGreaterThan(3000);
    expect(glass.userData.dayMaterial.transparent).toBe(true);expect(glass.userData.dayMaterial.depthWrite).toBe(false);
    expect(glass.userData.dayMaterial.opacity).toBeGreaterThan(0);expect(glass.userData.dayMaterial.opacity).toBeLessThan(.3);
    expect(glass.userData.nightMaterial.transparent).toBe(true);
  });
});
