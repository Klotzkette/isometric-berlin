import { describe, expect, test } from "bun:test";
import { Color, Matrix4, Vector3 } from "three";

import {
  createMinecraftSocialCourtRecognition,
  isMinecraftHeroSourceCourseAreaAt,
  voxelRecognitionAreaAt,
} from "../src/MinecraftVoxelWorld";
import {
  SOCIAL_COURT_PROFILE,
  socialCourtFacadeWorldAt,
} from "../src/SocialCourtDetails";

describe("Sozialgericht block-native Minecraft facade", () => {
  test("uses one bounded instanced draw call in both profiles", () => {
    const full = createMinecraftSocialCourtRecognition("full");
    const mobile = createMinecraftSocialCourtRecognition("mobile");
    expect(full.name).toBe(
      "Voxel Sozialgericht Berlin 11-axis recognition facade",
    );
    expect(mobile.name).toBe(full.name);
    expect(full.count).toBe(244);
    expect(mobile.count).toBe(196);
    expect(full.userData).toMatchObject({
      architecturalProfile: SOCIAL_COURT_PROFILE,
      blockCount: 244,
      detailProfile: "full",
      keepInMinecraft: true,
      sourceBound: true,
      textureFree: true,
    });
    expect(mobile.userData).toMatchObject({
      blockCount: 196,
      detailProfile: "mobile",
    });
  });

  test("keeps all eleven axes while mobile only coarsens repeated courses", () => {
    expect(SOCIAL_COURT_PROFILE.facade.bayCentresM).toHaveLength(11);
    const full = createMinecraftSocialCourtRecognition("full");
    const mobile = createMinecraftSocialCourtRecognition("mobile");
    const matrix = new Matrix4();
    const position = new Vector3();
    const scale = new Vector3();
    const bounds = (mesh: typeof full) => {
      let minY = Number.POSITIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;
      for (let index = 0; index < mesh.count; index += 1) {
        mesh.getMatrixAt(index, matrix);
        position.setFromMatrixPosition(matrix);
        scale.setFromMatrixScale(matrix);
        minY = Math.min(minY, position.y - scale.y / 2);
        maxY = Math.max(maxY, position.y + scale.y / 2);
      }
      return { maxY, minY };
    };
    const fullBounds = bounds(full);
    const mobileBounds = bounds(mobile);
    expect(fullBounds.minY).toBeCloseTo(SOCIAL_COURT_PROFILE.groundY + 0.01, 1);
    expect(fullBounds.maxY).toBeGreaterThan(SOCIAL_COURT_PROFILE.groundY + 27);
    expect(mobileBounds).toEqual(fullBounds);
  });

  test("centres the block gable on the exact LoD2 risalit midpoint", () => {
    const facade = createMinecraftSocialCourtRecognition("full");
    const matrix = new Matrix4();
    const position = new Vector3();
    const scale = new Vector3();
    const gableLocalXs: number[] = [];
    for (let index = 0; index < facade.count; index += 1) {
      facade.getMatrixAt(index, matrix);
      position.setFromMatrixPosition(matrix);
      scale.setFromMatrixScale(matrix);
      if (
        Math.abs(position.y - (SOCIAL_COURT_PROFILE.groundY + 17.35)) > 1e-4 ||
        Math.abs(scale.x - SOCIAL_COURT_PROFILE.facade.risalitWidthM) > 1e-4
      ) {
        continue;
      }
      gableLocalXs.push(
        (position.x - SOCIAL_COURT_PROFILE.frontCenterWorldM[0]) *
          SOCIAL_COURT_PROFILE.axisWorld[0] +
          (position.z - SOCIAL_COURT_PROFILE.frontCenterWorldM[1]) *
            SOCIAL_COURT_PROFILE.axisWorld[1],
      );
    }
    expect(gableLocalXs).toHaveLength(1);
    expect(gableLocalXs[0]).toBeCloseTo(
      SOCIAL_COURT_PROFILE.facade.risalitCenterLocalXM,
      4,
    );
  });

  test("uses only a small Minecraft material palette including amber 52", () => {
    const facade = createMinecraftSocialCourtRecognition();
    const colors = new Set<number>();
    const color = new Color();
    for (let index = 0; index < facade.count; index += 1) {
      facade.getColorAt(index, color);
      colors.add(color.getHex());
    }
    expect(colors.size).toBeLessThanOrEqual(10);
    expect(colors.has(0xe8d1ae)).toBe(true);
    expect(colors.has(0x72c5d2)).toBe(true);
    expect(colors.has(0xe6bd4c)).toBe(true);
    expect(colors.has(0x34443a)).toBe(true);
  });

  test("draws the address 52 as two complete 3 by 5 pixel glyphs", () => {
    const facade = createMinecraftSocialCourtRecognition();
    const matrix = new Matrix4();
    const position = new Vector3();
    const color = new Color();
    const numeralPixels: Vector3[] = [];
    for (let index = 0; index < facade.count; index += 1) {
      facade.getColorAt(index, color);
      if (color.getHex() !== 0x34443a) continue;
      facade.getMatrixAt(index, matrix);
      position.setFromMatrixPosition(matrix);
      if (
        position.y >= SOCIAL_COURT_PROFILE.groundY + 5.7 &&
        position.y <= SOCIAL_COURT_PROFILE.groundY + 6.4
      ) {
        numeralPixels.push(position.clone());
      }
    }
    expect(facade.userData.addressPixelCount).toBe(22);
    expect(numeralPixels).toHaveLength(22);
    expect(new Set(numeralPixels.map((pixel) => pixel.y.toFixed(2))).size).toBe(
      5,
    );
    const numeralLocalXs = numeralPixels.map(
      (pixel) =>
        (pixel.x - SOCIAL_COURT_PROFILE.frontCenterWorldM[0]) *
          SOCIAL_COURT_PROFILE.axisWorld[0] +
        (pixel.z - SOCIAL_COURT_PROFILE.frontCenterWorldM[1]) *
          SOCIAL_COURT_PROFILE.axisWorld[1],
    );
    expect(
      (Math.min(...numeralLocalXs) + Math.max(...numeralLocalXs)) / 2,
    ).toBeCloseTo(SOCIAL_COURT_PROFILE.portal.centerLocalXM, 4);
  });

  test("suppresses generic windows only in the shallow street strip", () => {
    const front = SOCIAL_COURT_PROFILE.frontCenterWorldM;
    const deepInterior = socialCourtFacadeWorldAt(0, 10);
    const outerStreet = socialCourtFacadeWorldAt(0, -10);
    expect(voxelRecognitionAreaAt(...front)?.name).toBe("Sozialgericht Berlin");
    expect(isMinecraftHeroSourceCourseAreaAt(...front)).toBe(true);
    expect(voxelRecognitionAreaAt(...deepInterior)?.name).not.toBe(
      "Sozialgericht Berlin",
    );
    expect(voxelRecognitionAreaAt(...outerStreet)?.name).not.toBe(
      "Sozialgericht Berlin",
    );
    expect(isMinecraftHeroSourceCourseAreaAt(...deepInterior)).toBe(false);
  });

  test("is deterministic across repeated construction", () => {
    const first = createMinecraftSocialCourtRecognition("mobile");
    const second = createMinecraftSocialCourtRecognition("mobile");
    expect(second.count).toBe(first.count);
    expect(Array.from(second.instanceMatrix.array)).toEqual(
      Array.from(first.instanceMatrix.array),
    );
    expect(Array.from(second.instanceColor!.array)).toEqual(
      Array.from(first.instanceColor!.array),
    );
  });
});
