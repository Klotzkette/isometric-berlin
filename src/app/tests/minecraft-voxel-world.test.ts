import { describe, expect, test } from "bun:test";

import { Box3, InstancedMesh, Matrix4, Vector3 } from "three";

import {
  HAMBURGER_BAHNHOF_VOXEL_FACADE,
  isCompleteRecognitionVoxelColumn,
  isFalseSintiRomaVoxelColumn,
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
  voxelRecognitionAreaAt,
} from "../src/MinecraftVoxelWorld";
import { isChancelleryExtensionConstructionPoint } from "../src/chancelleryExtensionProfile";
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
    const sampleCount = Math.min(2000, payload.buildings.length);
    const stride = Math.max(
      1,
      Math.floor(payload.buildings.length / sampleCount),
    );
    for (
      let index = 0;
      index < payload.buildings.length && taken < sampleCount;
    ) {
      const [xIdx, zIdx] = payload.buildings[index];
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
    // The task-10 expansion carries ~453k exposed faces on 133k surveyed
    // columns; interior faces are still skipped and the complete facade stays
    // in one instanced draw call.
    expect(mesh.count).toBeGreaterThan(150_000);
    expect(mesh.count).toBeLessThan(550_000);
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
    expect(instanced("Voxel ground runs", world).count).toBe(groundRuns);
    // Each column is a facade body plus (when tall enough) a darker
    // roof-cap layer.
    const columns = instanced("Voxel building columns", world).count;
    expect(columns).toBeGreaterThanOrEqual(payload.buildings.length);
    expect(columns).toBeLessThanOrEqual(payload.buildings.length * 2);
    const visibleTreeCount = payload.trees.filter(
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
    expect(payload.buildings.length).toBeGreaterThan(10_000);
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

    expect(skipped).toBeGreaterThan(500);
    // Cutting a diagonal course can split retained RLE runs, so instance count
    // alone is not a valid measure. The explicit cell counter is the contract.
    expect(cutGround.count).toBeGreaterThan(0);
    expect(fullGround.userData.skippedByWorldPredicateCells).toBe(0);

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
    const falseColumns = payload.buildings.filter(([xIdx, zIdx, y0dm, y1dm]) =>
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

  test("does not bury the complete Brandenburg Gate model inside a voxel wall", () => {
    const hiddenGateColumns = payload.buildings.filter(([xIdx, zIdx]) =>
      isCompleteRecognitionVoxelColumn(
        (xIdx + 0.5) * payload.cell_m,
        (zIdx + 0.5) * payload.cell_m,
      ),
    );
    expect(hiddenGateColumns).toHaveLength(24);

    const columns = instanced("Voxel building columns", world);
    const matrix = new Matrix4();
    const position = new Vector3();
    let remainingGateColumns = 0;
    for (let index = 0; index < columns.count; index += 1) {
      columns.getMatrixAt(index, matrix);
      position.setFromMatrixPosition(matrix);
      if (isCompleteRecognitionVoxelColumn(position.x, position.z)) {
        remainingGateColumns += 1;
      }
    }
    expect(remainingGateColumns).toBe(0);
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

  test("places tall Reichstag columns at the surveyed world position", () => {
    const buildings = instanced("Voxel building columns", world);
    const matrix = new Matrix4();
    const position = new Vector3();
    const scale = new Vector3();
    let tallReichstagColumns = 0;
    for (let index = 0; index < buildings.count; index += 1) {
      buildings.getMatrixAt(index, matrix);
      position.setFromMatrixPosition(matrix);
      scale.setFromMatrixScale(matrix);
      if (
        position.x >= 260 &&
        position.x <= 372 &&
        position.z >= -34 &&
        position.z <= 115 &&
        scale.y >= 24
      ) {
        tallReichstagColumns += 1;
      }
    }
    expect(tallReichstagColumns).toBeGreaterThan(300);
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
