import { describe, expect, test } from "bun:test";
import {
  Box3,
  Group,
  LineSegments,
  Material,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from "three";

import { createCentralCivicDetails } from "../src/CentralCivicDetails";
import {
  PARISER_PLATZ_ARCHITECTURE_GROUP_NAME,
  PARISER_PLATZ_ARCHITECTURE_PROFILE,
  PARISER_PLATZ_FACADE_NAMES,
  createPariserPlatzArchitecture,
} from "../src/PariserPlatzArchitecture";
import { FINE_DETAIL_LAYER_NAMES } from "../src/fineDetailFade";
import { applyMinecraftVisibility } from "../src/MinecraftVisibility";

const EXPECTED_FACADES = [
  PARISER_PLATZ_FACADE_NAMES.maxLiebermann,
  PARISER_PLATZ_FACADE_NAMES.france,
  PARISER_PLATZ_FACADE_NAMES.usa,
  PARISER_PLATZ_FACADE_NAMES.akademie,
  PARISER_PLATZ_FACADE_NAMES.europeanHouse,
] as const;

function materialsOf(mesh: Mesh): Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

describe("Pariser Platz source-bounded civic architecture", () => {
  test("uses the five exact LoD2/OSM frontages and current primary sources", () => {
    const { buildings } = PARISER_PLATZ_ARCHITECTURE_PROFILE;
    expect(buildings.maxLiebermannHaus).toMatchObject({
      facadeHeightM: 19.791,
      facadeWidthM: 28.08,
      lod2ParentId: "DEBE01YYK0000765",
      osmWayId: 131487807,
      sourceUrl: expect.stringContaining("stiftungbrandenburgertor.de"),
    });
    expect(buildings.frenchEmbassy).toMatchObject({
      facadeHeightM: 19.936,
      facadeWidthM: 52.75,
      lod2ParentId: "DEBE01YYK00009wl",
      osmRelationId: 3203772,
      sourceUrls: expect.arrayContaining([
        expect.stringContaining("2portzamparc.com"),
      ]),
    });
    expect(buildings.usEmbassy).toMatchObject({
      facadeHeightM: 21.414,
      facadeWidthM: 42.02,
      lod2ParentId: "DEBE01YYK00000k5",
      osmWayId: 195257482,
      sourceUrl: expect.stringContaining("moorerubleyudell.com"),
    });
    expect(buildings.akademieDerKuenste).toMatchObject({
      facadeHeightM: 20.211,
      facadeWidthM: 35.87,
      lod2ParentId: "DEBE01YYK00007H6",
      osmWayId: 237816189,
      sourceUrls: expect.arrayContaining([expect.stringContaining("adk.de")]),
    });
    expect(buildings.europeanHouse).toMatchObject({
      address: "Unter den Linden 78",
      facadeHeightM: 26.385,
      roofHeightM: 34.46,
      lod2ParentId: "DEBE01YYK00005TM",
      osmNodeIds: [514881066, 11816495166],
    });
    const [start, end] = buildings.europeanHouse.facadeSourceEdgeWorldM;
    expect(buildings.europeanHouse.facadeCenterWorldM[0]).toBeCloseTo(
      (start[0] + end[0]) / 2,
      8,
    );
    expect(buildings.europeanHouse.facadeCenterWorldM[2]).toBeCloseTo(
      (start[1] + end[1]) / 2,
      8,
    );
    expect(buildings.europeanHouse.facadeWidthM).toBeCloseTo(
      Math.hypot(end[0] - start[0], end[1] - start[1]),
      8,
    );
    for (const building of Object.values(buildings)) {
      expect(building.visualQa.photoBundled).toBe(false);
      expect(building.visualQa.referenceUrl).toContain(
        "commons.wikimedia.org/wiki/File:",
      );
      expect(building.visualQa.license.length).toBeGreaterThan(0);
    }
  });

  test("builds five batched facades at the surveyed edges without photo maps", () => {
    const architecture = createPariserPlatzArchitecture();
    expect(architecture).toBeInstanceOf(Group);
    expect(architecture.name).toBe(PARISER_PLATZ_ARCHITECTURE_GROUP_NAME);
    expect(architecture.children.map(({ name }) => name)).toEqual(
      EXPECTED_FACADES,
    );
    expect(architecture.userData).toMatchObject({
      collisionRole: expect.stringContaining("LoD2"),
      performance: { photoTexturesBundled: false },
      underlyingLoD2Retained: true,
    });

    let drawCalls = 0;
    let vertexCount = 0;
    architecture.traverse((object) => {
      if (!(object instanceof Mesh) && !(object instanceof LineSegments)) {
        return;
      }
      drawCalls += 1;
      vertexCount += object.geometry.getAttribute("position").count;
      if (object instanceof Mesh) {
        for (const material of materialsOf(object)) {
          expect((material as MeshStandardMaterial).map ?? null).toBeNull();
        }
        for (const keyedMaterial of [
          object.userData.dayMaterial,
          object.userData.nightMaterial,
        ]) {
          if (!keyedMaterial) continue;
          expect((keyedMaterial as MeshStandardMaterial).map).toBeNull();
        }
      }
    });
    expect(drawCalls).toBe(15);
    expect(vertexCount).toBeGreaterThan(8_000);
    expect(drawCalls).toBeLessThanOrEqual(
      PARISER_PLATZ_ARCHITECTURE_PROFILE.performance.drawCallBudget,
    );

    for (const facade of architecture.children as Group[]) {
      expect(facade.children.map(({ name }) => name)).toEqual([
        `${facade.name} bodies`,
        `${facade.name} lamps`,
        `${facade.name} ink lines`,
      ]);
      const bounds = new Box3().setFromObject(facade);
      const size = bounds.getSize(new Vector3());
      expect(size.y).toBeGreaterThan(19);
      expect(size.y).toBeLessThan(
        facade.name === PARISER_PLATZ_FACADE_NAMES.europeanHouse ? 35 : 27,
      );
      const lamps = facade.getObjectByName(`${facade.name} lamps`) as Mesh;
      const night = lamps.userData.nightMaterial as MeshStandardMaterial;
      expect(night.userData.nightEmissive).toBe(0xffd29a);
      expect(night.userData.nightEmissiveIntensity).toBe(0.72);
    }
  });

  test("integrates once into the surface-mode civic layer and fades only its overlay", () => {
    const central = createCentralCivicDetails([]);
    expect(
      central.children.filter(
        ({ name }) => name === PARISER_PLATZ_ARCHITECTURE_GROUP_NAME,
      ),
    ).toHaveLength(1);
    expect(PARISER_PLATZ_ARCHITECTURE_PROFILE.surfaceModes).toEqual([
      "day",
      "night",
      "snow",
      "schwellenraum",
    ]);
    for (const name of EXPECTED_FACADES) {
      expect(FINE_DETAIL_LAYER_NAMES).toEqual(
        expect.arrayContaining([
          `${name} bodies`,
          `${name} lamps`,
          `${name} ink lines`,
        ]),
      );
    }
    expect(FINE_DETAIL_LAYER_NAMES).not.toContain(
      PARISER_PLATZ_ARCHITECTURE_GROUP_NAME,
    );
  });

  test("hands Minecraft to the dedicated block batch and restores surface mode reversibly", () => {
    const central = createCentralCivicDetails([]);
    const architecture = central.getObjectByName(
      PARISER_PLATZ_ARCHITECTURE_GROUP_NAME,
    ) as Group;
    const roots = {
      centralDetails: central,
      cityStaffage: new Group(),
      civicDetails: new Group(),
      signatures: new Group(),
    };
    expect(architecture.visible).toBe(true);
    applyMinecraftVisibility(roots, true);
    expect(architecture.visible).toBe(false);
    applyMinecraftVisibility(roots, false);
    expect(architecture.visible).toBe(true);
  });
});
