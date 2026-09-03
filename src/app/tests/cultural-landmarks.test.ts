import { describe, expect, test } from "bun:test";
import {
  Box3,
  Group,
  InstancedMesh,
  Material,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PointLight,
} from "three";
import {
  createCulturalLandmarks,
  culturalFocusCamera,
} from "../src/CulturalLandmarks";
import { WATER_TOP_Y } from "../src/MinecraftVoxelWorld";
import { SPREEBOGEN_PARK_PROFILE } from "../src/SpreebogenPark";
import {
  setStarbucksPariserPlatzSnow,
  STARBUCKS_PARISER_PLATZ_PROFILE,
} from "../src/StarbucksPariserPlatz";
import { applyMaterialLighting } from "../src/ThreeViewer";

const landmarks = [
  {
    name: "TIPI am Kanzleramt",
    world: [-297.284, 8, 52.502] as [number, number, number],
  },
  {
    name: "Carillon im Tiergarten",
    world: [-326.839, 8, 140.633] as [number, number, number],
  },
  {
    name: "Pariser Platz",
    world: [497.05, 8, 292.85] as [number, number, number],
  },
  {
    name: "Starbucks Pariser Platz",
    world: [559.573, 8, 253.471] as [number, number, number],
  },
];

describe("cultural and Spree recognition details", () => {
  test("builds the colourful TIPI with the requested bulb marquee", () => {
    const details = createCulturalLandmarks(landmarks);
    const tipi = details.getObjectByName(
      "Granular TIPI am Kanzleramt show tent",
    );
    const marquee = details.getObjectByName(
      "TIPI PIGOR & EICHHORN golden marquee bulbs",
    );
    const todayMarquee = details.getObjectByName(
      "TIPI NUR HEUTE ABEND golden marquee bulbs",
    );
    const stringBulbs = details.getObjectByName(
      "TIPI warm canvas-rib string bulbs",
    );
    expect(tipi).toBeDefined();
    expect(tipi?.userData.ellipseLengthM).toBe(32);
    expect(tipi?.userData.ellipseWidthM).toBe(26);
    expect(tipi?.userData.marquee).toBe("PIGOR & EICHHORN");
    expect(tipi?.userData.marqueeAlwaysVisible).toBe(true);
    expect(tipi?.userData.marqueeIsOwnerAuthored).toBe(true);
    expect(tipi?.userData.mainRoofPeakCount).toBe(8);
    expect(tipi?.userData.todayMarquee).toBe("NUR HEUTE ABEND");
    expect(marquee).toBeInstanceOf(InstancedMesh);
    expect((marquee as InstancedMesh).count).toBeGreaterThan(200);
    expect(todayMarquee).toBeInstanceOf(InstancedMesh);
    expect((todayMarquee as InstancedMesh).count).toBeGreaterThan(150);
    expect((marquee as InstancedMesh).material.userData.nightEmissive).toBe(
      0xffbd3d,
    );
    expect(stringBulbs).toBeInstanceOf(InstancedMesh);
    expect((stringBulbs as InstancedMesh).count).toBe(144);
    const ribs = tipi?.getObjectByName(
      "TIPI forty-eight batched canvas seam ribs",
    ) as InstancedMesh;
    expect(ribs).toBeInstanceOf(InstancedMesh);
    expect(ribs.count).toBe(48);
    expect(
      tipi?.getObjectByName("TIPI alternating cool compound roof facets"),
    ).toBeDefined();
    const sidePavilions = tipi?.getObjectByName(
      "TIPI two large side pavilions",
    ) as InstancedMesh;
    const rearPavilions = tipi?.getObjectByName(
      "TIPI two smaller rear pavilions",
    ) as InstancedMesh;
    expect(sidePavilions).toBeInstanceOf(InstancedMesh);
    expect(sidePavilions.count).toBe(2);
    expect(rearPavilions).toBeInstanceOf(InstancedMesh);
    expect(rearPavilions.count).toBe(2);
    expect(
      tipi?.children.some((child) =>
        child.name.includes("colourful night uplight"),
      ),
    ).toBe(false);
    expect(
      tipi?.children.filter(
        (child) => child instanceof PointLight && child.userData.nightOnly,
      ),
    ).toHaveLength(4);
  });

  test("keeps the TIPI night character in the bulbs, not the canvas", () => {
    const details = createCulturalLandmarks(landmarks);
    const tipi = details.getObjectByName(
      "Granular TIPI am Kanzleramt show tent",
    );
    const skirt = tipi?.getObjectByName("TIPI elliptical canvas skirt") as Mesh;
    const roof = tipi?.getObjectByName("TIPI main peaked canvas roof") as Mesh;
    const marquee = details.getObjectByName(
      "TIPI PIGOR & EICHHORN golden marquee bulbs",
    ) as InstancedMesh;
    const letterCells = details.getObjectByName(
      "TIPI PIGOR & EICHHORN high-contrast letter cells",
    ) as InstancedMesh;
    const stringBulbs = details.getObjectByName(
      "TIPI warm canvas-rib string bulbs",
    ) as InstancedMesh;
    // Canvas surfaces must not glow like a lampshade at night.
    for (const canvasMesh of [skirt, roof]) {
      const material = canvasMesh.material as {
        userData: Record<string, number>;
      };
      expect(material.userData.nightEmissiveIntensity).toBeLessThanOrEqual(
        0.15,
      );
    }
    // The bulb chains and golden marquee remain the bright night character.
    expect(
      (stringBulbs.material as { userData: Record<string, number> }).userData
        .nightEmissiveIntensity,
    ).toBe(4.1);
    expect(
      (marquee.material as { userData: Record<string, number> }).userData
        .nightEmissiveIntensity,
    ).toBe(5.4);
    expect(letterCells).toBeInstanceOf(InstancedMesh);
    expect(letterCells.count).toBe(marquee.count);
    expect((letterCells.material as MeshStandardMaterial).transparent).toBe(
      false,
    );
    expect((letterCells.material as MeshStandardMaterial).map).toBeNull();
    const concertLights = tipi?.children.filter(
      (child): child is PointLight =>
        child instanceof PointLight && child.userData.nightOnly === true,
    );
    expect(concertLights?.every((light) => light.intensity <= 8)).toBe(true);
    expect(
      tipi?.getObjectByName("TIPI projecting entrance canopy"),
    ).toBeDefined();
    expect(tipi?.getObjectByName("TIPI Kasse ticket booth")).toBeDefined();
    expect(
      tipi?.getObjectByName("TIPI Kasse warm service window"),
    ).toBeDefined();
    const planters = tipi?.getObjectByName(
      "TIPI four entrance planters",
    ) as InstancedMesh;
    expect(planters).toBeInstanceOf(InstancedMesh);
    expect(planters.count).toBe(4);
  });

  test("keeps the granular TIPI mobile-safe without photo textures", () => {
    const details = createCulturalLandmarks(landmarks);
    const tipi = details.getObjectByName(
      "Granular TIPI am Kanzleramt show tent",
    ) as Group;
    let drawables = 0;
    let instances = 0;
    tipi.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      drawables += 1;
      if (object instanceof InstancedMesh) instances += object.count;
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const meshMaterial of materials) {
        const mapped = meshMaterial as MeshStandardMaterial;
        expect(mapped.map).toBeNull();
        if (mapped.transparent) expect(mapped.depthWrite).toBe(false);
      }
    });

    expect(drawables).toBeLessThanOrEqual(22);
    expect(instances).toBeGreaterThan(900);
  });

  test("preserves the Carillon height and all 68 visible bells", () => {
    const details = createCulturalLandmarks(landmarks);
    const carillon = details.getObjectByName(
      "Granular 42 m Carillon im Tiergarten",
    );
    const bells = details.getObjectByName("Carillon 68 bronze bells");
    const clappers = details.getObjectByName("Carillon 68 bell clappers");
    expect(carillon).toBeDefined();
    expect(carillon?.userData.heightM).toBe(42);
    expect(carillon?.userData.officialMeshCarriesPylons).toBe(true);
    // The payload anchor is a photo-geotag ~29 m south-west of the tower;
    // the recognition detail must sit on the official-mesh tower footprint
    // so it does not read as a second Carillon.
    expect(carillon?.position.toArray()).toEqual([-307.06, 4.51, 118.51]);
    expect(carillon?.userData.payloadAnchorWorld).toEqual([
      -326.839, 8, 140.633,
    ]);
    expect(
      carillon?.getObjectByName("Carillon black-granite tower shaft"),
    ).toBeUndefined();
    expect(bells).toBeInstanceOf(InstancedMesh);
    expect((bells as InstancedMesh).count).toBe(68);
    expect(clappers).toBeInstanceOf(InstancedMesh);
    expect((clappers as InstancedMesh).count).toBe(68);
    const roof = carillon?.getObjectByName(
      "Carillon overhanging patinated flying-bowl roof",
    ) as Mesh;
    expect(roof).toBeInstanceOf(Mesh);
    expect(roof.material.color.getHex()).toBe(0x4f5c58);
    const bounds = new Box3().setFromObject(carillon!);
    expect(bounds.max.y - bounds.min.y).toBeCloseTo(42, 5);
    expect(bounds.max.y - bounds.min.y).toBeLessThan(43);
  });

  test("does not duplicate the source-bound ships with invented party staffage", () => {
    const details = createCulturalLandmarks(landmarks);
    const forbiddenNames = [
      "Berlin Spree excursion steamer with occupied upper deck",
      "Spree steamer ten deck-chair seats",
      "Spree steamer seated passengers",
      "Spree steamer green Berliner Weisse glasses",
      "Spree steamer red Berliner Weisse glasses",
      "Spree steamer stern wash",
    ];
    for (const name of forbiddenNames) {
      expect(details.getObjectByName(name)).toBeUndefined();
    }
    const legacyObjects: string[] = [];
    details.traverse((object) => {
      if (object.name.includes("Spree steamer"))
        legacyObjects.push(object.name);
    });
    expect(legacyObjects).toEqual([]);
  });

  test("adds a metrically aligned Spree surface with real vertical relief", () => {
    const details = createCulturalLandmarks(landmarks);
    const waves = details.getObjectByName(
      "OSM-derived three-dimensional Spree wave field",
    );
    const surface = details.getObjectByName(
      "Spree metrically aligned undulating water surface",
    ) as Mesh;
    const positions = surface.geometry.getAttribute("position");
    const heights = Array.from({ length: positions.count }, (_, index) =>
      positions.getY(index),
    );

    expect(waves).toBeDefined();
    expect(waves?.userData.source).toContain("osm.gpkg");
    expect(surface).toBeInstanceOf(Mesh);
    expect(positions.count).toBeGreaterThan(2_000);
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(0.25);
    expect(
      details.getObjectByName(
        "Spree broken three-dimensional wave crest highlights",
      ),
    ).toBeDefined();
  });

  test("adds the OSM-anchored LEGO giraffe as an explicit approximation", () => {
    const details = createCulturalLandmarks(landmarks);
    const giraffe = details.getObjectByName(
      "LEGOLAND Discovery Centre LEGO giraffe recognition model",
    );
    const spots = details.getObjectByName(
      "LEGO giraffe thirty raised brown coat bricks",
    ) as InstancedMesh;
    const studs = details.getObjectByName(
      "LEGO giraffe visible top studs",
    ) as InstancedMesh;
    expect(giraffe).toBeDefined();
    expect(giraffe?.position.toArray()).toEqual([17.884, 4.12, 1023.63]);
    expect(giraffe?.userData.geometryStatus).toContain("not surveyed");
    expect(giraffe?.userData.sourceUrls).toHaveLength(3);
    expect((spots as InstancedMesh).count).toBe(30);
    expect((studs as InstancedMesh).count).toBe(12);
    const bounds = new Box3().setFromObject(giraffe!);
    expect(bounds.max.y - bounds.min.y).toBeGreaterThan(7);
    expect(bounds.max.y - bounds.min.y).toBeLessThan(7.6);
  });

  test("provides legible oblique cameras for the cultural landmarks", () => {
    const hkwCamera = culturalFocusCamera(
      "Haus der Kulturen der Welt (Schwangere Auster)",
    );
    expect(hkwCamera?.distance_m).toBeGreaterThanOrEqual(380);
    expect(hkwCamera?.target_world).toEqual([-505.17, 3.89, -12.073]);
    expect(culturalFocusCamera("TIPI am Kanzleramt")?.distance_m).toBe(74);
    expect(culturalFocusCamera("Carillon im Tiergarten")?.target_height_m).toBe(
      20,
    );
    expect(culturalFocusCamera("Spreebogen")?.distance_m).toBe(120);
    expect(culturalFocusCamera("Spreebogen")?.azimuth_degrees).toBe(130);
    expect(culturalFocusCamera("Spreebogen")?.target_world).toEqual([
      SPREEBOGEN_PARK_PROFILE.centreX,
      4.8,
      (SPREEBOGEN_PARK_PROFILE.southZ + SPREEBOGEN_PARK_PROFILE.northZ) / 2,
    ]);
    expect(culturalFocusCamera("Starbucks Pariser Platz")).toEqual({
      azimuth_degrees: -40,
      distance_m: 58,
      polar_degrees: 68,
      target_height_m: 2.4,
      target_world: [
        STARBUCKS_PARISER_PLATZ_PROFILE.southwestCornerWorldM[0] + 2.2,
        STARBUCKS_PARISER_PLATZ_PROFILE.groundY,
        STARBUCKS_PARISER_PLATZ_PROFILE.southwestCornerWorldM[1] - 1.2,
      ],
    });
    const starbucksAzimuth = (-40 * Math.PI) / 180;
    const cameraHorizontal = [
      Math.sin(starbucksAzimuth),
      Math.cos(starbucksAzimuth),
    ];
    for (const facade of Object.values(
      STARBUCKS_PARISER_PLATZ_PROFILE.facades,
    )) {
      const exteriorDot =
        cameraHorizontal[0] * facade.outwardNormalWorld[0] +
        cameraHorizontal[1] * facade.outwardNormalWorld[1];
      expect(exteriorDot).toBeGreaterThan(0.65);
    }
    expect(culturalFocusCamera("Reichstagsgebäude")).toBeNull();
  });

  test("binds the Starbucks profile to the OSM POI and both exact LoD2 axes", () => {
    expect(STARBUCKS_PARISER_PLATZ_PROFILE.osmNodeId).toBe("66917229");
    expect(STARBUCKS_PARISER_PLATZ_PROFILE.lod2BuildingId).toBe("K00005Hq");
    expect(STARBUCKS_PARISER_PLATZ_PROFILE.lod2HeightM).toBe(28.748);
    expect(STARBUCKS_PARISER_PLATZ_PROFILE.poiWorldM).toEqual([
      559.5734097249806, 4.95, 253.47099111787975,
    ]);
    expect(STARBUCKS_PARISER_PLATZ_PROFILE.southwestCornerWorldM).toEqual([
      551.552, 259.24,
    ]);
    expect(
      STARBUCKS_PARISER_PLATZ_PROFILE.facades.west.sourceEndWorldM,
    ).toEqual([550.123, 242.808]);
    expect(
      STARBUCKS_PARISER_PLATZ_PROFILE.facades.south.sourceEndWorldM,
    ).toEqual([576.089, 257.151]);
    expect(
      STARBUCKS_PARISER_PLATZ_PROFILE.facades.west.rotationYRadians,
    ).toBeCloseTo(-1.4840501098435204, 12);
    expect(
      STARBUCKS_PARISER_PLATZ_PROFILE.facades.south.rotationYRadians,
    ).toBeCloseTo(0.0849319244334032, 12);
  });

  test("wraps the real Starbucks corner with shallow glass overlays and two shared wordmarks", () => {
    const details = createCulturalLandmarks(landmarks);
    const shop = details.getObjectByName("Starbucks Pariser Platz")!;
    expect(shop.userData.osmNodeId).toBe("66917229");
    expect(shop.userData.lod2BuildingId).toBe("K00005Hq");
    expect(shop.userData.sourceBound).toBe(true);
    expect(shop.userData.sourceAttribution).toEqual([
      "OpenStreetMap contributors: node 66917229",
      "Berlin LoD2 building K00005Hq: west and south source edges",
    ]);

    const west = details.getObjectByName(
      "Starbucks west source-bound facade overlay",
    )!;
    const south = details.getObjectByName(
      "Starbucks south source-bound facade overlay",
    )!;
    const profile = STARBUCKS_PARISER_PLATZ_PROFILE;
    expect(west.position.x).toBeCloseTo(
      profile.southwestCornerWorldM[0] +
        profile.facades.west.outwardNormalWorld[0] * 0.13,
      8,
    );
    expect(west.position.z).toBeCloseTo(
      profile.southwestCornerWorldM[1] +
        profile.facades.west.outwardNormalWorld[1] * 0.13,
      8,
    );
    expect(west.rotation.y).toBeCloseTo(
      profile.facades.west.rotationYRadians,
      12,
    );
    expect(south.position.x).toBeCloseTo(
      profile.southwestCornerWorldM[0] +
        profile.facades.south.outwardNormalWorld[0] * 0.13,
      8,
    );
    expect(south.position.z).toBeCloseTo(
      profile.southwestCornerWorldM[1] +
        profile.facades.south.outwardNormalWorld[1] * 0.13,
      8,
    );
    expect(south.rotation.y).toBeCloseTo(
      profile.facades.south.rotationYRadians,
      12,
    );

    const westBounds = new Box3().setFromObject(west);
    const southBounds = new Box3().setFromObject(south);
    expect(westBounds.max.x - westBounds.min.x).toBeLessThan(4.2);
    expect(westBounds.max.z - westBounds.min.z).toBeLessThan(16.9);
    expect(southBounds.max.x - southBounds.min.x).toBeLessThan(25);
    expect(southBounds.max.z - southBounds.min.z).toBeLessThan(4.7);
    expect(westBounds.max.y - westBounds.min.y).toBeLessThan(
      profile.lod2HeightM,
    );
    expect(southBounds.max.y - southBounds.min.y).toBeLessThan(
      profile.lod2HeightM,
    );
    for (const facade of [west, south]) {
      expect(facade.userData.upperWindowRows).toBe(5);
      expect(
        facade.children.filter((child) => child instanceof Mesh),
      ).toHaveLength(5);
      const roof = facade.getObjectByName(
        `Pariser Platz 4a ${facade.userData.facade} patinated mansard`,
      ) as InstancedMesh;
      const transform = new Matrix4();
      roof.getMatrixAt(0, transform);
      roof.geometry.computeBoundingBox();
      const localBounds = roof.geometry
        .boundingBox!.clone()
        .applyMatrix4(transform);
      // The retained opaque LoD2 wall is 0.13 m behind this overlay's origin.
      expect(localBounds.min.z + 0.13).toBeGreaterThan(0.02);
      expect(localBounds.max.y).toBeLessThan(profile.lod2HeightM);
      expect(roof.userData.geometryStatus).toContain("retained LoD2 envelope");
    }
    expect(west.userData.dormerCount).toBe(4);
    expect(south.userData.dormerCount).toBe(6);

    const wordmarks: Mesh[] = [];
    shop.traverse((object) => {
      if (object.userData.lettering === "STARBUCKS") {
        wordmarks.push(object as Mesh);
      }
    });
    expect(wordmarks).toHaveLength(2);
    expect(
      wordmarks.map((wordmark) => wordmark.userData.facade).sort(),
    ).toEqual(["south", "west"]);
    expect(wordmarks[0].material).toBe(wordmarks[1].material);
    expect(
      (wordmarks[0].material as Material).userData.sharedCodeGeneratedTexture,
    ).toBe(true);

    const westGlass = shop.getObjectByName(
      "Starbucks west large dark glass fields",
    ) as InstancedMesh;
    const glassMaterial = westGlass.material as MeshStandardMaterial;
    const dayAppearance = {
      color: glassMaterial.color.getHex(),
      map: glassMaterial.map,
      opacity: glassMaterial.opacity,
    };
    applyMaterialLighting(glassMaterial, "night");
    expect(glassMaterial.emissive.getHex()).toBe(0xffcf9c);
    expect(glassMaterial.emissiveIntensity).toBe(0.62);
    applyMaterialLighting(glassMaterial, "day");
    expect(glassMaterial.emissive.getHex()).toBe(0x000000);
    expect({
      color: glassMaterial.color.getHex(),
      map: glassMaterial.map,
      opacity: glassMaterial.opacity,
    }).toEqual(dayAppearance);
  });

  test("keeps obsolete green fascia and double-wall geometry out, with reversible snow caps", () => {
    const details = createCulturalLandmarks(landmarks);
    const shop = details.getObjectByName("Starbucks Pariser Platz")!;
    const obsolete = [
      "Starbucks shopfront pier",
      "Starbucks fascia sign",
      "Starbucks awning",
      "Starbucks pavement tables",
    ];
    for (const name of obsolete) {
      expect(shop.getObjectByName(name)).toBeUndefined();
    }
    expect(
      shop.getObjectByName(
        "Starbucks four black freestanding umbrella canopies",
      )?.userData.freestanding,
    ).toBe(true);

    const snowCaps = shop.getObjectByName("Starbucks snow caps")!;
    expect(snowCaps.visible).toBe(false);
    setStarbucksPariserPlatzSnow(shop as Group, true);
    expect(snowCaps.visible).toBe(true);
    setStarbucksPariserPlatzSnow(shop as Group, false);
    expect(snowCaps.visible).toBe(false);
  });
});
