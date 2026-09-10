import { describe, expect, test } from "bun:test";
import {
  Box3,
  BoxGeometry,
  Color,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Raycaster,
  Vector3,
} from "three";

import {
  WAGNER_MEMORIAL_PRISM_IDS,
  WAGNER_MEMORIAL_PROFILE,
  createWagnerMemorial,
  createWagnerMemorialMinecraft,
  setWagnerMemorialSnow,
  setWagnerMemorialSmoothVisibility,
  wagnerMemorialFocusForMode,
  wagnerMemorialRenderStats,
  wagnerMemorialSolidAt,
  wagnerMemorialVoxelReplacementAt,
  wagnerMemorialWalkableInteriorAt,
} from "../src/WagnerMemorial";

function localToWorld(
  localX: number,
  localY: number,
  localZ: number,
): readonly [number, number, number] {
  const [worldX, groundY, worldZ] = WAGNER_MEMORIAL_PROFILE.worldM;
  const cosine = Math.cos(WAGNER_MEMORIAL_PROFILE.rotationY);
  const sine = Math.sin(WAGNER_MEMORIAL_PROFILE.rotationY);
  return [
    worldX + cosine * localX + sine * localZ,
    groundY + localY,
    worldZ - sine * localX + cosine * localZ,
  ];
}

function renderables(root: Object3D): Array<Mesh | LineSegments> {
  const result: Array<Mesh | LineSegments> = [];
  root.traverse((object) => {
    if (object instanceof Mesh || object instanceof LineSegments) {
      result.push(object);
    }
  });
  return result;
}

function materialsOf(object: Mesh | LineSegments): Material[] {
  return Array.isArray(object.material) ? object.material : [object.material];
}

describe("source-bound Richard-Wagner-Denkmal", () => {
  test("pins the OSM, survey, viewer, ground and LoD2 identities exactly", () => {
    expect(WAGNER_MEMORIAL_PROFILE).toMatchObject({
      name: "Richard Wagner",
      osmKey: "node/243487615",
      osmId: 243487615,
      groundY: 5.2,
      totalHeightM: 6,
      seatedFigureHeightM: 2.7,
      schwellenraumProtected: false,
    });
    expect(WAGNER_MEMORIAL_PROFILE.wgs84).toEqual([
      13.3618687, 52.5100656,
    ]);
    expect(WAGNER_MEMORIAL_PROFILE.epsg25833M).toEqual([
      388827.9302917426, 5819032.782903005,
    ]);
    expect(WAGNER_MEMORIAL_PROFILE.worldM).toEqual([
      -672.0697082573897, 5.2, 967.217096994631,
    ]);
    expect(WAGNER_MEMORIAL_PROFILE.lod2).toMatchObject({
      fullId: "DEBE00YYSR00009n",
      payloadId: "SR00009n",
      bottomY: 5.2,
      heightM: 9.3,
      topY: 14.5,
    });
    expect([...WAGNER_MEMORIAL_PRISM_IDS]).toEqual(["SR00009n"]);
    expect(WAGNER_MEMORIAL_PROFILE.voxelSource.columnCentersWorldM).toEqual([
      [-674, 962],
      [-670, 962],
      [-674, 966],
      [-670, 966],
      [-674, 970],
      [-670, 970],
    ]);
    expect(WAGNER_MEMORIAL_PROFILE.focus).toEqual({
      azimuthDegrees: -6,
      distanceM: 31,
      fovDegrees: 39,
      polarDegrees: 82,
      targetHeightM: 4,
    });
    expect(WAGNER_MEMORIAL_PROFILE.minecraftFocus).toEqual({
      azimuthDegrees: -6,
      distanceM: 31,
      fovDegrees: 39,
      polarDegrees: 82,
      targetHeightM: 4,
    });
    expect(wagnerMemorialFocusForMode("minecraft")).toBe(
      WAGNER_MEMORIAL_PROFILE.minecraftFocus,
    );
    for (const mode of [
      "day",
      "night",
      "snowstorm",
      "schwellenraum",
    ] as const) {
      expect(wagnerMemorialFocusForMode(mode)).toBe(
        WAGNER_MEMORIAL_PROFILE.focus,
      );
    }
    expect(WAGNER_MEMORIAL_PROFILE.sources.sculptureInventory).toContain(
      "bildhauerei-in-berlin.de",
    );
    expect(Object.isFrozen(WAGNER_MEMORIAL_PROFILE)).toBe(true);
    expect(Object.isFrozen(WAGNER_MEMORIAL_PROFILE.canopy)).toBe(true);
    expect(Object.isFrozen(WAGNER_MEMORIAL_PROFILE.lod2)).toBe(true);
    expect(Object.isFrozen(WAGNER_MEMORIAL_PROFILE.focus)).toBe(true);
    expect(Object.isFrozen(WAGNER_MEMORIAL_PROFILE.minecraftFocus)).toBe(
      true,
    );
  });

  test("builds the six-metre marble ensemble below an open barrel vault", () => {
    const model = createWagnerMemorial();
    model.updateMatrixWorld(true);
    expect(model.position.toArray()).toEqual(
      WAGNER_MEMORIAL_PROFILE.worldM as unknown as number[],
    );
    expect(model.rotation.y).toBe(WAGNER_MEMORIAL_PROFILE.rotationY);
    expect(model.userData).toMatchObject({
      ownedOsmKey: "node/243487615",
      schwellenraumGeschuetzt: false,
      sourceBounded: true,
      texturePolicy: "procedural geometry only; no image or canvas texture",
      wagnerMemorialSmooth: true,
    });

    const ensemble = model.getObjectByName(
      "Richard Wagner six-metre marble ensemble",
    )!;
    const steel = model.getObjectByName("Richard Wagner open steel canopy")!;
    const glazing = model.getObjectByName(
      "Richard Wagner open plexiglass barrel vault",
    ) as Mesh;
    const snow = model.getObjectByName(
      "Richard Wagner reversible snow caps",
    )!;
    expect(ensemble.userData).toMatchObject({
      inscription: "RICHARD / WAGNER",
      measuredHeightM: 6,
      seatedFigureHeightM: 2.7,
    });
    expect(ensemble.userData.operaFigures).toHaveLength(4);
    expect(steel.userData.canopyForm).toContain("open steel frame");
    expect(glazing.userData).toMatchObject({
      openCanopy: true,
      textureFree: true,
    });
    expect(snow.visible).toBe(false);

    const ensembleBounds = new Box3().setFromObject(ensemble);
    const fullBounds = new Box3().setFromObject(model);
    const fullSize = fullBounds.getSize(new Vector3());
    expect(ensembleBounds.min.y).toBeCloseTo(5.2, 5);
    expect(ensembleBounds.max.y).toBeCloseTo(11.2, 5);
    expect(fullSize.x).toBeGreaterThan(10);
    expect(fullSize.x).toBeLessThan(10.7);
    expect(fullSize.z).toBeGreaterThan(10.7);
    expect(fullSize.z).toBeLessThan(11);
    expect(fullBounds.max.y).toBeCloseTo(13.81, 2);
  });

  test("keeps every smooth surface texture-free and within the mobile batch budget", () => {
    const model = createWagnerMemorial();
    const objects = renderables(model);
    const meshes = objects.filter((object) => object instanceof Mesh);
    const lines = objects.filter((object) => object instanceof LineSegments);
    expect(meshes).toHaveLength(4);
    expect(lines).toHaveLength(2);
    expect(wagnerMemorialRenderStats(model)).toEqual({
      renderables: 6,
      renderedVertices: 26_304,
    });
    expect(26_304).toBeLessThanOrEqual(
      WAGNER_MEMORIAL_PROFILE.renderPolicy.maxSmoothRenderedVertices,
    );

    for (const object of objects) {
      for (const material of materialsOf(object)) {
        expect((material as MeshBasicMaterial).map ?? null).toBeNull();
      }
      const dayMaterial = object.userData.dayMaterial as Material | undefined;
      const nightMaterial = object.userData.nightMaterial as
        | Material
        | undefined;
      if (dayMaterial) {
        expect((dayMaterial as MeshBasicMaterial).map).toBeNull();
        expect(dayMaterial).toBeInstanceOf(MeshBasicMaterial);
      }
      if (nightMaterial) {
        expect((nightMaterial as MeshStandardMaterial).map).toBeNull();
        expect(nightMaterial).toBeInstanceOf(MeshStandardMaterial);
      }
    }
    expect(
      objects.filter((object) => object.material instanceof LineBasicMaterial),
    ).toHaveLength(2);

    const expectedColours = new Map([
      ["Richard Wagner open steel canopy bodies", [0x3e484b, 0x555f61]],
      ["Richard Wagner reversible snow caps bodies", [0xeaf1ef]],
    ] as const);
    const colour = new Color();
    for (const mesh of meshes) {
      const expected = expectedColours.get(mesh.name);
      if (!expected) continue;
      const attribute = mesh.geometry.getAttribute("color");
      const actual = new Set<number>();
      for (let index = 0; index < attribute.count; index += 1) {
        actual.add(colour.fromBufferAttribute(attribute, index).getHex());
      }
      expect(actual.size).toBe(expected.length);
      for (const expectedHex of expected) {
        expect(
          [...actual].some((actualHex) =>
            [16, 8, 0].every(
              (shift) =>
                Math.abs(
                  ((actualHex >> shift) & 0xff) -
                    ((expectedHex >> shift) & 0xff),
                ) <= 1,
            ),
          ),
        ).toBe(true);
      }
    }
  });

  test("models a deep glazed barrel above open approaches, not a shallow roof cap", () => {
    const model = createWagnerMemorial();
    const canopy = model.getObjectByName(
      "Richard Wagner open plexiglass barrel vault",
    ) as Mesh;
    canopy.geometry.computeBoundingBox();
    const bounds = canopy.geometry.boundingBox!;
    expect(bounds.min.y).toBeCloseTo(3.1, 5);
    expect(bounds.max.y).toBeCloseTo(8.55, 5);
    expect(bounds.getSize(new Vector3()).toArray()).toEqual([
      expect.closeTo(9.6, 5), expect.closeTo(5.45, 5), expect.closeTo(10.4, 5),
    ]);
    expect(WAGNER_MEMORIAL_PROFILE.canopy.postLocalXZ).toHaveLength(8);
    for (const [x, z] of WAGNER_MEMORIAL_PROFILE.canopy.postLocalXZ) {
      expect(wagnerMemorialSolidAt(...localToWorld(x, 2.9, z))).toBe(true);
    }
    // Both gables and the lateral low aisles remain free of invented walls.
    for (const z of [-5, 5]) {
      for (const x of [-3.8, 0, 3.8]) {
        expect(wagnerMemorialSolidAt(...localToWorld(x, 2.7, z))).toBe(false);
      }
    }
    const material = canopy.material as MeshBasicMaterial;
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
  });

  test("keeps marble relief readable in the unlit day material without gold paint", () => {
    const model = createWagnerMemorial();
    const body = model.getObjectByName(
      "Richard Wagner six-metre marble ensemble bodies",
    ) as Mesh;
    const colours = body.geometry.getAttribute("color");
    const palette = new Set<number>();
    const colour = new Color();
    for (let index = 0; index < colours.count; index += 1) {
      colour.fromBufferAttribute(colours, index);
      palette.add(colour.getHex());
      // All marble / inscription tones stay neutral, including Rheingold.
      expect(Math.max(colour.r, colour.g, colour.b)
        - Math.min(colour.r, colour.g, colour.b)).toBeLessThan(0.11);
    }
    expect(palette.size).toBeGreaterThan(15);
    expect(palette.has(0xb6963f)).toBe(false);
    expect((body.material as MeshBasicMaterial).map).toBeNull();
  });

  test("faces the marble mantle and snow roof outward for real front-face rendering", () => {
    const model = createWagnerMemorial();
    model.position.set(0, 0, 0);
    model.rotation.y = 0;
    model.updateMatrixWorld(true);
    const body = model.getObjectByName(
      "Richard Wagner six-metre marble ensemble bodies",
    ) as Mesh;
    const mantleRay = new Raycaster(new Vector3(0.12, 4.4, 4), new Vector3(0, 0, -1));
    const mantleHit = mantleRay.intersectObject(body)[0];
    expect(mantleHit).toBeDefined();
    expect(mantleHit.point.z).toBeGreaterThan(0.2);
    setWagnerMemorialSnow(model, true);
    const snow = model.getObjectByName("Richard Wagner reversible snow caps")!;
    const roofRay = new Raycaster(new Vector3(0, 12, 0), new Vector3(0, -1, 0));
    const roofHit = roofRay.intersectObject(snow, true)[0];
    expect(roofHit).toBeDefined();
    expect(roofHit.point.y).toBeCloseTo(8.605, 5);
  });

  test("toggles snow and smooth visibility reversibly without changing authored transforms", () => {
    const model = createWagnerMemorial();
    const transform = {
      position: model.position.toArray(),
      quaternion: model.quaternion.toArray(),
      scale: model.scale.toArray(),
    };
    const snowObjects: Object3D[] = [];
    model.traverse((object) => {
      if (object.userData.snowOnly === true) snowObjects.push(object);
    });
    expect(snowObjects.length).toBeGreaterThan(1);
    expect(snowObjects.every(({ visible }) => !visible)).toBe(true);

    setWagnerMemorialSnow(model, true);
    expect(
      snowObjects.every(
        ({ visible, userData }) =>
          visible && userData.snowActive === true,
      ),
    ).toBe(true);
    setWagnerMemorialSnow(model, false);
    expect(
      snowObjects.every(
        ({ visible, userData }) =>
          !visible && userData.snowActive === false,
      ),
    ).toBe(true);

    setWagnerMemorialSmoothVisibility(model, false);
    expect(model.visible).toBe(false);
    setWagnerMemorialSmoothVisibility(model, true);
    expect(model.visible).toBe(true);
    expect(model.position.toArray()).toEqual(transform.position);
    expect(model.quaternion.toArray()).toEqual(transform.quaternion);
    expect(model.scale.toArray()).toEqual(transform.scale);
  });

  test("replaces exactly the six false source columns and no nearby voxel", () => {
    for (const [x, z] of WAGNER_MEMORIAL_PROFILE.voxelSource
      .columnCentersWorldM) {
      expect(wagnerMemorialVoxelReplacementAt(x, z)).toBe(true);
      expect(wagnerMemorialVoxelReplacementAt(x, z, 12, 5.2)).toBe(true);
      expect(wagnerMemorialVoxelReplacementAt(x + 0.06, z, 12, 5.2)).toBe(
        false,
      );
    }
    expect(wagnerMemorialVoxelReplacementAt(-672, 966, 12, 5.2)).toBe(false);
    expect(wagnerMemorialVoxelReplacementAt(-674, 962, 9.3, 5.2)).toBe(
      false,
    );
    expect(wagnerMemorialVoxelReplacementAt(-674, 962, 12, 5.3)).toBe(false);
    expect(wagnerMemorialVoxelReplacementAt(Number.NaN, 962)).toBe(false);
  });

  test("keeps both approaches and the high shelter open while colliding with real marble and posts", () => {
    const frontApproach = localToWorld(0, 1, 3.8);
    const rearApproach = localToWorld(0, 1, -3.8);
    const sideAisle = localToWorld(3.55, 1, 0);
    const openUnderRoof = localToWorld(0, 7.5, 0);
    const base = localToWorld(0, 0.2, 0);
    const seatedStatue = localToWorld(0, 4, 0);
    const canopyPost = localToWorld(-4.8, 3, -4.85);

    for (const point of [
      frontApproach,
      rearApproach,
      sideAisle,
      openUnderRoof,
    ]) {
      expect(wagnerMemorialSolidAt(...point)).toBe(false);
      expect(
        wagnerMemorialWalkableInteriorAt(...point, "SR00009n"),
      ).toBe(true);
    }
    for (const point of [base, seatedStatue, canopyPost]) {
      expect(wagnerMemorialSolidAt(...point)).toBe(true);
      expect(
        wagnerMemorialWalkableInteriorAt(...point, "SR00009n"),
      ).toBe(false);
    }
    expect(
      wagnerMemorialWalkableInteriorAt(...frontApproach, "not-this-source"),
    ).toBe(false);
    expect(wagnerMemorialSolidAt(-650, 8, 950)).toBe(false);
  });

  test("uses one bounded texture-free Minecraft batch with the complete fixed palette", () => {
    const model = createWagnerMemorialMinecraft();
    expect(model).toBeInstanceOf(InstancedMesh);
    expect(model.geometry).toBeInstanceOf(BoxGeometry);
    expect(model.material).toBeInstanceOf(MeshStandardMaterial);
    expect((model.material as MeshStandardMaterial).map).toBeNull();
    expect((model.material as MeshStandardMaterial).transparent).toBe(false);
    expect(model.count).toBe(514);
    expect(model.count).toBeLessThanOrEqual(
      WAGNER_MEMORIAL_PROFILE.renderPolicy.maxMinecraftBlocks,
    );
    expect(model.frustumCulled).toBe(true);
    expect(model.userData).toMatchObject({
      blockCount: 514,
      blockNative: true,
      exactOneBatch: true,
      mode: "minecraft",
      ownedOsmKey: "node/243487615",
      smoothGeometryExcluded: true,
      textureFree: true,
    });
    expect(model.instanceColor).not.toBeNull();
    expect(model.boundingBox).not.toBeNull();
    expect(model.boundingSphere).not.toBeNull();

    const colour = new Color();
    const counts = new Map<number, number>();
    for (let index = 0; index < model.count; index += 1) {
      model.getColorAt(index, colour);
      const hex = colour.getHex();
      counts.set(hex, (counts.get(hex) ?? 0) + 1);
    }
    expect([...counts.entries()].sort(([a], [b]) => a - b)).toEqual(
      [
        [0x3e484b, 40],
        [0x555f61, 105],
        [0xa8d7dc, 120],
        [0xc9c7c0, 87],
        [0xe7e4dc, 162],
      ].sort(([a], [b]) => a - b),
    );

    const bounds = model.boundingBox!;
    const size = bounds.getSize(new Vector3());
    expect(bounds.min.y).toBeCloseTo(5.2, 5);
    expect(size.x).toBeLessThan(10.8);
    expect(size.y).toBeLessThan(9);
    expect(size.z).toBeLessThan(10.8);
  });
});
