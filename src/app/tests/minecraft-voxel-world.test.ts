import { describe, expect, test } from "bun:test";

import { Box3, InstancedMesh, Matrix4, Vector3 } from "three";

import {
  BUNDESTAG_SPREE_BRIDGE_VOXEL_CLEARING,
  HAMBURGER_BAHNHOF_VOXEL_FACADE,
  MINECRAFT_HERO_SOURCE_COURSE_MAX_M,
  isBundestagSpreeBridgeGroundCell,
  isFalseBundestagSpreeBridgeVoxelColumn,
  isFalseSintiRomaVoxelColumn,
  isMinecraftHeroSourceCourseAreaAt,
  SINTI_ROMA_VOXEL_CLEARING,
  type VoxelPayload,
  VOXEL_WINDOW_HEIGHT_M,
  VOXEL_WINDOW_WIDTH_M,
  createMinecraftBerlinModernRecognition,
  createMinecraftEinzEuropaplatzRecognition,
  createMinecraftFunboxRecognition,
  createMinecraftHamburgerBahnhofRecognition,
  createMinecraftUpbeatRecognition,
  createMinecraftVoxelWorld,
  decodeVoxelBuildingColumns,
  decodeVoxelTreeBlocks,
  minecraftBuildingLayerTones,
  voxelRecognitionAreaAt,
} from "../src/MinecraftVoxelWorld";
import { MINECRAFT_PALETTE } from "../src/visual-modes/minecraft/palette";
import { isChancelleryExtensionConstructionPoint } from "../src/chancelleryExtensionProfile";
import {
  MINECRAFT_ARCHITECTURAL_PROFILES,
  minecraftArchitecturalReplacementAt,
} from "../src/MinecraftArchitecturalLandmarks";
import scenePayload from "../public/mesh/regierungsviertel/scene.json";
import voxelPayload from "../public/mesh/regierungsviertel/minecraft-voxels.json";
import {
  BERLIN_MODERN_PROFILE,
  EUROPACITY_PROFILE,
  KOLLHOFF_TOWER_PROFILE,
  NORTHERN_CITY_PROFILE,
  RIECKHALLEN_PROFILE,
} from "../src/expandedCityProfiles";

const payload = voxelPayload as unknown as VoxelPayload;
const buildingColumns = decodeVoxelBuildingColumns(payload);
const treeBlocks = decodeVoxelTreeBlocks(payload);

const genericDetailFixture: VoxelPayload = {
  schema_version: 2,
  cell_m: 4,
  classes: ["grass", "concrete"],
  grid: { cols: 3, min_x_idx: 2_000, min_z_idx: 2_000, rows: 2 },
  ground_height: {
    cols: 3,
    rows: 2,
    stride_cells: 1,
    y_dm: [0, 0, 0, 0, 0, 0],
  },
  ground_rows: [
    [[0, 3, 0]],
    [[0, 3, 0]],
  ],
  building_rows: [[[0, 2, 0, 120, 1]], []],
  tree_rows: [[], []],
  water_top_y_m: -1.15,
};

function instanced(
  name: string,
  root: ReturnType<typeof createMinecraftVoxelWorld>,
) {
  const mesh = root.getObjectByName(name);
  expect(mesh).toBeInstanceOf(InstancedMesh);
  return mesh as InstancedMesh;
}

describe("true voxel Minecraft world", () => {
  const world = createMinecraftVoxelWorld(payload);
  const mobileWorld = createMinecraftVoxelWorld(payload, null, null, {
    detailProfile: "mobile",
  });

  test("keeps omitted and explicit full detail profiles byte-for-byte equivalent", () => {
    const implicit = createMinecraftVoxelWorld(genericDetailFixture);
    const explicit = createMinecraftVoxelWorld(
      genericDetailFixture,
      null,
      null,
      { detailProfile: "full" },
    );
    const contract = (root: typeof implicit) => {
      const meshes: Array<{
        capacity: number;
        count: number;
        matrix: number[];
        name: string;
      }> = [];
      root.traverse((child) => {
        if (!(child instanceof InstancedMesh)) return;
        const first = new Matrix4();
        if (child.count > 0) child.getMatrixAt(0, first);
        meshes.push({
          capacity: child.instanceMatrix.count,
          count: child.count,
          matrix: first.toArray(),
          name: child.name,
        });
      });
      return meshes;
    };
    expect(contract(explicit)).toEqual(contract(implicit));
    expect(instanced("Voxel building columns", implicit).count).toBe(6);
  });

  test("uses an explicit decoration-free mobile profile without touching hero batches", () => {
    expect(world.getObjectByName("Voxel facade windows")).toBeDefined();
    expect(world.getObjectByName("Voxel meadow flowers")).toBeDefined();
    expect(mobileWorld.getObjectByName("Voxel facade windows")).toBeUndefined();
    expect(mobileWorld.getObjectByName("Voxel meadow flowers")).toBeUndefined();
    expect(instanced("Voxel facade windows", world).count).toBe(1_594_973);
    expect(instanced("Voxel meadow flowers", world).count).toBe(39_616);
    expect(instanced("Voxel building columns", world).count).toBe(1_481_674);
    expect(instanced("Voxel building columns", mobileWorld).count).toBe(
      542_640,
    );

    const landmarks = world.getObjectByName(
      "Minecraft block-native architectural landmarks",
    );
    const mobileLandmarks = mobileWorld.getObjectByName(
      "Minecraft block-native architectural landmarks",
    );
    expect(
      mobileLandmarks?.children.map(({ name }) => [
        name,
        (mobileLandmarks.getObjectByName(name) as InstancedMesh).count,
      ]),
    ).toEqual(
      landmarks?.children.map(({ name }) => [
        name,
        (landmarks.getObjectByName(name) as InstancedMesh).count,
      ]),
    );
    const pariserPlatzName =
      "Minecraft Hotel Adlon and Starbucks block signature";
    const fullPariserPlatz = landmarks?.getObjectByName(pariserPlatzName);
    const mobilePariserPlatz =
      mobileLandmarks?.getObjectByName(pariserPlatzName);
    expect(fullPariserPlatz).toBeInstanceOf(InstancedMesh);
    expect(mobilePariserPlatz).toBeInstanceOf(InstancedMesh);
    expect((fullPariserPlatz as InstancedMesh).count).toBe(292);
    expect((mobilePariserPlatz as InstancedMesh).count).toBe(292);
    expect(fullPariserPlatz?.visible).toBe(true);
    expect(mobilePariserPlatz?.visible).toBe(true);
  });

  test("keeps mobile hero courses while collapsing generic layer stacks", () => {
    const heroCourseHeights = (root: typeof world): number[] => {
      const buildings = instanced("Voxel building columns", root);
      const matrix = new Matrix4();
      const position = new Vector3();
      const scale = new Vector3();
      const heights: number[] = [];
      for (let index = 0; index < buildings.count; index += 1) {
        buildings.getMatrixAt(index, matrix);
        position.setFromMatrixPosition(matrix);
        if (!isMinecraftHeroSourceCourseAreaAt(position.x, position.z)) {
          continue;
        }
        scale.setFromMatrixScale(matrix);
        heights.push(scale.y);
      }
      return heights;
    };
    const fullHeroCourses = heroCourseHeights(world);
    const mobileHeroCourses = heroCourseHeights(mobileWorld);
    expect(mobileHeroCourses).toEqual(fullHeroCourses);
    expect(mobileHeroCourses.length).toBeGreaterThan(2_000);
    expect(Math.max(...mobileHeroCourses)).toBeLessThanOrEqual(
      MINECRAFT_HERO_SOURCE_COURSE_MAX_M + 0.001,
    );

    const fullFixture = createMinecraftVoxelWorld(genericDetailFixture);
    const mobileFixture = createMinecraftVoxelWorld(
      genericDetailFixture,
      null,
      null,
      { detailProfile: "mobile" },
    );
    expect(instanced("Voxel building columns", fullFixture).count).toBe(6);
    const mobileColumns = instanced("Voxel building columns", mobileFixture);
    expect(mobileColumns.count).toBe(2);
    const matrix = new Matrix4();
    const scale = new Vector3();
    for (let index = 0; index < mobileColumns.count; index += 1) {
      mobileColumns.getMatrixAt(index, matrix);
      scale.setFromMatrixScale(matrix);
      expect(scale.y).toBeCloseTo(12, 6);
    }
  });

  test("ships the civic hero buildings as seven block-native batches", () => {
    const landmarks = world.getObjectByName(
      "Minecraft block-native architectural landmarks",
    );
    expect(landmarks).toBeDefined();
    expect(landmarks?.children.map(({ name }) => name)).toEqual([
      "Minecraft Reichstag block signature",
      "Minecraft Federal Chancellery block signature",
      "Minecraft Berlin Hauptbahnhof block signature",
      "Minecraft Brandenburg Gate block signature",
      "Minecraft parliamentary band block signature",
      "Minecraft Berliner Ensemble block signature",
      "Minecraft Hotel Adlon and Starbucks block signature",
    ]);
    expect(landmarks?.children.every((child) => child instanceof InstancedMesh)).toBe(
      true,
    );
    expect(landmarks?.userData.drawCallBudget).toBe(7);
  });

  test("suppresses generic windows only on the authored Adlon and Starbucks fronts", () => {
    const adlon = MINECRAFT_ARCHITECTURAL_PROFILES.hotelAdlon;
    expect(
      voxelRecognitionAreaAt(
        adlon.front.centerWorldM[0],
        adlon.front.centerWorldM[1],
      )?.name,
    ).toBe("Hotel Adlon authored north facade");
    // Deep inside the retained southern hotel block, generic source mass and
    // its ordinary facade treatment remain untouched.
    expect(voxelRecognitionAreaAt(590, 405)).toBeNull();

    const starbucks =
      MINECRAFT_ARCHITECTURAL_PROFILES.starbucksPariserPlatz;
    for (const facade of Object.values(starbucks.facades)) {
      const middleX =
        facade.sourceStartWorldM[0] +
        facade.directionWorld[0] * facade.storefrontLengthM * 0.5;
      const middleZ =
        facade.sourceStartWorldM[1] +
        facade.directionWorld[1] * facade.storefrontLengthM * 0.5;
      expect(voxelRecognitionAreaAt(middleX, middleZ)?.name).toBe(
        `Starbucks authored ${facade.key} facade`,
      );
    }
    // K00005Hq's office envelope away from the tenant L keeps its source
    // windows and never becomes a broad Starbucks replacement box.
    expect(voxelRecognitionAreaAt(580, 230)).toBeNull();
  });

  test("loads the static Invalidenfriedhof block details only with the voxel world", () => {
    const details = world.getObjectByName(
      "Minecraft Invalidenfriedhof block-native details",
    );
    expect(details).toBeDefined();
    expect(details?.parent).toBe(world);
    expect(details?.userData).toMatchObject({
      blockNative: true,
      motionPolicy: "static in Minecraft",
      sourceFootprintOwnership: [
        "litfin-watchtower",
        "auguste-viktoria-bell",
      ],
    });
    expect(details?.children.every((child) => child instanceof InstancedMesh)).toBe(
      true,
    );
    expect(details?.userData.drawCallCount).toBeLessThanOrEqual(10);
    expect(details?.userData.instanceCount).toBeGreaterThan(250);
    expect(details?.userData.instanceCount).toBeLessThanOrEqual(2_500);
  });

  test("keeps both literary memorials as one block-native batch in full and mobile", () => {
    const name = "Tiergarten literary memorials Minecraft block batch";
    const full = instanced(name, world);
    const mobile = instanced(name, mobileWorld);
    expect(full.count).toBe(557);
    expect(mobile.count).toBe(full.count);
    expect(full.userData).toMatchObject({
      blockNative: true,
      exactOneBatch: true,
      lessingFenceOutline: "chamfered-octagon",
      smoothGeometryExcluded: true,
      textureFree: true,
    });
    expect(mobile.userData).toEqual(full.userData);
  });

  test("uses only palette-native plinth and cap blocks", () => {
    const master = new Set<number>(MINECRAFT_PALETTE);
    for (const materialClass of ["clinker", "concrete", "glass"] as const) {
      const layers = minecraftBuildingLayerTones(materialClass);
      expect(master.has(layers.plinth)).toBe(true);
      expect(master.has(layers.cap)).toBe(true);
    }
    expect(minecraftBuildingLayerTones("glass")).not.toEqual(
      minecraftBuildingLayerTones("clinker"),
    );
  });

  test("columns take their building's real colour, snapped to the palette", async () => {
    const { buildColumnToneLookup } =
      await import("../src/MinecraftVoxelWorld");
    const { MINECRAFT_PALETTE } =
      await import("../src/visual-modes/minecraft/palette");
    const prisms =
      (await import("../public/mesh/regierungsviertel/lod2-prisms.json")) as {
        default: {
          buildings: Array<{
            ring: number[][];
            tone?: [number, number, number];
          }>;
        };
      };
    const lookup = buildColumnToneLookup(prisms.default);
    // Inside the Reichstag footprint (centre ~308, 41) the lookup
    // returns a palette colour; far out in the Spree it returns null.
    const reichstag = lookup(308, 41);
    expect(reichstag).toBe(0xd4d4b7);
    expect(MINECRAFT_PALETTE.includes(reichstag as never)).toBe(true);
    // The Chancellery is white concrete, so its near-neutral sample must
    // snap to the pale COOL entry, never to a warm sandstone cream — plain
    // RGB distance used to pick the cream and rendered it khaki-yellow.
    expect(lookup(-154, -146)).toBe(0xd6dfe0);
    expect(lookup(240.095, 1082.464)).toBe(
      KOLLHOFF_TOWER_PROFILE.minecraftClinkerTone,
    );
    expect(KOLLHOFF_TOWER_PROFILE.facadeMaterial).toBe("red-ceramic-cladding");
    expect(lookup(-5000, -5000)).toBeNull();
    // Coverage, sampled across the whole area rather than the first rows.
    // The overview raster the tones come from is pinned to the pre-expansion
    // polygon, so columns in the areas added by the bounds expansion stay
    // untoned by design and fall back to palette shading.
    let hits = 0;
    let taken = 0;
    const sampleCount = Math.min(2000, buildingColumns.length);
    const stride = Math.max(
      1,
      Math.floor(buildingColumns.length / sampleCount),
    );
    for (
      let index = 0;
      index < buildingColumns.length && taken < sampleCount;
    ) {
      const [xIdx, zIdx] = buildingColumns[index];
      const x = (xIdx + 0.5) * payload.cell_m;
      const z = (zIdx + 0.5) * payload.cell_m;
      if (lookup(x, z) !== null) {
        hits += 1;
      }
      taken += 1;
      index += stride;
    }
    expect(hits / taken).toBeGreaterThan(0.4);
  });

  test("exterior column faces carry blocky window panes", async () => {
    const { InstancedMesh } = await import("three");
    const panes = world.getObjectByName("Voxel facade windows");
    expect(panes).toBeInstanceOf(InstancedMesh);
    const mesh = panes as InstanceType<typeof InstancedMesh>;
    // The exact task-13 extent plus the non-overlapping OSM building sidecar
    // carries about 1.6 million exposed window faces on 533k columns;
    // interior faces are still skipped and the complete facade stays in one
    // instanced draw call.
    expect(mesh.count).toBeGreaterThan(1_450_000);
    expect(mesh.count).toBeLessThan(1_750_000);
    const matrix = new Matrix4();
    const scale = new Vector3();
    const position = new Vector3();
    let recognitionWindows = 0;
    for (let index = 0; index < mesh.count; index += 1) {
      mesh.getMatrixAt(index, matrix);
      position.setFromMatrixPosition(matrix);
      if (voxelRecognitionAreaAt(position.x, position.z)) {
        recognitionWindows += 1;
      }
      if (index % 97 === 0) {
        scale.setFromMatrixScale(matrix);
        expect(scale.x).toBeCloseTo(VOXEL_WINDOW_WIDTH_M, 5);
        expect(scale.y).toBeCloseTo(VOXEL_WINDOW_HEIGHT_M, 5);
        expect(scale.y / scale.x).toBeGreaterThan(1.7);
      }
    }
    expect(recognitionWindows).toBe(0);
  });

  test("builds one instanced box set per layer with full counts", () => {
    const groundRuns = payload.ground_rows.reduce(
      (sum, row) => sum + row.length,
      0,
    );
    // One 11-cell generic bridge run yields to the two source-sized
    // Bundestag footbridges; every other block-ground run stays intact.
    expect(instanced("Voxel ground runs", world).count).toBe(groundRuns - 1);
    // Ordinary columns are a facade body plus palette-native plinth and
    // roof-cap. Retained civic heroes add a few vertical block courses.
    const columns = instanced("Voxel building columns", world).count;
    expect(columns).toBeGreaterThanOrEqual(buildingColumns.length);
    expect(columns).toBeLessThanOrEqual(buildingColumns.length * 4);
    const visibleTreeCount = treeBlocks.filter(
      ([xIdx, zIdx]) =>
        !isChancelleryExtensionConstructionPoint(
          (xIdx + 0.5) * payload.cell_m,
          (zIdx + 0.5) * payload.cell_m,
        ),
    ).length;
    expect(instanced("Voxel tree trunks", world).count).toBe(visibleTreeCount);
    // Crowns: one per tree plus a stacked spruce top on some species.
    const crowns = instanced("Voxel tree crowns", world).count;
    expect(crowns).toBeGreaterThanOrEqual(visibleTreeCount);
    expect(crowns).toBeLessThanOrEqual(visibleTreeCount * 2);
    // Blocky by construction: thousands of surveyed building columns.
    expect(buildingColumns.length).toBeGreaterThan(10_000);
  });

  test("keeps both portal approaches open in a direct Minecraft load", () => {
    const tunnelWorld = createMinecraftVoxelWorld(
      payload,
      null,
      scenePayload.tiergartentunnel,
    );
    const fullGround = instanced("Voxel ground runs", world);
    const cutGround = instanced("Voxel ground runs", tunnelWorld);
    const skipped = cutGround.userData.skippedByWorldPredicateCells as number;
    const harbourReplacementCells = fullGround.userData
      .skippedByWorldPredicateCells as number;

    expect(skipped).toBeGreaterThan(500);
    // Cutting a diagonal course can split retained RLE runs, so instance count
    // alone is not a valid measure. The explicit cell counter is the contract.
    expect(cutGround.count).toBeGreaterThan(0);
    // The direct world deliberately removes exactly the north-bank cells
    // rebuilt by its block-native Schrägufer detail. The tunnel adds its two
    // portal cuts to that same counter; neither layer is a dirty double.
    expect(harbourReplacementCells).toBe(68);
    expect(skipped).toBeGreaterThan(harbourReplacementCells);
    expect(fullGround.userData.skippedBridgeCells).toBe(11);
    expect(isBundestagSpreeBridgeGroundCell(342, -186)).toBe(true);
    expect(isBundestagSpreeBridgeGroundCell(342, -178)).toBe(false);

    const fullTrees = instanced("Voxel tree trunks", world).count;
    const cutTrees = instanced("Voxel tree trunks", tunnelWorld).count;
    expect(cutTrees).toBeLessThan(fullTrees);
  });

  test("keeps KPMG and its current north forecourt recognisable in blocks", () => {
    const recognition = createMinecraftEinzEuropaplatzRecognition();
    const profile = recognition.userData.architecturalProfile as {
      campus: typeof EUROPACITY_PROFILE.lehrterCampus;
      plaza: typeof EUROPACITY_PROFILE.europaplatzNorth;
      tower: typeof EUROPACITY_PROFILE.einz;
    };
    expect(recognition.count).toBeGreaterThan(200);
    expect(profile.tower.facadeGridM).toBe(1.35);
    expect(profile.plaza.currentState).toContain("temporary 2026");
    expect(profile.campus.currentState).toContain(
      "ground-floor concrete frame",
    );
    expect(profile.campus.currentSlabTopM).toBeLessThan(
      profile.campus.plannedEnvelopeHeightM,
    );
    expect(recognition.userData.sourceRole).toContain("Lehrter-Campus");
    expect(
      world.getObjectByName("Voxel KPMG and Europaplatz Nord"),
    ).toBeDefined();
    expect(
      voxelRecognitionAreaAt(
        EUROPACITY_PROFILE.einz.centerWorldM[0],
        EUROPACITY_PROFILE.einz.centerWorldM[1],
      )?.name,
    ).toBe("KPMG Europacity");
  });

  test("does not bury the Sinti and Roma memorial under false building columns", () => {
    const falseColumns = buildingColumns.filter(([xIdx, zIdx, y0dm, y1dm]) =>
      isFalseSintiRomaVoxelColumn(
        (xIdx + 0.5) * payload.cell_m,
        (zIdx + 0.5) * payload.cell_m,
        (y1dm - y0dm) / 10,
      ),
    );
    expect(falseColumns).toHaveLength(86);
    expect(
      isFalseSintiRomaVoxelColumn(
        SINTI_ROMA_VOXEL_CLEARING.center[0],
        SINTI_ROMA_VOXEL_CLEARING.center[1],
        12,
      ),
    ).toBe(false);

    const columns = instanced("Voxel building columns", world);
    const matrix = new Matrix4();
    const position = new Vector3();
    const scale = new Vector3();
    let remainingFalseColumns = 0;
    for (let index = 0; index < columns.count; index += 1) {
      columns.getMatrixAt(index, matrix);
      position.setFromMatrixPosition(matrix);
      scale.setFromMatrixScale(matrix);
      if (isFalseSintiRomaVoxelColumn(position.x, position.z, scale.y)) {
        remainingFalseColumns += 1;
      }
    }
    expect(remainingFalseColumns).toBe(0);
  });

  test("clears the tall LoD2 wall from the Bundestag's open Spree bridges", () => {
    const falseBridgeColumns = buildingColumns.filter(
      ([xIdx, zIdx, y0dm, y1dm]) =>
        isFalseBundestagSpreeBridgeVoxelColumn(
          (xIdx + 0.5) * payload.cell_m,
          (zIdx + 0.5) * payload.cell_m,
          (y1dm - y0dm) / 10,
        ),
    );
    expect(falseBridgeColumns).toHaveLength(16);
    expect(BUNDESTAG_SPREE_BRIDGE_VOXEL_CLEARING.sourceBuildingId).toBe(
      "DEBE01YYK0001zDa",
    );
    expect(isFalseBundestagSpreeBridgeVoxelColumn(342, -182, 10)).toBe(false);
    expect(isFalseBundestagSpreeBridgeVoxelColumn(400, -182, 28)).toBe(false);
    // Adjacent 32 m connector buildings sit outside the 62.6 m LoD2 bridge
    // footprint and must survive the opening correction.
    expect(isFalseBundestagSpreeBridgeVoxelColumn(310, -182, 32)).toBe(false);
    expect(isFalseBundestagSpreeBridgeVoxelColumn(378, -182, 32)).toBe(false);
    expect(isFalseBundestagSpreeBridgeVoxelColumn(314, -182, 28)).toBe(true);
    expect(isFalseBundestagSpreeBridgeVoxelColumn(374, -182, 28)).toBe(true);

    const columns = instanced("Voxel building columns", world);
    const matrix = new Matrix4();
    const position = new Vector3();
    const scale = new Vector3();
    let remainingFalseBridgeColumns = 0;
    for (let index = 0; index < columns.count; index += 1) {
      columns.getMatrixAt(index, matrix);
      position.setFromMatrixPosition(matrix);
      scale.setFromMatrixScale(matrix);
      if (
        isFalseBundestagSpreeBridgeVoxelColumn(
          position.x,
          position.z,
          scale.y,
        )
      ) {
        remainingFalseBridgeColumns += 1;
      }
    }
    expect(remainingFalseBridgeColumns).toBe(0);
  });

  test("does not bury complete civic block models inside their source mass", () => {
    const hiddenByOwner = new Map<string, number>();
    const uniqueCellsByOwner = new Map<string, Set<string>>();
    for (const [xIdx, zIdx] of buildingColumns) {
      const owner = minecraftArchitecturalReplacementAt(
        (xIdx + 0.5) * payload.cell_m,
        (zIdx + 0.5) * payload.cell_m,
      );
      if (!owner) continue;
      hiddenByOwner.set(owner, (hiddenByOwner.get(owner) ?? 0) + 1);
      const cells = uniqueCellsByOwner.get(owner) ?? new Set<string>();
      cells.add(`${xIdx}:${zIdx}`);
      uniqueCellsByOwner.set(owner, cells);
    }
    expect(Object.fromEntries(hiddenByOwner)).toEqual({
      "auguste-viktoria-bell": 1,
      "berlin-hauptbahnhof": 1_284,
      "brandenburg-gate": 52,
      "chancellery-leadership-cube": 188,
      "melh-library-rotunda": 85,
      "melh-widening-stair": 40,
      "paul-loebe-rotunda": 149,
      "reichstag-west-portico": 12,
    });
    expect(
      Object.fromEntries(
        [...uniqueCellsByOwner].map(([owner, cells]) => [owner, cells.size]),
      ),
    ).toEqual({
      "auguste-viktoria-bell": 1,
      "berlin-hauptbahnhof": 1_235,
      "brandenburg-gate": 46,
      "chancellery-leadership-cube": 188,
      "melh-library-rotunda": 85,
      "melh-widening-stair": 40,
      "paul-loebe-rotunda": 149,
      "reichstag-west-portico": 12,
    });

    const columns = instanced("Voxel building columns", world);
    const matrix = new Matrix4();
    const position = new Vector3();
    const remainingByOwner = new Map<string, number>();
    for (let index = 0; index < columns.count; index += 1) {
      columns.getMatrixAt(index, matrix);
      position.setFromMatrixPosition(matrix);
      const owner = minecraftArchitecturalReplacementAt(position.x, position.z);
      if (!owner) continue;
      remainingByOwner.set(owner, (remainingByOwner.get(owner) ?? 0) + 1);
    }
    expect(remainingByOwner.size).toBe(0);
  });

  test("gives Hamburger Bahnhof its own stepped historical front", () => {
    const facade = createMinecraftHamburgerBahnhofRecognition();
    expect(facade.count).toBeGreaterThan(250);
    expect(facade.userData.architecturalProfile).toEqual({
      lowerHallArches: 2,
      roofForm: "flat-cornice",
      towerHeightM: 26,
      upperArcades: 6,
    });
    expect(
      voxelRecognitionAreaAt(...HAMBURGER_BAHNHOF_VOXEL_FACADE.center)?.name,
    ).toBe("Hamburger Bahnhof");
    expect(
      world.getObjectByName("Voxel Hamburger Bahnhof recognition facade"),
    ).toBeDefined();

    const matrix = new Matrix4();
    const position = new Vector3();
    let highest = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < facade.count; index += 1) {
      facade.getMatrixAt(index, matrix);
      position.setFromMatrixPosition(matrix);
      highest = Math.max(highest, position.y);
    }
    expect(highest).toBeGreaterThanOrEqual(
      HAMBURGER_BAHNHOF_VOXEL_FACADE.groundY + 25,
    );
  });

  test("keeps the Rieckhallen voxel roof flat instead of alternating peaks", () => {
    expect(
      voxelRecognitionAreaAt(...RIECKHALLEN_PROFILE.centerWorldM)?.name,
    ).toBe("Rieckhallen");
    const buildings = instanced("Voxel building columns", world);
    const matrix = new Matrix4();
    const position = new Vector3();
    const scale = new Vector3();
    const roofTops: number[] = [];
    for (let index = 0; index < buildings.count; index += 1) {
      buildings.getMatrixAt(index, matrix);
      position.setFromMatrixPosition(matrix);
      scale.setFromMatrixScale(matrix);
      if (
        scale.y <= 1.01 &&
        position.y + scale.y / 2 >
          RIECKHALLEN_PROFILE.minecraftRoofTopY - 0.1 &&
        voxelRecognitionAreaAt(position.x, position.z)?.name === "Rieckhallen"
      ) {
        roofTops.push(position.y + scale.y / 2);
      }
    }
    expect(roofTops.length).toBeGreaterThan(250);
    expect(Math.min(...roofTops)).toBeCloseTo(
      RIECKHALLEN_PROFILE.minecraftRoofTopY,
      5,
    );
    expect(Math.max(...roofTops)).toBeCloseTo(
      RIECKHALLEN_PROFILE.minecraftRoofTopY,
      5,
    );
  });

  test("keeps berlin modern present as a block-native planning envelope", () => {
    const museum = createMinecraftBerlinModernRecognition();
    expect(museum.count).toBeGreaterThan(1_000);
    expect(museum.userData.architecturalProfile).toEqual(BERLIN_MODERN_PROFILE);
    expect(
      voxelRecognitionAreaAt(...BERLIN_MODERN_PROFILE.centerWorldM)?.name,
    ).toBe("berlin modern");
    expect(
      world.getObjectByName("Voxel berlin modern planning envelope"),
    ).toBeDefined();

    const matrix = new Matrix4();
    const position = new Vector3();
    const scale = new Vector3();
    let minBottom = Number.POSITIVE_INFINITY;
    let maxTop = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < museum.count; index += 1) {
      museum.getMatrixAt(index, matrix);
      position.setFromMatrixPosition(matrix);
      scale.setFromMatrixScale(matrix);
      minBottom = Math.min(minBottom, position.y - scale.y / 2);
      maxTop = Math.max(maxTop, position.y + scale.y / 2);
    }
    expect(minBottom).toBeCloseTo(BERLIN_MODERN_PROFILE.groundY, 5);
    expect(maxTop).toBeGreaterThan(
      BERLIN_MODERN_PROFILE.groundY + BERLIN_MODERN_PROFILE.totalHeightM - 0.5,
    );
    expect(maxTop).toBeLessThanOrEqual(
      BERLIN_MODERN_PROFILE.groundY + BERLIN_MODERN_PROFILE.totalHeightM,
    );
  });

  test("keeps Upbeat present as a block-native Europacity volume", () => {
    const upbeat = createMinecraftUpbeatRecognition();
    expect(upbeat.count).toBeGreaterThan(400);
    expect(upbeat.userData.architecturalProfile).toEqual(
      EUROPACITY_PROFILE.upbeat,
    );
    expect(world.getObjectByName("Voxel Upbeat Europacity")).toBeDefined();
    const bounds = new Box3().setFromObject(upbeat);
    expect(bounds.min.x).toBeGreaterThan(-725);
    expect(bounds.max.x).toBeLessThan(-618);
    expect(bounds.min.z).toBeGreaterThan(-2018);
    expect(bounds.max.z).toBeLessThan(-1937);
    expect(bounds.min.y).toBeCloseTo(EUROPACITY_PROFILE.upbeat.groundY, 5);
    expect(bounds.max.y).toBeCloseTo(
      EUROPACITY_PROFILE.upbeat.groundY +
        EUROPACITY_PROFILE.upbeat.tierTopHeightsM[2],
      5,
    );
  });

  test("keeps FUNBOX present as a block-native temporary event", () => {
    const funbox = createMinecraftFunboxRecognition();
    const profile = NORTHERN_CITY_PROFILE.funbox;
    expect(funbox.count).toBeGreaterThan(50);
    expect(funbox.userData.architecturalProfile).toEqual(profile);
    expect(funbox.userData.sourceRole).toBe("temporary-event-presentation");
    expect(world.getObjectByName("Voxel FUNBOX event park")).toBeDefined();
    const bounds = new Box3().setFromObject(funbox);
    expect(bounds.min.y).toBeCloseTo(profile.groundY, 5);
    expect(bounds.max.y).toBeGreaterThan(profile.groundY + 8);
    expect(bounds.max.y).toBeLessThanOrEqual(profile.groundY + 9);
    expect(bounds.max.x - bounds.min.x).toBeGreaterThan(60);
    expect(bounds.max.z - bounds.min.z).toBeGreaterThan(90);
  });

  test("builds retained civic hero masses from visible vertical block courses", () => {
    const buildings = instanced("Voxel building columns", world);
    const matrix = new Matrix4();
    const position = new Vector3();
    const scale = new Vector3();
    let heroCourses = 0;
    let reichstagCourses = 0;
    for (let index = 0; index < buildings.count; index += 1) {
      buildings.getMatrixAt(index, matrix);
      position.setFromMatrixPosition(matrix);
      scale.setFromMatrixScale(matrix);
      if (!isMinecraftHeroSourceCourseAreaAt(position.x, position.z)) continue;
      heroCourses += 1;
      expect(scale.y).toBeLessThanOrEqual(
        MINECRAFT_HERO_SOURCE_COURSE_MAX_M + 0.001,
      );
      if (voxelRecognitionAreaAt(position.x, position.z)?.name === "Reichstag") {
        reichstagCourses += 1;
      }
    }
    expect(heroCourses).toBeGreaterThan(2_000);
    expect(reichstagCourses).toBeGreaterThan(1_000);
  });

  test("clips only the coarse Berliner Ensemble roof cell and retains its body", () => {
    const buildings = instanced("Voxel building columns", world);
    const matrix = new Matrix4();
    const position = new Vector3();
    const scale = new Vector3();
    const spansAt = (x: number, z: number): Array<[number, number]> => {
      const spans: Array<[number, number]> = [];
      for (let index = 0; index < buildings.count; index += 1) {
        buildings.getMatrixAt(index, matrix);
        position.setFromMatrixPosition(matrix);
        if (
          Math.abs(position.x - x) > 1e-5 ||
          Math.abs(position.z - z) > 1e-5
        ) {
          continue;
        }
        scale.setFromMatrixScale(matrix);
        spans.push([
          position.y - scale.y / 2,
          position.y + scale.y / 2,
        ]);
      }
      return spans.sort(([a], [b]) => a - b);
    };

    const clipped = spansAt(1006, -326);
    expect(clipped).toHaveLength(3);
    expect(clipped[0][0]).toBeCloseTo(4.2, 6);
    expect(Math.max(...clipped.map(([, top]) => top))).toBeCloseTo(
      MINECRAFT_ARCHITECTURAL_PROFILES.berlinerEnsemble.blockLoD
        .roofStageBaseY,
      5,
    );
    for (let index = 1; index < clipped.length; index += 1) {
      expect(clipped[index][0]).toBeLessThanOrEqual(clipped[index - 1][1] + 1e-6);
    }

    const outside = spansAt(998, -334);
    expect(Math.max(...outside.map(([, top]) => top))).toBeCloseTo(28.1, 6);
  });

  test("keeps every column inside the payload grid in world metres", () => {
    const cell = payload.cell_m;
    const minX = payload.grid.min_x_idx * cell;
    const maxX = (payload.grid.min_x_idx + payload.grid.cols) * cell;
    const minZ = payload.grid.min_z_idx * cell;
    const maxZ = (payload.grid.min_z_idx + payload.grid.rows) * cell;
    const buildings = instanced("Voxel building columns", world);
    const matrix = new Matrix4();
    const position = new Vector3();
    for (let index = 0; index < buildings.count; index += 1) {
      buildings.getMatrixAt(index, matrix);
      position.setFromMatrixPosition(matrix);
      expect(position.x).toBeGreaterThanOrEqual(minX);
      expect(position.x).toBeLessThanOrEqual(maxX);
      expect(position.z).toBeGreaterThanOrEqual(minZ);
      expect(position.z).toBeLessThanOrEqual(maxZ);
    }
  });

  test("fills the complete versioned radius with an explicit extrapolated surround", async () => {
    const { VISIBLE_RADIUS_M, extrapolatedEnvelopeBounds } =
      await import("../src/worldEnvelope");
    const surround = world.getObjectByName(
      "Minecraft extrapolated radius surround",
    );
    expect(surround).toBeDefined();
    expect(surround?.userData.extrapolated).toBe(true);
    expect(surround?.userData.visibleRadiusM).toBe(VISIBLE_RADIUS_M);

    const envelope = extrapolatedEnvelopeBounds();
    const bounds = new Box3().setFromObject(surround!);
    expect(bounds.min.x).toBeLessThanOrEqual(envelope.minX);
    expect(bounds.max.x).toBeGreaterThanOrEqual(envelope.maxX);
    expect(bounds.min.z).toBeLessThanOrEqual(envelope.minZ);
    expect(bounds.max.z).toBeGreaterThanOrEqual(envelope.maxZ);

    // The generated west-park trees and lamps are gone since task-09 fetched
    // the real Tiergarten; only the Siegessäule model remains, because LoD2
    // carries just its 25 m socle.
    expect(
      world.getObjectByName("Voxel extrapolated tree trunks"),
    ).toBeUndefined();
    expect(
      world.getObjectByName("Voxel extrapolated lamp poles"),
    ).toBeUndefined();
    expect(
      instanced("Voxel extrapolated Siegessäule", world).count,
    ).toBeGreaterThan(5);
  });
});
