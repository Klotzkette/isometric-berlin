import { describe, expect, test } from "bun:test";

import { InstancedMesh, Matrix4, Vector3 } from "three";

import {
  HUGO_PREUSS_OSM_DECK,
  SANDKRUG_OSM_DECK,
  isNorthernHumboldthafenReplacementCell,
} from "../src/HumboldthafenSources";
import { createMinecraftHumboldthafenDetails } from "../src/MinecraftHumboldthafen";
import type { VoxelPayload } from "../src/MinecraftVoxelWorld";
import { REAL_SPREE_VESSEL_PROFILES } from "../src/SpreeVesselProfiles";
import voxelPayloadJson from "../public/mesh/regierungsviertel/minecraft-voxels.json";

const payload = voxelPayloadJson as unknown as VoxelPayload;

describe("block-native Humboldthafen parity", () => {
  const details = createMinecraftHumboldthafenDetails(payload);
  const blocks = details.getObjectByName(
    "Minecraft source-bound Humboldthafen blocks",
  ) as InstancedMesh;

  test("uses one small instanced draw call with no exact transform doubles", () => {
    expect(blocks).toBeInstanceOf(InstancedMesh);
    expect(details.userData.drawCalls).toBe(1);
    expect(blocks.userData.drawCalls).toBe(1);
    expect(blocks.userData.approxInstanceTransferBytes).toBeLessThan(40_000);
    expect(blocks.count).toBeLessThan(500);
    const matrix = new Matrix4();
    const keys = new Set<string>();
    for (let index = 0; index < blocks.count; index += 1) {
      blocks.getMatrixAt(index, matrix);
      const key = matrix.elements.map((value) => value.toFixed(5)).join(",");
      expect(keys.has(key)).toBe(false);
      keys.add(key);
    }
    expect(blocks.userData.staticAntiFlicker).toBe(true);
  });

  test("replaces exactly the DGM cells suppressed from the base ground", () => {
    let replacementCells = 0;
    const cell = payload.cell_m;
    const { min_x_idx, min_z_idx } = payload.grid;
    payload.ground_rows.forEach((row, zOffset) => {
      for (const [xStart, run] of row) {
        for (let step = 0; step < run; step += 1) {
          const x = (min_x_idx + xStart + step + 0.5) * cell;
          const z = (min_z_idx + zOffset + 0.5) * cell;
          if (isNorthernHumboldthafenReplacementCell(x, z))
            replacementCells += 1;
        }
      }
    });
    expect(replacementCells).toBe(68);
    expect(blocks.userData.sourceRoles.bank).toBe(replacementCells);
    expect(details.userData.collisionSource).toContain("same predicate");
  });

  test("adds only bridge furniture over the existing source deck", () => {
    expect(blocks.userData.sourceRoles["bridge-rail"]).toBeGreaterThan(100);
    expect(blocks.userData.sourceRoles["bridge-deck"]).toBeUndefined();
    expect(details.userData.sources.bridges.hugoPreuss).toEqual(
      HUGO_PREUSS_OSM_DECK,
    );
    expect(details.userData.sources.bridges.sandkrug).toEqual(
      SANDKRUG_OSM_DECK,
    );
    expect(details.userData.sources.roads.rahelHirschStrasse.osmWay).toBe(
      4592633,
    );
    expect(details.userData.sources.settPaths).toContain("1087036421");
  });

  test("keeps both real-profile vessels static and recognisable as blocks", () => {
    expect(blocks.userData.sourceRoles.vessel).toBeGreaterThan(150);
    expect(details.userData.vessels).toEqual(
      REAL_SPREE_VESSEL_PROFILES.map((profile) => ({
        beamM: profile.beamM,
        draughtM: profile.draughtM,
        lengthM: profile.lengthM,
        name: profile.name,
        type: profile.type,
      })),
    );
    expect(details.getObjectByName("vessel wake ribbons")).toBeUndefined();
    expect(details.userData.staticAllModes).toBe(true);
  });

  test("keeps every instance finite and above a non-zero scale", () => {
    const matrix = new Matrix4();
    const position = new Vector3();
    const scale = new Vector3();
    const quaternion = blocks.quaternion.clone();
    for (let index = 0; index < blocks.count; index += 1) {
      blocks.getMatrixAt(index, matrix);
      matrix.decompose(position, quaternion, scale);
      expect(position.toArray().every(Number.isFinite)).toBe(true);
      expect(scale.x).toBeGreaterThan(0);
      expect(scale.y).toBeGreaterThan(0);
      expect(scale.z).toBeGreaterThan(0);
    }
  });
});
