import { describe, expect, test } from "bun:test";
import { InstancedMesh, Mesh } from "three";
import { createTeufelsbergStationV195, TEUFELSBERG_STATION_V195_PROFILE } from "../src/TeufelsbergStationV195";
import { teufelsbergStationV195SolidAt as solid } from "../src/teufelsbergStationV195Navigation";
import data from "../src/data/teufelsbergStationV195.json";

describe("Teufelsberg former listening station",()=>{
  test("all five caps share full detail on touch with bounded static batches",()=>{
    expect(data.radomes.length).toBe(5);
    for(const native of[false,true]) {
      const root=createTeufelsbergStationV195(native);let bytes=0;
      expect(root.children.length).toBe(native?1:3);
      expect(root.userData.fullStaticDetailOnTouch).toBe(true);
      expect(root.userData.sourceDatumNHN).toBe(30);
      expect(root.userData.blockNative).toBe(native);
      for(const child of root.children) {
        const m=child as Mesh;
        expect(m.matrixAutoUpdate).toBe(false);expect(m.frustumCulled).toBe(true);
        expect(m.geometry.getAttribute("uv")).toBeUndefined();
        expect(m.userData.dayMaterial).not.toBe(m.userData.nightMaterial);
        const bounds=m instanceof InstancedMesh?m.boundingSphere!:m.geometry.boundingSphere!;
        expect(Number.isFinite(bounds.radius)).toBe(true);expect(bounds.radius).toBeGreaterThan(20);
        for(const a of Object.values(m.geometry.attributes))bytes+=a.array.byteLength;
        bytes+=m.geometry.index?.array.byteLength??0;
        if(m instanceof InstancedMesh) {
          bytes+=m.instanceMatrix.array.byteLength+m.instanceColor!.array.byteLength;
          expect(m.count).toBe(native?3029:800);
          if(native)for(let i=0;i<m.count;i++)for(const j of[1,2,4,6,8,9])expect(m.instanceMatrix.array[i*16+j]).toBe(0);
        }
      }
      expect(bytes).toBe(native?230852:899648);expect(bytes).toBeLessThan(TEUFELSBERG_STATION_V195_PROFILE.budgetBytes);
    }
  });
  test("courtyard and exposed central tower space remain open in both modes",()=>{
    for(const native of[false,true]) {
      expect(solid(-8990,86,2160,.15,native)).toBe(false);
      expect(solid(-8933.439,115,2115.111,.15,native)).toBe(false);
      expect(solid(0,85,0,.15,native)).toBe(false);
    }
    expect(solid(-8938.439,115,2115.111)).toBe(true);
    expect(solid(-8938.439,145,2115.111)).toBe(false);
  });
  test("every represented native block is available to solid collision",()=>{
    for(let i=0;i<data.blocks.length;i+=13) {
      const r=data.blocks[i];expect(solid(r[0],r[1],r[2],0,true)).toBe(true);
    }
  });
});
