import { describe, expect, test } from "bun:test";
import {
  Box3,
  Group,
  InstancedMesh,
  LineSegments,
  Material,
  Mesh,
  MeshStandardMaterial,
  Texture,
  Vector3,
} from "three";

import {
  WEIDENDAMMER_BRIDGE_EAGLE_COUNT,
  WEIDENDAMMER_BRIDGE_AUTHORED_FEATHER_CUES,
  WEIDENDAMMER_BRIDGE_FOCUS_CAMERA,
  WEIDENDAMMER_BRIDGE_INK_LAYER_NAME,
  WEIDENDAMMER_BRIDGE_LAMP_STANDARD_COUNT,
  WEIDENDAMMER_BRIDGE_LAMP_LAYER_NAME,
  WEIDENDAMMER_BRIDGE_LOVE_LOCK_COUNT,
  WEIDENDAMMER_BRIDGE_LOVE_LOCK_LAYER_NAME,
  WEIDENDAMMER_BRIDGE_MARKER_WORLD,
  WEIDENDAMMER_BRIDGE_MARKER_Y,
  WEIDENDAMMER_BRIDGE_MINECRAFT_ROOT_NAME,
  WEIDENDAMMER_BRIDGE_PROFILE,
  WEIDENDAMMER_BRIDGE_RAILING_SYSTEM_COUNT,
  WEIDENDAMMER_BRIDGE_REPEATING_RAIL_FIELD_COUNT,
  WEIDENDAMMER_BRIDGE_SMOOTH_ROOT_NAME,
  WEIDENDAMMER_BRIDGE_SNOW_LAYER_NAME,
  WEIDENDAMMER_BRIDGE_STRUCTURAL_LAYER_NAME,
  WEIDENDAMMER_BRIDGE_SUPPORT_LAYOUT,
  createWeidendammerBridgeDetails,
  createWeidendammerBridgeMinecraft,
  setWeidendammerBridgePresentation,
  weidendammerBridgeRenderStats,
  weidendammerBridgePlanContains,
  weidendammerBridgeSolidAt,
  weidendammerBridgeWorldEnvelope,
} from "../src/WeidendammerBridgeDetails";
import {
  nextDetailFadeVisible,
  readDetailFadeRangeM,
} from "../src/fineDetailFade";
import {
  applyMaterialLighting,
  applySignatureLightingPresentation,
} from "../src/ThreeViewer";
import { applyMinecraftVisibility } from "../src/MinecraftVisibility";

const viewerSource = await Bun.file(
  new URL("../src/ThreeViewer.tsx", import.meta.url),
).text();

const HALF_LENGTH = WEIDENDAMMER_BRIDGE_PROFILE.inventory.lengthM / 2;
const HALF_WIDTH = WEIDENDAMMER_BRIDGE_PROFILE.inventory.widthM / 2;
const AXIS = WEIDENDAMMER_BRIDGE_PROFILE.axis;
const NORMAL = [-AXIS[1], AXIS[0]] as const;
const DECK_BASE_Y = 1.31 + 5.4;

function worldAt(localX: number, localZ: number): [number, number] {
  return [
    WEIDENDAMMER_BRIDGE_PROFILE.centreWorldM[0] +
      AXIS[0] * localX +
      NORMAL[0] * localZ,
    WEIDENDAMMER_BRIDGE_PROFILE.centreWorldM[1] +
      AXIS[1] * localX +
      NORMAL[1] * localZ,
  ];
}

function materialTextures(material: Material): Texture[] {
  const values = Object.values(material as unknown as Record<string, unknown>);
  return values.filter((value): value is Texture => value instanceof Texture);
}

describe("Weidendammer Bruecke source-bound close details", () => {
  test("pins the current bridge envelope to the official inventory and exact OSM axis", () => {
    expect(WEIDENDAMMER_BRIDGE_PROFILE).toMatchObject({
      centreWorldM: [1128.1180265166913, -334.7174344994128],
      inventory: {
        areaM2: 1749,
        bridgeNumber: "3446013",
        built: 1896,
        conditionGrade: 3,
        construction: "Bogenbruecke mit aufgestaenderter Fahrbahn",
        dataStatus: "06/2025",
        lengthM: 69.48,
        material: "Stahl/Leichtmetall",
        widthM: 25.17,
      },
      monumentObjectId: "09030074",
      ornamentArtisans: ["M. Fabian", "Eduard Puls"],
      osmWayId: "6228081",
      sourceEpsg25833Axis: [
        [390625.110604, 5820369.948078],
        [390631.125449, 5820299.486791],
      ],
    });
    expect(Math.hypot(...WEIDENDAMMER_BRIDGE_PROFILE.axis)).toBeCloseTo(1, 8);
    expect(WEIDENDAMMER_BRIDGE_PROFILE.axis[0]).toBeCloseTo(0.08503, 4);
    expect(WEIDENDAMMER_BRIDGE_PROFILE.axis[1]).toBeCloseTo(0.99638, 4);
    expect(WEIDENDAMMER_BRIDGE_PROFILE.historicSupportSpansM).toEqual([
      16.3, 38.5, 15.5,
    ]);
    expect(
      WEIDENDAMMER_BRIDGE_SUPPORT_LAYOUT.scaledSupportSpansM.reduce(
        (sum, span) => sum + span,
        0,
      ),
    ).toBeCloseTo(69.48, 8);
    expect(
      WEIDENDAMMER_BRIDGE_SUPPORT_LAYOUT.scaledSupportSpansM[0] -
        WEIDENDAMMER_BRIDGE_SUPPORT_LAYOUT.scaledSupportSpansM[2],
    ).toBeCloseTo(0.8 * WEIDENDAMMER_BRIDGE_SUPPORT_LAYOUT.envelopeScale, 8);
    expect(WEIDENDAMMER_BRIDGE_PROFILE.historicDimensionConflict).toContain(
      "22.4 m",
    );
    expect(WEIDENDAMMER_BRIDGE_PROFILE.historicDimensionConflict).toContain(
      "25.17 m",
    );
  });

  test("builds paired detailed centre eagles, neo-Baroque rail fields and one lock batch", () => {
    const bridge = createWeidendammerBridgeDetails("full");
    expect(bridge.name).toBe(WEIDENDAMMER_BRIDGE_SMOOTH_ROOT_NAME);
    expect(bridge.userData).toMatchObject({
      detailProfile: "full",
      eagleCount: WEIDENDAMMER_BRIDGE_EAGLE_COUNT,
      loveLockCount: WEIDENDAMMER_BRIDGE_LOVE_LOCK_COUNT.full,
      lampStandardCount: WEIDENDAMMER_BRIDGE_LAMP_STANDARD_COUNT,
      authoredFeatherCueCount:
        WEIDENDAMMER_BRIDGE_EAGLE_COUNT *
        WEIDENDAMMER_BRIDGE_AUTHORED_FEATHER_CUES.totalPerEagle,
      authoredFeatherCuesPerEagle: {
        tailPerEagle: 7,
        totalPerEagle: 27,
        wingPerEagle: 20,
      },
      railingSystemCount: WEIDENDAMMER_BRIDGE_RAILING_SYSTEM_COUNT,
      repeatingRailFieldCount:
        WEIDENDAMMER_BRIDGE_REPEATING_RAIL_FIELD_COUNT.full,
      textureFree: true,
    });
    expect(
      bridge.getObjectByName(WEIDENDAMMER_BRIDGE_STRUCTURAL_LAYER_NAME),
    ).toBeInstanceOf(Mesh);
    expect(
      bridge.getObjectByName(WEIDENDAMMER_BRIDGE_INK_LAYER_NAME),
    ).toBeInstanceOf(LineSegments);
    const lamps = bridge.getObjectByName(WEIDENDAMMER_BRIDGE_LAMP_LAYER_NAME);
    expect(lamps).toBeInstanceOf(Mesh);
    expect((lamps as Mesh).userData.nightMaterial.userData).toMatchObject({
      nightEmissive: 0xffc75c,
      nightEmissiveIntensity: 1.45,
    });
    const locks = bridge.getObjectByName(
      WEIDENDAMMER_BRIDGE_LOVE_LOCK_LAYER_NAME,
    );
    expect(locks).toBeInstanceOf(InstancedMesh);
    expect((locks as InstancedMesh).count).toBe(
      WEIDENDAMMER_BRIDGE_LOVE_LOCK_COUNT.full,
    );
    expect((locks as InstancedMesh).instanceColor).not.toBeNull();
    expect(locks?.userData.detailFadeM).toEqual([180, 260]);
    expect(
      bridge.getObjectByName(WEIDENDAMMER_BRIDGE_INK_LAYER_NAME)?.userData
        .detailFadeM,
    ).toEqual([420, 560]);
    expect(
      bridge.getObjectByName(WEIDENDAMMER_BRIDGE_SNOW_LAYER_NAME)?.visible,
    ).toBeFalse();
    expect(
      bridge.getObjectByName(WEIDENDAMMER_BRIDGE_SNOW_LAYER_NAME)?.userData,
    ).toMatchObject({ lampCapCount: 16, loveLocksRemainExposed: true });

    const localAxis = new Vector3(1, 0, 0).applyQuaternion(bridge.quaternion);
    expect(localAxis.x).toBeCloseTo(AXIS[0], 6);
    expect(localAxis.z).toBeCloseTo(AXIS[1], 6);
    expect(bridge.position.x).toBeCloseTo(
      WEIDENDAMMER_BRIDGE_PROFILE.centreWorldM[0],
      6,
    );
    expect(bridge.position.z).toBeCloseTo(
      WEIDENDAMMER_BRIDGE_PROFILE.centreWorldM[1],
      6,
    );
  });

  test("keeps the full and mobile detail profiles bounded and deterministic", () => {
    const full = createWeidendammerBridgeDetails("full");
    const fullAgain = createWeidendammerBridgeDetails("full");
    const mobile = createWeidendammerBridgeDetails("mobile");
    const fullLocks = full.getObjectByName(
      WEIDENDAMMER_BRIDGE_LOVE_LOCK_LAYER_NAME,
    ) as InstancedMesh;
    const repeatedLocks = fullAgain.getObjectByName(
      WEIDENDAMMER_BRIDGE_LOVE_LOCK_LAYER_NAME,
    ) as InstancedMesh;
    const mobileLocks = mobile.getObjectByName(
      WEIDENDAMMER_BRIDGE_LOVE_LOCK_LAYER_NAME,
    ) as InstancedMesh;
    expect(Array.from(fullLocks.instanceMatrix.array)).toEqual(
      Array.from(repeatedLocks.instanceMatrix.array),
    );
    expect(Array.from(fullLocks.instanceColor!.array)).toEqual(
      Array.from(repeatedLocks.instanceColor!.array),
    );
    expect(mobileLocks.count).toBe(WEIDENDAMMER_BRIDGE_LOVE_LOCK_COUNT.mobile);
    expect(mobile.userData.repeatingRailFieldCount).toBe(
      WEIDENDAMMER_BRIDGE_REPEATING_RAIL_FIELD_COUNT.mobile,
    );
    const fullStats = weidendammerBridgeRenderStats(full);
    const mobileStats = weidendammerBridgeRenderStats(mobile);
    expect(fullStats).toEqual({
      instanceCount: 192,
      renderedVertices: 90_116,
      renderables: 5,
      storedVertices: 46_568,
    });
    expect(mobileStats).toEqual({
      instanceCount: 96,
      renderedVertices: 54_404,
      renderables: 5,
      storedVertices: 32_744,
    });
    expect(mobileStats.renderedVertices).toBeLessThan(
      fullStats.renderedVertices,
    );
    expect(mobileStats.instanceCount).toBeLessThan(fullStats.instanceCount);

    const envelope = weidendammerBridgeWorldEnvelope();
    const bounds = new Box3().setFromObject(full);
    expect(envelope.containsBox(bounds)).toBeTrue();
    expect(bounds.max.y - bounds.min.y).toBeLessThan(4.75);
  });

  test("keeps locks at the 82 m focus and removes them before overview", () => {
    const locks = createWeidendammerBridgeDetails("full").getObjectByName(
      WEIDENDAMMER_BRIDGE_LOVE_LOCK_LAYER_NAME,
    )!;
    const range = readDetailFadeRangeM(locks.userData.detailFadeM);
    expect(range).toEqual([180, 260]);
    expect(
      nextDetailFadeVisible({ distanceM: 82, visible: true }, range!),
    ).toBeTrue();
    expect(
      nextDetailFadeVisible({ distanceM: 948, visible: true }, range!),
    ).toBeFalse();
    expect(
      nextDetailFadeVisible({ distanceM: 220, visible: false }, range!),
    ).toBeFalse();
    expect(
      nextDetailFadeVisible({ distanceM: 170, visible: false }, range!),
    ).toBeTrue();
  });

  test("switches cleanly across Day, Night, Snowstorm, Schwellenraum and Minecraft", () => {
    const scene = new Group();
    const smooth = createWeidendammerBridgeDetails("full");
    const minecraft = createWeidendammerBridgeMinecraft("full");
    scene.add(smooth, minecraft);
    const structure = smooth.getObjectByName(
      WEIDENDAMMER_BRIDGE_STRUCTURAL_LAYER_NAME,
    ) as Mesh;
    const lamps = smooth.getObjectByName(
      WEIDENDAMMER_BRIDGE_LAMP_LAYER_NAME,
    ) as Mesh;
    const dayMaterial = structure.material;

    setWeidendammerBridgePresentation(scene, "day");
    expect(smooth.visible).toBeTrue();
    expect(minecraft.visible).toBeFalse();
    expect(structure.material).toBe(dayMaterial);
    expect(
      smooth.getObjectByName(WEIDENDAMMER_BRIDGE_SNOW_LAYER_NAME)?.visible,
    ).toBeFalse();

    setWeidendammerBridgePresentation(scene, "night");
    expect(structure.material).toBe(structure.userData.nightMaterial);
    expect(lamps.material).toBe(lamps.userData.nightMaterial);
    applyMaterialLighting(
      lamps.material as MeshStandardMaterial,
      "night",
      true,
    );
    expect((lamps.material as MeshStandardMaterial).emissive.getHex()).toBe(
      0xffc75c,
    );
    applyMaterialLighting(
      lamps.material as MeshStandardMaterial,
      "night",
      false,
    );
    expect((lamps.material as MeshStandardMaterial).emissiveIntensity).toBe(0);
    setWeidendammerBridgePresentation(scene, "snowstorm");
    expect(smooth.visible).toBeTrue();
    expect(structure.material).toBe(dayMaterial);
    expect(
      smooth.getObjectByName(WEIDENDAMMER_BRIDGE_SNOW_LAYER_NAME)?.visible,
    ).toBeTrue();
    setWeidendammerBridgePresentation(scene, "schwellenraum");
    expect(smooth.visible).toBeTrue();
    expect(
      smooth.getObjectByName(WEIDENDAMMER_BRIDGE_SNOW_LAYER_NAME)?.visible,
    ).toBeFalse();
    setWeidendammerBridgePresentation(scene, "minecraft");
    expect(smooth.visible).toBeFalse();
    expect(minecraft.visible).toBeTrue();
  });

  test("relights the material selected by the real Day to Night bridge sequence immediately", () => {
    const signatures = new Group();
    const smooth = createWeidendammerBridgeDetails("mobile");
    signatures.add(smooth);
    const lamps = smooth.getObjectByName(
      WEIDENDAMMER_BRIDGE_LAMP_LAYER_NAME,
    ) as Mesh;

    applySignatureLightingPresentation(signatures, "day", true);
    expect(lamps.material).toBe(lamps.userData.dayMaterial);

    applySignatureLightingPresentation(signatures, "night", true);
    expect(lamps.material).toBe(lamps.userData.nightMaterial);
    expect((lamps.material as MeshStandardMaterial).emissive.getHex()).toBe(
      0xffc75c,
    );
    expect(
      (lamps.material as MeshStandardMaterial).emissiveIntensity,
    ).toBeGreaterThan(0);

    applySignatureLightingPresentation(signatures, "night", false);
    expect(lamps.material).toBe(lamps.userData.nightMaterial);
    expect((lamps.material as MeshStandardMaterial).emissive.getHex()).toBe(0);
    expect((lamps.material as MeshStandardMaterial).emissiveIntensity).toBe(0);

    applySignatureLightingPresentation(signatures, "day", true);
    expect(lamps.material).toBe(lamps.userData.dayMaterial);
  });

  test("survives the real signature-filter order across Day to Minecraft to Day and Snow", () => {
    const signatures = new Group();
    const retainedBridgeBase = new Group();
    retainedBridgeBase.name = "drawn bridge structures";
    const smooth = createWeidendammerBridgeDetails("mobile");
    retainedBridgeBase.add(smooth);
    signatures.add(retainedBridgeBase);
    const roots = {
      centralDetails: new Group(),
      cityStaffage: new Group(),
      civicDetails: new Group(),
      signatures,
    };

    setWeidendammerBridgePresentation(signatures, "day");
    expect(smooth.visible).toBeTrue();
    applyMinecraftVisibility(roots, true);
    setWeidendammerBridgePresentation(signatures, "minecraft");
    expect(smooth.visible).toBeFalse();
    applyMinecraftVisibility(roots, false);
    setWeidendammerBridgePresentation(signatures, "day");
    expect(smooth.visible).toBeTrue();
    setWeidendammerBridgePresentation(signatures, "snowstorm");
    expect(smooth.visible).toBeTrue();
    expect(
      smooth.getObjectByName(WEIDENDAMMER_BRIDGE_SNOW_LAYER_NAME)?.visible,
    ).toBeTrue();
  });

  test("uses one block-native batch with the same official anchor on full and mobile", () => {
    const full = createWeidendammerBridgeMinecraft("full");
    const mobile = createWeidendammerBridgeMinecraft("mobile");
    expect(full.name).toBe(WEIDENDAMMER_BRIDGE_MINECRAFT_ROOT_NAME);
    expect(full.children).toHaveLength(1);
    expect(mobile.children).toHaveLength(1);
    expect(full.children[0]).toBeInstanceOf(InstancedMesh);
    expect(mobile.children[0]).toBeInstanceOf(InstancedMesh);
    expect(full.position.toArray()).toEqual(mobile.position.toArray());
    expect(full.quaternion.toArray()).toEqual(mobile.quaternion.toArray());
    const fullStats = weidendammerBridgeRenderStats(full);
    const mobileStats = weidendammerBridgeRenderStats(mobile);
    expect(fullStats).toEqual({
      instanceCount: 344,
      renderedVertices: 8_256,
      renderables: 1,
      storedVertices: 24,
    });
    expect(mobileStats).toEqual({
      instanceCount: 224,
      renderedVertices: 5_376,
      renderables: 1,
      storedVertices: 24,
    });
    expect(fullStats.instanceCount).toBe(full.userData.blockCount);
    expect(mobileStats.instanceCount).toBe(mobile.userData.blockCount);
    expect(mobile.userData.blockCount).toBeLessThan(full.userData.blockCount);
  });

  test("keeps the deck and approaches open while rails, standards and eagles are solid", () => {
    const [deckX, deckZ] = worldAt(8, 0);
    const deckY =
      DECK_BASE_Y + 0.34 * Math.cos((8 / HALF_LENGTH) * (Math.PI / 2)) ** 2;
    expect(
      weidendammerBridgeSolidAt(deckX, deckY + 0.9, deckZ, 0.12),
    ).toBeFalse();

    const [railX, railZ] = worldAt(8, HALF_WIDTH);
    expect(
      weidendammerBridgeSolidAt(railX, deckY + 0.7, railZ, 0.08),
    ).toBeTrue();

    const lampLocalX = HALF_LENGTH * 0.25;
    const [lampX, lampZ] = worldAt(lampLocalX, HALF_WIDTH - 0.08);
    expect(
      weidendammerBridgeSolidAt(lampX, DECK_BASE_Y + 2.4, lampZ, 0.08),
    ).toBeTrue();

    const [eagleX, eagleZ] = worldAt(0, HALF_WIDTH + 0.09);
    expect(
      weidendammerBridgeSolidAt(eagleX, DECK_BASE_Y + 1.8, eagleZ, 0.05),
    ).toBeTrue();

    for (const localX of [-HALF_LENGTH - 4, HALF_LENGTH + 4]) {
      const [approachX, approachZ] = worldAt(localX, 0);
      expect(
        weidendammerBridgeSolidAt(approachX, DECK_BASE_Y + 1.8, approachZ, 0.2),
      ).toBeFalse();
    }

    expect(weidendammerBridgePlanContains(deckX, deckZ)).toBeTrue();
    const [outsideX, outsideZ] = worldAt(0, HALF_WIDTH + 1);
    expect(weidendammerBridgePlanContains(outsideX, outsideZ)).toBeFalse();
  });

  test("provides a close bridge focus and loads no photograph, plan, lyric or texture", () => {
    expect(WEIDENDAMMER_BRIDGE_FOCUS_CAMERA).toMatchObject({
      distance_m: 82,
      target_height_m: 0,
      target_world: [1128.1180265166913, 8.15, -334.7174344994128],
    });
    expect(WEIDENDAMMER_BRIDGE_MARKER_WORLD[0]).toBe(
      WEIDENDAMMER_BRIDGE_PROFILE.centreWorldM[0],
    );
    expect(WEIDENDAMMER_BRIDGE_MARKER_Y).toBe(12.4);
    expect(WEIDENDAMMER_BRIDGE_MARKER_WORLD[1]).toBeCloseTo(12.4, 6);
    expect(WEIDENDAMMER_BRIDGE_MARKER_WORLD[2]).toBe(
      WEIDENDAMMER_BRIDGE_PROFILE.centreWorldM[1],
    );
    expect(WEIDENDAMMER_BRIDGE_PROFILE.runtimeAssets).toEqual([]);
    expect(WEIDENDAMMER_BRIDGE_PROFILE.biermannReference.relation).toContain(
      "no lyric text",
    );
    expect(WEIDENDAMMER_BRIDGE_PROFILE.visualReferencePolicy).toContain(
      "no third-party image",
    );
    const bridge = createWeidendammerBridgeDetails("full");
    bridge.traverse((object) => {
      if (!(object instanceof Mesh) && !(object instanceof LineSegments))
        return;
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of materials) {
        expect(materialTextures(material)).toEqual([]);
      }
    });
  });

  test("wires all-mode relighting, selectable focus and both navigation startup paths", () => {
    expect(viewerSource).toContain(
      "applySignatureLightingPresentation(runtime.signatures, mode, lightsOn);",
    );
    const signatureLightingStart = viewerSource.indexOf(
      "export function applySignatureLightingPresentation(",
    );
    const signatureLightingEnd = viewerSource.indexOf(
      "function setSceneLighting(",
      signatureLightingStart,
    );
    const signatureLighting = viewerSource.slice(
      signatureLightingStart,
      signatureLightingEnd,
    );
    expect(
      signatureLighting.indexOf("setWeidendammerBridgePresentation("),
    ).toBeLessThan(signatureLighting.indexOf("applyLightingToRoot("));
    expect(viewerSource).toContain(
      "runtime.focusCameraByName.set(WEIDENDAMMER_BRIDGE_PROFILE.name",
    );
    expect(viewerSource).toContain("case WEIDENDAMMER_BRIDGE_PROFILE.name:");
    expect(viewerSource).toContain("return WEIDENDAMMER_BRIDGE_MARKER_Y;");
    expect(viewerSource).toContain(
      "rangeM: readDetailFadeRangeM(object.userData.detailFadeM)",
    );
    expect(viewerSource).toContain("nextDetailFadeVisible(");
    expect(viewerSource).toContain(
      "applyRuntimeMinecraftVisibility(runtime, voxelMode);",
    );
    expect(
      viewerSource.match(/weidendammerBridgeSolidAt\(x, y, z, radius\)/g),
    ).toHaveLength(2);
    expect(viewerSource).toContain(
      "setWeidendammerBridgePresentation(bridges, runtime.lightingMode);",
    );
  });
});
