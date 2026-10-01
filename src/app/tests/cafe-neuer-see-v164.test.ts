import { describe, expect, test } from "bun:test";
import { InstancedMesh, Mesh, Raycaster, Vector3 } from "three";
import { createCafeNeuerSeeV164, createMinecraftCafeNeuerSeeV164 } from "../src/CafeNeuerSeeV164";
import { cafeNeuerSeeRoofAt, CAFE_NEUER_SEE_V164_PRISM_IDS } from "../src/cafeNeuerSeeV164Profile";
import source from "../src/data/cafeNeuerSeeV164Source.json";
import nav from "../src/data/cafeNeuerSeeV164Navigation.json";

describe("Café am Neuen See complete architecture and lake props", () => {
  test("renders every stored source triangle and its clipped facade detail", () => {
    const root=createCafeNeuerSeeV164();
    const body=root.getObjectByName("Complete cafe measured walls and shaped roofs") as Mesh;
    expect(Array.from(body.geometry.attributes.position.array)).toEqual(Array.from(new Float32Array(source.surfaces.flatMap(s=>s.triangles).flat(2))));
    const facade=root.getObjectByName("Cafe source-clipped timber and glazing") as InstancedMesh;
    expect(facade.count).toBe(source.facadeBoxes.length);
    expect(root.userData.fullStaticDetailOnTouch).toBe(true);
    expect(root.userData.boatCount).toBe(6);expect(root.userData.sandpitCount).toBe(2);
    expect(root.userData.chairCount).toBe(source.chairTables.length*4);
  });
  test("all six rowing boats have open hulls with low interior floors", () => {
    const root=createCafeNeuerSeeV164();root.updateMatrixWorld(true);
    const hulls=root.getObjectByName("Hollow rowing hulls and light fabric roofs") as Mesh;
    for(const [x,z] of source.boats){
      const ray=new Raycaster(new Vector3(x,source.waterY+2,z),new Vector3(0,-1,0),0,3);
      const hits=ray.intersectObject(hulls,false);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].point.y).toBeLessThan(source.waterY+.1);
      expect(hits[0].point.y).toBeGreaterThan(source.waterY-.1);
    }
  });
  test("keeps native geometry axis-aligned and all transforms frozen within bounded batches", () => {
    for(const native of [false,true]){
      const root=native?createMinecraftCafeNeuerSeeV164():createCafeNeuerSeeV164();
      let calls=0,bytes=0;
      root.traverse(o=>{
        expect(o.matrixAutoUpdate).toBe(false);
        if(!(o instanceof Mesh))return;calls++;
        expect(o.userData.dayMaterial.map).toBeNull();expect(o.userData.nightMaterial.map).toBeNull();
        for(const a of Object.values(o.geometry.attributes))bytes+=a.array.byteLength;
        bytes+=o.geometry.index?.array.byteLength??0;
        if(o instanceof InstancedMesh){bytes+=o.instanceMatrix.array.byteLength+(o.instanceColor?.array.byteLength??0);
          if(native)for(let i=0;i<o.count;i++)for(const offset of [1,2,4,6,8,9])expect(Math.abs(o.instanceMatrix.array[i*16+offset])).toBe(0);
        }else expect(native).toBe(false);
      });
      expect(calls).toBe(native?2:4);expect(bytes).toBeLessThan(native?2500000:1300000);
    }
  });
  test("navigation follows source and native roof geometry and replaces only exact owners", () => {
    expect([...CAFE_NEUER_SEE_V164_PRISM_IDS].sort()).toEqual(["yG0owFin","SgY4xGay","ian6cfqM","fl00001D","K0002Klw","K0002KWV"].sort());
    for(const [x,z,y] of nav.nativeRoofCells)expect(cafeNeuerSeeRoofAt(x,z,true)).toBe(y);
    for(const [a,b,c] of nav.roofTriangles){const x=(a[0]+b[0]+c[0])/3,z=(a[2]+b[2]+c[2])/3,y=(a[1]+b[1]+c[1])/3;const roof=cafeNeuerSeeRoofAt(x,z);if(roof!==null)expect(roof).toBeGreaterThanOrEqual(y-.002);}
    expect(cafeNeuerSeeRoofAt(0,0)).toBeNull();expect(cafeNeuerSeeRoofAt(0,0,true)).toBeNull();
  });
});
