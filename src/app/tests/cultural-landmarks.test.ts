import { describe, expect, test } from "bun:test";
import { Box3, InstancedMesh, Mesh, PointLight } from "three";
import {
  createCulturalLandmarks,
  culturalFocusCamera,
} from "../src/CulturalLandmarks";
import { WATER_TOP_Y } from "../src/MinecraftVoxelWorld";
import { REAL_SPREE_VESSEL_PROFILES } from "../src/SpreeVesselProfiles";

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
    const tipi = details.getObjectByName("Granular TIPI am Kanzleramt show tent");
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
    expect(tipi?.userData.todayMarquee).toBe("NUR HEUTE ABEND");
    expect(marquee).toBeInstanceOf(InstancedMesh);
    expect((marquee as InstancedMesh).count).toBeGreaterThan(200);
    expect(todayMarquee).toBeInstanceOf(InstancedMesh);
    expect((todayMarquee as InstancedMesh).count).toBeGreaterThan(150);
    expect(
      (marquee as InstancedMesh).material.userData.nightEmissive,
    ).toBe(0xffbd3d);
    expect(stringBulbs).toBeInstanceOf(InstancedMesh);
    expect((stringBulbs as InstancedMesh).count).toBe(220);
    expect(
      tipi?.children.filter((child) =>
        child.name.startsWith("TIPI structural radial rib"),
      ),
    ).toHaveLength(20);
    const uplights = tipi?.children.filter((child) =>
      child.name.includes("colourful night uplight"),
    );
    expect(uplights).toHaveLength(4);
    expect(uplights?.every((light) => light.userData.nightOnly && !light.visible)).toBe(
      true,
    );
    expect(
      tipi?.children.filter(
        (child) => child instanceof PointLight && child.userData.nightOnly,
      ),
    ).toHaveLength(4);
  });

  test("keeps the TIPI night character in the bulbs, not the canvas", () => {
    const details = createCulturalLandmarks(landmarks);
    const tipi = details.getObjectByName("Granular TIPI am Kanzleramt show tent");
    const skirt = tipi?.getObjectByName(
      "TIPI elliptical canvas skirt",
    ) as Mesh;
    const roof = tipi?.getObjectByName(
      "TIPI main peaked canvas roof",
    ) as Mesh;
    const marquee = details.getObjectByName(
      "TIPI PIGOR & EICHHORN golden marquee bulbs",
    ) as InstancedMesh;
    const stringBulbs = details.getObjectByName(
      "TIPI warm canvas-rib string bulbs",
    ) as InstancedMesh;
    // Canvas surfaces must not glow like a lampshade at night.
    for (const canvasMesh of [skirt, roof]) {
      const material = canvasMesh.material as { userData: Record<string, number> };
      expect(material.userData.nightEmissiveIntensity).toBeLessThanOrEqual(0.15);
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
    const concertLights = tipi?.children.filter(
      (child): child is PointLight =>
        child instanceof PointLight && child.userData.nightOnly === true,
    );
    expect(concertLights?.every((light) => light.intensity <= 8)).toBe(true);
    expect(tipi?.getObjectByName("TIPI projecting entrance canopy")).toBeDefined();
    expect(tipi?.getObjectByName("TIPI Kasse ticket booth")).toBeDefined();
    expect(tipi?.getObjectByName("TIPI Kasse warm service window")).toBeDefined();
    expect(
      tipi?.children.filter((child) => child.name === "TIPI entrance planter"),
    ).toHaveLength(4);
  });

  test("preserves the Carillon height and all 68 visible bells", () => {
    const details = createCulturalLandmarks(landmarks);
    const carillon = details.getObjectByName("Granular 42 m Carillon im Tiergarten");
    const bells = details.getObjectByName("Carillon 68 bronze bells");
    const clappers = details.getObjectByName("Carillon 68 bell clappers");
    expect(carillon).toBeDefined();
    expect(carillon?.userData.heightM).toBe(42);
    expect(carillon?.userData.officialMeshCarriesPylons).toBe(true);
    // The payload anchor is a photo-geotag ~29 m south-west of the tower;
    // the recognition detail must sit on the official-mesh tower footprint
    // so it does not read as a second Carillon.
    expect(carillon?.position.toArray()).toEqual([-307.06, 4.51, 118.51]);
    expect(carillon?.userData.payloadAnchorWorld).toEqual([-326.839, 8, 140.633]);
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
      if (object.name.includes("Spree steamer")) legacyObjects.push(object.name);
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
    const heights = Array.from(
      { length: positions.count },
      (_, index) => positions.getY(index),
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
    expect(culturalFocusCamera("Carillon im Tiergarten")?.target_height_m).toBe(20);
    expect(culturalFocusCamera("Spreebogen")?.distance_m).toBe(90);
    expect(culturalFocusCamera("Spreebogen")?.azimuth_degrees).toBe(130);
    const vessel = REAL_SPREE_VESSEL_PROFILES.find(
      (profile) => profile.name === "FMS Spree-Blick III",
    )!;
    // The focus follows the source-bound profile, not the removed alt boat.
    expect(culturalFocusCamera("Spreebogen")?.target_world).toEqual([
      vessel.displayPositionWorldM[0],
      WATER_TOP_Y,
      vessel.displayPositionWorldM[1],
    ]);
    expect(culturalFocusCamera("Reichstagsgebäude")).toBeNull();
  });

  test("gives the Pariser Platz Starbucks a drawn fascia, not a bitmap logo", () => {
    const details = createCulturalLandmarks(landmarks);
    const shop = details.getObjectByName("Starbucks Pariser Platz")!;
    expect(shop).not.toBeNull();
    const fascia = details.getObjectByName("Starbucks fascia sign")!;
    expect(fascia.userData.lettering).toBe("STARBUCKS");
    expect(details.getObjectByName("Starbucks glazed shopfront")).not.toBeNull();
    // Turned towards the square, not left on the default bearing.
    expect(Math.abs(shop.rotation.y)).toBeGreaterThan(0.1);
    const bounds = new Box3().setFromObject(shop);
    expect(bounds.max.y - bounds.min.y).toBeGreaterThan(5);
    expect(bounds.max.y - bounds.min.y).toBeLessThan(9);
  });
});
