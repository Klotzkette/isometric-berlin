import { describe, expect, test } from "bun:test";
import {
  Box3,
  Group,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from "three";

import { createChancelleryExtension } from "../src/ChancelleryExtension";
import {
  CHANCELLERY_EXTENSION_PROFILE,
  isChancelleryExtensionConstructionPoint,
  pointInWorldRing,
} from "../src/chancelleryExtensionProfile";
import type { VoxelPayload } from "../src/MinecraftVoxelWorld";
import groundJson from "../public/mesh/regierungsviertel/minecraft-voxels.json";

const ground = groundJson as unknown as VoxelPayload;

function model(): Group {
  const extension = createChancelleryExtension(ground);
  if (!extension) throw new Error("Expected Chancellery extension model");
  return extension;
}

describe("current Federal Chancellery extension construction stage", () => {
  test("pins every authoritative horizontal feature to current OSM ways", () => {
    const profile = CHANCELLERY_EXTENSION_PROFILE;
    expect(profile.osmSiteWayId).toBe("1357789475");
    expect(profile.osmCurvedBuildingWayId).toBe("1434663371");
    expect(profile.osmAnnexWayId).toBe("1315319770");
    expect(profile.osmSouthBridgeWayId).toBe("1357796197");
    expect(profile.curvedBuildingFootprintWorldM).toHaveLength(42);
    expect(profile.annexFootprintWorldM).toHaveLength(15);
    expect(profile.plannedOfficeStoreys).toBe(6);
    expect(profile.southBridge.documentedLengthM).toBe(180);
    expect(profile.southBridge.osmAxisLengthM).toBeCloseTo(194.32, 2);
    expect(profile.southBridge.presentationRule).toContain(
      "official published",
    );
  });

  test("keeps the source footprint separate from inferred vertical detail", () => {
    const extension = model();
    expect(extension.userData.currentStage).toContain("shell largely complete");
    expect(extension.userData.geometryStatus).toContain("OSM construction");
    expect(extension.userData.geometryStatus).toContain(
      "presentation estimates",
    );
    expect(extension.userData.sourceUrls).toHaveLength(7);
    expect(extension.userData.sourceCheckedAt).toBe("2026-08-12");
    expect(extension.userData.currentStagePublishedAt).toBe("2026-04-10");
  });

  test("draws the standing shells, installed South Bridge and worksite", () => {
    const extension = model();
    const shell = extension.getObjectByName(
      "Chancellery extension standing shell bodies",
    ) as Mesh;
    const site = extension.getObjectByName(
      "Chancellery extension construction details bodies",
    ) as Mesh;
    const fitOutWindows = extension.getObjectByName(
      "Chancellery extension standing shell lamps",
    ) as Mesh;
    const lamps = extension.getObjectByName(
      "Chancellery extension construction details lamps",
    ) as Mesh;
    const ink = extension.getObjectByName(
      "Chancellery extension standing shell ink lines",
    );
    expect(shell).toBeInstanceOf(Mesh);
    expect(site).toBeInstanceOf(Mesh);
    expect(fitOutWindows).toBeInstanceOf(Mesh);
    expect(lamps).toBeInstanceOf(Mesh);
    expect(ink).toBeInstanceOf(LineSegments);
    expect(shell.material).toBeInstanceOf(MeshBasicMaterial);
    expect(lamps.userData.nightMaterial).toBeInstanceOf(MeshStandardMaterial);
    expect(lamps.userData.nightMaterial.userData.nightEmissive).toBe(0xffb14f);
    const fitOutColor = fitOutWindows.geometry.getAttribute("color");
    const first = [
      fitOutColor.getX(0),
      fitOutColor.getY(0),
      fitOutColor.getZ(0),
    ];
    expect(first[0]).toBeLessThan(first[2]);
    expect(extension.userData.towerCraneCount).toBe(2);
    expect(extension.userData.scaffoldBays).toBeGreaterThan(40);
    expect(extension.userData.fencePanelCount).toBeGreaterThan(100);
  });

  test("fits the known site without pretending the finished project exists", () => {
    const bounds = new Box3().setFromObject(model());
    expect(bounds.min.x).toBeLessThanOrEqual(-749);
    expect(bounds.max.x).toBeGreaterThanOrEqual(-400.1);
    expect(bounds.min.z).toBeLessThanOrEqual(-235);
    expect(bounds.max.z).toBeGreaterThanOrEqual(-96.3);
    expect(bounds.max.y).toBeGreaterThan(44);
    expect(bounds.max.y).toBeLessThan(55);
  });

  test("suppresses stale park staffage only inside the OSM worksite", () => {
    const site = CHANCELLERY_EXTENSION_PROFILE.siteFootprintWorldM;
    expect(pointInWorldRing(-681.77, -177.65, site)).toBe(true);
    expect(isChancelleryExtensionConstructionPoint(-505.76, -187.19)).toBe(
      true,
    );
    expect(isChancelleryExtensionConstructionPoint(-220, -146)).toBe(false);
    expect(isChancelleryExtensionConstructionPoint(-820, -170)).toBe(false);
  });
});
