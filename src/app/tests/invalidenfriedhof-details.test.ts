import { describe, expect, test } from "bun:test";
import {
  Box3,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PointLight,
  Quaternion,
  Vector3,
} from "three";

import {
  INVALIDENFRIEDHOF_DETAIL_PROFILE,
  createInvalidenfriedhofDetails,
  createMinecraftInvalidenfriedhofDetails,
  invalidenfriedhofSolidAt,
  invalidenfriedhofVoxelReplacementAt,
  invalidenfriedhofWalkableInteriorAt,
  setInvalidenfriedhofSnow,
} from "../src/InvalidenfriedhofDetails";
import { NORTHERN_CITY_PROFILE } from "../src/expandedCityProfiles";

function worldFromLocal(
  center: readonly [number, number, number],
  rotationY: number,
  localX: number,
  localY: number,
  localZ: number,
): [number, number, number] {
  const cosine = Math.cos(rotationY);
  const sine = Math.sin(rotationY);
  return [
    center[0] + cosine * localX + sine * localZ,
    center[1] + localY,
    center[2] - sine * localX + cosine * localZ,
  ];
}

function distanceToSegment(
  x: number,
  z: number,
  start: readonly [number, number],
  end: readonly [number, number],
): number {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const denominator = dx * dx + dz * dz;
  const t =
    denominator === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((x - start[0]) * dx + (z - start[1]) * dz) / denominator),
        );
  return Math.hypot(x - (start[0] + dx * t), z - (start[1] + dz * t));
}

function nearestLineDistance(
  x: number,
  z: number,
  lines: readonly (readonly (readonly [number, number])[])[],
): number {
  let nearest = Number.POSITIVE_INFINITY;
  for (const points of lines) {
    for (let index = 0; index < points.length - 1; index += 1) {
      nearest = Math.min(
        nearest,
        distanceToSegment(x, z, points[index], points[index + 1]),
      );
    }
  }
  return nearest;
}

function instancePositions(mesh: InstancedMesh): Vector3[] {
  const matrix = new Matrix4();
  const position = new Vector3();
  const quaternion = new Quaternion();
  const scale = new Vector3();
  return Array.from({ length: mesh.count }, (_, index) => {
    mesh.getMatrixAt(index, matrix);
    matrix.decompose(position, quaternion, scale);
    return position.clone();
  });
}

describe("granular Invalidenfriedhof details", () => {
  test("pins every identified photo subject to OSM or LoD2 evidence", () => {
    const profile = INVALIDENFRIEDHOF_DETAIL_PROFILE;
    const legacy = NORTHERN_CITY_PROFILE.invalidenfriedhof;
    expect(profile.graves.scharnhorst.centerWorldM).toEqual([
      38.597, 5.2, -1425.035,
    ]);
    expect(profile.graves.scharnhorst.sourcePointWorldM).toBe(
      legacy.graveWorldM[7],
    );
    expect(profile.graves.scharnhorst.osmKey).toBe("node/273120316");
    expect(profile.graves.witzleben.sourcePointWorldM).toBe(
      legacy.graveWorldM[10],
    );
    expect(profile.graves.witzleben.osmKey).toBe("node/279219447");
    expect(profile.graves.winterfeld.osmKey).toBe("node/279219439");
    expect(profile.graves.winterfeld.sourcePointWorldM).toBe(
      legacy.graveWorldM[5],
    );
    expect(profile.graves.vonKessel.sourcePointWorldM).toBe(
      legacy.graveWorldM[24],
    );
    expect(profile.graves.vonKessel.osmKey).toBe("node/273120317");
    expect(profile.graves.vonRauch.centerWorldM).toEqual([
      47.117806, 5.2, -1439.965711,
    ]);
    expect(profile.graves.vonRauch.osmKey).toBe("node/281941696");
    expect(profile.graves.vonRauch.sourcePointWorldM).toEqual([
      47.117806, -1439.965711,
    ]);
    expect(profile.graves.vonRauch.absorbedGenericOsmKeys).toEqual([
      "node/281941700",
    ]);
    expect(profile.graves.vonRauch.absorbedGenericSourcePointsWorldM).toEqual([
      legacy.graveWorldM[15],
    ]);
    expect(profile.graves.vonRauch.centerWorldM).not.toEqual([
      47.797, 5.2, -1438.504,
    ]);
    expect(profile.graves.vonRauch.centerWorldM).not.toEqual([
      36.596, 5.2, -1433.193,
    ]);
    expect(profile.augusteViktoriaBell.osmKey).toBe("node/7430297888");
    expect(profile.augusteViktoriaBell.lod2BuildingPartId).toBe("K0001yqp");
    expect(profile.augusteViktoriaBell.lod2BuildingPartFullId).toBe(
      "DEBE01YYK0001yqp",
    );
    expect(profile.augusteViktoriaBell.footprintM).toEqual([5.01, 5]);
    expect(profile.augusteViktoriaBell.measuredHeightM).toBeCloseTo(10.044, 3);
    expect(profile.litfinWatchtower.osmKey).toBe("way/31347999");
    expect(profile.litfinWatchtower.lod2BuildingPartId).toBe("1pC0000R");
    expect(profile.litfinWatchtower.lod2BuildingPartFullId).toBe(
      "DEBE01AL1pC0000R",
    );
    expect(profile.litfinWatchtower.roofFootprintM).toEqual([4.15, 4.16]);
    expect(profile.litfinWatchtower.bodyHeightM).toBeCloseTo(8.946, 3);
    expect(profile.augusteViktoriaBell.sourceUrls).toContain(
      "https://www.gedenktafeln-in-berlin.de/gedenktafeln/detail/augusta-viktoria-glocke",
    );
    expect(profile.litfinWatchtower.sourceUrls).toContain(
      "https://www.stiftung-berliner-mauer.de/de/gedenkstaette-guenter-litfin",
    );
    expect(profile.walls.groundY).toBe(5.2);
    expect(profile.walls.groundY).not.toBe(legacy.groundY);
    expect(profile.walls.canalBrickWallWorldM).toBe(
      legacy.canalBrickWallWorldM,
    );
    expect(profile.modeContract).toContain("all five graves");
    expect(profile.visualReferenceStatus).toContain("reference-only");
    expect(profile.visualReferenceStatus).toContain("no photograph");
  });

  test("renders all characteristic forms in named protected exact-Day roots", () => {
    const root = createInvalidenfriedhofDetails();
    const requiredNames = [
      "Invalidenfriedhof Scharnhorst lion tomb exact Day protected",
      "Scharnhorst two-pier marble sarcophagus",
      "Scharnhorst marble relief frieze figures",
      "Scharnhorst reclining bronze lion body head and paws",
      "Invalidenfriedhof Witzleben canopy exact Day protected",
      "Witzleben Gothic pointed canopy arches",
      "Invalidenfriedhof Winterfeld pedestal exact Day protected",
      "Winterfeld laurel portrait medallion",
      "Winterfeld helmet and feather plume blocks",
      "Invalidenfriedhof von Kessel grave exact Day protected",
      "von Kessel low wrought railing uprights",
      "Invalidenfriedhof Familie von Rauch grave exact Day protected",
      "Familie von Rauch yellow arch",
      "Familie von Rauch white memorial cross",
      "Invalidenfriedhof Auguste-Viktoria bell tower exact Day protected",
      "Auguste-Viktoria bell open steel legs",
      "Auguste-Viktoria visible 1.60 m bell",
      "Auguste-Viktoria faceted upper casing",
      "Günter Litfin watchtower exact Day protected",
      "Günter Litfin sixteen upper observation panes",
      "Günter Litfin eight small shaft windows",
      "Günter Litfin roof railing uprights",
      "Günter Litfin roof railing two horizontal courses",
      "Invalidenfriedhof historic walls exact Day protected",
      "Invalidenfriedhof Hinterlandmauer continuous grey backing shell",
      "Invalidenfriedhof Hinterlandmauer irregular white paint fields",
      "Invalidenfriedhof canal wall white inset fields",
    ];
    for (const name of requiredNames) {
      expect(root.getObjectByName(name), name).not.toBeNull();
    }

    const protectedRoots = root.children.filter(
      (child) => child.userData.schwellenraumGeschuetzt === true,
    );
    expect(protectedRoots).toHaveLength(8);
    for (const protectedRoot of protectedRoots) {
      expect(protectedRoot.userData.motionPolicy).toBe(
        "static in every visual mode",
      );
      expect(protectedRoot.userData.presentationContract).toContain(
        "Exact ordinary Day",
      );
      expect(protectedRoot.userData.sourceKeys.length).toBeGreaterThan(0);
    }
    expect(
      root.getObjectByName(
        "Invalidenfriedhof Scharnhorst lion tomb exact Day protected",
      )!.userData.sourceKeys,
    ).toEqual(["node/273120316"]);
    expect(
      root.getObjectByName(
        "Invalidenfriedhof Familie von Rauch grave exact Day protected",
      )!.userData.sourceKeys,
    ).toEqual(["node/281941696", "node/281941700"]);

    const upperPanes = root.getObjectByName(
      "Günter Litfin sixteen upper observation panes",
    ) as InstancedMesh;
    const smallWindows = root.getObjectByName(
      "Günter Litfin eight small shaft windows",
    ) as InstancedMesh;
    expect(upperPanes.count).toBe(16);
    expect(smallWindows.count).toBe(8);
    expect(
      (root.getObjectByName(
        "Günter Litfin roof railing two horizontal courses",
      ) as InstancedMesh).count,
    ).toBe(8);
    expect(
      (root.getObjectByName(
        "Günter Litfin roof railing uprights",
      ) as InstancedMesh).count,
    ).toBe(22);
    expect(
      root.getObjectByName("Günter Litfin roof railing uprights")!.userData
        .cornerDownpipeCount,
    ).toBe(2);
    expect(
      root.getObjectByName(
        "Günter Litfin roof railing two horizontal courses",
      )!.userData.horizontalCourseCount,
    ).toBe(2);
    expect(
      root.getObjectByName(
        "Günter Litfin sealed door plaques and information board",
      )!.userData.rooftopEquipment,
    ).toContain("not interpreted as a searchlight");

    const litfinShell = root.getObjectByName(
      "Günter Litfin concrete shaft and roof ring",
    ) as InstancedMesh;
    const shellMatrix = new Matrix4();
    const shellPosition = new Vector3();
    const shellQuaternion = new Quaternion();
    const shellScale = new Vector3();
    litfinShell.getMatrixAt(0, shellMatrix);
    shellMatrix.decompose(shellPosition, shellQuaternion, shellScale);
    const shaftTop = shellPosition.y + shellScale.y / 2;
    litfinShell.getMatrixAt(1, shellMatrix);
    shellMatrix.decompose(shellPosition, shellQuaternion, shellScale);
    const observationCabinBottom = shellPosition.y - shellScale.y / 2;
    expect(shaftTop).toBeCloseTo(7.74, 5);
    expect(observationCabinBottom).toBeCloseTo(shaftTop, 5);
  });

  test("keeps field photographs out and batches repeated static detail", () => {
    const root = createInvalidenfriedhofDetails();
    const renderables: Mesh[] = [];
    root.traverse((object) => {
      expect(object).not.toBeInstanceOf(PointLight);
      expect(object.userData.windFlag).toBeUndefined();
      expect(object.userData.windFlagInstances).toBeUndefined();
      if (!(object instanceof Mesh)) return;
      renderables.push(object);
      for (const assigned of Array.isArray(object.material)
        ? object.material
        : [object.material]) {
        expect(assigned.map).toBeNull();
      }
      expect(object.geometry.getAttribute("uv")).toBeUndefined();
    });
    expect(renderables.length).toBeLessThanOrEqual(50);
    expect(
      renderables.filter((object) => object instanceof InstancedMesh).length,
    ).toBeGreaterThan(30);
    expect(root.userData.motionPolicy).toContain("no animated");
    expect(root.userData.texturePolicy).toContain("no image textures");

    const bounds = new Box3().setFromObject(root);
    expect(bounds.min.y).toBeCloseTo(5.2, 5);
    expect(bounds.max.y).toBeGreaterThan(15.2);
    expect(bounds.max.y).toBeLessThan(15.4);
    expect(bounds.min.z).toBeLessThan(-1654);
    expect(bounds.max.z).toBeGreaterThan(-1364);
  });

  test("uses a solid Hinterland shell and offsets both paint systems", () => {
    const root = createInvalidenfriedhofDetails();
    const shell = root.getObjectByName(
      "Invalidenfriedhof Hinterlandmauer continuous grey backing shell",
    ) as InstancedMesh;
    const white = root.getObjectByName(
      "Invalidenfriedhof Hinterlandmauer irregular white paint fields",
    ) as InstancedMesh;
    const canalWhite = root.getObjectByName(
      "Invalidenfriedhof canal wall white inset fields",
    ) as InstancedMesh;
    const matrix = new Matrix4();
    const position = new Vector3();
    const quaternion = new Quaternion();
    const scale = new Vector3();
    for (let index = 0; index < shell.count; index += 1) {
      shell.getMatrixAt(index, matrix);
      matrix.decompose(position, quaternion, scale);
      expect(scale.y).toBeCloseTo(3.4, 4);
      expect(scale.z).toBeCloseTo(0.34, 4);
    }

    const hinterlandLines =
      INVALIDENFRIEDHOF_DETAIL_PROFILE.walls.hinterlandWallSegmentsWorldM;
    for (const paintPosition of instancePositions(white)) {
      expect(
        nearestLineDistance(
          paintPosition.x,
          paintPosition.z,
          hinterlandLines,
        ),
      ).toBeGreaterThan(0.17);
      expect(
        nearestLineDistance(
          paintPosition.x,
          paintPosition.z,
          hinterlandLines,
        ),
      ).toBeLessThan(0.24);
    }
    const canalLines = [
      INVALIDENFRIEDHOF_DETAIL_PROFILE.walls.canalBrickWallWorldM,
    ] as const;
    for (const paintPosition of instancePositions(canalWhite)) {
      expect(
        nearestLineDistance(paintPosition.x, paintPosition.z, canalLines),
      ).toBeGreaterThan(0.23);
      expect(
        nearestLineDistance(paintPosition.x, paintPosition.z, canalLines),
      ).toBeLessThan(0.3);
    }
  });

  test("adds hidden horizontal-only snow to graves, towers and both walls", () => {
    const root = createInvalidenfriedhofDetails();
    const snow = root.getObjectByName(
      "Invalidenfriedhof horizontal snow caps",
    )!;
    const hinterlandSnow = root.getObjectByName(
      "Invalidenfriedhof Hinterlandmauer horizontal snow caps",
    ) as InstancedMesh;
    expect(snow.visible).toBeFalse();
    expect(snow.userData.surfacePolicy).toBe("horizontal top faces only");
    expect(hinterlandSnow.count).toBe(3);
    const graveSnow = root.getObjectByName(
      "Invalidenfriedhof grave horizontal snow caps",
    ) as InstancedMesh;
    const graveSnowPositions = instancePositions(graveSnow);
    expect(graveSnowPositions[0].y).toBeCloseTo(7.1675, 4);
    const rauch = INVALIDENFRIEDHOF_DETAIL_PROFILE.graves.vonRauch;
    const rauchSnow = graveSnowPositions.filter(
      (position) =>
        Math.hypot(
          position.x - rauch.centerWorldM[0],
          position.z - rauch.centerWorldM[2],
        ) < 3,
    );
    expect(rauchSnow).toHaveLength(3);
    expect(Math.max(...rauchSnow.map(({ y }) => y))).toBeCloseTo(9.405, 4);

    const matrix = new Matrix4();
    const position = new Vector3();
    const quaternion = new Quaternion();
    const scale = new Vector3();
    snow.traverse((object) => {
      if (!(object instanceof InstancedMesh)) return;
      for (let index = 0; index < object.count; index += 1) {
        object.getMatrixAt(index, matrix);
        matrix.decompose(position, quaternion, scale);
        expect(scale.y).toBeLessThan(0.06);
        expect(scale.y).toBeLessThan(scale.x);
        expect(scale.y).toBeLessThan(scale.z);
      }
    });

    const bell = root.getObjectByName(
      "Auguste-Viktoria visible 1.60 m bell",
    )!;
    const bellMatrix = bell.matrix.toArray();
    setInvalidenfriedhofSnow(root, true);
    expect(snow.visible).toBeTrue();
    expect(snow.userData.snowActive).toBeTrue();
    expect(bell.matrix.toArray()).toEqual(bellMatrix);
    setInvalidenfriedhofSnow(root, false);
    expect(snow.visible).toBeFalse();
  });

  test("collides with represented solids while keeping open structures and paths open", () => {
    const graves = INVALIDENFRIEDHOF_DETAIL_PROFILE.graves;
    expect(
      invalidenfriedhofSolidAt(
        ...worldFromLocal(graves.scharnhorst.centerWorldM, -0.08, 0, 0.1, 0),
      ),
    ).toBeTrue();
    expect(
      invalidenfriedhofSolidAt(
        ...worldFromLocal(graves.scharnhorst.centerWorldM, -0.08, 0, 0.9, 0),
      ),
    ).toBeFalse();
    expect(
      invalidenfriedhofSolidAt(
        ...worldFromLocal(graves.scharnhorst.centerWorldM, -0.08, 2.8, 0.7, 0),
      ),
    ).toBeTrue();

    expect(
      invalidenfriedhofSolidAt(
        ...worldFromLocal(graves.witzleben.centerWorldM, 0.04, 0.45, 1.8, 0.45),
      ),
    ).toBeFalse();
    expect(
      invalidenfriedhofSolidAt(
        ...worldFromLocal(graves.winterfeld.centerWorldM, -0.06, 0, 1.6, 0),
      ),
    ).toBeTrue();
    expect(
      invalidenfriedhofSolidAt(
        ...worldFromLocal(graves.winterfeld.centerWorldM, -0.06, 1.4, 1.6, 0),
      ),
    ).toBeFalse();
    expect(
      invalidenfriedhofSolidAt(
        ...worldFromLocal(graves.vonKessel.centerWorldM, -0.12, 0, 1.3, 0),
      ),
    ).toBeFalse();
    expect(
      invalidenfriedhofSolidAt(
        ...worldFromLocal(graves.vonRauch.centerWorldM, 0.16, 1, 1.8, 0),
      ),
    ).toBeFalse();

    const bell = INVALIDENFRIEDHOF_DETAIL_PROFILE.augusteViktoriaBell;
    expect(
      invalidenfriedhofSolidAt(
        ...worldFromLocal(bell.centerWorldM, bell.rotationY, 0, 1, 0),
      ),
    ).toBeFalse();
    expect(
      invalidenfriedhofSolidAt(
        ...worldFromLocal(bell.centerWorldM, bell.rotationY, 1.95, 1, 1.95),
        0.05,
      ),
    ).toBeTrue();
    expect(
      invalidenfriedhofSolidAt(
        ...worldFromLocal(bell.centerWorldM, bell.rotationY, 0, 3, 0),
      ),
    ).toBeTrue();

    const litfin = INVALIDENFRIEDHOF_DETAIL_PROFILE.litfinWatchtower;
    expect(
      invalidenfriedhofSolidAt(
        ...worldFromLocal(litfin.centerWorldM, litfin.rotationY, 0, 3, 0),
      ),
    ).toBeTrue();
    expect(
      invalidenfriedhofSolidAt(
        ...worldFromLocal(litfin.centerWorldM, litfin.rotationY, 1.8, 2, 0),
      ),
    ).toBeFalse();
    expect(
      invalidenfriedhofSolidAt(
        ...worldFromLocal(litfin.centerWorldM, litfin.rotationY, 0, 1, 3.08),
      ),
    ).toBeTrue();

    const wall = INVALIDENFRIEDHOF_DETAIL_PROFILE.walls.canalBrickWallWorldM;
    const wallMidpoint: [number, number, number] = [
      (wall[0][0] + wall[1][0]) / 2,
      INVALIDENFRIEDHOF_DETAIL_PROFILE.walls.groundY + 1,
      (wall[0][1] + wall[1][1]) / 2,
    ];
    expect(invalidenfriedhofSolidAt(...wallMidpoint)).toBeTrue();
    const canalDx = wall[1][0] - wall[0][0];
    const canalDz = wall[1][1] - wall[0][1];
    const canalLength = Math.hypot(canalDx, canalDz);
    expect(
      invalidenfriedhofSolidAt(
        wallMidpoint[0] - (canalDz / canalLength) * 0.46,
        wallMidpoint[1],
        wallMidpoint[2] + (canalDx / canalLength) * 0.46,
        0.2,
      ),
    ).toBeFalse();
    const hinterland =
      INVALIDENFRIEDHOF_DETAIL_PROFILE.walls.hinterlandWallSegmentsWorldM[0];
    const hinterlandMidpoint: [number, number, number] = [
      (hinterland[0][0] + hinterland[1][0]) / 2,
      INVALIDENFRIEDHOF_DETAIL_PROFILE.walls.groundY + 1,
      (hinterland[0][1] + hinterland[1][1]) / 2,
    ];
    const hinterlandDx = hinterland[1][0] - hinterland[0][0];
    const hinterlandDz = hinterland[1][1] - hinterland[0][1];
    const hinterlandLength = Math.hypot(hinterlandDx, hinterlandDz);
    expect(
      invalidenfriedhofSolidAt(
        hinterlandMidpoint[0] - (hinterlandDz / hinterlandLength) * 0.38,
        hinterlandMidpoint[1],
        hinterlandMidpoint[2] + (hinterlandDx / hinterlandLength) * 0.38,
        0.2,
      ),
    ).toBeFalse();
    expect(invalidenfriedhofSolidAt(10, 6.2, -1500, 0.2)).toBeFalse();
    expect(invalidenfriedhofSolidAt(Number.NaN, 6, -1500)).toBeFalse();
  });

  test("owns only the two exact rotated LoD2 replacement footprints", () => {
    const profile = INVALIDENFRIEDHOF_DETAIL_PROFILE;
    expect(
      invalidenfriedhofVoxelReplacementAt(
        profile.litfinWatchtower.centerWorldM[0],
        profile.litfinWatchtower.centerWorldM[2],
      ),
    ).toBe("litfin-watchtower");
    expect(
      invalidenfriedhofVoxelReplacementAt(
        profile.augusteViktoriaBell.centerWorldM[0],
        profile.augusteViktoriaBell.centerWorldM[2],
      ),
    ).toBe("auguste-viktoria-bell");
    const litfinOutside = worldFromLocal(
      profile.litfinWatchtower.centerWorldM,
      profile.litfinWatchtower.rotationY,
      profile.litfinWatchtower.roofFootprintM[0] / 2 + 0.05,
      0,
      0,
    );
    expect(
      invalidenfriedhofVoxelReplacementAt(litfinOutside[0], litfinOutside[2]),
    ).toBeNull();
    expect(
      invalidenfriedhofVoxelReplacementAt(
        profile.graves.scharnhorst.centerWorldM[0],
        profile.graves.scharnhorst.centerWorldM[2],
      ),
    ).toBeNull();
    expect(invalidenfriedhofVoxelReplacementAt(Number.NaN, 0)).toBeNull();
  });

  test("opens only the real bell undercroft inside the closed LoD2 prism", () => {
    const bell = INVALIDENFRIEDHOF_DETAIL_PROFILE.augusteViktoriaBell;
    const center = worldFromLocal(bell.centerWorldM, bell.rotationY, 0, 1, 0);
    expect(
      invalidenfriedhofWalkableInteriorAt(
        ...center,
        bell.lod2BuildingPartId,
        0.2,
      ),
    ).toBeTrue();
    const leg = worldFromLocal(
      bell.centerWorldM,
      bell.rotationY,
      1.95,
      1,
      1.95,
    );
    expect(
      invalidenfriedhofWalkableInteriorAt(
        ...leg,
        bell.lod2BuildingPartId,
        0.2,
      ),
    ).toBeFalse();
    const bellBody = worldFromLocal(
      bell.centerWorldM,
      bell.rotationY,
      0,
      3,
      0,
    );
    expect(
      invalidenfriedhofWalkableInteriorAt(
        ...bellBody,
        bell.lod2BuildingPartId,
        0.2,
      ),
    ).toBeFalse();
    const casing = worldFromLocal(
      bell.centerWorldM,
      bell.rotationY,
      0,
      5,
      0,
    );
    expect(
      invalidenfriedhofWalkableInteriorAt(
        ...casing,
        bell.lod2BuildingPartId,
      ),
    ).toBeFalse();
    expect(
      invalidenfriedhofWalkableInteriorAt(
        ...center,
        INVALIDENFRIEDHOF_DETAIL_PROFILE.litfinWatchtower.lod2BuildingPartId,
      ),
    ).toBeFalse();
    expect(
      invalidenfriedhofWalkableInteriorAt(
        ...center,
        bell.lod2BuildingPartFullId,
      ),
    ).toBeFalse();
  });

  test("builds every Minecraft signature from one shared opaque cube", () => {
    const root = createMinecraftInvalidenfriedhofDetails();
    expect(root.userData.blockNative).toBeTrue();
    expect(root.userData.signatureIds).toEqual([
      "scharnhorst-lion-tomb",
      "witzleben-green-canopy-tomb",
      "hans-carl-von-winterfeld-pedestal",
      "von-kessel-fenced-slab",
      "familie-von-rauch-yellow-arch",
      "auguste-viktoria-bell",
      "litfin-watchtower",
      "invalidenfriedhof-historic-walls",
    ]);
    expect(root.children.length).toBeLessThanOrEqual(10);
    expect(root.userData.drawCallCount).toBe(root.children.length);
    expect(root.userData.instanceCount).toBeGreaterThan(1_400);
    const batches = root.children as InstancedMesh[];
    const sharedGeometry = batches[0].geometry;
    for (const batch of batches) {
      expect(batch).toBeInstanceOf(InstancedMesh);
      expect(batch.geometry).toBe(sharedGeometry);
      expect(batch.geometry.type).toBe("BoxGeometry");
      expect(batch.geometry.getAttribute("uv")).toBeUndefined();
      const assigned = batch.material as MeshStandardMaterial;
      expect(assigned.map).toBeNull();
      expect(assigned.transparent).toBeFalse();
      expect(assigned.opacity).toBe(1);
      expect(batch.userData.blockNative).toBeTrue();
    }
    expect(
      (root.getObjectByName(
        "Minecraft Invalidenfriedhof glass blocks",
      ) as InstancedMesh).count,
    ).toBeGreaterThanOrEqual(32);
    expect(
      (root.getObjectByName(
        "Minecraft Invalidenfriedhof bellSteel blocks",
      ) as InstancedMesh).count,
    ).toBe(8);

    const bounds = new Box3().setFromObject(root);
    expect(bounds.min.y).toBeCloseTo(5.2, 5);
    expect(bounds.max.y).toBeGreaterThan(15.2);
    expect(bounds.min.z).toBeLessThan(-1654);
  });

  test("is deterministic in both drawn and Minecraft rebuilds", () => {
    const first = createInvalidenfriedhofDetails();
    const second = createInvalidenfriedhofDetails();
    const firstLion = first.getObjectByName(
      "Scharnhorst reclining bronze lion body head and paws",
    ) as InstancedMesh;
    const secondLion = second.getObjectByName(
      "Scharnhorst reclining bronze lion body head and paws",
    ) as InstancedMesh;
    expect(Array.from(firstLion.instanceMatrix.array)).toEqual(
      Array.from(secondLion.instanceMatrix.array),
    );

    const firstMinecraft = createMinecraftInvalidenfriedhofDetails();
    const secondMinecraft = createMinecraftInvalidenfriedhofDetails();
    for (let index = 0; index < firstMinecraft.children.length; index += 1) {
      const firstBatch = firstMinecraft.children[index] as InstancedMesh;
      const secondBatch = secondMinecraft.children[index] as InstancedMesh;
      expect(firstBatch.name).toBe(secondBatch.name);
      expect(Array.from(firstBatch.instanceMatrix.array)).toEqual(
        Array.from(secondBatch.instanceMatrix.array),
      );
    }
  });
});
