import { describe, expect, test } from "bun:test";
import {
  Box3,
  InstancedMesh,
  MeshStandardMaterial,
  PointLight,
  Vector3,
} from "three";

import groundJson from "../public/mesh/regierungsviertel/minecraft-voxels.json";
import {
  smoothGroundTopSampler,
  type VoxelPayload,
} from "../src/MinecraftVoxelWorld";
import {
  QUEER_RAINBOW_MEMORIAL_PROFILE,
  createQueerRainbowMemorial,
  setQueerRainbowMemorialSnow,
} from "../src/QueerRainbowMemorial";

const ground = groundJson as unknown as VoxelPayload;

describe("Queer Rainbow Memorial at Ahornsteig", () => {
  test("uses the supplied Ahornsteig point without claiming surveyed offerings", () => {
    const memorial = createQueerRainbowMemorial();
    expect(memorial.name).toBe("Queer Rainbow Memorial Berlin");
    expect(memorial.position.toArray()).toEqual([
      ...QUEER_RAINBOW_MEMORIAL_PROFILE.worldM,
    ]);
    expect(memorial.userData.species).toContain(
      "species and dimensions unverified",
    );
    expect(memorial.userData.geometryStatus).toContain("field-view-bounded");
    expect(memorial.userData.geometryStatus).toContain("not surveyed");
    expect(memorial.userData.positionStatus).toContain(
      "interpolated official-mesh terrain surface",
    );
    expect(QUEER_RAINBOW_MEMORIAL_PROFILE.trunkRadiusM).toBe(0.36);
  });

  test("fits the display base to the same continuous park surface as the viewer", () => {
    const profile = QUEER_RAINBOW_MEMORIAL_PROFILE;
    const xOffset = profile.worldM[0] / ground.cell_m - ground.grid.min_x_idx;
    const zOffset = profile.worldM[2] / ground.cell_m - ground.grid.min_z_idx;
    const renderedGround = smoothGroundTopSampler(ground)(xOffset, zOffset);

    expect(profile.sourceGroundYM).toBe(4.057);
    expect(profile.renderedGroundYM).toBeCloseTo(renderedGround, 2);
    expect(profile.worldM[1]).toBe(profile.renderedGroundYM);
  });

  test("keeps the reconstructed tree at metric height and grounds every offering", () => {
    const memorial = createQueerRainbowMemorial();
    const localBounds = new Box3().setFromObject(memorial);
    const size = localBounds.getSize(new Vector3());
    expect(localBounds.min.y).toBeCloseTo(
      QUEER_RAINBOW_MEMORIAL_PROFILE.worldM[1],
      5,
    );
    expect(size.y).toBeGreaterThanOrEqual(22.9);
    expect(size.y).toBeLessThan(23.5);
    expect(size.x).toBeGreaterThan(8.5);
    expect(size.z).toBeGreaterThan(8.5);
  });

  test("renders the supplied memorial cues as stable batched detail", () => {
    const memorial = createQueerRainbowMemorial();
    expect(
      memorial.getObjectByName("Queer Rainbow Memorial six-colour heart"),
    ).not.toBeNull();
    expect(
      memorial.getObjectByName("Queer Rainbow Memorial rainbow fabric bands"),
    ).not.toBeNull();
    expect(
      memorial.getObjectByName("Queer Rainbow Memorial fine detail"),
    ).not.toBeNull();

    const stems = memorial.getObjectByName(
      "Queer Rainbow Memorial flower stems",
    ) as InstancedMesh;
    const flames = memorial.getObjectByName(
      "Queer Rainbow Memorial candle flames",
    ) as InstancedMesh;
    const messages = memorial.getObjectByName(
      "Queer Rainbow Memorial cards and messages",
    ) as InstancedMesh;
    expect(stems.count).toBe(QUEER_RAINBOW_MEMORIAL_PROFILE.flowerCount);
    expect(flames.count).toBe(QUEER_RAINBOW_MEMORIAL_PROFILE.candleCount);
    expect(messages.count).toBe(QUEER_RAINBOW_MEMORIAL_PROFILE.messageCount);
    const flameMaterial = flames.material as MeshStandardMaterial;
    expect(flameMaterial.userData.nightEmissive).toBe(0xff9e35);
    expect(flameMaterial.userData.nightEmissiveIntensity).toBe(2.2);
    expect(flames.userData.nightOnly).toBeTrue();
    expect(flames.visible).toBeFalse();
    const candleLights = memorial.children
      .flatMap((child) => child.children)
      .filter((child) => child instanceof PointLight);
    expect(candleLights).toHaveLength(2);
    for (const light of candleLights) {
      expect(light.userData.nightOnly).toBeTrue();
      expect(light.visible).toBeFalse();
      expect(light.castShadow).toBeFalse();
    }
  });

  test("shows static crown snow only in Snowstorm", () => {
    const memorial = createQueerRainbowMemorial();
    const snow = memorial.getObjectByName(
      "Queer Rainbow Memorial snow crown caps",
    );
    expect(snow?.visible).toBeFalse();
    setQueerRainbowMemorialSnow(memorial, true);
    expect(snow?.visible).toBeTrue();
    setQueerRainbowMemorialSnow(memorial, false);
    expect(snow?.visible).toBeFalse();
  });

  test("is deterministic between rebuilds", () => {
    const first = createQueerRainbowMemorial();
    const second = createQueerRainbowMemorial();
    const firstStems = first.getObjectByName(
      "Queer Rainbow Memorial flower stems",
    ) as InstancedMesh;
    const secondStems = second.getObjectByName(
      "Queer Rainbow Memorial flower stems",
    ) as InstancedMesh;
    expect(Array.from(firstStems.instanceMatrix.array)).toEqual(
      Array.from(secondStems.instanceMatrix.array),
    );
  });
});
