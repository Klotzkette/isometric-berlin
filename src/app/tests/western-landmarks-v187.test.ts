import { describe, expect, test } from "bun:test";
import { InstancedMesh, Mesh } from "three";
import { createWesternLandmarksV187, createMinecraftWesternLandmarksV187 } from "../src/WesternLandmarksV187";
import { westernStadiumGroundYV187 } from "../src/westernStadiumGroundV187";
import source from "../src/data/westLandmarksV187.json";

describe("western source-bound landmarks v187", () => {
  test("only the selected mode owns geometry; final-count buffers and frozen spatial groups", () => {
    for (const native of [false, true]) {
      const root = native ? createMinecraftWesternLandmarksV187() : createWesternLandmarksV187();
      expect(root.children.length).toBe(source.groups.length);
      let instances = 0, vertices = 0, calls = 0;
      root.traverse(object => {
        expect(object.matrixAutoUpdate).toBe(false);
        if (!(object instanceof Mesh)) return;
        calls++;
        expect(object.geometry.getAttribute("uv")).toBeUndefined();
        expect(object.geometry.boundingSphere?.radius).toBeGreaterThan(0);
        if (object instanceof InstancedMesh) {
          expect(object.instanceMatrix.array.length).toBe(object.count * 16);
          expect(object.instanceColor?.array.length).toBe(object.count * 3);
          instances += object.count;
          if (native) expect(object.userData.blockNative).toBe(true);
        } else {
          expect(native).toBe(false);
          vertices += object.geometry.getAttribute("position").count;
        }
      });
      expect(calls).toBeLessThanOrEqual(26);
      expect(instances).toBe(native ? source.groups.reduce((n,g)=>n+g.native.length,0) : source.groups.reduce((n,g)=>n+g.boxes.length+g.rods.length,0));
      expect(vertices).toBe(native ? 0 : source.groups.reduce((n,g)=>n+g.surfaces.reduce((v,s)=>v+s.triangles.length*3,0),0));
      root.traverse(object => { if (object instanceof Mesh) { object.geometry.dispose(); for (const m of Array.isArray(object.material) ? object.material : [object.material]) m.dispose(); } });
    }
  });
  test("walking can reach the source-height pitch while outside terrain stays unchanged", () => {
    expect(westernStadiumGroundYV187(-8963,262)).toBeCloseTo(-12.667,3);
    expect(westernStadiumGroundYV187(0,0)).toBeUndefined();
    expect(westernStadiumGroundYV187(-9200,400)).toBeUndefined();
    expect(westernStadiumGroundYV187(-8963,200)).toBeLessThan(3.55);
  });
});
