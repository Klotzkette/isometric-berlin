import { describe, expect, test } from "bun:test";

import { Box3, InstancedMesh, LineSegments, Mesh, Vector3 } from "three";

import {
  type PrismPayload,
  buildRoofGeometry,
  createIsometricCity,
  fitRectangle,
  ISO_EDGE_THRESHOLD_DEGREES,
  ISO_INK_COLOR,
  ISO_WINDOW_BAY_PITCH_M,
  ISO_WINDOW_FLOOR_PITCH_M,
  PRISM_GLASSED_IDS,
  ROOF_GABLED,
  ROOF_HIPPED,
  ROOF_MIN_RECTANGULARITY,
  ROOF_SHED,
  roofRise,
  windowGrid,
} from "../src/IsometricCityWorld";
import prismPayload from "../public/mesh/regierungsviertel/lod2-prisms.json";

const payload = prismPayload as unknown as PrismPayload;

describe("drawn isometric city (LoD2 prisms)", () => {
  const city = createIsometricCity(payload, null);
  const bodies = city.getObjectByName("LoD2 prism buildings") as Mesh;
  const ink = city.getObjectByName("LoD2 prism ink lines") as LineSegments;

  test("merges thousands of surveyed footprints into prisms with ink lines", () => {
    expect(payload.buildings.length).toBeGreaterThan(2000);
    expect(bodies).toBeInstanceOf(Mesh);
    expect(ink).toBeInstanceOf(LineSegments);
    expect(ISO_EDGE_THRESHOLD_DEGREES).toBeGreaterThan(0);
    // Fine grey pencil ink — light lines, no black marker.
    expect(ISO_INK_COLOR).toBeGreaterThan(0x404040);
    expect(ISO_INK_COLOR).toBeLessThan(0x909090);
    expect(bodies.geometry.getAttribute("color")).toBeDefined();
  });

  test("keeps the Reichstag as a tall prism with courtyard holes", () => {
    const reichstag = payload.buildings.filter((building) => {
      const xs = building.ring.map(([x]) => x / 10);
      const zs = building.ring.map(([, z]) => z / 10);
      const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
      const cz = zs.reduce((a, b) => a + b, 0) / zs.length;
      return cx >= 260 && cx <= 372 && cz >= -34 && cz <= 115;
    });
    expect(reichstag.length).toBeGreaterThan(0);
    expect(Math.max(...reichstag.map((b) => b.h_dm))).toBeGreaterThanOrEqual(240);
    expect(
      reichstag.some((building) => (building.holes ?? []).length >= 1),
    ).toBe(true);
  });

  test("city geometry spans the quarter and sits above ground", () => {
    const bounds = new Box3().setFromObject(bodies);
    const size = bounds.getSize(new Vector3());
    expect(size.x).toBeGreaterThan(800);
    expect(size.z).toBeGreaterThan(800);
    expect(bounds.min.y).toBeGreaterThan(-10);
    expect(bounds.max.y).toBeLessThan(200);
  });
});

describe("ligne-claire fenestration", () => {
  const city = createIsometricCity(payload, null);

  test("windowGrid derives real floors and bays from surveyed geometry", () => {
    // A 20 m wall on a 12 m body: bays span the wall, floors the height.
    const grid = windowGrid(20, 12);
    expect(grid).not.toBeNull();
    expect(grid!.bays).toBeGreaterThanOrEqual(5);
    expect(grid!.floors).toBe(3);
    // The bay run stays centred inside the wall.
    const lastOffset =
      grid!.firstOffset + (grid!.bays - 1) * ISO_WINDOW_BAY_PITCH_M;
    expect(grid!.firstOffset).toBeGreaterThan(0);
    expect(lastOffset).toBeLessThan(20);
    // Storey pitch is architectural, not decorative.
    expect(ISO_WINDOW_FLOOR_PITCH_M).toBeGreaterThan(2.5);
    expect(ISO_WINDOW_FLOOR_PITCH_M).toBeLessThan(4);
    // Walls too short and bodies too low carry no windows.
    expect(windowGrid(2, 12)).toBeNull();
    expect(windowGrid(20, 2.5)).toBeNull();
  });

  test("facades are articulated by fine glazing axes, not punched panes", () => {
    // No invented square windows: the facade rhythm is drawn as slender
    // vertical ink lines ("keine quadratischen Fenster wo keine sind").
    const axes = city.getObjectByName("LoD2 facade axes") as LineSegments;
    expect(axes).toBeInstanceOf(LineSegments);
    const position = axes.geometry.getAttribute("position");
    // Thousands of axis lines across the quarter (2 endpoints each).
    expect(position.count).toBeGreaterThan(20_000);
    // Each axis is vertical: the two endpoints share x and z.
    for (let index = 0; index < position.count; index += 2) {
      expect(Math.abs(position.getX(index) - position.getX(index + 1))).toBeLessThan(1e-3);
      expect(Math.abs(position.getZ(index) - position.getZ(index + 1))).toBeLessThan(1e-3);
      expect(position.getY(index + 1)).toBeGreaterThan(position.getY(index));
    }
  });

  test("night lights only a warm minority of facade axes, hidden by day", () => {
    const strips = city.getObjectByName("LoD2 facade night strips") as InstancedMesh;
    expect(strips).toBeInstanceOf(InstancedMesh);
    // Off by day.
    expect(strips.visible).toBe(false);
    const axes = city.getObjectByName("LoD2 facade axes") as LineSegments;
    const axisCount = axes.geometry.getAttribute("position").count / 2;
    // The lit strips are a minority (~38%) of all axes.
    expect(strips.count).toBeGreaterThan(0);
    expect(strips.count / axisCount).toBeLessThan(0.5);
    // The strips are warm (r ≥ b) on average.
    const colors = strips.instanceColor!.array as Float32Array;
    let warm = 0;
    for (let index = 0; index < strips.count; index += 1) {
      if (colors[index * 3] >= colors[index * 3 + 2]) warm += 1;
    }
    expect(warm / strips.count).toBeGreaterThan(0.5);
  });

  test("glass-class prisms and the Hauptbahnhof towers render transparent", () => {
    const glass = city.getObjectByName("LoD2 glass prisms") as Mesh;
    expect(glass).toBeInstanceOf(Mesh);
    const material = glass.material as { opacity: number; transparent: boolean };
    expect(material.transparent).toBe(true);
    expect(material.opacity).toBeGreaterThan(0.3);
    expect(material.opacity).toBeLessThan(0.8);
    // The 24 Bügel tower prisms are glassed, and all of them exist.
    expect(PRISM_GLASSED_IDS.size).toBe(24);
    for (const id of PRISM_GLASSED_IDS) {
      expect(payload.buildings.some((b) => b.id === id)).toBe(true);
    }
  });

  test("the station's low slabs are suppressed but stay in the payload", async () => {
    const { PRISM_SUPPRESSED_IDS } = await import("../src/IsometricCityWorld");
    for (const id of ["K0002KiE", "YK0000Cm", "q7Axk9GG"]) {
      expect(PRISM_SUPPRESSED_IDS.has(id)).toBe(true);
      expect(payload.buildings.some((b) => b.id === id)).toBe(true);
    }
    // No suppressed or glassed id overlaps the other set.
    for (const id of PRISM_GLASSED_IDS) {
      expect(PRISM_SUPPRESSED_IDS.has(id)).toBe(false);
    }
  });

  test("every sizeable building gets one drawn entrance door", () => {
    const panes = city.getObjectByName("LoD2 prism windows") as InstancedMesh;
    expect(panes).toBeInstanceOf(InstancedMesh);
    const matrices = panes.instanceMatrix.array as Float32Array;
    let doors = 0;
    for (let index = 0; index < panes.count; index += 1) {
      // The pane layer now carries ONLY doors (2.35 m tall).
      if (Math.abs(matrices[index * 16 + 5] - 2.35) < 1e-3) {
        doors += 1;
      }
    }
    expect(doors).toBeGreaterThan(400);
    expect(doors).toBeLessThan(payload.buildings.length);
    // Doors are the whole pane layer now — no invented windows.
    expect(doors).toBe(panes.count);
  });

  test("transparent glass buildings carry drawn curtain-wall mullions", () => {
    const mullions = city.getObjectByName("LoD2 glass mullions");
    expect(mullions).toBeInstanceOf(LineSegments);
    const positions = (mullions as LineSegments).geometry.getAttribute(
      "position",
    );
    expect(positions.count).toBeGreaterThan(1000);
  });

  test("the ground grid draws kerb ink where roads meet lawns and plazas", async () => {
    const voxelPayload = (await import(
      "../public/mesh/regierungsviertel/minecraft-voxels.json"
    )) as { default: unknown };
    const grounded = createIsometricCity(
      payload,
      voxelPayload.default as never,
      null,
    );
    const kerbs = grounded.getObjectByName("drawn kerb lines");
    expect(kerbs).toBeInstanceOf(LineSegments);
    const positions = (kerbs as LineSegments).geometry.getAttribute("position");
    expect(positions.count).toBeGreaterThan(2000);
  });

  test("the Tiergartentunnel leaves a dashed trace when ground is present", async () => {
    const voxelPayload = (await import(
      "../public/mesh/regierungsviertel/minecraft-voxels.json"
    )) as { default: unknown };
    const points: [number, number, number][] = [
      [-115, -8.5, -280],
      [-111, -8.5, -14],
      [-113, -8.5, 336],
    ];
    const traced = createIsometricCity(
      payload,
      voxelPayload.default as never,
      points,
    );
    const trace = traced.getObjectByName("Tiergartentunnel underground trace");
    expect(trace).toBeInstanceOf(LineSegments);
    const positions = (trace as LineSegments).geometry.getAttribute("position");
    expect(positions.count).toBeGreaterThan(100);
    // Both portals ("dessen Eingänge") come along: ramps + ink.
    const portals = traced.getObjectByName("Tiergartentunnel portals");
    expect(portals).toBeDefined();
    const ramps = traced.getObjectByName("tunnel portal ramps") as Mesh;
    expect(ramps).toBeInstanceOf(Mesh);
    expect(ramps.geometry.getAttribute("position").count).toBeGreaterThan(100);
    expect(
      traced.getObjectByName("tunnel portal ink lines"),
    ).toBeInstanceOf(LineSegments);
  });
});

describe("west Tiergarten extrapolation and the recessed Spree", () => {
  test("the extrapolated west carries lawn, axis road and a 67 m Siegessäule", async () => {
    const { createWestTiergarten } = await import("../src/IsometricCityWorld");
    const west = createWestTiergarten();
    expect(west.userData.extrapolated).toBe(true);
    const bounds = new Box3().setFromObject(west);
    // The column with Viktoria tops out around 67 m over the park.
    expect(bounds.max.y).toBeGreaterThan(60);
    expect(bounds.max.y).toBeLessThan(85);
    // The apron reaches the Großer Stern in the west.
    expect(bounds.min.x).toBeLessThan(-1500);
    expect(west.getObjectByName("extrapolated tree crowns")).toBeDefined();
    expect(west.getObjectByName("extrapolated west ink lines")).toBeDefined();
  });

  test("quay walls drop from the banks wherever land meets water", async () => {
    const voxelPayload = (await import(
      "../public/mesh/regierungsviertel/minecraft-voxels.json"
    )) as { default: unknown };
    const city = createIsometricCity(
      payload,
      voxelPayload.default as never,
      null,
    );
    const quays = city.getObjectByName("drawn quay walls") as Mesh;
    expect(quays).toBeInstanceOf(Mesh);
    // Thousands of embankment triangles along Spree + Humboldthafen.
    expect(quays.geometry.getAttribute("position").count).toBeGreaterThan(3000);
  });

  test("the Reichstag wears its pinned stately window rhythm", async () => {
    const { HERO_WINDOW_FORMATS } = await import("../src/IsometricCityWorld");
    const format = HERO_WINDOW_FORMATS.K0002MCN;
    expect(format.height).toBeGreaterThan(4);
    expect(format.sillStart).toBeGreaterThan(4);
    // Tall base + stately pitch → exactly 3 rows on the 28 m body.
    const grid = windowGrid(30, 28.1, format);
    expect(grid).not.toBeNull();
    expect(grid!.floors).toBe(3);
  });
});

describe("procedural pitched roofs from ALKIS codes", () => {
  // A 20 m × 10 m rectangle rotated 30° — fitRectangle must recover it.
  const angle = Math.PI / 6;
  const rotated: Array<[number, number]> = (
    [
      [-10, -5],
      [10, -5],
      [10, 5],
      [-10, 5],
    ] as Array<[number, number]>
  ).map(([x, z]) => [
    x * Math.cos(angle) - z * Math.sin(angle) + 100,
    x * Math.sin(angle) + z * Math.cos(angle) + 200,
  ]);

  test("fitRectangle recovers an oriented rectangle exactly", () => {
    const rect = fitRectangle(rotated);
    expect(rect).not.toBeNull();
    expect(rect!.halfLength).toBeCloseTo(10, 4);
    expect(rect!.halfWidth).toBeCloseTo(5, 4);
    expect(rect!.center[0]).toBeCloseTo(100, 4);
    expect(rect!.center[1]).toBeCloseTo(200, 4);
    expect(rect!.rectangularity).toBeCloseTo(1, 4);
    // A perfect rectangle sails past the roofing threshold.
    expect(rect!.rectangularity).toBeGreaterThanOrEqual(
      ROOF_MIN_RECTANGULARITY,
    );
  });

  test("gable, hip and shed codes produce flat-facet triangles; others stay flat", () => {
    const rect = fitRectangle(rotated)!;
    for (const code of [ROOF_GABLED, ROOF_HIPPED, ROOF_SHED]) {
      const triangles = buildRoofGeometry(rect, 10, 13, code);
      expect(triangles).not.toBeNull();
      expect(triangles!.length % 9).toBe(0);
      // Every vertex lies between eave and ridge.
      for (let i = 1; i < triangles!.length; i += 3) {
        expect(triangles![i]).toBeGreaterThanOrEqual(10);
        expect(triangles![i]).toBeLessThanOrEqual(13);
      }
      // The ridge is actually reached.
      let ridgeHit = false;
      for (let i = 1; i < triangles!.length; i += 3) {
        if (triangles![i] === 13) ridgeHit = true;
      }
      expect(ridgeHit).toBe(true);
    }
    // Flat (1000), unknown (9999) and dome (5000) codes keep the flat cap.
    expect(buildRoofGeometry(rect, 10, 13, 1000)).toBeNull();
    expect(buildRoofGeometry(rect, 10, 13, 9999)).toBeNull();
    expect(buildRoofGeometry(rect, 10, 13, 5000)).toBeNull();
  });

  test("roofRise stays plausible and yields to squat buildings", () => {
    const rect = fitRectangle(rotated)!;
    // 10 m wide → 3 m rise, within [1.2, 5].
    expect(roofRise(rect, 20)).toBeCloseTo(3, 4);
    // A building barely taller than the rise keeps its flat cap.
    expect(roofRise(rect, 4)).toBe(0);
  });

  test("hundreds of surveyed pitched-roof buildings actually get roofs", () => {
    const codes = new Set([ROOF_GABLED, ROOF_HIPPED, ROOF_SHED]);
    let roofed = 0;
    for (const building of payload.buildings) {
      if (!codes.has(building.roof ?? 0)) continue;
      const ring = building.ring.map(
        ([x, z]) => [x / 10, z / 10] as [number, number],
      );
      const rect = fitRectangle(ring);
      if (!rect || rect.rectangularity < ROOF_MIN_RECTANGULARITY) continue;
      if (roofRise(rect, Math.max(2.5, building.h_dm / 10)) > 0) roofed += 1;
    }
    expect(roofed).toBeGreaterThan(400);
  });
});

describe("real-colour facade tones", () => {
  test("cleanedTone keeps grey grey and clamps lightness to paint bands", async () => {
    const { cleanedTone, HERO_PRISM_TONES } = await import(
      "../src/IsometricCityWorld"
    );
    // A dark grey sample stays a readable dark grey (never black, never warm).
    const grey = cleanedTone([92, 90, 86]);
    expect(grey.r).toBeGreaterThan(0.2);
    expect(Math.abs(grey.r - grey.b)).toBeLessThan(0.06);
    // A blown-out white sample is capped below pure white.
    const bright = cleanedTone([250, 250, 250]);
    expect(bright.r).toBeLessThanOrEqual(0.9);
    // The Reichstag pin is the darker grey the owner asked for, not warm.
    const reichstag = HERO_PRISM_TONES.K0002MCN;
    const r = (reichstag >> 16) & 255;
    const b = reichstag & 255;
    expect(r - b).toBeLessThan(40);
    expect(r).toBeLessThan(180);
  });
});

describe("hero prism pins", () => {
  test("the Chancellery is pinned light grey, per the owner's direction", async () => {
    const { HERO_PRISM_TONES } = await import("../src/IsometricCityWorld");
    const chancellery = HERO_PRISM_TONES.MLwG4KW9;
    const r = (chancellery >> 16) & 255;
    const g = (chancellery >> 8) & 255;
    const b = chancellery & 255;
    // Light (luma high) and neutral (channels close together).
    expect((r + g + b) / 3).toBeGreaterThan(190);
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(12);
  });
});

describe("prism suppression for full recognition models", () => {
  test("the Brandenburg Gate body prism is skipped (model carries it)", async () => {
    const { PRISM_SUPPRESSED_IDS, createIsometricCity } = await import(
      "../src/IsometricCityWorld"
    );
    const { Matrix4, Mesh, Vector3 } = await import("three");
    const payloadModule = await import(
      "../public/mesh/regierungsviertel/lod2-prisms.json"
    );
    const data = payloadModule.default as never as {
      buildings: Array<{ id: string; ring: number[][] }>;
      classes: string[];
      schema_version: number;
    };
    expect(PRISM_SUPPRESSED_IDS.has("K0001xqy")).toBe(true);
    // The suppressed building exists in the payload (data untouched)…
    expect(data.buildings.some((b) => b.id === "K0001xqy")).toBe(true);
    // …but produces no geometry at the gate anchor above pavilion height.
    const city = createIsometricCity(data as never, null);
    const bodies = city.getObjectByName("LoD2 prism buildings") as InstanceType<
      typeof Mesh
    >;
    const position = bodies.geometry.getAttribute("position");
    const matrix = new Matrix4();
    void matrix;
    const vertex = new Vector3();
    let tallGateVertices = 0;
    for (let index = 0; index < position.count; index += 1) {
      vertex.fromBufferAttribute(position, index);
      if (
        vertex.x > 407 &&
        vertex.x < 429 &&
        vertex.z > 290 &&
        vertex.z < 312 &&
        vertex.y > 18
      ) {
        tallGateVertices += 1;
      }
    }
    expect(tallGateVertices).toBe(0);
  });
});
