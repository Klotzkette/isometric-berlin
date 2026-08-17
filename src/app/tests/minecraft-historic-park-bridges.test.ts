import { describe, expect, test } from "bun:test";
import { InstancedMesh, Matrix4, Vector3 } from "three";

import { ADLER_BRIDGE_PROFILE } from "../src/AdlerBridge";
import { LOEWEN_BRIDGE_PROFILE } from "../src/LoewenBridge";
import {
  MINECRAFT_ADLER_BRIDGE_PROFILE,
  MINECRAFT_LOEWEN_BRIDGE_PROFILE,
  createMinecraftHistoricParkBridges,
} from "../src/MinecraftHistoricParkBridges";

describe("block-native historic Tiergarten bridges", () => {
  test("shares the exact OSM centres and bearings with the smooth models", () => {
    expect(MINECRAFT_ADLER_BRIDGE_PROFILE).toMatchObject({
      centreWorldM: ADLER_BRIDGE_PROFILE.centreWorldM,
      name: ADLER_BRIDGE_PROFILE.name,
      sourceWayId: ADLER_BRIDGE_PROFILE.osmWayId,
    });
    expect(MINECRAFT_ADLER_BRIDGE_PROFILE.axis[0]).toBeCloseTo(
      ADLER_BRIDGE_PROFILE.axis[0],
      5,
    );
    expect(MINECRAFT_ADLER_BRIDGE_PROFILE.axis[1]).toBeCloseTo(
      ADLER_BRIDGE_PROFILE.axis[1],
      5,
    );
    expect(MINECRAFT_LOEWEN_BRIDGE_PROFILE).toMatchObject({
      centreWorldM: LOEWEN_BRIDGE_PROFILE.world,
      name: LOEWEN_BRIDGE_PROFILE.name,
      sourceWayId: LOEWEN_BRIDGE_PROFILE.osmWayId,
    });
    expect(MINECRAFT_LOEWEN_BRIDGE_PROFILE.axis).toEqual(
      LOEWEN_BRIDGE_PROFILE.axis,
    );
  });

  test("keeps both silhouettes in one small instanced draw call", () => {
    const bridges = createMinecraftHistoricParkBridges(() => 5.2);
    expect(bridges.children).toHaveLength(1);
    const blocks = bridges.children[0] as InstancedMesh;
    expect(blocks).toBeInstanceOf(InstancedMesh);
    expect(blocks.count).toBeGreaterThan(170);
    expect(blocks.count).toBeLessThan(260);
    expect(blocks.userData).toMatchObject({
      adlerBridgeOsmWayId: ADLER_BRIDGE_PROFILE.osmWayId,
      blockCount: blocks.count,
      loewenBridgeOsmWayId: LOEWEN_BRIDGE_PROFILE.osmWayId,
    });

    const matrix = new Matrix4();
    const position = new Vector3();
    let adlerBlocks = 0;
    let loewenBlocks = 0;
    for (let index = 0; index < blocks.count; index += 1) {
      blocks.getMatrixAt(index, matrix);
      position.setFromMatrixPosition(matrix);
      if (
        Math.hypot(
          position.x - ADLER_BRIDGE_PROFILE.centreWorldM[0],
          position.z - ADLER_BRIDGE_PROFILE.centreWorldM[1],
        ) < 8
      ) {
        adlerBlocks += 1;
      }
      if (
        Math.hypot(
          position.x - LOEWEN_BRIDGE_PROFILE.world[0],
          position.z - LOEWEN_BRIDGE_PROFILE.world[1],
        ) < 14
      ) {
        loewenBlocks += 1;
      }
    }
    expect(adlerBlocks).toBeGreaterThan(60);
    expect(loewenBlocks).toBeGreaterThan(100);
  });
});
