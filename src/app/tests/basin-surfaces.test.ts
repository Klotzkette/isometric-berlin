import { describe, expect, test } from "bun:test";
import { Box3, LineSegments, Mesh } from "three";

import {
  createSmoothSurfaces,
  setIsoNightPresentation,
  type SurfacePayload,
} from "../src/IsometricCityWorld";
import surfacePayload from "../public/mesh/regierungsviertel/surface-polygons.json";

const surfaces = surfacePayload as unknown as SurfacePayload;
/** Surveyed ground in the Invalidenpark, well above the Spree table. */
const TERRAIN_M = 5.3;
const terrainAt = () => TERRAIN_M;

describe("constructed basins", () => {
  test("water is split into rivers and basins", () => {
    const kinds = new Set(surfaces.water.map((entry) => entry.kind));
    expect(kinds).toEqual(new Set(["basin", "river"]));
    const basins = surfaces.water.filter((entry) => entry.kind === "basin");
    expect(basins.length).toBeGreaterThan(0);
    expect(basins.length).toBeLessThan(surfaces.water.length / 2);
  });

  test("a basin plate sits above the lawn that surrounds it", () => {
    // The bug this fixes: every basin was drawn at the single Spree table
    // (−1.15 m) while its own terrain is 5.3 m, so the Invalidenpark
    // fountain lay 6.5 m under the opaque lawn plate and read as grass.
    const group = createSmoothSurfaces(surfaces, -1.15, 4.2, terrainAt);
    const water = group.getObjectByName("basin water");
    expect(water).toBeInstanceOf(Mesh);
    const lawns = group.getObjectByName("smooth parkland lawns") as Mesh;
    const lawnTop = new Box3().setFromObject(lawns).max.y;
    const basinBox = new Box3().setFromObject(water as Mesh);
    expect(basinBox.min.y).toBeGreaterThan(lawnTop);
    // A water surface is flat: one level per basin, not a draped plate.
    expect(basinBox.max.y - basinBox.min.y).toBeLessThan(0.01);
  });

  test("the river keeps the Spree table while the basin does not", () => {
    const group = createSmoothSurfaces(surfaces, -1.15, 4.2, terrainAt);
    const river = group.getObjectByName("smooth water surface") as Mesh;
    expect(new Box3().setFromObject(river).max.y).toBeCloseTo(-1.15, 5);
  });
});

describe("the sunken wall", () => {
  test("the slab ramps from the rim down under the water", () => {
    const group = createSmoothSurfaces(surfaces, -1.15, 4.2, terrainAt);
    const slab = group.getObjectByName("sunken walls");
    expect(slab).toBeInstanceOf(Mesh);
    const water = new Box3().setFromObject(
      group.getObjectByName("basin water") as Mesh,
    ).max.y;
    const box = new Box3().setFromObject(slab as Mesh);
    // It stands proud of the basin at the crest and disappears below the
    // surface at the sinking tip — that descent IS the artwork.
    expect(box.max.y).toBeGreaterThan(water + 0.5);
    expect(box.min.y).toBeLessThan(water);
  });

  test("a walkable crown runs along the slab", () => {
    const group = createSmoothSurfaces(surfaces, -1.15, 4.2, terrainAt);
    const crown = group.getObjectByName("sunken wall crown path");
    expect(crown).toBeInstanceOf(Mesh);
    const slabBox = new Box3().setFromObject(
      group.getObjectByName("sunken walls") as Mesh,
    );
    const crownBox = new Box3().setFromObject(crown as Mesh);
    // The path stops where the wall dips under, so it is shorter than the
    // slab, and it lies on top of it rather than beside it.
    expect(crownBox.max.y).toBeLessThanOrEqual(slabBox.max.y + 0.1);
    expect(slabBox.containsBox(crownBox.clone().expandByScalar(-0.2))).toBe(
      true,
    );
  });

  test("basin and wall are inked and carry a night tone", () => {
    const group = createSmoothSurfaces(surfaces, -1.15, 4.2, terrainAt);
    expect(group.getObjectByName("basin and sunken wall ink")).toBeInstanceOf(
      LineSegments,
    );
    for (const name of [
      "basin floors",
      "basin water",
      "sunken walls",
      "sunken wall crown path",
    ]) {
      const mesh = group.getObjectByName(name) as Mesh;
      expect(mesh.userData.dayMaterial).toBeDefined();
      expect(mesh.userData.nightMaterial).toBeDefined();
    }
    setIsoNightPresentation(group, true);
    for (const name of ["sunken walls", "sunken wall crown path"]) {
      const mesh = group.getObjectByName(name) as Mesh;
      expect(mesh.material).toBe(mesh.userData.nightMaterial);
    }
    setIsoNightPresentation(group, false);
    const slab = group.getObjectByName("sunken walls") as Mesh;
    expect(slab.material).toBe(slab.userData.dayMaterial);
  });
});
