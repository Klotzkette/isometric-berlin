import { describe, expect, test } from "bun:test";
import { InstancedMesh, Mesh, Raycaster, Vector3 } from "three";
import { createGrosserSternGatehousesV164, createMinecraftGrosserSternGatehousesV164 } from "../src/GrosserSternGatehousesV164";
import { GROSSER_STERN_GATEHOUSES_V164_PROFILE as houses, GROSSER_STERN_GATEHOUSES_V164_PRISM_IDS, gatehouseV164World, gatehouseV164Local, grosserSternGatehouseSolidAt, grosserSternGatehousePassageAt, grosserSternGatehouseRoofAt, grosserSternGatehouseSourceColumn } from "../src/grosserSternGatehousesV164Profile";
import source from "../src/data/grosserSternGatehousesV164Source.json";

function stats(mobile:boolean,native:boolean){
  const group=native?createMinecraftGrosserSternGatehousesV164(mobile):createGrosserSternGatehousesV164(mobile);
  let bytes=0,meshes=0,instances=0;
  group.traverse(o=>{
    expect(o.matrixAutoUpdate).toBe(false);
    if(!(o instanceof Mesh))return;
    meshes++;
    for(const a of Object.values(o.geometry.attributes))bytes+=a.array.byteLength;
    bytes+=o.geometry.index?.array.byteLength??0;
    expect(o.geometry.getAttribute("uv")).toBeUndefined();
    expect(o.userData.dayMaterial).toBeDefined();expect(o.userData.nightMaterial).toBeDefined();
    if(o instanceof InstancedMesh){
      instances+=o.count;bytes+=o.instanceMatrix.array.byteLength+(o.instanceColor?.array.byteLength??0);
      if(native)for(let i=0;i<o.count;i++)for(const j of [1,2,4,6,8,9])expect(o.instanceMatrix.array[i*16+j]).toBe(0);
    }else expect(native).toBe(false);
  });
  return {group,bytes,meshes,instances};
}

describe("source-bound Grosser Stern four gatehouses",()=>{
  test("retains source evidence while explicitly separating incompatible roof heights",()=>{
    expect(houses).toHaveLength(4);expect(source.parts).toHaveLength(8);expect(GROSSER_STERN_GATEHOUSES_V164_PRISM_IDS.size).toBe(8);
    for(const h of houses){expect(h.widthM).toBeGreaterThan(7.8);expect(h.widthM).toBeLessThan(8.2);expect(h.bodyDepthM).toBeGreaterThan(12.3);expect(h.bodyDepthM).toBeLessThan(12.8);expect(h.presentationStatus).toContain("conflicts");}
    const east=source.parts.find(p=>p.legacyId==='K0002Ovc')!;
    const heights=east.sourceSurfaces.flatMap(s=>s.ringsWorldXZandNHN.flatMap(r=>r.map(p=>p[1])));
    expect(Math.max(...heights)-Math.min(...heights)).toBeGreaterThan(19);
    for(const p of source.legacyPrisms){const a=p.ring[0],b=p.ring[2];expect(grosserSternGatehouseSourceColumn((a[0]+b[0])/20,(a[1]+b[1])/20,p.y0_dm/10,p.y0_dm/10+Math.ceil(p.h_dm/40)*4)).toBe(true);}
    expect(grosserSternGatehouseSourceColumn(0,0,5.2,13.2)).toBe(false);
  });
  test("square piers collide but all four centre entrance lanes remain open",()=>{
    for(const h of houses){const d=h.bodyDepthM/2;
      for(let z=-d+.8;z<d+h.porticoDepthM+.7;z+=.3){const p=gatehouseV164World(h,0,1.7,z);expect(grosserSternGatehouseSolidAt(...p,.25)).toBe(false);expect(grosserSternGatehousePassageAt(...p)).toBe(true);}
      for(const r of [-.87,-.29,.29,.87]){const p=gatehouseV164World(h,r*h.widthM/2,2,d+h.porticoDepthM-.42);expect(grosserSternGatehouseSolidAt(...p)).toBe(true);}
      const p=gatehouseV164World(h,0,1.7,d);expect(grosserSternGatehousePassageAt(...p,"unrelated-building")).toBe(false);
      expect(grosserSternGatehouseRoofAt(h.center[0],h.center[1])!).toBeGreaterThan(12);expect(grosserSternGatehouseRoofAt(h.center[0],h.center[1])!).toBeLessThan(14);
    }
  });
  test("front aperture is geometrically open, with no dark vertical fake doorway",()=>{
    const g=createGrosserSternGatehousesV164();g.updateMatrixWorld(true);
    for(const h of houses){const d=h.bodyDepthM/2,start=gatehouseV164World(h,0,2,d+h.porticoDepthM+1);
      const ray=new Raycaster(new Vector3(...start),new Vector3(-h.front[0],0,-h.front[1]),0,5);
      expect(ray.intersectObject(g,true)).toHaveLength(0);
    }
  });
  test("stone retaining faces cover the soil edges of every exact stair cut",()=>{
    const g=createGrosserSternGatehousesV164();g.updateMatrixWorld(true);
    for(const h of houses){
      const start=gatehouseV164World(h,0,-1,0);
      const back=new Raycaster(new Vector3(...start),new Vector3(-h.front[0],0,-h.front[1]),0,h.bodyDepthM);
      const hit=back.intersectObject(g,true)[0];expect(hit).toBeDefined();
      expect(gatehouseV164Local(h,hit.point.x,hit.point.z)[1]).toBeGreaterThan(-h.bodyDepthM/2+.43);
      for(const side of [-1,1]){
        const ray=new Raycaster(new Vector3(...start),new Vector3(side*h.right[0],0,side*h.right[1]),0,4);
        const wall=ray.intersectObject(g,true)[0];expect(wall).toBeDefined();
        expect(Math.abs(gatehouseV164Local(h,wall.point.x,wall.point.z)[0])).toBeLessThan(2.57);
      }
    }
  });
  test("full touch detail, bounded GPU arrays and a separate orthogonal native reading",()=>{
    const drawn=stats(false,false),touch=stats(true,false),native=stats(false,true),nativeTouch=stats(true,true);
    expect(drawn.instances).toBe(touch.instances);expect(drawn.bytes).toBe(touch.bytes);
    expect(native.instances).toBe(nativeTouch.instances);expect(native.bytes).toBe(nativeTouch.bytes);
    expect(drawn.meshes).toBe(2);expect(native.meshes).toBe(1);expect(drawn.bytes).toBeLessThan(220000);expect(native.bytes).toBeLessThan(2000000);
    expect(drawn.group.userData.counts["square pier"]).toBe(16);expect(drawn.group.userData.counts["source-bounded side window"]).toBe(80);
  });
});
