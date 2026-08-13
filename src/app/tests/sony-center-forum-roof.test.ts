import { describe, expect, test } from "bun:test";
import {
  Box3,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from "three";

import { POTSDAMER_DETAIL_PROFILE } from "../src/expandedCityProfiles";
import { createSonyCenterForumRoof } from "../src/SonyCenterForumRoof";
import { SONY_CENTER_OSM_PANEL_PLAN } from "../src/sonyCenterPanelPlan";

describe("Sony Center Forum roof", () => {
  test("keeps the published ring dimensions and OSM panel register", () => {
    const profile = POTSDAMER_DETAIL_PROFILE.sonyCenterForumRoof;
    expect(profile.outerRingSizeM[0]).toBe(102);
    expect(profile.outerRingSizeM[1]).toBe(78);
    expect(profile.kingpostLengthM).toBe(42.5);
    expect(profile.supportHeightAboveGroundM).toBe(41);
    expect(profile.peakHeightAboveGroundM).toBe(67);
    expect(profile.segmentCount).toBe(24);
    expect(profile.sourceOsmWayIds).toHaveLength(24);
    expect(profile.supportCount).toBe(7);
    expect(profile.geometryStatus).toContain("bounded presentation");
    expect(profile.openingCenterWorldM).not.toEqual(
      profile.outerRingCenterWorldM,
    );
    expect(profile.sources).toHaveLength(3);
    expect(profile.sources[0]).toContain("arup-journal");
  });

  test("builds the 24 mapped membrane fields without an opaque roof slab", () => {
    const roof = createSonyCenterForumRoof();
    const membrane = roof.getObjectByName(
      "Sony Center membrane roof sectors",
    ) as Mesh;
    expect(membrane).toBeInstanceOf(Mesh);
    expect(SONY_CENTER_OSM_PANEL_PLAN).toHaveLength(24);
    expect(new Set(SONY_CENTER_OSM_PANEL_PLAN.map((panel) => panel.wayId))).toEqual(
      new Set(POTSDAMER_DETAIL_PROFILE.sonyCenterForumRoof.sourceOsmWayIds),
    );
    expect(membrane.geometry.getAttribute("position").count).toBe(147);
    expect(membrane.userData.dayMaterial).toBeInstanceOf(MeshBasicMaterial);
    expect(membrane.userData.nightMaterial).toBeInstanceOf(
      MeshStandardMaterial,
    );
    expect((membrane.userData.dayMaterial as MeshBasicMaterial).transparent).toBe(
      true,
    );
    expect((membrane.userData.dayMaterial as MeshBasicMaterial).depthWrite).toBe(
      false,
    );
    const glass = roof.getObjectByName("Sony Center glass roof sectors") as Mesh;
    expect(glass.geometry.getAttribute("position").count).toBe(144);
    expect((glass.userData.dayMaterial as MeshBasicMaterial).opacity).toBeLessThan(
      0.25,
    );
    expect((glass.userData.dayMaterial as MeshBasicMaterial).depthWrite).toBe(
      false,
    );
    const membraneBounds = new Box3().setFromObject(membrane);
    const profile = POTSDAMER_DETAIL_PROFILE.sonyCenterForumRoof;
    expect(membraneBounds.max.x - membraneBounds.min.x).toBeLessThanOrEqual(
      profile.outerRingSizeM[0] + 1,
    );
    expect(membraneBounds.max.z - membraneBounds.min.z).toBeLessThanOrEqual(
      profile.outerRingSizeM[0] + 1,
    );
    expect(roof.getObjectByName("Sony Center Forum reflecting pool")).toBeDefined();
    expect(roof.userData.sourceUrls).toEqual([
      ...POTSDAMER_DETAIL_PROFILE.sonyCenterForumRoof.sources,
    ]);
  });

  test("instances the ring, cables and exactly seven supports", () => {
    const roof = createSonyCenterForumRoof();
    const ring = roof.getObjectByName(
      "Sony Center oval ring truss",
    ) as InstancedMesh;
    const radial = roof.getObjectByName(
      "Sony Center radial roof cables",
    ) as InstancedMesh;
    const lattice = roof.getObjectByName(
      "Sony Center oval ring lattice",
    ) as InstancedMesh;
    const stays = roof.getObjectByName(
      "Sony Center lower stay cables",
    ) as InstancedMesh;
    const supports = roof.getObjectByName(
      "Sony Center seven ring supports",
    ) as InstancedMesh;
    const kingpost = roof.getObjectByName(
      "Sony Center tilted kingpost",
    ) as InstancedMesh;
    expect(ring.count).toBe(24);
    expect(lattice.count).toBe(72);
    expect(radial.count).toBe(24);
    expect(stays.count).toBe(24);
    expect(supports.count).toBe(7);
    const kingpostMatrix = new Matrix4();
    const kingpostScale = new Vector3();
    kingpost.getMatrixAt(0, kingpostMatrix);
    kingpostMatrix.decompose(new Vector3(), new Quaternion(), kingpostScale);
    expect(kingpostScale.y).toBeCloseTo(42.5, 3);
  });

  test("stays within the metric Forum envelope and published peak height", () => {
    const roof = createSonyCenterForumRoof();
    const profile = POTSDAMER_DETAIL_PROFILE.sonyCenterForumRoof;
    const bounds = new Box3().setFromObject(roof);
    expect(bounds.max.x - bounds.min.x).toBeLessThan(110);
    expect(bounds.max.z - bounds.min.z).toBeLessThan(90);
    expect(bounds.min.y).toBeGreaterThanOrEqual(profile.groundY);
    const publishedPeakY =
      profile.groundY + profile.peakHeightAboveGroundM;
    expect(bounds.max.y).toBeGreaterThanOrEqual(publishedPeakY);
    expect(bounds.max.y).toBeLessThanOrEqual(publishedPeakY + 0.4);
  });
});
