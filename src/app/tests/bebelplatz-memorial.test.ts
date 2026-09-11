import { describe, expect, test } from "bun:test";
import { InstancedMesh, Mesh, Raycaster, Vector3 } from "three";
import { createBebelplatzMemorial } from "../src/BebelplatzMemorial";
import { BEBEL_LIBRARY_MEMORIAL as P, isBebelLibraryGroundCell } from "../src/bebelplatzMemorialProfile";
import { createGroundSlabs, type VoxelPayload } from "../src/MinecraftVoxelWorld";
import payload from "../public/mesh/regierungsviertel/ground-context.json";
const ground = payload as unknown as VoxelPayload;
describe("Bebelplatz's source-bound empty library", () => {
  test("removes only the six source cells over the underground room", () => {
    let count = 0;
    for(let x=1506;x<=1530;x+=4) for(let z=290;z<=310;z+=4) if(isBebelLibraryGroundCell(x,z)) count++;
    expect(count).toBe(6);
    expect(isBebelLibraryGroundCell(1510,298)).toBeFalse();
    expect(isBebelLibraryGroundCell(1518,306)).toBeFalse();
  });
  for(const minecraft of [false,true]) {
    test(`keeps a real open aperture above empty shelves (${minecraft ? "block" : "drawn"})`, () => {
      const root=createBebelplatzMemorial(ground,minecraft); root.updateMatrixWorld(true);
      const [x,z]=P.worldM;
      const ray=new Raycaster(new Vector3(x,12,z),new Vector3(0,-1,0));
      const paving=root.getObjectByName("Bebelplatz paving with open memorial aperture") as Mesh;
      expect(ray.intersectObject(paving).length).toBe(0);
      const glass=root.getObjectByName("Bebelplatz transparent walkable glass pane") as Mesh;
      expect(ray.intersectObject(glass).length).toBeGreaterThan(0);
      expect(root.userData.bookCount).toBe(0);
      const chamber=root.getObjectByName("Bebelplatz illuminated empty shelves and chamber") as InstancedMesh;
      expect(chamber.userData.emptyShelfTiers).toBe(14);
      expect(chamber.boundingBox!.min.y).toBeCloseTo(root.userData.glassGroundY-P.roomHeightM-0.12,4);
      expect(root.children.length).toBe(4);
      expect(chamber.count).toBe(157);
      expect((glass.material as { opacity: number }).opacity).toBeLessThan(0.1);
      ray.set(new Vector3(x-1,8,z-1),new Vector3(1,-2.788,1).normalize());
      expect(ray.intersectObject(chamber).length).toBeGreaterThan(0);
    });
  }
  test("source raster cannot hide the pane or mutate the canonical ground", () => {
    const original=JSON.stringify(ground.ground_rows);
    const slabs=createGroundSlabs(ground,"memorial raster test",{grass:[0xabcdef]}, {skipAtWorld:isBebelLibraryGroundCell});
    slabs.updateMatrixWorld(true); const [x,z]=P.worldM;
    expect(new Raycaster(new Vector3(x,20,z),new Vector3(0,-1,0)).intersectObject(slabs).length).toBe(0);
    expect(JSON.stringify(ground.ground_rows)).toBe(original);
    expect(slabs.userData.skippedByWorldPredicateCells).toBe(6);
    slabs.geometry.dispose();
  });
});
