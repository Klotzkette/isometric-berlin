import { describe, expect, test } from "bun:test";
import {
  Box3,
  InstancedMesh,
  LineSegments,
  Material,
  Matrix4,
  Mesh,
  Vector3,
} from "three";

import {
  MOABIT_PRISON_MEMORIAL_MARKER_HEIGHT_M,
  MOABIT_PRISON_MEMORIAL_MARKER_Y,
  MOABIT_PRISON_MEMORIAL_PROFILE,
  MOABIT_PRISON_PARK_SOURCE_PROFILE,
  createMoabitPrisonMemorialPark,
  createMoabitPrisonMemorialParkMinecraft,
  moabitPrisonMemorialDetailFocusForMode,
  moabitPrisonMemorialDetailFocusTarget,
  moabitPrisonMemorialFocusForMode,
  moabitPrisonMemorialFocusTarget,
  moabitPrisonMemorialRenderStats,
  moabitPrisonMemorialSiteFocusForMode,
  moabitPrisonMemorialSiteFocusTarget,
  moabitPrisonMemorialSolidAt,
  setMoabitPrisonMemorialFineVisibility,
  setMoabitPrisonMemorialMicroVisibility,
  setMoabitPrisonMemorialSmoothVisibility,
  setMoabitPrisonMemorialSnow,
} from "../src/MoabitPrisonMemorialPark";

type Point2 = readonly [number, number];

function midpoint(start: Point2, end: Point2): Point2 {
  return [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
}

function materialsOf(material: Material | Material[]): Material[] {
  return Array.isArray(material) ? material : [material];
}

function pointInPolygon(point: Point2, polygon: readonly Point2[]): boolean {
  let inside = false;
  for (
    let current = 0, previous = polygon.length - 1;
    current < polygon.length;
    previous = current, current += 1
  ) {
    const [x, z] = polygon[current];
    const [previousX, previousZ] = polygon[previous];
    if (
      z > point[1] !== previousZ > point[1] &&
      point[0] <
        ((previousX - x) * (point[1] - z)) / (previousZ - z) + x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function orientation(a: Point2, b: Point2, c: Point2): number {
  return (b[0] - a[0]) * (c[1] - a[1]) -
    (b[1] - a[1]) * (c[0] - a[0]);
}

function polygonsOverlap(
  first: readonly Point2[],
  second: readonly Point2[],
): boolean {
  if (
    first.some((point) => pointInPolygon(point, second)) ||
    second.some((point) => pointInPolygon(point, first))
  ) {
    return true;
  }
  for (let firstIndex = 0; firstIndex < first.length; firstIndex += 1) {
    const firstStart = first[firstIndex];
    const firstEnd = first[(firstIndex + 1) % first.length];
    for (let secondIndex = 0; secondIndex < second.length; secondIndex += 1) {
      const secondStart = second[secondIndex];
      const secondEnd = second[(secondIndex + 1) % second.length];
      if (segmentsIntersect(firstStart, firstEnd, secondStart, secondEnd)) {
        return true;
      }
    }
  }
  return false;
}

function segmentsIntersect(
  firstStart: Point2,
  firstEnd: Point2,
  secondStart: Point2,
  secondEnd: Point2,
): boolean {
  const onSegment = (start: Point2, end: Point2, point: Point2): boolean =>
    point[0] >= Math.min(start[0], end[0]) - 1e-9 &&
    point[0] <= Math.max(start[0], end[0]) + 1e-9 &&
    point[1] >= Math.min(start[1], end[1]) - 1e-9 &&
    point[1] <= Math.max(start[1], end[1]) + 1e-9;
  const firstStartSide = orientation(firstStart, firstEnd, secondStart);
  const firstEndSide = orientation(firstStart, firstEnd, secondEnd);
  const secondStartSide = orientation(secondStart, secondEnd, firstStart);
  const secondEndSide = orientation(secondStart, secondEnd, firstEnd);
  if (
    ((firstStartSide > 1e-9 && firstEndSide < -1e-9) ||
      (firstStartSide < -1e-9 && firstEndSide > 1e-9)) &&
    ((secondStartSide > 1e-9 && secondEndSide < -1e-9) ||
      (secondStartSide < -1e-9 && secondEndSide > 1e-9))
  ) {
    return true;
  }
  return (
    (Math.abs(firstStartSide) <= 1e-9 &&
      onSegment(firstStart, firstEnd, secondStart)) ||
    (Math.abs(firstEndSide) <= 1e-9 &&
      onSegment(firstStart, firstEnd, secondEnd)) ||
    (Math.abs(secondStartSide) <= 1e-9 &&
      onSegment(secondStart, secondEnd, firstStart)) ||
    (Math.abs(secondEndSide) <= 1e-9 &&
      onSegment(secondStart, secondEnd, firstEnd))
  );
}

describe("source-bound Moabit prison memorial park", () => {
  test("freezes the present park, historic prison and exact source identities", () => {
    const profile = MOABIT_PRISON_MEMORIAL_PROFILE;
    expect(MOABIT_PRISON_PARK_SOURCE_PROFILE.sourceParkWayId).toBe(
      "498278335",
    );
    expect(profile.osmKey).toBe("way/498278335");
    expect(profile.presentDayIdentity.wikidata).toBe("Q15111585");
    expect(profile.commemoratedHistoricIdentity.wikidata).toBe("Q187723");
    expect(profile.officialMonumentObject).toBe("09050274");
    expect(profile.preservedWallWayIds).toEqual([
      "53178124",
      "105495351",
      "498279237",
      "498279239",
    ]);
    expect(profile.panopticon.osmKey).toBe("way/195086492");
    expect(profile.walkInCell).toMatchObject({
      osmKey: "node/2310445137",
      lod2BuildingId: "DEBE01AL2yz00000",
    });
    expect(profile.informationArtwork.osmKey).toBe("node/5772396362");
    expect(profile.memorialPlaque.osmKey).toBe("node/3841135547");
    expect(profile.sources).toContain(
      "https://www.openstreetmap.org/way/195086492",
    );
    expect(profile.sources).toContain(
      "https://www.openstreetmap.org/node/2310445137",
    );
    expect(profile.sources).toContain(
      "https://www.openstreetmap.org/node/5772396362",
    );
    expect(profile.modelOwnership.retainedLod2PrismIds).toEqual([
      "2yz00000",
    ]);
    expect(profile.modelOwnership.genericArtworkSuppressionKeys).toEqual([
      "way/195086492",
      "node/2310445137",
    ]);
    expect(profile.modelOwnership.retainedGenericOsmKeys).toEqual([
      "node/3841135547",
    ]);
  });

  test("keeps source scope and present-day interpretation non-contradictory", () => {
    const profile = MOABIT_PRISON_MEMORIAL_PROFILE;
    expect(profile.currentInterpretiveWingCount).toBe(4);
    expect(profile.historicalPrisonWingCount).toBe(5);
    expect(profile.reconstructedCellCount).toBe(0);
    expect(profile.reconstructedBuildingCount).toBe(0);
    expect(profile.retainedPublicRealm.treesInsideExactPark).toBe(175);
    expect(profile.retainedPublicRealm.lights).toBe(9);
    expect(profile.wallHeightConflict.explicitOsmWayHeightM).toEqual({
      "105495351": 4,
    });
    expect(profile.wallReading).toContain("north and south");
    expect(profile.referencePolicy).toContain("no plan");
    expect(profile.referencePolicy).toContain("photograph");
    expect(profile.sourceRoles.jvaHistory).toContain("different current JVA");
    expect(profile.sourceRoles.mittePress2026).toContain("not detailed geometry");
  });

  test("builds separately fadeable structural, mortar and interpretive layers", () => {
    const root = createMoabitPrisonMemorialPark("full");
    const structure = root.getObjectByName(
      "Geschichtspark Moabit structural red-brick walls",
    )!;
    const mortar = root.getObjectByName(
      "Geschichtspark Moabit brick mortar courses",
    )!;
    const fine = root.getObjectByName(
      "Geschichtspark Moabit interpretive memorial details",
    )!;
    expect(structure.userData.alwaysOnStructuralDetail).toBe(true);
    expect(mortar.userData.moabitPrisonMemorialMicro).toBe(true);
    expect(fine.userData.moabitPrisonMemorialFine).toBe(true);

    setMoabitPrisonMemorialFineVisibility(root, false);
    setMoabitPrisonMemorialMicroVisibility(root, false);
    expect(structure.visible).toBe(true);
    expect(mortar.visible).toBe(false);
    expect(fine.visible).toBe(false);
    setMoabitPrisonMemorialFineVisibility(root, true);
    setMoabitPrisonMemorialMicroVisibility(root, true);
    expect(mortar.visible).toBe(true);
    expect(fine.visible).toBe(true);

    setMoabitPrisonMemorialSmoothVisibility(root, false);
    expect(root.visible).toBe(false);
    setMoabitPrisonMemorialSmoothVisibility(root, true);
    expect(root.visible).toBe(true);
  });

  test("uses reversible additive snow without moving source geometry", () => {
    const root = createMoabitPrisonMemorialPark("full");
    const sourcePosition = root.position.toArray();
    const snowObjects = root.children.filter(
      (object) => object.userData.snowOnly === true,
    );
    expect(snowObjects).toHaveLength(1);
    expect(snowObjects[0].visible).toBe(false);

    setMoabitPrisonMemorialSnow(root, true);
    setMoabitPrisonMemorialSnow(root, true);
    expect(snowObjects[0].visible).toBe(true);
    expect(snowObjects[0].userData.snowActive).toBe(true);
    expect(root.position.toArray()).toEqual(sourcePosition);

    setMoabitPrisonMemorialSnow(root, false);
    setMoabitPrisonMemorialSnow(root, false);
    expect(snowObjects[0].visible).toBe(false);
    expect(snowObjects[0].userData.snowActive).toBe(false);
    expect(root.position.toArray()).toEqual(sourcePosition);
  });

  test("is procedural and stays within the bounded smooth mobile budget", () => {
    const full = createMoabitPrisonMemorialPark("full");
    const mobile = createMoabitPrisonMemorialPark("mobile");
    expect(moabitPrisonMemorialRenderStats(full)).toEqual({
      renderables: 5,
      renderedVertices: 7_818,
    });
    expect(moabitPrisonMemorialRenderStats(mobile)).toEqual({
      renderables: 5,
      renderedVertices: 5_448,
    });
    full.traverse((object) => {
      if (!(object instanceof Mesh) && !(object instanceof LineSegments)) return;
      for (const material of materialsOf(object.material)) {
        expect((material as Material & { map?: unknown }).map ?? null).toBeNull();
      }
    });
    const objectNames: string[] = [];
    full.traverse((object) => objectNames.push(object.name));
    expect(objectNames.join("|")).not.toMatch(/Klopfzeichen|walk-in cell/i);
    expect(full.userData.preservedLod2BuildingIds).toEqual([
      "DEBE01AL2yz00000",
    ]);
    expect(full.userData.preservedLod2PrismIds).toEqual(["2yz00000"]);
  });

  test("keeps exact walls, mapped gates and the open Panoptikum analytical", () => {
    const profile = MOABIT_PRISON_MEMORIAL_PROFILE;
    const groundY = profile.groundY;
    const tallWallPoint = midpoint(
      profile.preservedWallPathsWorldM[0][0],
      profile.preservedWallPathsWorldM[0][1],
    );
    const fourMetreWallPoint = midpoint(
      profile.preservedWallPathsWorldM[1][0],
      profile.preservedWallPathsWorldM[1][1],
    );
    const mappedGatePoint = midpoint(
      profile.preservedWallPathsWorldM[2].at(-1)!,
      profile.preservedWallPathsWorldM[3][0],
    );
    expect(
      moabitPrisonMemorialSolidAt(
        tallWallPoint[0],
        groundY + 4.5,
        tallWallPoint[1],
      ),
    ).toBe(true);
    expect(
      moabitPrisonMemorialSolidAt(
        fourMetreWallPoint[0],
        groundY + 3.8,
        fourMetreWallPoint[1],
      ),
    ).toBe(true);
    expect(
      moabitPrisonMemorialSolidAt(
        fourMetreWallPoint[0],
        groundY + 4.5,
        fourMetreWallPoint[1],
      ),
    ).toBe(false);
    expect(
      moabitPrisonMemorialSolidAt(
        mappedGatePoint[0],
        groundY + 1,
        mappedGatePoint[1],
      ),
    ).toBe(false);

    const panCorner = profile.panopticon.ringWorldM[0];
    const panBeam = midpoint(
      profile.panopticon.ringWorldM[0],
      profile.panopticon.ringWorldM[1],
    );
    expect(
      moabitPrisonMemorialSolidAt(
        profile.panopticon.centerWorldM[0],
        groundY + 1,
        profile.panopticon.centerWorldM[1],
      ),
    ).toBe(false);
    expect(
      moabitPrisonMemorialSolidAt(
        panCorner[0],
        groundY + 1,
        panCorner[1],
      ),
    ).toBe(true);
    expect(
      moabitPrisonMemorialSolidAt(
        panBeam[0],
        groundY + 3.43,
        panBeam[1],
      ),
    ).toBe(true);
  });

  test("mirrors the retained exact cell collision without adding a second shell", () => {
    const profile = MOABIT_PRISON_MEMORIAL_PROFILE;
    const footprint = profile.walkInCell.footprintWorldM;
    const center: Point2 = [
      footprint.reduce((sum, point) => sum + point[0], 0) / footprint.length,
      footprint.reduce((sum, point) => sum + point[1], 0) / footprint.length,
    ];
    expect(
      moabitPrisonMemorialSolidAt(
        center[0],
        profile.groundY + 1,
        center[1],
      ),
    ).toBe(true);
    expect(
      moabitPrisonMemorialSolidAt(
        profile.centerWorldM[0],
        profile.groundY + 1,
        profile.centerWorldM[1],
      ),
    ).toBe(false);
    expect(moabitPrisonMemorialSolidAt(Number.NaN, 0, 0)).toBe(false);
    expect(profile.modelOwnership.cellPolicy).toContain("add no second cell");
  });

  test("has one opaque block-native Minecraft batch and no cell replacement", () => {
    const full = createMoabitPrisonMemorialParkMinecraft("full");
    const mobile = createMoabitPrisonMemorialParkMinecraft("mobile");
    expect(full).toBeInstanceOf(InstancedMesh);
    expect(full.count).toBe(3_882);
    expect(mobile.count).toBe(2_093);
    expect(full.userData.exactOneBatch).toBe(true);
    expect(full.userData.blockNative).toBe(true);
    expect(full.userData.smoothGeometryExcluded).toBe(true);
    expect(full.userData.textureFree).toBe(true);
    expect(full.instanceColor).not.toBeNull();
    expect(full.userData.preservedLod2BuildingIds).toEqual([
      "DEBE01AL2yz00000",
    ]);
    expect(full.userData.preservedLod2PrismIds).toEqual(["2yz00000"]);
    expect(full.userData.retainedCellPolicy).toContain("existing source voxel");
  });

  test("keeps every new smooth and Minecraft solid outside the retained source cell", () => {
    const profile = MOABIT_PRISON_MEMORIAL_PROFILE;
    const cosine = Math.cos(profile.rotationY);
    const sine = Math.sin(profile.rotationY);
    const cellPlanX = profile.walkInCell.footprintWorldM.map(([x, z]) => {
      const deltaX = x - profile.panopticon.centerWorldM[0];
      const deltaZ = z - profile.panopticon.centerWorldM[1];
      return deltaX * cosine - deltaZ * sine;
    });
    expect(profile.walkInCell.wingAHedgeEndLocalXM).toBeLessThan(
      Math.min(...cellPlanX) - 0.5,
    );

    for (const detailProfile of ["full", "mobile"] as const) {
      const root = createMoabitPrisonMemorialPark(detailProfile);
      root.updateMatrixWorld(true);
      root.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const position = object.geometry.getAttribute("position");
        const index = object.geometry.getIndex();
        const vertex = (offset: number): Point2 => {
          const sourceIndex = index ? index.getX(offset) : offset;
          const world = new Vector3()
            .fromBufferAttribute(position, sourceIndex)
            .applyMatrix4(object.matrixWorld);
          return [world.x, world.z];
        };
        const triangleCount = (index?.count ?? position.count) / 3;
        for (let triangle = 0; triangle < triangleCount; triangle += 1) {
          expect(
            polygonsOverlap(
              [
                vertex(triangle * 3),
                vertex(triangle * 3 + 1),
                vertex(triangle * 3 + 2),
              ],
              profile.walkInCell.footprintWorldM,
            ),
            `${detailProfile} ${object.name} triangle ${triangle} intersects retained cell`,
          ).toBeFalse();
        }
      });
    }

    for (const detailProfile of ["full", "mobile"] as const) {
      const mesh = createMoabitPrisonMemorialParkMinecraft(detailProfile);
      mesh.updateMatrixWorld(true);
      const instanceMatrix = new Matrix4();
      for (let index = 0; index < mesh.count; index += 1) {
        mesh.getMatrixAt(index, instanceMatrix);
        instanceMatrix.premultiply(mesh.matrixWorld);
        const blockFootprint = [
          [-0.5, -0.5],
          [0.5, -0.5],
          [0.5, 0.5],
          [-0.5, 0.5],
        ].map(([x, z]) => {
          const world = new Vector3(x, 0, z).applyMatrix4(instanceMatrix);
          return [world.x, world.z] as const;
        });
        expect(
          polygonsOverlap(
            blockFootprint,
            profile.walkInCell.footprintWorldM,
          ),
          `${detailProfile} hedge block ${index} intersects retained cell`,
        ).toBeFalse();
      }
    }
  });

  test("uses a close recognition focus and keeps an explicit whole-site overview", () => {
    const profile = MOABIT_PRISON_MEMORIAL_PROFILE;
    expect(moabitPrisonMemorialFocusForMode("day").distanceM).toBe(128);
    expect(moabitPrisonMemorialFocusForMode("minecraft").distanceM).toBe(142);
    expect(moabitPrisonMemorialDetailFocusForMode("day").distanceM).toBe(128);
    expect(
      moabitPrisonMemorialDetailFocusForMode("minecraft").distanceM,
    ).toBe(142);
    expect(moabitPrisonMemorialFocusTarget()).toEqual([
      profile.panopticon.centerWorldM[0],
      profile.groundY,
      profile.panopticon.centerWorldM[1],
    ]);
    expect(moabitPrisonMemorialDetailFocusTarget()).toEqual([
      profile.panopticon.centerWorldM[0],
      profile.groundY,
      profile.panopticon.centerWorldM[1],
    ]);
    expect(moabitPrisonMemorialSiteFocusForMode("day").distanceM).toBe(278);
    expect(moabitPrisonMemorialSiteFocusForMode("minecraft").distanceM).toBe(
      294,
    );
    expect(moabitPrisonMemorialSiteFocusTarget()).toEqual([
      profile.centerWorldM[0],
      profile.groundY,
      profile.centerWorldM[1],
    ]);
    expect(MOABIT_PRISON_MEMORIAL_MARKER_HEIGHT_M).toBe(5);
    expect(MOABIT_PRISON_MEMORIAL_MARKER_Y).toBe(profile.groundY + 5);
  });

  test("covers every exact wall anchor inside its source-bound world bounds", () => {
    const root = createMoabitPrisonMemorialPark("full");
    root.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(root);
    for (const path of MOABIT_PRISON_MEMORIAL_PROFILE.preservedWallPathsWorldM) {
      for (const [x, z] of path) {
        expect(bounds.containsPoint(new Vector3(x, root.position.y, z))).toBe(
          true,
        );
      }
    }
  });
});
