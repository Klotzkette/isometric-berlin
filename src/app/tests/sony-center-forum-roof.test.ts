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
    expect(
      new Set(SONY_CENTER_OSM_PANEL_PLAN.map((panel) => panel.wayId)),
    ).toEqual(
      new Set(POTSDAMER_DETAIL_PROFILE.sonyCenterForumRoof.sourceOsmWayIds),
    );
    expect(membrane.geometry.getAttribute("position").count).toBe(147);
    expect(membrane.userData.dayMaterial).toBeInstanceOf(MeshBasicMaterial);
    expect(membrane.userData.nightMaterial).toBeInstanceOf(
      MeshStandardMaterial,
    );
    expect(
      (membrane.userData.dayMaterial as MeshBasicMaterial).transparent,
    ).toBe(true);
    expect(
      (membrane.userData.dayMaterial as MeshBasicMaterial).depthWrite,
    ).toBe(false);
    const glass = roof.getObjectByName(
      "Sony Center glass roof sectors",
    ) as Mesh;
    expect(glass.geometry.getAttribute("position").count).toBe(144);
    expect(
      (glass.userData.dayMaterial as MeshBasicMaterial).opacity,
    ).toBeLessThan(0.25);
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
    expect(
      roof.getObjectByName("Sony Center Forum reflecting pool"),
    ).toBeDefined();
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

  test("wraps the Forum in curved glass, steel rails and red fins", () => {
    const roof = createSonyCenterForumRoof();
    const glass = roof.getObjectByName(
      "Sony Center curved Forum glass facades",
    ) as InstancedMesh;
    const rails = roof.getObjectByName(
      "Sony Center stainless facade rails",
    ) as InstancedMesh;
    const fins = roof.getObjectByName(
      "Sony Center warm red facade fins",
    ) as InstancedMesh;
    const mullions = roof.getObjectByName(
      "Sony Center stainless vertical mullions",
    ) as InstancedMesh;
    const entrances = roof.getObjectByName(
      "Sony Center alternating full-height Forum entrances",
    ) as InstancedMesh;
    const parapets = roof.getObjectByName(
      "Sony Center continuous Forum parapet caps",
    ) as InstancedMesh;

    expect(glass).toBeInstanceOf(InstancedMesh);
    expect(rails).toBeInstanceOf(InstancedMesh);
    expect(fins).toBeInstanceOf(InstancedMesh);
    expect(mullions).toBeInstanceOf(InstancedMesh);
    expect(entrances).toBeInstanceOf(InstancedMesh);
    expect(parapets).toBeInstanceOf(InstancedMesh);
    expect(glass.count).toBe(28 * 6);
    expect(rails.count).toBe(28 * 7);
    expect(fins.count).toBe(28);
    expect(mullions.count).toBe(28 * 3);
    expect(entrances.count).toBe(28);
    expect(parapets.count).toBe(28);
    expect(glass.userData.dayMaterial).toBeInstanceOf(MeshBasicMaterial);
    expect(glass.userData.nightMaterial).toBeInstanceOf(MeshStandardMaterial);
    expect((glass.userData.dayMaterial as MeshBasicMaterial).transparent).toBe(
      true,
    );
    expect((glass.userData.dayMaterial as MeshBasicMaterial).opacity).toBe(
      0.28,
    );
    expect((glass.userData.dayMaterial as MeshBasicMaterial).depthWrite).toBe(
      false,
    );
    expect(
      (glass.userData.nightMaterial as MeshStandardMaterial).transparent,
    ).toBe(true);
    expect((glass.userData.nightMaterial as MeshStandardMaterial).opacity).toBe(
      0.34,
    );
    expect(
      (glass.userData.nightMaterial as MeshStandardMaterial).depthWrite,
    ).toBe(false);
    expect(roof.userData.forumFacadePanelCount).toBe(28);
    expect(roof.userData.forumFacadeFloorCount).toBe(6);
    expect(roof.userData.forumFacadeGlassFieldCount).toBe(168);
    expect(roof.userData.forumFacadeMullionCount).toBe(84);
    expect(roof.userData.forumEntranceFieldCount).toBe(28);
  });

  test("adds batched roof fasteners, folded cables and restrained Forum water detail", () => {
    const roof = createSonyCenterForumRoof();
    const clamps = roof.getObjectByName(
      "Sony Center membrane field clamp rails",
    ) as InstancedMesh;
    const ridges = roof.getObjectByName(
      "Sony Center twelve upper ridge cables",
    ) as InstancedMesh;
    const valleys = roof.getObjectByName(
      "Sony Center twelve upper valley cables",
    ) as InstancedMesh;
    const junctions = roof.getObjectByName(
      "Sony Center forty-eight cable junction nodes",
    ) as InstancedMesh;
    const lights = roof.getObjectByName(
      "Sony Center twenty-four restrained ring soffit lights",
    ) as InstancedMesh;
    const rim = roof.getObjectByName(
      "Sony Center Forum forty-eight-piece fountain rim",
    ) as InstancedMesh;
    const jets = roof.getObjectByName(
      "Sony Center Forum twelve restrained fountain jets",
    ) as InstancedMesh;

    expect(clamps.count).toBe(97);
    expect(ridges.count).toBe(12);
    expect(valleys.count).toBe(12);
    expect(junctions.count).toBe(48);
    expect(lights.count).toBe(24);
    expect(rim.count).toBe(48);
    expect(jets.count).toBe(12);
    expect((jets.material as MeshBasicMaterial).transparent).toBe(true);
    expect((jets.material as MeshBasicMaterial).depthWrite).toBe(false);
    expect(roof.userData.primaryArchitectureSource).toContain("jahn.studio");
    expect(roof.userData.visualReferencePolicy).toContain("no image");
  });

  test("keeps the added detail mobile-safe and texture-free", () => {
    const roof = createSonyCenterForumRoof();
    let drawables = 0;
    let instances = 0;
    roof.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      drawables += 1;
      if (object instanceof InstancedMesh) instances += object.count;
      const activeMaterials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      const modeMaterials = [
        object.userData.dayMaterial,
        object.userData.nightMaterial,
      ].filter(Boolean);
      for (const material of [...activeMaterials, ...modeMaterials]) {
        const mapped = material as MeshBasicMaterial | MeshStandardMaterial;
        expect(mapped.map).toBeNull();
        if (mapped.transparent) expect(mapped.depthWrite).toBe(false);
      }
    });

    expect(drawables).toBeLessThanOrEqual(24);
    expect(instances).toBeGreaterThan(900);
    expect(instances).toBeLessThan(1_100);
  });

  test("stays within the metric Forum envelope and published peak height", () => {
    const roof = createSonyCenterForumRoof();
    const profile = POTSDAMER_DETAIL_PROFILE.sonyCenterForumRoof;
    const bounds = new Box3().setFromObject(roof);
    expect(bounds.max.x - bounds.min.x).toBeLessThan(110);
    expect(bounds.max.z - bounds.min.z).toBeLessThan(90);
    expect(bounds.min.y).toBeGreaterThanOrEqual(profile.groundY);
    const publishedPeakY = profile.groundY + profile.peakHeightAboveGroundM;
    expect(bounds.max.y).toBeGreaterThanOrEqual(publishedPeakY);
    expect(bounds.max.y).toBeLessThanOrEqual(publishedPeakY + 0.4);
  });
});
