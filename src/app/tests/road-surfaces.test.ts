import { describe, expect, test } from "bun:test";
import { Box3, LineSegments, Mesh } from "three";

import {
  DRAPED_SURFACE_MAX_EDGE_M,
  createSmoothSurfaces,
  type SurfacePayload,
} from "../src/IsometricCityWorld";
import {
  createGroundSlabs,
  smoothGroundTopSampler,
  type VoxelPayload,
} from "../src/MinecraftVoxelWorld";
import { createTunnelPortalApproachTester } from "../src/TunnelPortals";
import groundPayload from "../public/mesh/regierungsviertel/minecraft-voxels.json";
import scenePayload from "../public/mesh/regierungsviertel/scene.json";
import surfacePayload from "../public/mesh/regierungsviertel/surface-polygons.json";

const surfaces = surfacePayload as unknown as SurfacePayload;
const ground = groundPayload as unknown as VoxelPayload;

describe("drawn carriageways and park paths", () => {
  test("bilinearly interpolates the measured terrain samples for drawn grades", () => {
    const fixture: VoxelPayload = {
      buildings: [],
      cell_m: 4,
      classes: [],
      grid: { cols: 8, min_x_idx: 0, min_z_idx: 0, rows: 8 },
      ground_height: {
        cols: 2,
        rows: 2,
        stride_cells: 4,
        y_dm: [40, 80, 120, 160],
      },
      ground_rows: [],
      schema_version: 1,
      trees: [],
      water_top_y_m: -1.15,
    };
    const sample = smoothGroundTopSampler(fixture);
    expect(sample(2, 2)).toBeCloseTo(4, 6);
    expect(sample(6, 2)).toBeCloseTo(8, 6);
    expect(sample(4, 4)).toBeCloseTo(10, 6);
    expect(sample(6, 6)).toBeCloseTo(16, 6);
  });

  test("the payload carries buffered road polygons and lane markings", () => {
    // OSM ships streets as centrelines. Until v0.44.0 the drawn city had no
    // road surface at all beyond the 4 m voxel raster, so the Straße des
    // 17. Juni read as a pale green band through the park.
    expect(surfaces.roads?.length ?? 0).toBeGreaterThan(20);
    const kinds = new Set((surfaces.roads ?? []).map((road) => road.kind));
    expect(kinds.has("asphalt")).toBe(true);
    expect(kinds.has("sand")).toBe(true);
    expect(kinds.has("paving")).toBe(true);
    expect(kinds.has("earth")).toBe(true);
    expect(kinds.has("wood")).toBe(true);
    expect(kinds.has("metal")).toBe(true);
    expect(surfaces.path_inventory?.line_parts ?? 0).toBeGreaterThan(8_000);
    expect(
      surfaces.path_inventory?.mapped_surface_line_parts ?? 0,
    ).toBeGreaterThan(7_000);
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
      "smooth earth desire paths",
      "smooth timber paths",
      "smooth metal paths and steps",
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
    // A compact metric fixture exercises the same draping contract without
    // triangulating the complete central-Berlin road payload twice. The old
    // full-payload test sat at Bun's five-second timeout and failed at random.
    const fixture: SurfacePayload = {
      parks: [],
      roads: [
        {
          area_m2: 16_000,
          holes: [],
          kind: "asphalt",
          name: "graded test road",
          ring: [
            [0, 0],
            [4_000, 0],
            [4_000, 400],
            [0, 400],
          ],
        },
      ],
      schema_version: 8,
      water: [],
    };
    const flat = createSmoothSurfaces(fixture, -1.15, 4.2);
    const followed = createSmoothSurfaces(
      fixture,
      -1.15,
      4.2,
      (x) => 6.5 + 0.003 * x,
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

  test("subdivides long road triangles so interior terrain rises survive", () => {
    const fixture: SurfacePayload = {
      parks: [],
      roads: [
        {
          area_m2: 8_000,
          holes: [],
          kind: "asphalt",
          name: "terrain test road",
          ring: [
            [0, 0],
            [4_000, 0],
            [4_000, 200],
            [0, 200],
          ],
        },
      ],
      schema_version: 8,
      water: [],
    };
    const group = createSmoothSurfaces(
      fixture,
      -1.15,
      4.2,
      (x) => 5 + 2 * Math.sin((Math.PI * x) / 400),
    );
    const road = group.getObjectByName("smooth carriageways") as Mesh;
    const positions = road.geometry.getAttribute("position");
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < positions.count; index += 1) {
      minY = Math.min(minY, positions.getY(index));
      maxY = Math.max(maxY, positions.getY(index));
    }
    expect(maxY - minY).toBeGreaterThan(1.5);

    const indices = road.geometry.index;
    expect(indices).not.toBeNull();
    let maxEdge = 0;
    for (let index = 0; index < (indices?.count ?? 0); index += 3) {
      for (const [from, to] of [
        [index, index + 1],
        [index + 1, index + 2],
        [index + 2, index],
      ]) {
        const a = indices!.getX(from);
        const b = indices!.getX(to);
        maxEdge = Math.max(
          maxEdge,
          Math.hypot(
            positions.getX(a) - positions.getX(b),
            positions.getZ(a) - positions.getZ(b),
          ),
        );
      }
    }
    expect(maxEdge).toBeLessThanOrEqual(DRAPED_SURFACE_MAX_EDGE_M + 1e-4);
  });

  test("quay coping follows the local landward grade", () => {
    const fixture: SurfacePayload = {
      parks: [],
      roads: [],
      schema_version: 8,
      water: [
        {
          area_m2: 5_000,
          holes: [],
          kind: "river",
          name: "graded river",
          ring: [
            [0, 0],
            [1_000, 0],
            [1_000, 500],
            [0, 500],
          ],
        },
      ],
    };
    const group = createSmoothSurfaces(fixture, -1.15, 4.2, (x) => 4 + x / 40);
    const walls = group.getObjectByName("smooth quay walls") as Mesh;
    const bounds = new Box3().setFromObject(walls);
    expect(bounds.max.y).toBeGreaterThan(6.3);
    expect(bounds.min.y).toBeCloseTo(-4.25, 4);
  });

  test("the drawn base can omit coarse asphalt without changing Minecraft", () => {
    const shades = {
      asphalt: [0x777777],
      grass: [0x77aa66],
    };
    const minecraft = createGroundSlabs(ground, "all ground", shades);
    const drawn = createGroundSlabs(ground, "smooth-road base", shades, {
      skipClasses: ["asphalt"],
    });
    const asphaltId = ground.classes.indexOf("asphalt");
    const asphaltRuns = ground.ground_rows.reduce(
      (count, row) =>
        count + row.filter(([, , classId]) => classId === asphaltId).length,
      0,
    );

    expect(asphaltRuns).toBeGreaterThan(1_000);
    expect(minecraft.count - drawn.count).toBe(asphaltRuns);
  });

  test("cuts the measured ground raster around both authored tunnel ramps", () => {
    const insideApproach = createTunnelPortalApproachTester({
      clear_height_m: scenePayload.tiergartentunnel.clear_height_m,
      portal_surface_anchors:
        scenePayload.tiergartentunnel.portal_surface_anchors,
      points: scenePayload.tiergartentunnel.points as Array<
        [number, number, number]
      >,
    });
    const cut = createGroundSlabs(
      ground,
      "portal-cut ground",
      { asphalt: [0x777777], grass: [0x77aa66] },
      { skipAtWorld: insideApproach },
    );

    expect(cut.userData.skippedByWorldPredicateCells).toBeGreaterThan(500);
  });
});
