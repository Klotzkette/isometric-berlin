import { describe, expect, test } from "bun:test";
import { Box3, LineSegments, Mesh } from "three";

import {
  createSmoothSurfaces,
  type SurfacePayload,
} from "../src/IsometricCityWorld";
import surfacePayload from "../public/mesh/regierungsviertel/surface-polygons.json";

const surfaces = surfacePayload as unknown as SurfacePayload;

describe("drawn carriageways and park paths", () => {
  test("the payload carries buffered road polygons and lane markings", () => {
    // OSM ships streets as centrelines. Until v0.44.0 the drawn city had no
    // road surface at all beyond the 4 m voxel raster, so the Straße des
    // 17. Juni read as a pale green band through the park.
    expect(surfaces.roads?.length ?? 0).toBeGreaterThan(20);
    const kinds = new Set((surfaces.roads ?? []).map((road) => road.kind));
    expect(kinds.has("asphalt")).toBe(true);
    expect(kinds.has("sand")).toBe(true);
    expect(kinds.has("paving")).toBe(true);
    expect(surfaces.lane_markings?.length ?? 0).toBeGreaterThan(20);
    const named = (surfaces.lane_markings ?? []).map((entry) => entry.name);
    expect(named).toContain("Straße des 17. Juni");
  });

  test("no road hole is a degenerate sliver", () => {
    // A hole without area crashes three's earcut triangulator and used to
    // take the ENTIRE drawn city down with it, silently falling back to the
    // bare photogrammetry mesh.
    for (const road of surfaces.roads ?? []) {
      for (const hole of road.holes) {
        expect(hole.length).toBeGreaterThanOrEqual(4);
      }
    }
  });

  test("every family is drawn as its own plate with a night tone", () => {
    const group = createSmoothSurfaces(surfaces, -1.15, 4.2);
    for (const name of [
      "smooth carriageways",
      "smooth park paths",
      "smooth paved paths",
    ]) {
      const plate = group.getObjectByName(name);
      expect(plate).toBeInstanceOf(Mesh);
      expect((plate as Mesh).userData.dayMaterial).toBeDefined();
      expect((plate as Mesh).userData.nightMaterial).toBeDefined();
    }
    const markings = group.getObjectByName("carriageway lane markings");
    expect(markings).toBeInstanceOf(LineSegments);
  });

  test("asphalt carriageways carry raised kerbstones with an ink arris", () => {
    // "Alle Straßen, die Bordsteine haben, müssen diese Bordsteine
    // aufzeigen": every asphalt polygon outline gets a kerb upstand wall
    // plus a fine ink line along its top edge. Park paths stay kerbless.
    const group = createSmoothSurfaces(surfaces, -1.15, 4.2);
    const upstands = group.getObjectByName("smooth kerb upstands");
    expect(upstands).toBeInstanceOf(Mesh);
    expect((upstands as Mesh).userData.dayMaterial).toBeDefined();
    expect((upstands as Mesh).userData.nightMaterial).toBeDefined();
    const geometry = (upstands as Mesh).geometry;
    const positions = geometry.getAttribute("position");
    // Two triangles per outline segment across the whole asphalt network:
    // this has to be a substantial band, not a token.
    expect(positions.count).toBeGreaterThan(3_000);
    const ink = group.getObjectByName("smooth kerb ink");
    expect(ink).toBeInstanceOf(LineSegments);
  });

  test("surfaces follow the terrain instead of one constant height", () => {
    // The surveyed terrain runs to a median of 5.2 m while the single
    // constant this used to use is 4.2 m — every lawn and every road plate
    // sat a metre UNDERGROUND and simply never appeared on screen.
    const flat = createSmoothSurfaces(surfaces, -1.15, 4.2);
    const followed = createSmoothSurfaces(
      surfaces,
      -1.15,
      4.2,
      (x, z) => 6.5 + 0.6 * Math.sin(x / 400) + 0.6 * Math.cos(z / 400),
    );
    const heightOf = (group: ReturnType<typeof createSmoothSurfaces>): Box3 =>
      new Box3().setFromObject(
        group.getObjectByName("smooth carriageways") as Mesh,
      );
    const flatBox = heightOf(flat);
    const followedBox = heightOf(followed);
    expect(flatBox.max.y - flatBox.min.y).toBeLessThan(0.01);
    expect(followedBox.max.y - followedBox.min.y).toBeGreaterThan(0.5);
    expect(followedBox.min.y).toBeGreaterThan(flatBox.max.y);
  });
});
