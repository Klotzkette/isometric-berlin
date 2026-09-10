import { describe, expect, test } from "bun:test";
import { Mesh, Vector3, Matrix4 } from "three";
import { pointInBrandenburgApproach } from "../src/brandenburgApproachScope";
import { BRANDENBURG_APPROACH_SCOPE } from "../src/brandenburgApproachScopeData";
import { createGroundSlabs, type VoxelPayload } from "../src/MinecraftVoxelWorld";
import { createDistrictStreets, districtStreetTerrainSampler } from "../src/DistrictStreets";
import groundJson from "../public/mesh/regierungsviertel/ground-context.json";

describe("continuous Brandenburg Gate avenue and plaza", () => {
  test("keeps the plaza, both carriageways and distant west-avenue approach in scope", () => {
    for (const [x, z] of [[497, 294], [600, 300], [600, 270], [800, 278], [800, 250], [1080, 255]]) {
      expect(pointInBrandenburgApproach(x, z)).toBeTrue();
    }
    for (const [x, z] of [[-100, -100], [700, 500], [1100, 500], [1500, 300]]) {
      expect(pointInBrandenburgApproach(x, z)).toBeFalse();
    }
  });

  test("only removes raster cells whose complete footprint is covered", () => {
    const radius = 4 / Math.SQRT2;
    let removed = 0;
    for (let x = 414; x < 1200; x += 4) {
      for (let z = 194; z < 370; z += 4) {
        if (!pointInBrandenburgApproach(x, z, radius)) continue;
        removed++;
        for (const dx of [-2, 0, 2]) for (const dz of [-2, 0, 2]) {
          expect(pointInBrandenburgApproach(x + dx, z + dz)).toBeTrue();
        }
      }
    }
    expect(removed).toBeGreaterThan(1000);
    for (const polygon of BRANDENBURG_APPROACH_SCOPE) {
      for (const [x, z] of polygon.ring) expect(pointInBrandenburgApproach(x, z, radius)).toBeFalse();
    }
  });

  test("leaves neighbouring ground intact and does not mutate the source raster", () => {
    const ground = groundJson as unknown as VoxelPayload;
    const original = JSON.stringify(ground.ground_rows);
    const raster = createGroundSlabs(ground, "test avenue raster", { grass: [0xabcdef] }, {
      skipAtWorld: (x, z) => pointInBrandenburgApproach(x, z, ground.cell_m / Math.SQRT2),
    });
    const matrix = new Matrix4(), centre = new Vector3();
    let nearby = 0;
    for (let i = 0; i < raster.count; i++) {
      raster.getMatrixAt(i, matrix); centre.setFromMatrixPosition(matrix);
      expect(pointInBrandenburgApproach(centre.x, centre.z, ground.cell_m / Math.SQRT2)).toBeFalse();
      if (Math.abs(centre.x - 900) < 100 && Math.abs(centre.z - 450) < 70) nearby++;
    }
    expect(nearby).toBeGreaterThan(0);
    expect(JSON.stringify(ground.ground_rows)).toBe(original);
    raster.geometry.dispose();
  });

  test("raises sidewalks to the kerb top while keeping gravel and garden bases distinct", () => {
    const ground = groundJson as unknown as VoxelPayload;
    const terrain = districtStreetTerrainSampler(ground);
    const streets = createDistrictStreets(ground);
    for (const [name, lift] of [
      ["Brandenburg approach raised sidewalks", 0.32],
      ["Unter den Linden mapped gravel promenade", 0.3],
      ["Brandenburg approach mapped lawns", 0.035],
    ] as const) {
      const mesh = streets.getObjectByName(name) as Mesh;
      expect(mesh).toBeInstanceOf(Mesh);
      const points = mesh.geometry.getAttribute("position");
      expect(points.count).toBeGreaterThan(10);
      for (let i = 0; i < points.count; i++) {
        expect(points.getY(i) - terrain(points.getX(i), points.getZ(i))).toBeCloseTo(lift, 3);
      }
    }
  });
});
