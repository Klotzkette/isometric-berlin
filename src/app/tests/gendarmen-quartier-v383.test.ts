import { expect, test } from "bun:test";
import { Mesh, Raycaster, Vector3 } from "three";
import { createGendarmenmarktArchitecture, createMinecraftGendarmenmarktArchitecture } from "../src/GendarmenmarktArchitecture";
import fronts from "../src/data/gendarmenFrontAxesV383.json";
import square from "../src/data/gendarmenQuartierV383.json";

test("the same joined plaza respects all three monumental building holes and the southern gardens", () => {
  for (const create of [createGendarmenmarktArchitecture, createMinecraftGendarmenmarktArchitecture]) {
    const root = create();
    root.updateMatrixWorld(true);
    const surface = root.getObjectByName("Gendarmenmarkt – vermessenes Pflasterraster und Domgärten") as Mesh;
    expect(surface.userData.osmKey).toBe("relation/3573535");
    const ray = new Raycaster();
    const at = (x: number,z: number) => {
      ray.set(new Vector3(x, 40, z), new Vector3(0,-1,0));
      return ray.intersectObject(surface, false);
    };
    for (const [x,z] of [[1371,617],[1390,536],[1410,720],[1425.4,617],[1318,505]]) {
      expect(at(x,z)).toHaveLength(0);
    }
    for (const [x,z] of [[1365.76,738.51],[1363.2,702.895],[1394.75,750.62],[1388.82,686.765]]) {
      const hit=at(x,z)[0];
      expect(hit.point.y).toBeCloseTo(5.36,2);
      const color=surface.geometry.getAttribute("color");
      expect(color.getY(hit.face!.a)).toBeGreaterThan(color.getX(hit.face!.a));
    }
    expect(surface.geometry.boundingBox!.max.y * .01).toBeCloseTo(5.67,2);
    expect(surface.geometry.boundingBox!.min.y * .01).toBeCloseTo(5.36,2);
  }
  expect(square.lamps).toHaveLength(4);
  expect(square.benches).toHaveLength(33);
  expect(square.drink).toHaveLength(2);
});

test("the addition contains eleven real west faces of Q205 and photo-registered upper-storey divisions", () => {
  expect(new Set(fronts.map(f => f.owner)).size).toBe(5);
  expect(new Set(fronts.map(f => f.part + "/" + f.index)).size).toBe(40);
  expect(fronts.filter(f=>f.edge)).toHaveLength(11);
  expect(fronts.reduce((total, f)=>total+f.axes.length*f.levels.length,0)).toBe(646);
});
