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
  test("the wedge climbs from grade to a high point over the water", () => {
    const group = createSmoothSurfaces(surfaces, -1.15, 4.2, terrainAt);
    const slab = group.getObjectByName("sunken walls");
    expect(slab).toBeInstanceOf(Mesh);
    const water = new Box3().setFromObject(
      group.getObjectByName("basin water") as Mesh,
    ).max.y;
    const box = new Box3().setFromObject(slab as Mesh);
    // Several metres proud of the water at the crest, and carried down
    // through the surface by the plunge face — that drop IS the artwork.
    expect(box.max.y).toBeGreaterThan(water + 4);
    expect(box.min.y).toBeLessThan(water);
  });

  test("the wedge is low in the north and high in the south", () => {
    const wall = surfaces.sunken_walls?.[0];
    expect(wall).toBeDefined();
    // World z runs south, so the crest is the southern end.
    expect(wall!.crest[1]).toBeGreaterThan(wall!.foot[1]);
    const group = createSmoothSurfaces(surfaces, -1.15, 4.2, terrainAt);
    const slab = group.getObjectByName("sunken walls") as Mesh;
    const position = slab.geometry.getAttribute("position");
    let northTop = -Infinity;
    let southTop = -Infinity;
    const midZ = (wall!.crest[1] + wall!.foot[1]) / 20;
    for (let index = 0; index < position.count; index += 1) {
      const y = position.getY(index);
      if (position.getZ(index) < midZ) {
        northTop = Math.max(northTop, y);
      } else {
        southTop = Math.max(southTop, y);
      }
    }
    expect(southTop).toBeGreaterThan(northTop + 2);
  });

  test("a walkable crown with rails runs the whole ramp", () => {
    const group = createSmoothSurfaces(surfaces, -1.15, 4.2, terrainAt);
    const crown = group.getObjectByName("sunken wall crown path");
    expect(crown).toBeInstanceOf(Mesh);
    const slabBox = new Box3().setFromObject(
      group.getObjectByName("sunken walls") as Mesh,
    );
    const crownBox = new Box3().setFromObject(crown as Mesh);
    // The path lies on the slab and runs its full length, from the
    // entrance at grade to the break at the crest.
    expect(crownBox.max.y).toBeLessThanOrEqual(slabBox.max.y + 0.1);
    expect(slabBox.containsBox(crownBox.clone().expandByScalar(-0.2))).toBe(
      true,
    );
    // The parapet rails are drawn as ink lines standing above the crown.
    const ink = group.getObjectByName(
      "basin and sunken wall ink",
    ) as LineSegments;
    expect(new Box3().setFromObject(ink).max.y).toBeGreaterThan(
      crownBox.max.y + 0.5,
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
