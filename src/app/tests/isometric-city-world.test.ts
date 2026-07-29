import { describe, expect, test } from "bun:test";

import {
  Box3,
  InstancedMesh,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector3,
} from "three";

import {
  EXTRAPOLATED_WEST_M,
  type PrismPayload,
  VISIBLE_RADIUS_M,
  buildRoofGeometry,
  createIsometricCity,
  fitRectangle,
  ISO_EDGE_THRESHOLD_DEGREES,
  ISO_GROUND_SHADES,
  ISO_INK_COLOR,
  ISO_WINDOW_BAY_PITCH_M,
  ISO_WINDOW_HEIGHT_M,
  ISO_WINDOW_FLOOR_PITCH_M,
  PAUL_LOEBE_WEST_FACE_X,
  PRISM_GLASSED_IDS,
  createLandmarkRefinements,
  createPaulLoebeCanopy,
  ROOF_GABLED,
  ROOF_HIPPED,
  ROOF_MIN_RECTANGULARITY,
  ROOF_SHED,
  roofRise,
  setIsoNightPresentation,
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
    expect(bodies.material).toBeInstanceOf(MeshBasicMaterial);
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

  test("facades are articulated by glazing axes and storey bands", () => {
    // The facade grid is drawn: slender vertical bay axes crossed by one
    // horizontal hairline per storey, so walls stay legible when the
    // panes themselves fall below a pixel.
    const axes = city.getObjectByName("LoD2 facade axes") as LineSegments;
    expect(axes).toBeInstanceOf(LineSegments);
    const position = axes.geometry.getAttribute("position");
    expect(position.count).toBeGreaterThan(20_000);
    let verticals = 0;
    let bands = 0;
    for (let index = 0; index < position.count; index += 2) {
      const sameXZ =
        Math.abs(position.getX(index) - position.getX(index + 1)) < 1e-3 &&
        Math.abs(position.getZ(index) - position.getZ(index + 1)) < 1e-3;
      if (sameXZ) {
        expect(position.getY(index + 1)).toBeGreaterThan(position.getY(index));
        verticals += 1;
      } else {
        // Storey bands run level along the wall.
        expect(
          Math.abs(position.getY(index) - position.getY(index + 1)),
        ).toBeLessThan(1e-3);
        bands += 1;
      }
    }
    expect(verticals).toBeGreaterThan(5_000);
    expect(bands).toBeGreaterThan(5_000);
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
    expect(glass.material).toBeInstanceOf(MeshBasicMaterial);
    expect(material.transparent).toBe(true);
    expect(material.opacity).toBeGreaterThan(0.3);
    expect(material.opacity).toBeLessThan(0.8);
    // The 24 Bügel tower prisms are glassed, and all of them exist.
    expect(PRISM_GLASSED_IDS.size).toBe(24);
    for (const id of PRISM_GLASSED_IDS) {
      expect(payload.buildings.some((b) => b.id === id)).toBe(true);
    }
  });

  test("glass swaps losslessly between flat day and lit night materials", () => {
    const glass = city.getObjectByName("LoD2 glass prisms") as Mesh;
    const dayMaterial = glass.material;
    setIsoNightPresentation(city, true);
    expect(glass.material).toBeInstanceOf(MeshStandardMaterial);
    setIsoNightPresentation(city, false);
    expect(glass.material).toBe(dayMaterial);
  });

  test("night masonry keeps a cool readable floor instead of collapsing to black", () => {
    const bodies = city.getObjectByName("LoD2 prism buildings") as Mesh;
    const dayMaterial = bodies.material;
    setIsoNightPresentation(city, true);
    const nightMaterial = bodies.material as MeshStandardMaterial;
    expect(nightMaterial).toBeInstanceOf(MeshStandardMaterial);
    expect(nightMaterial.emissive.getHex()).toBe(0x252c39);
    expect(nightMaterial.emissiveIntensity).toBeGreaterThanOrEqual(0.65);
    setIsoNightPresentation(city, false);
    expect(bodies.material).toBe(dayMaterial);
  });

  test("the presentation paper closes distant camera views without data claims", () => {
    const backdrop = city.getObjectByName("presentation paper backdrop") as Mesh;
    expect(backdrop).toBeInstanceOf(Mesh);
    expect(backdrop.material).toBeInstanceOf(MeshBasicMaterial);
    expect(backdrop.userData.presentationOnly).toBe(true);
    const dayMaterial = backdrop.material;
    setIsoNightPresentation(city, true);
    expect(backdrop.material).not.toBe(dayMaterial);
    setIsoNightPresentation(city, false);
    expect(backdrop.material).toBe(dayMaterial);
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
    // The pane layer carries ONLY doors: LoD2 has no real window
    // positions, so a generated pane grid would be invented geometry
    // (owner: "keine schwachsinnigen nichtexistierenden Quadratfenster").
    expect(panes.count).toBe(doors);
  });

  test("ordinary blocks are articulated by drawn axes, not invented panes", () => {
    const panes = city.getObjectByName("LoD2 prism windows") as InstancedMesh;
    const matrices = panes.instanceMatrix.array as Float32Array;
    for (let index = 0; index < panes.count; index += 1) {
      const height = matrices[index * 16 + 5];
      // Nothing but entrance doors may exist as pane geometry.
      expect(Math.abs(height - 2.35)).toBeLessThan(1e-3);
      expect(Math.abs(height - ISO_WINDOW_HEIGHT_M)).toBeGreaterThan(0.1);
    }
    // The facade rhythm instead comes from the drawn axis/band grid.
    const axes = city.getObjectByName("LoD2 facade axes") as LineSegments;
    expect(
      axes.geometry.getAttribute("position").count,
    ).toBeGreaterThan(20_000);
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
  test("the day park palette stays quiet, bright and closely spaced", () => {
    const channels = ISO_GROUND_SHADES.grass.map((tone) => [
      (tone >> 16) & 0xff,
      (tone >> 8) & 0xff,
      tone & 0xff,
    ]);
    for (let channel = 0; channel < 3; channel += 1) {
      const values = channels.map((rgb) => rgb[channel]);
      expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(2);
    }
    for (const [red, green, blue] of channels) {
      expect(green).toBeGreaterThan(red);
      expect(green).toBeGreaterThan(blue);
      expect((red + green + blue) / 3).toBeGreaterThan(170);
    }
  });

  test("the extrapolated west carries lawn, axis road and a 67 m Siegessäule", async () => {
    const { createWestTiergarten } = await import("../src/IsometricCityWorld");
    const west = createWestTiergarten();
    expect(west.userData.extrapolated).toBe(true);
    const bounds = new Box3().setFromObject(west);
    // The column with Viktoria tops out around 67 m over the park.
    expect(bounds.max.y).toBeGreaterThan(60);
    expect(bounds.max.y).toBeLessThan(85);
    // The apron reaches the Großer Stern in the west.
    expect(bounds.min.x).toBeLessThanOrEqual(EXTRAPOLATED_WEST_M);
    expect(bounds.min.x).toBeGreaterThan(EXTRAPOLATED_WEST_M - 10);
    expect(west.userData.visibleRadiusM).toBe(VISIBLE_RADIUS_M);
    const trunks = west.getObjectByName(
      "extrapolated tree trunks",
    ) as InstancedMesh;
    expect(trunks.count).toBeGreaterThan(780);
    const matrix = new Matrix4();
    const treeXs: number[] = [];
    for (let index = 0; index < trunks.count; index += 1) {
      trunks.getMatrixAt(index, matrix);
      treeXs.push(matrix.elements[12]);
    }
    expect(treeXs.some((x) => x > -1810 && x < -1730)).toBe(true);
    expect(treeXs.some((x) => x > -1910 && x < -1830)).toBe(true);
    expect(treeXs.some((x) => x > -2010 && x < -1930)).toBe(true);
    expect(treeXs.some((x) => x > -2110 && x < -2030)).toBe(true);
    expect(treeXs.some((x) => x > -2210 && x < -2130)).toBe(true);
    expect(treeXs.some((x) => x > -2310 && x < -2230)).toBe(true);
    expect(treeXs.some((x) => x > -2410 && x < -2330)).toBe(true);
    expect(treeXs.some((x) => x > -2510 && x < -2430)).toBe(true);
    const crowns = west.getObjectByName(
      "extrapolated tree crowns",
    ) as InstancedMesh;
    expect(crowns).toBeDefined();
    expect(crowns.geometry.getAttribute("position").count).toBeGreaterThan(100);
    expect(west.getObjectByName("extrapolated west ink lines")).toBeDefined();
    const body = west.getObjectByName(
      "extrapolated west ground and Siegessäule",
    ) as Mesh;
    expect(body.material).toBeInstanceOf(MeshBasicMaterial);
    const bodyBounds = new Box3().setFromObject(body);
    expect(bodyBounds.min.z).toBeLessThanOrEqual(-2100);
    expect(bodyBounds.max.z).toBeGreaterThanOrEqual(2520);
    // v0.27.0 adds exactly two instanced lamp layers (poles + warm
    // heads) along the axis; everything else stays merged.
    expect(west.children.length).toBe(6);
    expect(west.getObjectByName("extrapolated lamp poles")).toBeDefined();
    expect(west.getObjectByName("extrapolated lamp heads")).toBeDefined();
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
    // The Reichstag pin is pale neutral sandstone, never yellow or muddy.
    const reichstag = HERO_PRISM_TONES.K0002MCN;
    const r = (reichstag >> 16) & 255;
    const b = reichstag & 255;
    expect(r - b).toBeLessThan(40);
    expect(r).toBeGreaterThanOrEqual(195);
    expect(r).toBeLessThanOrEqual(215);
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

describe("real bridge structures", () => {
  test("bridges carry an elevated deck on piers that reach the riverbed", async () => {
    const { createIsometricCity, BRIDGE_MIN_CLUSTER_CELLS } = await import(
      "../src/IsometricCityWorld"
    );
    const voxelPayload = (await import(
      "../public/mesh/regierungsviertel/minecraft-voxels.json"
    )) as { default: { water_top_y_m: number } };
    expect(BRIDGE_MIN_CLUSTER_CELLS).toBeGreaterThan(0);
    const city = createIsometricCity(
      payload,
      voxelPayload.default as never,
      null,
    );
    const bodies = city.getObjectByName("bridge structure bodies") as Mesh;
    expect(bodies).toBeInstanceOf(Mesh);
    const bounds = new Box3().setFromObject(bodies);
    const waterTop = voxelPayload.default.water_top_y_m;
    // Piers stand in the riverbed…
    expect(bounds.min.y).toBeLessThan(waterTop - 1.5);
    // …and the deck with its parapets rides well above the water.
    expect(bounds.max.y).toBeGreaterThan(waterTop + 3);
    // The flat bridge slabs are gone from the ground layer.
    const slabs = city.getObjectByName("Drawn ground slabs") as InstancedMesh;
    expect(slabs).toBeInstanceOf(InstancedMesh);
    expect(city.getObjectByName("bridge structure ink lines")).toBeDefined();
  });

  test("the Paul-Löbe-Haus carries a cantilevered west entrance canopy", () => {
    const canopy = createPaulLoebeCanopy();
    const bodies = canopy.getObjectByName("Paul-Löbe canopy bodies") as Mesh;
    expect(bodies).toBeInstanceOf(Mesh);
    const bounds = new Box3().setFromObject(bodies);
    // Only the hinted stair runs sit behind the glass; everything else
    // cantilevers west over the forecourt towards the Chancellery.
    expect(bounds.max.x).toBeLessThan(PAUL_LOEBE_WEST_FACE_X + 4);
    // Roof plate, columns, paving bands and both fountain rows.
    expect(PAUL_LOEBE_WEST_FACE_X - bounds.min.x).toBeGreaterThan(38);
    // …carried by columns that reach the forecourt, with the slab well above
    // head height so the roof reads as a canopy rather than a porch wall.
    expect(bounds.min.y).toBeLessThan(6);
    expect(bounds.max.y).toBeGreaterThan(26);
    // The plate spans the full ~102 m west facade, not just the entrance bay.
    expect(bounds.max.z - bounds.min.z).toBeGreaterThan(100);
    expect(
      canopy.getObjectByName("Paul-Löbe canopy ink lines"),
    ).toBeInstanceOf(LineSegments);
  });

  test("the four coarsest LoD2 blocks carry their missing signatures", () => {
    const refined = createLandmarkRefinements();
    const bodies = refined.getObjectByName("Landmark refinement bodies") as Mesh;
    expect(bodies).toBeInstanceOf(Mesh);
    expect(
      refined.getObjectByName("Landmark refinement ink lines"),
    ).toBeInstanceOf(LineSegments);
    const bounds = new Box3().setFromObject(bodies);
    // West as far as the Haus-der-Kulturen reflecting pool, east to the
    // Jakob-Kaiser-Haus arcade.
    expect(bounds.min.x).toBeLessThan(-550);
    expect(bounds.max.x).toBeGreaterThan(400);
    // The saddle shell and the Lüders rotunda both rise well over the
    // 7 m boxes LoD2 gives them.
    expect(bounds.max.y).toBeGreaterThan(35);
  });
});

describe("smooth OSM water and parkland", () => {
  test("real polygons replace the rasterised river with a continuous shoreline", async () => {
    const { createSmoothSurfaces } = await import("../src/IsometricCityWorld");
    const surfaces = (await import(
      "../public/mesh/regierungsviertel/surface-polygons.json"
    )) as { default: { parks: unknown[]; water: unknown[] } };
    const payloadSurfaces = surfaces.default as never as Parameters<
      typeof createSmoothSurfaces
    >[0];
    expect(payloadSurfaces.water.length).toBeGreaterThan(10);
    expect(payloadSurfaces.parks.length).toBeGreaterThan(100);
    const group = createSmoothSurfaces(payloadSurfaces, -1.15, 4.2);
    // A transparent water plate over a sandy bed, plus smooth quay
    // walls and one continuous shoreline ink run.
    const water = group.getObjectByName("smooth water surface") as Mesh;
    expect(water).toBeInstanceOf(Mesh);
    expect((water.material as MeshBasicMaterial).transparent).toBe(true);
    expect(group.getObjectByName("smooth river bed")).toBeInstanceOf(Mesh);
    expect(group.getObjectByName("smooth parkland lawns")).toBeInstanceOf(Mesh);
    const walls = group.getObjectByName("smooth quay walls") as Mesh;
    expect(walls).toBeInstanceOf(Mesh);
    const shore = group.getObjectByName("smooth shoreline ink") as LineSegments;
    expect(shore).toBeInstanceOf(LineSegments);
    // The shoreline follows the polygon rings, so its segments are NOT
    // axis-aligned staircases: most have both dx and dz non-zero.
    const position = shore.geometry.getAttribute("position");
    let diagonal = 0;
    let segments = 0;
    for (let index = 0; index < position.count; index += 2) {
      const dx = Math.abs(position.getX(index) - position.getX(index + 1));
      const dz = Math.abs(position.getZ(index) - position.getZ(index + 1));
      segments += 1;
      if (dx > 0.15 && dz > 0.15) {
        diagonal += 1;
      }
    }
    expect(segments).toBeGreaterThan(200);
    expect(diagonal / segments).toBeGreaterThan(0.3);
    // The bank plate sits above the water plate: a real recessed river.
    const waterBounds = new Box3().setFromObject(water);
    const wallBounds = new Box3().setFromObject(walls);
    expect(wallBounds.max.y).toBeGreaterThan(waterBounds.max.y + 3);
    expect(wallBounds.min.y).toBeLessThan(waterBounds.max.y - 2);
  });
});

describe("isometric face shading", () => {
  test("faces step by facing direction without gradients", async () => {
    const { isoFaceShade, ISO_FACE_SHADE } = await import(
      "../src/IsometricCityWorld"
    );
    // Tops stay full; the two visible wall directions step down.
    expect(isoFaceShade(0, 1, 0)).toBe(ISO_FACE_SHADE.top);
    expect(isoFaceShade(1, 0, 0)).toBe(ISO_FACE_SHADE.east);
    expect(isoFaceShade(-1, 0, 0)).toBe(ISO_FACE_SHADE.west);
    expect(isoFaceShade(0, 0, 1)).toBe(ISO_FACE_SHADE.south);
    expect(isoFaceShade(0, 0, -1)).toBe(ISO_FACE_SHADE.north);
    // A real drawing convention: top brightest, all sides below it,
    // every step a constant (no interpolation between facings).
    const sides = [
      ISO_FACE_SHADE.east,
      ISO_FACE_SHADE.north,
      ISO_FACE_SHADE.south,
      ISO_FACE_SHADE.west,
    ];
    for (const side of sides) {
      expect(side).toBeLessThan(ISO_FACE_SHADE.top);
      // Compressed into the bright ivory register (v0.38.0): with the film
      // curve gone, a 0.795 west wall landed on a mid grey — the "alle
      // Gebäude … grau" report. Four distinct steps survive, all bright.
      expect(side).toBeGreaterThanOrEqual(0.86);
    }
    expect(new Set(sides).size).toBe(4);
  });

  test("no invented window panes remain — only real doors", () => {
    const city = createIsometricCity(payload, null);
    const panes = city.getObjectByName("LoD2 prism windows") as InstancedMesh;
    expect(panes).toBeInstanceOf(InstancedMesh);
    const matrices = panes.instanceMatrix.array as Float32Array;
    for (let index = 0; index < panes.count; index += 1) {
      // Every pane is a 2.35 m entrance door; nothing else is invented.
      expect(Math.abs(matrices[index * 16 + 5] - 2.35)).toBeLessThan(1e-3);
    }
    expect(panes.count).toBeGreaterThan(400);
    expect(panes.count).toBeLessThan(2_000);
  });
});
