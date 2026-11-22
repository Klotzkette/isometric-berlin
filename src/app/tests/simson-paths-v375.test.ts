import { expect, test } from "bun:test";
import { Color, LinearSRGBColorSpace, Mesh, Raycaster, Vector3 } from "three";
import raw from "../public/mesh/regierungsviertel/ground-context.json";
import { createDistrictStreets, districtStreetTerrainSampler } from "../src/DistrictStreets";
import { GATE_FORECOURTS_V374 } from "../src/GateForecourtsV374";
import { SIMSON_WOODS_V375 } from "../src/SimsonWoodsV375";
import { SIMSON_PATHS_V375 } from "../src/SimsonPathsV375";
import { admitsSimsonGroundV375 } from "../src/simsonGroundGuardV375";
import type { VoxelPayload } from "../src/terrainPayload";

const ground = raw as unknown as VoxelPayload;
const ray = (x:number,z:number) => new Raycaster(new Vector3(x,20,z), new Vector3(0,-1,0));

test("the first published street group owns the surveyed mosaic and gravel courses and the cadastral branches", () => {
  const root = createDistrictStreets(ground,new Set(),true,true);
  const path = root.getObjectByName(SIMSON_PATHS_V375) as Mesh;
  const oldSquare = root.getObjectByName(GATE_FORECOURTS_V374) as Mesh;
  const dgm = districtStreetTerrainSampler(ground);
  const samples = [
    [269,190,0xbab2a5], [266,193,0xb3aea8], [276,189,0xb3aea8],
    [258,194,0xbab2a5], [338,253,0xbab2a5], [211,139,0xb3aea8],
    [157,138,0xb3aea8], [186,258,0xb0a99e], [336.21,250.92,0xbab2a5],
    [344.21,245.95,0xbab2a5], [348.05,253.70,0xbab2a5],
  ];
  for (const [x,z,hex] of samples) {
    const hit = ray(x,z).intersectObject(root,true)[0];
    expect(hit.object).toBe(path);
    const color = new Color().fromBufferAttribute(path.geometry.getAttribute("color"),hit.face!.a);
    expect(color.getHex(LinearSRGBColorSpace)).toBe(hex);
    expect(Math.abs(hit.point.y-dgm(x,z)-.32)).toBeLessThan(.018);
  }
  // These foreground pixels in the original phone view belong to genuine
  // survey mosaic already supplied by the v374 square. They appear contiguous
  // with the new end of that very same mosaic course.
  for (const [x,z] of [[296,226.65],[315.63,241.90],[303.47,223.16],[313.66,227.3]]) {
    expect(ray(x,z).intersectObject(root,true)[0].object).toBe(oldSquare);
    expect(ray(x,z).intersectObject(path)).toHaveLength(0);
  }
  // Preserve the memorial pool, its paving apron, the enclosed planted
  // ground, the road carriageway, and the lawn between the route branches.
  for (const [x,z] of [[307.7,186.23],[313,187],[302,187],[304.32,204.49],[220,128],[240,245]]) {
    expect(ray(x,z).intersectObject(path)).toHaveLength(0);
  }
  expect(path.geometry.getAttribute("position").count).toBeLessThan(4000);
  expect(path.userData.nightMaterial).toBeDefined();
  const woods = root.getObjectByName(SIMSON_WOODS_V375) as Mesh;
  // In v254/v255 these four real camera pixels alternatingly hit a 4 m slab
  // or one of two overlapping park plates. Two are above cadastral tunnels.
  for (const [x,z] of [[161.17,250.896],[175.599,249.508],[342.109,228.251],[343.932,211.77]]) {
    const hit = ray(x,z).intersectObject(root,true)[0];
    expect(hit.object).toBe(woods);
    expect(Math.abs(hit.point.y - dgm(x,z) - .06)).toBeLessThan(.017);
  }
  for (const [x,z] of [[310.207,185.92],[113.062,261.611],[303.47,223.16],[338,253]]) {
    expect(ray(x,z).intersectObject(woods)).toHaveLength(0);
  }
});

test("the correction is guarded against a different ground survey and keeps historical options", () => {
  expect(admitsSimsonGroundV375(ground)).toBeTrue();
  const h=ground.ground_height;
  const changed={...h,y_dm:Array.from(h.y_dm)};
  changed.y_dm[239*h.cols+254]++;
  const revised={...ground,ground_height:changed};
  expect(admitsSimsonGroundV375(revised)).toBeFalse();
  expect(createDistrictStreets(revised,new Set(),true,true).getObjectByName(SIMSON_PATHS_V375)).toBeUndefined();
  expect(createDistrictStreets(ground,new Set(),true).getObjectByName(SIMSON_PATHS_V375)).toBeUndefined();
});

test("all six arriving production batches retire their captured faces before transfer", async () => {
  const { createSmoothSurfaces } = await import("../src/IsometricCityWorld");
  const { surfaceFamilyPayload, splitParkSurfaceFamily } = await import("../src/progressiveWorld");
  const { createRestoredRoadBatch } = await import("../src/restoredRoadSurfaces");
  const { spreebogenTerrainYAt } = await import("../src/spreebogenBankProfile");
  const { applySimsonCutsV375 } = await import("../src/simsonSurfaceCutsV375");
  const surfaces = await Bun.file(import.meta.dir+"/../public/mesh/regierungsviertel/surface-polygons.json").json();
  const terrain = districtStreetTerrainSampler(ground);
  const options = {invalidenGroundV371:true,parliamentaryDiningV296:true,waterfrontV296:true};
  const check = (root:ReturnType<typeof createSmoothSurfaces>, key:string, name:string) => {
    const old = (root.getObjectByName(name) as Mesh).geometry;
    applySimsonCutsV375(root,key);
    const actual = (root.getObjectByName(name) as Mesh).geometry;
    expect(actual).not.toBe(old);
    expect(actual.userData.simsonCutsV375).toBeTrue();
  };
  const {applyMittePathLawnV375} = await import("../src/MittePathLawnV375");
  const general = await Bun.file(import.meta.dir+"/../src/data/mittePathLawnV375.json").json();
  const parks = splitParkSurfaceFamily(surfaces);
  for (const [n, payload] of parks.slice(0,3).entries()) {
    const root = createSmoothSurfaces(payload,0,5.35,terrain,options);
    applyMittePathLawnV375(root,general);
    check(root,"surface-parks-"+(n+1),"smooth parkland lawns");
    if (n===0) {
      const complement = root.getObjectByName("Retained park lawn beside mapped paths in Mitte v375") as Mesh;
      expect(complement.geometry.userData.simsonCutsV375).toBeTrue();
    }
    const lawn = root.getObjectByName("smooth parkland lawns") as Mesh;
    for (const [x,z] of [[161.17,250.896],[342.109,228.251]]) {
      expect(ray(x,z).intersectObject(lawn,true)).toHaveLength(0);
    }
  }
  for (const kind of ["sand","earth"] as const) {
    const root = createSmoothSurfaces(surfaceFamilyPayload(surfaces,kind),0,5.35,terrain,options);
    check(root,"surface-"+kind,kind==="sand"?"smooth park paths":"smooth earth desire paths");
  }
  const lines = (await Bun.file(import.meta.dir+"/../src/data/restoredRoadSurfaces.ndjson.txt").text()).split("\n");
  const batch = JSON.parse(lines.find(line=>line.startsWith('{"id":"restored-paving-0-0"'))!);
  const paved = createRestoredRoadBatch(batch,(x,z)=>spreebogenTerrainYAt(x,z,terrain(x,z)),true);
  check(paved,batch.id,"smooth paved paths");
}, 30000);
