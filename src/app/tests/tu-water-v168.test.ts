import { expect, test } from "bun:test";
import { InstancedMesh, Mesh } from "three";
import { createTuWaterV168, createMinecraftTuWaterV168 } from "../src/TuWaterV168";
import { TU_WATER_V168_PARENT_IDS, TU_WATER_V168_PRISM_IDS, TU_WATER_V168_PARTS, tuWaterV168RoofAt, tuWaterV168SourceColumn, tuWaterV168StructureSolidAt } from "../src/tuWaterV168Profile";
import nav from "../src/data/tuWaterV168Navigation.json";
import source from "../src/data/tuWaterV168Source.json";
import { compilePedestrianObstacles, pedestrianPointIsBlocked, pointInPedestrianRing } from "../src/pedestrianNavigation";
import { staticGeometryAudit, disposeStaticAudit } from "./helpers/staticGeometryAudit";

test("complete 24-part TU/VWS identity, exact coarse owners and measured roof navigation", () => {
  expect(TU_WATER_V168_PARENT_IDS.size).toBe(5);
  expect(source.sourceParts).toHaveLength(24);
  expect([...TU_WATER_V168_PRISM_IDS].sort()).toEqual(["-3348239", "14269403", "6Va8XF4g", "GZbL6snz", "K0002Skp", "K0002VBQ", "O5AGB7fA", "U6frqVw8", "Yez44z7p", "Yu5NppI5"].sort());
  expect(TU_WATER_V168_PARTS).toHaveLength(23);
  expect(tuWaterV168SourceColumn(-3100, 670, 5.2, 17.2)).toBe(true);
  expect(tuWaterV168SourceColumn(-3100, 670, 5.2, 21.2)).toBe(false);
  expect(tuWaterV168SourceColumn(0, 0, 5.2, 17.2)).toBe(false);
  expect(tuWaterV168RoofAt(-3050, 676)!).toBeGreaterThan(40);
  expect(tuWaterV168RoofAt(-2800, 500)).toBeNull();
  for (let i = 0; i < nav.roofTriangles.length; i += 31) {
    const [a,b,c] = nav.roofTriangles[i];
    const area = (b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);
    if (Math.abs(area) > .001) expect(tuWaterV168RoofAt((a[0]+b[0]+c[0])/3, (a[2]+b[2]+c[2])/3)!).toBeGreaterThanOrEqual((a[1]+b[1]+c[1])/3-.01);
  }
  for (const [x,z,y] of nav.nativeRoofCells) expect(tuWaterV168RoofAt(x+.5,z+.5,true)).toBe(y);
});

test("all four drawn styles retain complete geometry at desktop and touch", () => {
  const a=createTuWaterV168(), b=createTuWaterV168({mobileLike:true});
  expect(a.children).toHaveLength(2);
  expect(a.userData.sourcePartIds).toHaveLength(24);
  expect(a.userData.openPipeLoop).toBe(true);
  expect(a.userData.industrialSurveyCorrectionDocumented).toBe(true);
  for(let i=0;i<a.children.length;i++) {
    const x=a.children[i] as Mesh,y=b.children[i] as Mesh;
    expect(x.matrixAutoUpdate).toBe(false);
    expect(x.userData.dayMaterial).toBeTruthy();expect(x.userData.nightMaterial).toBeTruthy();
    expect(x.geometry.attributes.uv).toBeUndefined();
    expect(x.geometry.attributes.position.array).toEqual(y.geometry.attributes.position.array);
    if(x instanceof InstancedMesh && y instanceof InstancedMesh)expect(x.instanceMatrix.array).toEqual(y.instanceMatrix.array);
  }
  const aa=staticGeometryAudit(a),bb=staticGeometryAudit(b);
  expect(aa.hash).toBe(bb.hash);expect(aa.budget.draws).toBe(2);expect(aa.budget.bytes).toBeLessThan(4300000);
  console.log({tuWaterDrawn:aa.budget});disposeStaticAudit(a);disposeStaticAudit(b);
});

test("native TU and pink loop remain compact independent orthogonal surface blocks", () => {
  const a=createMinecraftTuWaterV168(),b=createMinecraftTuWaterV168({mobileLike:true});
  expect(a.children).toHaveLength(2);let count=0;
  a.children.forEach((child,i)=>{
    expect(child instanceof InstancedMesh).toBe(true);
    const x=child as InstancedMesh,y=b.children[i]as InstancedMesh;
    expect(x.instanceMatrix.array).toEqual(y.instanceMatrix.array);count+=x.count;
    expect(x.matrixAutoUpdate).toBe(false);
    for(let n=0;n<x.count;n++)for(const j of [1,2,4,6,8,9])expect(Math.abs(x.instanceMatrix.array[n*16+j])).toBe(0);
  });
  expect(count).toBeGreaterThan(55000);expect(count).toBeLessThan(69000);
  const aa=staticGeometryAudit(a),bb=staticGeometryAudit(b);
  expect(aa.hash).toBe(bb.hash);expect(aa.budget.draws).toBe(2);expect(aa.budget.bytes).toBeLessThan(5300000);
  console.log({tuWaterNative:aa.budget});disposeStaticAudit(a);disposeStaticAudit(b);
});


test("actual pedestrian capsules pass the UT2 air gap in both branches", () => {
  const norm=Math.hypot(.9493,.3144),dx=.9493/norm,dz=.3144/norm;
  const at=(u:number,v:number)=>[-2606.55+dx*u-dz*v,641.02+dz*u+dx*v];
  for(const mode of ["day","minecraft"] as const) {
    const index=compilePedestrianObstacles({buildings:nav.legacyPrisms},()=>mode);
    for(const u of [10.5,12,14.5])for(const v of [-2,0,2]) {
      const [x,z]=at(u,v);
      expect(tuWaterV168StructureSolidAt(x,z,16.1,mode==="minecraft")).toBe(false);
      expect(pedestrianPointIsBlocked(x,z,15.2,index)).toBe(false);
    }
    const [x,z]=at(12,0);
    expect(pedestrianPointIsBlocked(x,z,13.6,index)).toBe(true);
    expect(pedestrianPointIsBlocked(x,z,18,index)).toBe(true);
    const [hx,hz]=at(25,0);
    expect(pedestrianPointIsBlocked(hx,hz,39,index)).toBe(true);
  }
});

test("all 1268 actual owned legacy columns including thirty roof tiers are suppressed", async () => {
  const payload=await Bun.file(new URL("../public/mesh/regierungsviertel/minecraft-voxels.json",import.meta.url)).json();
  let owned=0,tiers=0;
  for(let zi=0;zi<payload.building_rows.length;zi++) {
    const z=(payload.grid.min_z_idx+zi+.5)*payload.cell_m;
    if(z<620||z>745)continue;
    for(const [offset,run,lo,hi] of payload.building_rows[zi])for(let i=0;i<run;i++) {
      const x=(payload.grid.min_x_idx+offset+i+.5)*payload.cell_m;
      if(x < -3140||x > -2460)continue;
      const owner=nav.legacyPrisms.find(p=>pointInPedestrianRing(x*10,z*10,p.ring)&&!p.holes.some(h=>pointInPedestrianRing(x*10,z*10,h)));
      if(!owner)continue;
      const base=owner.y0_dm/10,top=base+Math.ceil(owner.h_dm/40)*4;
      const body=Math.abs(lo/10-base)<.11&&Math.abs(hi/10-top)<.11;
      const tier=[3100,3200,3300,3400].includes(owner.roof)&&Math.abs(lo/10-top)<.11&&Math.abs(hi/10-top-4)<.11;
      if(!body&&!tier)continue;
      owned++;if(tier)tiers++;
      expect(tuWaterV168SourceColumn(x,z,lo/10,hi/10)).toBe(true);
      expect(tuWaterV168SourceColumn(x,z,-4,base)).toBe(false);
    }
  }
  expect(owned).toBe(1268);expect(tiers).toBe(30);
  expect(tuWaterV168SourceColumn(-2598,682,17.2,21.2)).toBe(true);
  expect(tuWaterV168SourceColumn(-2598,682,21.2,25.2)).toBe(false);
});
