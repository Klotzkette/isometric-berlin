import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createBundesschlangeV390 } from "../src/BundesschlangeV390";
import { createMoabitStreetFrontsV340 } from "../src/MoabitStreetFrontsV340";
import { berlinPlaceViewsV378 } from "../src/berlinPlaceViewsV378";
import profile from "../src/data/bundesschlangeV390.json";
import { type VoxelPayload } from "../src/terrainPayload";

const load = (name: string) => JSON.parse(readFileSync(new URL("../public/mesh/regierungsviertel/" + name, import.meta.url), "utf8"));
const buildings = load("lod2-prisms.json").buildings as {id: string}[];
const blocks = load("minecraft-voxels.json") as VoxelPayload;
const name = "Bundesschlange am Moabiter Werder";

describe(name, () => {
  for (const native of [false, true]) {
    test((native ? "block" : "drawn") + " exterior is installed on the normal Moabit source path in a single bounded mesh", () => {
      const root = createMoabitStreetFrontsV340(buildings, native, native ? blocks : undefined);
      const item = root?.getObjectByName(name);
      expect(item?.type).toBe("Mesh");
      const mesh = createBundesschlangeV390(buildings, native ? blocks : undefined)!;
      expect(mesh.userData.blockNative).toBe(native);
      expect(mesh.userData.dayMaterial).not.toBe(mesh.userData.nightMaterial);
      const positions = mesh.geometry.getAttribute("position");
      expect(Array.from(positions.array).every(Number.isFinite)).toBeTrue();
      mesh.geometry.computeBoundingBox();
      const box = mesh.geometry.boundingBox!;
      expect(box.max.x - box.min.x).toBeGreaterThan(320);
      expect(box.max.z - box.min.z).toBeGreaterThan(108);
      expect(mesh.geometry.index!.count / 3).toBeLessThan(80000);
    });
  }
  test("duplicate or altered building records and an incompatible block grid cannot borrow these facades", () => {
    const first = profile.sites[0].prism;
    expect(createBundesschlangeV390([{ ...first, h_dm: first.h_dm + 1 }])).toBeNull();
    expect(createBundesschlangeV390([first, first])).toBeNull();
    expect(createBundesschlangeV390([first], { ...blocks, cell_m: 8 })).toBeNull();
    expect(createBundesschlangeV390([first], { ...blocks, building_rows: [] })).toBeNull();
    expect(createBundesschlangeV390([])).toBeNull();
  });
  test("all five curved sections expose both the entrance and garden elevations", () => {
    const body = profile.sites.slice(0,5);
    expect(body.map(s => s.floors)).toEqual([8,7,7,6,5]);
    for (const site of body) {
      expect(new Set(site.faces.map(f => f[3]))).toEqual(new Set(["garden", "street"]));
      expect(new Set(site.native.map(row => site.faces[row[6]][3]))).toEqual(new Set(["garden","street"]));
    }
    expect(berlinPlaceViewsV378[name].target).toEqual([-920,15,-20]);
  });
});
