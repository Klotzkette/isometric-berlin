import { describe, expect, test } from "bun:test";
import {
  Box3,
  Color,
  InstancedMesh,
  LineSegments,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from "three";

import {
  GOETHE_INSCRIPTION_GOLD,
  TIERGARTEN_LITERARY_MEMORIAL_OSM_KEYS,
  TIERGARTEN_LITERARY_MEMORIAL_PROTECTION_PROFILES,
  TIERGARTEN_LITERARY_MEMORIAL_SOLID_PROFILES,
  TIERGARTEN_LITERARY_MEMORIALS_PROFILE,
  createTiergartenLiteraryMemorials,
  createTiergartenLiteraryMemorialsMinecraft,
  setTiergartenLiteraryMemorialsSnow,
  tiergartenLiteraryMemorialProtectedAt,
  tiergartenLiteraryMemorialSolidAt,
} from "../src/TiergartenLiteraryMemorials";
import { pedestrianPointIsBlocked } from "../src/pedestrianNavigation";

function localToWorld(
  world: readonly [number, number, number],
  yaw: number,
  localX: number,
  localZ: number,
): readonly [number, number] {
  const cosine = Math.cos(yaw);
  const sine = Math.sin(yaw);
  return [
    world[0] + cosine * localX + sine * localZ,
    world[2] - sine * localX + cosine * localZ,
  ];
}

function boundsWithoutSnow(root: Object3D): Box3 {
  const bounds = new Box3();
  for (const child of root.children) {
    if (child.userData.snowOnly === true) continue;
    bounds.expandByObject(child);
  }
  return bounds;
}

function renderedStats(root: Object3D, visibleOnly: boolean): {
  renderables: number;
  vertices: number;
} {
  let renderables = 0;
  let vertices = 0;
  const visit = (object: Object3D): void => {
    if (!(object instanceof Mesh) && !(object instanceof LineSegments)) return;
    const positionCount = object.geometry.getAttribute("position")?.count ?? 0;
    renderables += 1;
    vertices += object instanceof InstancedMesh
      ? positionCount * object.count
      : positionCount;
  };
  if (visibleOnly) root.traverseVisible(visit);
  else root.traverse(visit);
  return { renderables, vertices };
}

describe("exact Tiergarten literary memorial profiles", () => {
  test("freezes the source-owned API contract and exact OSM anchors", () => {
    expect(Object.isFrozen(TIERGARTEN_LITERARY_MEMORIALS_PROFILE)).toBeTrue();
    expect(Object.isFrozen(TIERGARTEN_LITERARY_MEMORIALS_PROFILE.goethe)).toBeTrue();
    expect(Object.isFrozen(TIERGARTEN_LITERARY_MEMORIALS_PROFILE.lessing)).toBeTrue();
    expect(TIERGARTEN_LITERARY_MEMORIAL_OSM_KEYS).toEqual([
      "node/278738513",
      "node/884700390",
    ]);
    expect(TIERGARTEN_LITERARY_MEMORIALS_PROFILE.goethe).toMatchObject({
      artist: "Fritz Schaper",
      created: "1876–1880",
      fenceFieldCount: 42,
      figureHeightM: 2.72,
      osmKey: "node/278738513",
      pedestalHeightM: 3.36,
      totalHeightM: 6.08,
      wgs84: [13.3763737, 52.5137982],
      worldM: [321.583409, 4.69, 574.310594],
    });
    expect(TIERGARTEN_LITERARY_MEMORIALS_PROFILE.lessing).toMatchObject({
      artist: "Otto Lessing",
      fenceChamferM: 0.8,
      fenceFieldCount: 28,
      fenceHalfExtentM: 2.8,
      fenceOutline: "chamfered-octagon",
      fenceSegmentCount: 8,
      figureHeightM: 3,
      osmKey: "node/884700390",
      pedestalHeightM: 4,
      totalHeightM: 7,
      worldM: [220.8739978952799, 4.2, 766.8354332130402],
    });
  });

  test("records official inventories and reusable licensed visual references", () => {
    const profile = TIERGARTEN_LITERARY_MEMORIALS_PROFILE;
    expect(profile.goethe.officialSource).toContain("denkmaldatenbank.berlin.de");
    expect(profile.goethe.inventorySource).toContain("goethedenkmal-5168");
    expect(profile.goethe.visualReferences).toHaveLength(3);
    expect(profile.goethe.visualReferences.map((reference) => reference.author)).toEqual([
      "Jörg Zägel",
      "Senorita78",
      "Mike Peel",
    ]);
    expect(profile.goethe.visualReferences.map((reference) => reference.license)).toEqual([
      "CC BY-SA 3.0",
      "CC BY-SA 3.0",
      "CC BY-SA 4.0",
    ]);
    expect(profile.goethe.visualReferences.map((reference) => reference.pageUrl)).toEqual([
      "https://commons.wikimedia.org/wiki/File%3ABerlin%2C_Tiergarten%2C_Grosser_Tiergarten%2C_Goethe-Denkmal.jpg",
      "https://commons.wikimedia.org/wiki/File%3ATiergarten%2C_Goethe-Denkmal.jpg",
      "https://commons.wikimedia.org/wiki/File%3AJohann_Wolfgang_von_Goethe_monument_in_the_Tiergarten%2C_Berlin_2014-1.jpg",
    ]);
    expect(profile.lessing.inventorySource).toContain("lessingdenkmal-4997");
    expect(profile.lessing.visualReferences.map((reference) => reference.license)).toEqual(
      ["CC BY-SA 4.0", "CC BY-SA 3.0", "CC BY-SA 3.0"],
    );
    expect(profile.lessing.visualReferences.map((reference) => reference.pageUrl)).toEqual(
      [
        "https://commons.wikimedia.org/wiki/File:Lessing_monument_in_Berlin_Tiergarten_9593.jpg",
        "https://commons.wikimedia.org/wiki/File:Lessing_Tiergarten_3K.jpg",
        "https://commons.wikimedia.org/wiki/File:Lessing_Tiergarten_4K.jpg",
      ],
    );
    expect(profile.renderPolicy.texturePolicy).toContain("no photograph");
  });

  test("pins Goethe front east and Lessing front to the mapped SSE approach", () => {
    const root = createTiergartenLiteraryMemorials();
    root.updateMatrixWorld(true);
    const goethe = root.getObjectByName("Goethe-Denkmal exact literary memorial")!;
    const lessing = root.getObjectByName("Lessing-Denkmal exact literary memorial")!;
    const goetheFront = new Vector3(0, 0, 1).applyQuaternion(goethe.getWorldQuaternion(goethe.quaternion.clone()));
    const lessingFront = new Vector3(0, 0, 1).applyQuaternion(lessing.getWorldQuaternion(lessing.quaternion.clone()));
    expect(goetheFront.x).toBeCloseTo(1, 6);
    expect(goetheFront.z).toBeCloseTo(0, 6);
    expect(lessingFront.x).toBeCloseTo(Math.sin(0.25), 6);
    expect(lessingFront.z).toBeCloseTo(Math.cos(0.25), 6);
  });
});

describe("granular smooth Goethe and Lessing models", () => {
  test("keeps both documented total heights exact instead of the old oversized models", () => {
    const root = createTiergartenLiteraryMemorials();
    const goethe = root.getObjectByName("Goethe-Denkmal exact literary memorial")!;
    const lessing = root.getObjectByName("Lessing-Denkmal exact literary memorial")!;
    expect(boundsWithoutSnow(goethe).getSize(new Vector3()).y).toBeCloseTo(6.08, 5);
    expect(boundsWithoutSnow(lessing).getSize(new Vector3()).y).toBeCloseTo(7, 5);
    expect(goethe.position.toArray()).toEqual([321.583409, 4.69, 574.310594]);
    expect(lessing.position.toArray()).toEqual([
      220.8739978952799,
      4.2,
      766.8354332130402,
    ]);
  });

  test("exposes stable semantic cues for Goethe's figure, all three paired allegories and 42-field fence", () => {
    const goethe = createTiergartenLiteraryMemorials().getObjectByName(
      "Goethe-Denkmal exact literary memorial",
    )!;
    for (const cue of [
      "Goethe cue standing figure",
      "Goethe cue Lyrik pair",
      "Goethe cue Dramatik pair",
      "Goethe cue Wissenschaft pair",
      "Goethe cue gilded front inscription",
      "Goethe cue reconstructed 42-field fence",
    ]) {
      expect(goethe.getObjectByName(cue)?.userData.sourceBounded).toBeTrue();
    }
    expect(goethe.userData).toMatchObject({
      cueCount: 6,
      exactOwnOsmKey: "node/278738513",
      fenceFieldCount: 42,
      sourceOwned: true,
    });
    expect(
      goethe.getObjectByName("Goethe memorial fine allegory and fence cues")?.userData,
    ).toMatchObject({
      fadeAsFineDetail: true,
      fenceFieldCount: 42,
      gildedInscriptionColorHex: 0xc49a45,
    });
    const inscriptionCue = goethe.getObjectByName("Goethe cue gilded front inscription")!;
    expect(GOETHE_INSCRIPTION_GOLD).toBe(0xc49a45);
    expect(inscriptionCue.userData.colorHex).toBe(GOETHE_INSCRIPTION_GOLD);
    const fineBodies = goethe.getObjectByName(
      "Goethe memorial fine allegory and fence cues bodies",
    ) as Mesh;
    const colors = fineBodies.geometry.getAttribute("color");
    const gold = new Color(GOETHE_INSCRIPTION_GOLD);
    const compactPaletteTolerance = 1 / 255 + Number.EPSILON;
    expect(colors.array).toBeInstanceOf(Uint8Array);
    expect(colors.normalized).toBe(true);
    let containsGold = false;
    for (let index = 0; index < colors.count; index += 1) {
      if (
        Math.abs(colors.getX(index) - gold.r) <= compactPaletteTolerance &&
        Math.abs(colors.getY(index) - gold.g) <= compactPaletteTolerance &&
        Math.abs(colors.getZ(index) - gold.b) <= compactPaletteTolerance
      ) {
        containsGold = true;
        break;
      }
    }
    expect(containsGold).toBeTrue();
  });

  test("exposes Lessing's book stance, four faces, two allegories, portraits, basins and current fence", () => {
    const lessing = createTiergartenLiteraryMemorials().getObjectByName(
      "Lessing-Denkmal exact literary memorial",
    )!;
    for (const cue of [
      "Lessing cue standing book figure",
      "Lessing cue Genius der Humanität",
      "Lessing cue Allegorie der Kritik",
      "Lessing cue Mendelssohn portrait",
      "Lessing cue Ewald von Kleist portrait",
      "Lessing cue Nicolai portrait",
      "Lessing cue twin basins and dolphin spouts",
      "Lessing cue current simplified fence",
    ]) {
      expect(lessing.getObjectByName(cue)?.userData.sourceBounded).toBeTrue();
    }
    expect(lessing.userData).toMatchObject({
      cueCount: 8,
      exactOwnOsmKey: "node/884700390",
      fenceFieldCount: 28,
      fenceOutline: "chamfered-octagon",
      fenceSegmentCount: 8,
      sourceOwned: true,
    });
    expect(
      lessing.getObjectByName("Lessing memorial relief allegory and fence cues")?.userData,
    ).toMatchObject({
      fadeAsFineDetail: true,
      fenceFieldCount: 28,
      fenceOutline: "chamfered-octagon",
      fenceSegmentCount: 8,
      portraitCount: 3,
    });
    expect(
      lessing.getObjectByName("Lessing cue current simplified fence")?.userData.role,
    ).toContain("chamfered-octagon");
  });

  test("owns each protected OSM source once and never bundles a texture", () => {
    const root = createTiergartenLiteraryMemorials();
    expect(root.userData).toMatchObject({
      ownedOsmKeys: ["node/278738513", "node/884700390"],
      schwellenraumGeschuetzt: true,
      suppressesGenericModels: true,
    });
    const owned = root.children.map((child) => child.userData.exactOwnOsmKey);
    expect(new Set(owned)).toEqual(new Set(TIERGARTEN_LITERARY_MEMORIAL_OSM_KEYS));
    root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const materials = (Array.isArray(object.material)
        ? object.material
        : [object.material]) as Material[];
      for (const material of materials) {
        if ("map" in material) expect(material.map).toBeNull();
      }
    });
  });

  test("toggles static snow caps reversibly without moving either monument body", () => {
    const root = createTiergartenLiteraryMemorials();
    const goetheSnow = root.getObjectByName("Goethe memorial reversible snow caps")!;
    const lessingSnow = root.getObjectByName("Lessing memorial reversible snow caps")!;
    const goetheBody = root.getObjectByName("Goethe memorial structural silhouette bodies")!;
    const bodyMatrix = goetheBody.matrix.toArray();
    expect(goetheSnow.visible).toBeFalse();
    expect(lessingSnow.visible).toBeFalse();
    setTiergartenLiteraryMemorialsSnow(root, true);
    expect(goetheSnow.visible).toBeTrue();
    expect(lessingSnow.visible).toBeTrue();
    expect(goetheSnow.userData.snowActive).toBeTrue();
    expect(goetheBody.matrix.toArray()).toEqual(bodyMatrix);
    setTiergartenLiteraryMemorialsSnow(root, false);
    expect(goetheSnow.visible).toBeFalse();
    expect(lessingSnow.visible).toBeFalse();
    expect(goetheBody.matrix.toArray()).toEqual(bodyMatrix);
  });
});

describe("analytical solids and protection envelopes", () => {
  test("keeps both mapped ring paths free under the real double-sampled pedestrian query", () => {
    expect(TIERGARTEN_LITERARY_MEMORIAL_SOLID_PROFILES.lessing).toMatchObject({
      fenceChamferM: 0.8,
      fenceCollisionShape: "chamfered-octagon",
      fenceFieldCount: 28,
      fenceHalfExtentM: 2.8,
      fenceSegmentCount: 8,
      fenceStraightHalfM: 2,
    });
    for (const [name, profile, ringRadius, fenceHalfExtent] of [
      [
        "Goethe",
        TIERGARTEN_LITERARY_MEMORIALS_PROFILE.goethe,
        5.2,
        TIERGARTEN_LITERARY_MEMORIAL_SOLID_PROFILES.goethe.fenceHalfExtentM,
      ],
      [
        "Lessing",
        TIERGARTEN_LITERARY_MEMORIALS_PROFILE.lessing,
        4.1,
        TIERGARTEN_LITERARY_MEMORIAL_SOLID_PROFILES.lessing.fenceHalfExtentM,
      ],
    ] as const) {
      const access = {
        interiorSolidAt: tiergartenLiteraryMemorialSolidAt,
      };
      for (let direction = 0; direction < 8; direction += 1) {
        const angle = (direction / 8) * Math.PI * 2;
        const [pathX, pathZ] = localToWorld(
          profile.worldM,
          profile.rotationY,
          Math.cos(angle) * ringRadius,
          Math.sin(angle) * ringRadius,
        );
        expect(
          pedestrianPointIsBlocked(
            pathX,
            pathZ,
            profile.worldM[1],
            undefined,
            access,
          ),
          `${name} real body samples at ring direction ${direction}`,
        ).toBeFalse();
      }
      const [fenceX, fenceZ] = localToWorld(
        profile.worldM,
        profile.rotationY,
        fenceHalfExtent,
        0,
      );
      expect(
        pedestrianPointIsBlocked(
          fenceX,
          fenceZ,
          profile.worldM[1],
          undefined,
          access,
        ),
        `${name} physical fence side remains solid`,
      ).toBeTrue();
      expect(
        pedestrianPointIsBlocked(
          profile.worldM[0],
          profile.worldM[2],
          profile.worldM[1],
          undefined,
          access,
        ),
        `${name} monument core remains solid`,
      ).toBeTrue();
    }

    const lessing = TIERGARTEN_LITERARY_MEMORIALS_PROFILE.lessing;
    const half = TIERGARTEN_LITERARY_MEMORIAL_SOLID_PROFILES.lessing.fenceHalfExtentM;
    const straight = TIERGARTEN_LITERARY_MEMORIAL_SOLID_PROFILES.lessing.fenceStraightHalfM;
    const vertices = [
      [-straight, -half],
      [straight, -half],
      [half, -straight],
      [half, straight],
      [straight, half],
      [-straight, half],
      [-half, straight],
      [-half, -straight],
    ] as const;
    for (let segment = 0; segment < vertices.length; segment += 1) {
      const start = vertices[segment];
      const end = vertices[(segment + 1) % vertices.length];
      const [fenceX, fenceZ] = localToWorld(
        lessing.worldM,
        lessing.rotationY,
        (start[0] + end[0]) / 2,
        (start[1] + end[1]) / 2,
      );
      expect(
        tiergartenLiteraryMemorialSolidAt(
          fenceX,
          lessing.worldM[1] + 0.5,
          fenceZ,
          0,
        ),
        `Lessing chamfered fence segment ${segment} exact solid`,
      ).toBeTrue();
      expect(
        pedestrianPointIsBlocked(
          fenceX,
          fenceZ,
          lessing.worldM[1],
          undefined,
          { interiorSolidAt: tiergartenLiteraryMemorialSolidAt },
        ),
        `Lessing chamfered fence segment ${segment} blocks a pedestrian`,
      ).toBeTrue();
    }
  });

  test("models Goethe's closed fence as four thin sides rather than a filled square", () => {
    const profile = TIERGARTEN_LITERARY_MEMORIALS_PROFILE.goethe;
    const [freeX, freeZ] = localToWorld(profile.worldM, profile.rotationY, 3, 0);
    const [fenceX, fenceZ] = localToWorld(profile.worldM, profile.rotationY, 4.2, 0);
    expect(TIERGARTEN_LITERARY_MEMORIAL_SOLID_PROFILES.goethe.fenceHalfExtentM).toBe(4.2);
    expect(TIERGARTEN_LITERARY_MEMORIAL_PROTECTION_PROFILES.goethe).toMatchObject({
      radiusM: 4.3,
      shape: "circle",
    });
    expect(tiergartenLiteraryMemorialSolidAt(profile.worldM[0], profile.worldM[1] + 1, profile.worldM[2], 0)).toBeTrue();
    expect(tiergartenLiteraryMemorialSolidAt(freeX, profile.worldM[1] + 0.5, freeZ, 0)).toBeFalse();
    expect(tiergartenLiteraryMemorialSolidAt(fenceX, profile.worldM[1] + 0.5, fenceZ, 0)).toBeTrue();
    expect(tiergartenLiteraryMemorialProtectedAt(freeX, freeZ, 0)).toBeTrue();
    expect(tiergartenLiteraryMemorialProtectedAt(fenceX, fenceZ, 0)).toBeTrue();
    // OSM way/24736591 approaches to about 5.20 m from the anchor. A 0.42 m
    // pedestrian capsule must stay free even at that nearest radial bound.
    for (let direction = 0; direction < 8; direction += 1) {
      const angle = (direction / 8) * Math.PI * 2;
      const [pathX, pathZ] = localToWorld(
        profile.worldM,
        profile.rotationY,
        Math.cos(angle) * 5.2,
        Math.sin(angle) * 5.2,
      );
      expect(
        tiergartenLiteraryMemorialProtectedAt(pathX, pathZ, 0.42),
        `Goethe way/24736591 radial direction ${direction}`,
      ).toBeFalse();
    }
  });

  test("keeps Lessing's mapped surrounding path outside its compact protection profile", () => {
    const profile = TIERGARTEN_LITERARY_MEMORIALS_PROFILE.lessing;
    const [freeX, freeZ] = localToWorld(profile.worldM, profile.rotationY, 2.5, 0);
    const [fenceX, fenceZ] = localToWorld(profile.worldM, profile.rotationY, 2.8, 0);
    expect(TIERGARTEN_LITERARY_MEMORIAL_PROTECTION_PROFILES.lessing).toMatchObject({
      radiusM: 2.95,
      shape: "circle",
    });
    expect(tiergartenLiteraryMemorialSolidAt(freeX, profile.worldM[1] + 0.5, freeZ, 0)).toBeFalse();
    expect(tiergartenLiteraryMemorialSolidAt(fenceX, profile.worldM[1] + 0.5, fenceZ, 0)).toBeTrue();
    expect(tiergartenLiteraryMemorialProtectedAt(freeX, freeZ, 0)).toBeTrue();
    expect(tiergartenLiteraryMemorialProtectedAt(fenceX, fenceZ, 0)).toBeTrue();
    for (let direction = 0; direction < 8; direction += 1) {
      const angle = (direction / 8) * Math.PI * 2;
      const [pathX, pathZ] = localToWorld(
        profile.worldM,
        profile.rotationY,
        Math.cos(angle) * 4.1,
        Math.sin(angle) * 4.1,
      );
      expect(
        tiergartenLiteraryMemorialProtectedAt(pathX, pathZ, 0.42),
        `Lessing ring direction ${direction}`,
      ).toBeFalse();
    }
    expect(tiergartenLiteraryMemorialSolidAt(Number.NaN, 5, fenceZ, 0)).toBeFalse();
    expect(tiergartenLiteraryMemorialProtectedAt(fenceX, Number.NaN, 0)).toBeFalse();
  });
});

describe("mobile-bounded Minecraft presentation", () => {
  test("uses one colour-instanced block-native batch below the 600-block cap", () => {
    const minecraft = createTiergartenLiteraryMemorialsMinecraft();
    expect(minecraft).toBeInstanceOf(InstancedMesh);
    expect(minecraft.material).toBeInstanceOf(MeshStandardMaterial);
    expect(minecraft.frustumCulled).toBeFalse();
    expect(minecraft.instanceColor).not.toBeNull();
    expect(minecraft.count).toBe(557);
    expect(minecraft.userData).toMatchObject({
      blockCount: minecraft.count,
      blockNative: true,
      exactOneBatch: true,
      lessingFenceFieldCount: 28,
      lessingFenceOutline: "chamfered-octagon",
      lessingFenceSegmentCount: 8,
      ownedOsmKeys: ["node/278738513", "node/884700390"],
      smoothGeometryExcluded: true,
      textureFree: true,
    });
    const material = minecraft.material as MeshStandardMaterial;
    expect(material.color.getHex()).toBe(0xffffff);
    expect(material.emissive.getHex()).toBe(0x2b3132);
    expect(material.emissiveIntensity).toBe(0.14);
    expect(material.flatShading).toBeTrue();
    expect(material.metalness).toBe(0);
    expect(material.opacity).toBe(1);
    expect(material.roughness).toBe(0.93);
    expect(material.transparent).toBeFalse();
    // Instanced colours use USE_INSTANCING_COLOR. Enabling USE_COLOR without
    // a BoxGeometry colour attribute multiplies every instance by black.
    expect(material.vertexColors).toBeFalse();
    expect(minecraft.geometry.getAttribute("color")).toBeUndefined();
    expect(material.map).toBeNull();

    const instanceColor = minecraft.instanceColor!;
    expect(instanceColor.count).toBe(557);
    expect(instanceColor.itemSize).toBe(3);
    expect(instanceColor.version).toBeGreaterThan(0);
    const sampled = new Color();
    const palette = new Set<number>();
    for (let index = 0; index < minecraft.count; index += 1) {
      minecraft.getColorAt(index, sampled);
      palette.add(sampled.getHex());
    }
    expect([...palette].sort((left, right) => left - right)).toEqual(
      [0xe7e3d6, 0xaaa9a3, 0xaaa79f, 0x987368, 0x486d63, 0x353b3a].sort(
        (left, right) => left - right,
      ),
    );
  });

  test("stays below the per-presentation renderable and rendered-vertex budgets", () => {
    const smooth = createTiergartenLiteraryMemorials();
    setTiergartenLiteraryMemorialsSnow(smooth, true);
    const snowstorm = renderedStats(smooth, true);
    const minecraft = createTiergartenLiteraryMemorialsMinecraft();
    const blockMode = renderedStats(minecraft, true);
    const storedRenderableCount = renderedStats(smooth, false).renderables + blockMode.renderables;
    expect(snowstorm).toEqual({ renderables: 8, vertices: 24_870 });
    expect(blockMode).toEqual({ renderables: 1, vertices: 13_368 });
    expect(storedRenderableCount).toBe(9);
  });
});
