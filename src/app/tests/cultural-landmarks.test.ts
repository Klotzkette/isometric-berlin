import { describe, expect, test } from "bun:test";
import { Box3, InstancedMesh, Mesh, PointLight } from "three";
import {
  createCulturalLandmarks,
  culturalFocusCamera,
} from "../src/CulturalLandmarks";

const landmarks = [
  {
    name: "TIPI am Kanzleramt",
    world: [-297.284, 8, 52.502] as [number, number, number],
  },
  {
    name: "Carillon im Tiergarten",
    world: [-326.839, 8, 140.633] as [number, number, number],
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

  test("preserves the Carillon height and all 68 visible bells", () => {
    const details = createCulturalLandmarks(landmarks);
    const carillon = details.getObjectByName("Granular 42 m Carillon im Tiergarten");
    const bells = details.getObjectByName("Carillon 68 bronze bells");
    const clappers = details.getObjectByName("Carillon 68 bell clappers");
    expect(carillon).toBeDefined();
    expect(carillon?.userData.heightM).toBe(42);
    expect(bells).toBeInstanceOf(InstancedMesh);
    expect((bells as InstancedMesh).count).toBe(68);
    expect(clappers).toBeInstanceOf(InstancedMesh);
    expect((clappers as InstancedMesh).count).toBe(68);
    const bounds = new Box3().setFromObject(carillon!);
    expect(bounds.max.y - bounds.min.y).toBeGreaterThanOrEqual(42);
    expect(bounds.max.y - bounds.min.y).toBeLessThan(43);
  });

  test("grounds a detailed occupied excursion steamer in the Spree", () => {
    const details = createCulturalLandmarks(landmarks);
    const boat = details.getObjectByName(
      "Berlin Spree excursion steamer with occupied upper deck",
    );
    const chairs = details.getObjectByName("Spree steamer ten deck-chair seats");
    const passengers = details.getObjectByName("Spree steamer seated passengers");
    const greenDrinks = details.getObjectByName(
      "Spree steamer green Berliner Weisse glasses",
    );
    const redDrinks = details.getObjectByName(
      "Spree steamer red Berliner Weisse glasses",
    );
    expect(boat).toBeDefined();
    expect(boat?.position.y).toBeLessThan(1.249);
    expect(chairs).toBeInstanceOf(InstancedMesh);
    expect((chairs as InstancedMesh).count).toBe(10);
    expect(passengers).toBeInstanceOf(InstancedMesh);
    expect((passengers as InstancedMesh).count).toBe(10);
    expect((greenDrinks as InstancedMesh).count).toBe(5);
    expect((redDrinks as InstancedMesh).count).toBe(5);
    expect(
      boat?.children.filter((child) => child.name.includes("wake")),
    ).toHaveLength(2);
    expect(boat?.getObjectByName("Spree steamer stern wash")).toBeDefined();
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

  test("provides close oblique cameras for TIPI, Carillon, and the Spree boat", () => {
    expect(culturalFocusCamera("TIPI am Kanzleramt")?.distance_m).toBe(74);
    expect(culturalFocusCamera("Carillon im Tiergarten")?.target_height_m).toBe(20);
    expect(culturalFocusCamera("Spreebogen")?.distance_m).toBe(90);
    expect(culturalFocusCamera("Spreebogen")?.azimuth_degrees).toBe(130);
    expect(culturalFocusCamera("Spreebogen")?.target_world).toEqual([
      -259.21, 1.249, -219.53,
    ]);
    expect(culturalFocusCamera("Reichstagsgebäude")).toBeNull();
  });
});
