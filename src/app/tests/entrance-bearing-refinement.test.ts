import { describe, expect, test } from "bun:test";
import { Box3, InstancedMesh, Matrix4, Raycaster, Vector3 } from "three";
import { createArchitecturalSignature, type ChancelleryModelSignature } from "../src/ArchitecturalLandmarks";
import { createMinecraftArchitecturalLandmarks } from "../src/MinecraftArchitecturalLandmarks";
import { CHANCELLERY_LAWN_RINGS, chancelleryLawnContains } from "../src/ChancelleryEntranceProfile";
import { HBF_BEARING_SUPPORT_PROFILE, createMinecraftHbfBearingSupports, planHbfBearingSupport } from "../src/HauptbahnhofBearingSupports";
import { worldGroundSampler, type VoxelPayload } from "../src/MinecraftVoxelWorld";
import scene from "../public/mesh/regierungsviertel/scene.json";
import voxels from "../public/mesh/regierungsviertel/minecraft-voxels.json";
import rail from "../public/mesh/regierungsviertel/rail-lines.json";

const ground=worldGroundSampler(voxels as unknown as VoxelPayload);
const signature=scene.architectural_signatures.find(s=>s.kind==="chancellery_model") as ChancelleryModelSignature;

describe("Ehrenhof and station bearing source corrections",()=>{
  test("the real entrance fence stands above DGM and joins both office ends",()=>{
    const root=createArchitecturalSignature(signature)!;root.updateMatrixWorld(true);
    const bars=root.getObjectByName("Chancellery instanced Ehrenhof entrance fence bars") as InstancedMesh;
    for(const name of ["Chancellery Ehrenhof German flagpole","Chancellery Ehrenhof EU flagpole","Chancellery Ehrenhof empty protocol flagpole"]) {
      expect(new Box3().setFromObject(root.getObjectByName(name)!).min.y).toBeCloseTo(5.15,4);
    }
    expect(root.getObjectByName("Chancellery street pavilion flat entrance canopy")).toBeUndefined();
    const box=new Box3().setFromObject(bars);expect(box.min.y).toBeCloseTo(5.15,4);expect(box.max.y).toBeCloseTo(8.15,4);
    const m=new Matrix4(),v=new Vector3();
    for(const i of [0,Math.floor(bars.count/2),bars.count-1]) {
      bars.getMatrixAt(i,m);v.setFromMatrixPosition(m).applyMatrix4(bars.matrixWorld);
      expect(v.y-1.5).toBeGreaterThan(ground(v.x,v.z)!);
    }
    bars.getMatrixAt(0,m);v.setFromMatrixPosition(m);expect(v.x).toBeCloseTo(170.429,3);expect(v.z).toBeCloseTo(-27.621,3);
    bars.getMatrixAt(bars.count-1,m);v.setFromMatrixPosition(m);expect(v.z).toBeCloseTo(27.6945,3);
  });
  test("entrance blades have open gaps and raster-derived lawns cross the fence",()=>{
    const root=createArchitecturalSignature(signature)!;root.updateMatrixWorld(true);
    const bars=root.getObjectByName("Chancellery instanced Ehrenhof entrance fence bars") as InstancedMesh;
    const m=new Matrix4();bars.getMatrixAt(120,m);
    const centre=new Vector3().setFromMatrixPosition(m).applyMatrix4(bars.matrixWorld);
    const forward=new Vector3(1,0,0).transformDirection(root.matrixWorld),lateral=new Vector3(0,0,1).transformDirection(root.matrixWorld);
    expect(new Raycaster(centre.clone().addScaledVector(forward,1),forward.clone().negate(),0,2).intersectObject(bars).length).toBeGreaterThan(0);
    expect(new Raycaster(centre.clone().addScaledVector(lateral,.09).addScaledVector(forward,1),forward.clone().negate(),0,2).intersectObject(bars)).toHaveLength(0);
    const crossings=CHANCELLERY_LAWN_RINGS.filter(r=>r.some(p=>p[0]<170.429)&&r.some(p=>p[0]>170.429));
    expect(crossings.length).toBeGreaterThanOrEqual(3);
    expect(crossings.some(r=>Array.from({length:55},(_,i)=>i-27).some(z=>chancelleryLawnContains(r,170.429,z)))).toBeTrue();
    const mc=createMinecraftArchitecturalLandmarks().children.find(o=>o.userData.landmarkId==="bundeskanzleramt")!;
    expect(mc.userData.cueCounts["Ehrenhof iron entrance fence"]).toBeGreaterThan(60);
    expect(mc.userData.cueCounts["Ehrenhof stepped lawn crossing fence"]).toBeGreaterThan(100);
  });
  test("four steel frames retain source support stations and remain beneath the track deck",()=>{
    for(const [x,z] of HBF_BEARING_SUPPORT_PROFILE.piers) {
      expect(rail.piers.some(p=>Math.hypot(p[0]/10-x,p[1]/10-z)<.001)).toBeTrue();
      const foot=ground(x,z)!;const blocks=planHbfBearingSupport(x,z,foot);
      expect(blocks.filter(b=>b.role==="rust steel column flange")).toHaveLength(4);
      expect(blocks.filter(b=>b.role==="original grey bearing stem")).toHaveLength(1);
      expect(blocks.filter(b=>b.role==="bearing head stiffener")).toHaveLength(14);
      for(const b of blocks) {expect(b.position[1]+b.size[1]/2).toBeLessThanOrEqual(13.575+.001);expect(b.position[1]-b.size[1]/2).toBeGreaterThanOrEqual(foot-.001);}
    }
    const root=createMinecraftHbfBearingSupports(ground),bounds=new Box3().setFromObject(root);
    expect(root.children).toHaveLength(1);expect(bounds.max.y).toBeLessThan(rail.deck_top_y_m);
    expect(bounds.max.x).toBeLessThan(-8);expect(bounds.min.x).toBeGreaterThan(-48);
  });
});
