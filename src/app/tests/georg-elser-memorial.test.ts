import { describe, expect, test } from "bun:test";
import { Box3, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";

import groundJson from "../public/mesh/regierungsviertel/minecraft-voxels.json";
import {
  expandedCityFocusCamera,
  POTSDAMER_DETAIL_PROFILE,
} from "../src/ExpandedCityDetails";
import { createGeorgElserMemorial } from "../src/GeorgElserMemorial";
import { createMemorialLandmarks } from "../src/MemorialLandmarks";
import {
  smoothGroundTopSampler,
  type VoxelPayload,
} from "../src/MinecraftVoxelWorld";

const ground = groundJson as unknown as VoxelPayload;

describe("Georg Elser memorial", () => {
  test("uses the exact OSM sculpture anchor and published height", () => {
    const profile = POTSDAMER_DETAIL_PROFILE.georgElser;
    expect(profile.osmNodeId).toBe("1986458966");
    expect(profile.sourceEpsg25833).toEqual([390249.614475, 5819250.155827]);
    expect(profile.worldM).toEqual([749.614475, 749.844173]);
    expect(profile.heightM).toBe(17);
    expect(profile.material).toBe("steel");
  });

  test("sits on the interpolated local terrain instead of the generic sight height", () => {
    const profile = POTSDAMER_DETAIL_PROFILE.georgElser;
    const xOffset = profile.worldM[0] / ground.cell_m - ground.grid.min_x_idx;
    const zOffset = profile.worldM[1] / ground.cell_m - ground.grid.min_z_idx;
    const sampledGround = smoothGroundTopSampler(ground)(xOffset, zOffset);
    const memorial = createGeorgElserMemorial();
    const bounds = new Box3().setFromObject(memorial);

    expect(profile.groundYM).toBeCloseTo(sampledGround, 2);
    expect(memorial.position.y).toBe(profile.groundYM);
    expect(bounds.min.y).toBeCloseTo(profile.groundYM, 2);
  });

  test("draws one continuous layered profile instead of generic rods", () => {
    const memorial = createGeorgElserMemorial();
    const profile = memorial.getObjectByName(
      "Georg Elser laminated steel profile",
    );
    expect(profile).toBeDefined();
    expect(profile!.children).toHaveLength(3);
    const bounds = new Box3().setFromObject(profile!);
    expect(bounds.max.y - bounds.min.y).toBeCloseTo(17, 1);
    expect(bounds.max.x - bounds.min.x).toBeGreaterThan(4.8);
    expect(bounds.max.x - bounds.min.x).toBeLessThan(5.2);
    expect(bounds.max.z - bounds.min.z).toBeCloseTo(0.46, 2);
    for (const layer of profile!.children) {
      expect(layer).toBeInstanceOf(Mesh);
      const mesh = layer as Mesh;
      expect(mesh.geometry.getAttribute("position").count).toBeGreaterThan(300);
      expect(mesh.geometry.getAttribute("color")).toBeDefined();
      expect(mesh.userData.dayMaterial).toBeInstanceOf(MeshBasicMaterial);
      expect(mesh.userData.nightMaterial).toBeInstanceOf(MeshStandardMaterial);
      expect(mesh.userData.nightMaterial.transparent).toBe(false);
    }
  });

  test("sets the complete pavement inscription on a flush plaque", () => {
    const memorial = createGeorgElserMemorial();
    const quote = memorial.getObjectByName(
      "Georg Elser pavement inscription quote",
    ) as Mesh;
    const attribution = memorial.getObjectByName(
      "Georg Elser pavement inscription attribution",
    ) as Mesh;
    const plaque = memorial.getObjectByName(
      "Georg Elser pavement inscription plaque",
    );
    expect(quote.userData.lettering).toBe(
      "Ich habe den Krieg verhindern wollen.",
    );
    expect(attribution.userData.lettering).toBe(
      "Georg Elser, Ende November 1939",
    );
    expect(quote.rotation.x).toBeCloseTo(-Math.PI / 2, 8);
    expect(attribution.rotation.x).toBeCloseTo(-Math.PI / 2, 8);
    const bounds = new Box3().setFromObject(plaque!);
    expect(bounds.max.y - bounds.min.y).toBeLessThan(0.1);
    expect(bounds.max.x - bounds.min.x).toBeCloseTo(
      POTSDAMER_DETAIL_PROFILE.georgElser.plaqueWidthM,
      1,
    );
    expect(bounds.max.z - bounds.min.z).toBeCloseTo(
      POTSDAMER_DETAIL_PROFILE.georgElser.plaqueDepthM,
      1,
    );
  });

  test("replaces the old rods in the memorial layer shared by every mode", () => {
    const details = createMemorialLandmarks([
      { name: "Denkzeichen Georg Elser", world: [749.6, 8, 749.8] },
    ]);
    expect(details.getObjectByName("Denkzeichen Georg Elser")).toBeDefined();
    expect(
      details.getObjectByName("Georg Elser laminated steel profile"),
    ).toBeDefined();
    expect(details.userData.modelCount).toBe(1);
  });

  test("offers a close oblique camera that reveals profile and pavement", () => {
    expect(
      expandedCityFocusCamera({
        name: "Denkzeichen Georg Elser",
        world: [749.614475, 8, 749.844173],
      }),
    ).toEqual({
      azimuth_degrees: 68,
      distance_m: 44,
      fov_degrees: 32,
      polar_degrees: 66,
      target_height_m: 8.8,
      target_world: [749.614475, 8, 749.844173],
    });
  });
});
