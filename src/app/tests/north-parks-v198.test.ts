import {describe,expect,test} from "bun:test";
import {InstancedMesh,Mesh,Raycaster,Vector3} from "three";
import {createNorthParksV198} from "../src/NorthParksV198";
import {northParksV198GroundAt,northParksV198WaterAt,northParksV198SolidAt,northParksV198TerrainAt} from "../src/northParksV198Navigation";
import buildings from "../src/data/northParksV198Buildings.json";

const waters=[[2740.4381973357076,-6602.53742606286],[2634.842624392024,-6364.279848338105],[4241.529347163456,-7473.442803863902]];
describe("northern parks independent representation and exact new-footprint navigation",()=>{
  for(const native of [false,true])test(`${native?"native":"drawn"} cells are finite, frozen, owned and actually match the river sampler`,()=>{
    const root=createNorthParksV198(native);root.updateMatrixWorld(true);
    expect(root.children.length).toBe(28);expect(root.userData.fullStaticDetailOnTouch).toBe(true);
    let bytes=0;
    for(const child of root.children){
      const mesh=child as Mesh;expect(mesh.matrixAutoUpdate).toBe(false);expect(mesh.geometry.getAttribute("uv")).toBeUndefined();expect(mesh.userData.dayMaterial).not.toBe(mesh.userData.nightMaterial);
      for(const a of Object.values(mesh.geometry.attributes))bytes+=a.array.byteLength;
      bytes+=mesh.geometry.index?.array.byteLength??0;
      if(mesh instanceof InstancedMesh){bytes+=mesh.instanceMatrix.array.byteLength+mesh.instanceColor!.array.byteLength;expect(mesh.boundingSphere!.radius).toBeGreaterThan(0);
        if(native)for(let i=0;i<mesh.count;i++)for(const j of [1,2,4,6,8,9])expect(mesh.instanceMatrix.array[i*16+j]).toBe(0);
      }else expect(mesh.geometry.boundingSphere!.radius).toBeGreaterThan(0);
    }
    expect(bytes).toBeLessThan(8*1024*1024);
    for(const [x,z]of waters){
      const y=northParksV198WaterAt(x,z,native);expect(y).not.toBeNull();expect(y!).toBeLessThan(northParksV198TerrainAt(x,z,native));
      const ray=new Raycaster(new Vector3(x,100,z),new Vector3(0,-1,0));const hits=ray.intersectObjects(root.children,false);
      expect(hits.some(hit=>Math.abs(hit.point.y-y!)<.003)).toBe(true);
    }
  });
  test("old scope and distant points never acquire a new ground or water fallback",()=>{
    for(const [x,z]of [[0,0],[2000,-2000],[6000,-6000],[-10000,20000]]){
      expect(northParksV198GroundAt(x,z)).toBeNull();expect(northParksV198WaterAt(x,z)).toBeNull();
    }
    expect(northParksV198GroundAt(2465,-6530)).not.toBeNull();
  });
  test("source house, palace and obelisk solids are bounded; the entrance between gatehouses stays open",()=>{
    for(const native of [false,true]){
      expect(northParksV198SolidAt(2730,20,-6984,0,native)).toBe(true);
      expect(northParksV198SolidAt(2730,100,-6984,0,native)).toBe(false);
      expect(northParksV198SolidAt(359,17,-6837,.2,native)).toBe(false);
      const o=buildings.obelisk,base=native?o.nativeBase:o.base;
      expect(northParksV198SolidAt(o.point[0],base+33.4,o.point[1],0,native)).toBe(true);
      expect(northParksV198SolidAt(o.point[0],base+34,o.point[1],0,native)).toBe(false);
      expect(northParksV198SolidAt(o.point[0]+8,base+20,o.point[1],0,native)).toBe(false);
    }
  });
});
