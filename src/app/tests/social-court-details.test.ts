import { describe, expect, test } from "bun:test";
import {
  Color,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Texture,
} from "three";

import {
  createExpandedCityDetails,
  expandedCityFocusCamera,
} from "../src/ExpandedCityDetails";
import {
  createSocialCourtDetails,
  SOCIAL_COURT_BATCH_NAME,
  SOCIAL_COURT_PROFILE,
  SOCIAL_COURT_RENDER_BUDGET,
  SOCIAL_COURT_ROOT_NAME,
  socialCourtRenderStats,
} from "../src/SocialCourtDetails";
import { HERO_PRISM_TONES } from "../src/IsometricCityWorld";

function distanceToSegment(
  point: readonly [number, number],
  start: readonly [number, number],
  end: readonly [number, number],
): number {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const lengthSquared = dx * dx + dz * dz;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point[0] - start[0]) * dx + (point[1] - start[1]) * dz) /
        lengthSquared,
    ),
  );
  return Math.hypot(
    point[0] - (start[0] + t * dx),
    point[1] - (start[1] + t * dz),
  );
}

function localFacadeBounds(root: ReturnType<typeof createSocialCourtDetails>) {
  const [centerX, centerZ] = SOCIAL_COURT_PROFILE.frontCenterWorldM;
  const rotation = SOCIAL_COURT_PROFILE.facade.rotationY;
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  root.traverse((object) => {
    const geometry = (object as Mesh).geometry;
    const positions = geometry?.getAttribute("position");
    if (!positions) return;
    for (let index = 0; index < positions.count; index += 1) {
      const dx = positions.getX(index) - centerX;
      const dz = positions.getZ(index) - centerZ;
      const localX = dx * cosine - dz * sine;
      const localZ = dx * sine + dz * cosine;
      minX = Math.min(minX, localX);
      maxX = Math.max(maxX, localX);
      minY = Math.min(minY, positions.getY(index));
      maxY = Math.max(maxY, positions.getY(index));
      minZ = Math.min(minZ, localZ);
      maxZ = Math.max(maxZ, localZ);
    }
  });
  return { maxX, maxY, maxZ, minX, minY, minZ };
}

describe("Sozialgericht Berlin source-bound facade", () => {
  test("separates the OSM site boundary from the LoD2 facade", () => {
    const profile = SOCIAL_COURT_PROFILE;
    expect(profile.osmWayId).toBe("423490503");
    expect(profile.lod2.sourceBuildingId).toBe("DEBE01YYK0002Qys");
    expect(HERO_PRISM_TONES.K0002Qys).toBe(profile.palette.main);
    expect(profile.groundY).toBe(5.5);
    expect(profile.lod2.measuredHeightM).toBeCloseTo(16.956, 3);
    expect(profile.facade.sourceStreetBoundaryStartWorldM).toEqual([
      42.76884108165, -937.37724192,
    ]);
    expect(profile.facade.sourceStreetBoundaryEndWorldM).toEqual([
      -9.6127475682, -912.386695696,
    ]);
    expect(profile.facade.sourceStreetBoundaryLengthM).toBeCloseTo(
      58.03755878787,
      6,
    );
    expect(profile.facade.sourceFacadeEdgeStartWorldM).toEqual([
      32.388, -939.739,
    ]);
    expect(profile.facade.sourceFacadeEdgeEndWorldM).toEqual([
      -11.798, -918.779,
    ]);
    expect(profile.facade.facadeLengthM).toBeCloseTo(48.9052573452, 6);
    expect(profile.facade.rotationY).toBeCloseTo(-2.698667940187, 9);
    expect(profile.frontCenterWorldM).toEqual([
      10.346430053465344, -929.1505797546556,
    ]);
    expect(
      distanceToSegment(
        profile.frontCenterWorldM,
        profile.facade.sourceFacadeEdgeStartWorldM,
        profile.facade.sourceFacadeEdgeEndWorldM,
      ),
    ).toBeCloseTo(profile.facade.facadeOffsetOutwardM, 8);
    expect(
      distanceToSegment(
        profile.frontCenterWorldM,
        profile.facade.sourceStreetBoundaryStartWorldM,
        profile.facade.sourceStreetBoundaryEndWorldM,
      ),
    ).toBeGreaterThan(5);
    expect(Math.hypot(...profile.axisWorld)).toBeCloseTo(1, 8);
    expect(Math.hypot(...profile.outwardNormalWorld)).toBeCloseTo(1, 8);
    expect(
      profile.axisWorld[0] * profile.outwardNormalWorld[0] +
        profile.axisWorld[1] * profile.outwardNormalWorld[1],
    ).toBeCloseTo(0, 8);
  });

  test("keeps the photographed 4 + 3 + 4 hierarchy and Portal 52", () => {
    const profile = SOCIAL_COURT_PROFILE;
    expect(profile.facade.axisCount).toBe(11);
    expect(profile.facade.leftWingAxisCount).toBe(4);
    expect(profile.facade.centreAxisCount).toBe(3);
    expect(profile.facade.rightWingAxisCount).toBe(4);
    expect(profile.facade.bayCentresM).toHaveLength(11);
    expect(profile.facade.bayCentresM[5]).toBe(0);
    expect(profile.facade.risalitWidthM).toBeCloseTo(15.39194156044, 6);
    expect(profile.facade.risalitCenterLocalXM).toBeCloseTo(
      -0.235918582711,
      9,
    );
    expect(profile.portal).toMatchObject({
      addressNumber: "52",
      columnCount: 2,
      stepCount: 6,
    });
    expect(profile.portal.sourceWidthM).toBeCloseTo(4.79694611185, 6);
    expect(profile.portal.centerLocalXM).toBeCloseTo(0.279181354749, 9);
    expect(profile.roof).toEqual({
      centralSculptureGroupCount: 1,
      flagpoleIsBare: true,
      shoulderSculptureGroupCount: 2,
    });
  });

  test("applies the LoD2 feature centres and faces every disc outward", () => {
    const profile = SOCIAL_COURT_PROFILE;
    const root = createSocialCourtDetails("full");
    const lamps = root.getObjectByName(
      `${SOCIAL_COURT_BATCH_NAME} lamps`,
    ) as Mesh;
    const positions = lamps.geometry.getAttribute("position");
    const normals = lamps.geometry.getAttribute("normal");
    const colors = lamps.geometry.getAttribute("color");
    const glass = new Color(profile.palette.glass);
    const amber = new Color(profile.palette.transom);
    const [centerX, centerZ] = profile.frontCenterWorldM;
    const cosine = Math.cos(profile.facade.rotationY);
    const sine = Math.sin(profile.facade.rotationY);
    const oculusLocalXs: number[] = [];
    const transomLocalXs: number[] = [];

    for (let index = 0; index < positions.count; index += 1) {
      const dx = positions.getX(index) - centerX;
      const dz = positions.getZ(index) - centerZ;
      const localX = dx * cosine - dz * sine;
      const localZ = dx * sine + dz * cosine;
      const matchesColor = (target: Color): boolean =>
        Math.abs(colors.getX(index) - target.r) < 1e-5 &&
        Math.abs(colors.getY(index) - target.g) < 1e-5 &&
        Math.abs(colors.getZ(index) - target.b) < 1e-5;
      const outwardDot =
        normals.getX(index) * profile.outwardNormalWorld[0] +
        normals.getZ(index) * profile.outwardNormalWorld[1];

      if (matchesColor(amber)) {
        expect(outwardDot).toBeGreaterThan(0.999);
        transomLocalXs.push(localX);
      }
      if (matchesColor(glass) && Math.abs(localZ + 1.18) < 1e-4) {
        expect(outwardDot).toBeGreaterThan(0.999);
        oculusLocalXs.push(localX);
      }
    }

    expect(transomLocalXs).toHaveLength(26);
    expect(oculusLocalXs).toHaveLength(78);
    expect(
      (Math.min(...transomLocalXs) + Math.max(...transomLocalXs)) / 2,
    ).toBeCloseTo(profile.portal.centerLocalXM, 4);
    expect(
      (Math.min(...oculusLocalXs) + Math.max(...oculusLocalXs)) / 2,
    ).toBeCloseTo(profile.facade.risalitCenterLocalXM, 4);
  });

  test("places all eight wing tympana on their photographed window axes", () => {
    const root = createSocialCourtDetails("full");
    const bodies = root.getObjectByName(
      `${SOCIAL_COURT_BATCH_NAME} bodies`,
    ) as Mesh;
    const positions = bodies.geometry.getAttribute("position");
    const [centerX, centerZ] = SOCIAL_COURT_PROFILE.frontCenterWorldM;
    const cosine = Math.cos(SOCIAL_COURT_PROFILE.facade.rotationY);
    const sine = Math.sin(SOCIAL_COURT_PROFILE.facade.rotationY);
    const tipY = SOCIAL_COURT_PROFILE.groundY + 12.76;
    const tipXs: number[] = [];
    for (let index = 0; index < positions.count; index += 1) {
      if (Math.abs(positions.getY(index) - tipY) > 1e-5) continue;
      const dx = positions.getX(index) - centerX;
      const dz = positions.getZ(index) - centerZ;
      tipXs.push(dx * cosine - dz * sine);
    }
    const wingAxes = SOCIAL_COURT_PROFILE.facade.bayCentresM.filter(
      (localX) =>
        Math.abs(localX) > SOCIAL_COURT_PROFILE.facade.bayPitchM * 1.45,
    );
    expect(wingAxes).toHaveLength(8);
    for (const localX of wingAxes) {
      expect(tipXs.some((tipX) => Math.abs(tipX - localX) < 0.01)).toBe(true);
    }
  });

  test("builds one local three-renderable batch within both budgets", () => {
    const full = createSocialCourtDetails("full");
    const mobile = createSocialCourtDetails("mobile");
    expect(full.name).toBe(SOCIAL_COURT_ROOT_NAME);
    expect(mobile.name).toBe(SOCIAL_COURT_ROOT_NAME);
    expect(full.children).toHaveLength(1);
    expect(mobile.children).toHaveLength(1);
    expect(full.children[0].name).toBe(SOCIAL_COURT_BATCH_NAME);
    expect(mobile.children[0].name).toBe(SOCIAL_COURT_BATCH_NAME);

    const fullStats = socialCourtRenderStats(full);
    const mobileStats = socialCourtRenderStats(mobile);
    expect(fullStats).toEqual({ renderables: 3, vertices: 30_005 });
    expect(mobileStats).toEqual({ renderables: 3, vertices: 19_338 });
    expect(fullStats.renderables).toBe(3);
    expect(mobileStats.renderables).toBe(3);
    expect(fullStats.renderables).toBeLessThanOrEqual(
      SOCIAL_COURT_RENDER_BUDGET.full.maxRenderables,
    );
    expect(mobileStats.renderables).toBeLessThanOrEqual(
      SOCIAL_COURT_RENDER_BUDGET.mobile.maxRenderables,
    );
    expect(fullStats.vertices).toBeLessThanOrEqual(
      SOCIAL_COURT_RENDER_BUDGET.full.maxVertices,
    );
    expect(mobileStats.vertices).toBeLessThanOrEqual(
      SOCIAL_COURT_RENDER_BUDGET.mobile.maxVertices,
    );
    expect(mobileStats.vertices).toBeLessThan(fullStats.vertices * 0.7);
    expect(full.userData.detailProfile).toBe("full");
    expect(mobile.userData.detailProfile).toBe("mobile");
  });

  test("stays a shallow facade skin while retaining the full roof silhouette", () => {
    for (const detailProfile of ["full", "mobile"] as const) {
      const bounds = localFacadeBounds(createSocialCourtDetails(detailProfile));
      expect(bounds.minX).toBeGreaterThan(-25.1);
      expect(bounds.maxX).toBeLessThan(25.1);
      expect(bounds.minY).toBeCloseTo(SOCIAL_COURT_PROFILE.groundY, 5);
      expect(bounds.maxY).toBeGreaterThan(SOCIAL_COURT_PROFILE.groundY + 27);
      expect(bounds.maxY).toBeLessThan(SOCIAL_COURT_PROFILE.groundY + 29);
      expect(bounds.minZ).toBeGreaterThan(-3.5);
      expect(bounds.maxZ).toBeLessThan(1.3);
    }
  });

  test("uses procedural geometry and reversible day/night materials only", () => {
    const root = createSocialCourtDetails();
    expect(root.userData.runtimeAssets).toEqual([]);
    expect(root.userData.textureFree).toBe(true);
    expect(root.userData.photoReferenceCount).toBe(6);
    expect(SOCIAL_COURT_PROFILE.texturePolicy).toContain("not bundled");
    const textures: Texture[] = [];
    const meshNames: string[] = [];
    root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      meshNames.push(object.name);
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of materials) {
        for (const value of Object.values(material)) {
          if (value instanceof Texture) textures.push(value);
        }
      }
      expect(object.userData.dayMaterial).toBeInstanceOf(MeshBasicMaterial);
      expect(object.userData.nightMaterial).toBeInstanceOf(
        MeshStandardMaterial,
      );
    });
    expect(textures).toHaveLength(0);
    expect(meshNames).toEqual([
      `${SOCIAL_COURT_BATCH_NAME} bodies`,
      `${SOCIAL_COURT_BATCH_NAME} lamps`,
    ]);
    expect(
      root.getObjectByName(`${SOCIAL_COURT_BATCH_NAME} ink lines`),
    ).toBeInstanceOf(LineSegments);
  });

  test("integrates as a dedicated local group and forwards the mobile profile", () => {
    const landmark = {
      name: "Sozialgericht Berlin",
      world: [-1.038, 8, -964.978] as [number, number, number],
    };
    const full = createExpandedCityDetails([landmark]);
    const mobile = createExpandedCityDetails([landmark], {
      detailProfile: "mobile",
    });
    expect(full.userData.socialCourt).toBe(SOCIAL_COURT_PROFILE);
    expect(
      full.getObjectByName(SOCIAL_COURT_ROOT_NAME)?.userData,
    ).toMatchObject({
      addressNumber: "52",
      detailProfile: "full",
      facadeAxisCount: 11,
    });
    expect(
      mobile.getObjectByName(SOCIAL_COURT_ROOT_NAME)?.userData.detailProfile,
    ).toBe("mobile");
    expect(
      full.getObjectByName(
        "Expanded architecture and public-realm details bodies",
      ),
    ).toBeUndefined();
  });

  test("focuses the real street facade instead of the displaced POI", () => {
    const landmark = {
      name: "Sozialgericht Berlin",
      world: [-1.0383746, 8, -964.9776] as [number, number, number],
    };
    expect(expandedCityFocusCamera(landmark)).toMatchObject({
      azimuth_degrees: 25.4,
      distance_m: 142,
      fov_degrees: 36,
      polar_degrees: 63,
      target_height_m: 9.2,
      target_world: [
        SOCIAL_COURT_PROFILE.frontCenterWorldM[0],
        SOCIAL_COURT_PROFILE.groundY,
        SOCIAL_COURT_PROFILE.frontCenterWorldM[1],
      ],
    });
  });
});
