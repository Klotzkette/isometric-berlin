import { describe, expect, test } from "bun:test";
import { Box3 } from "three";
import {
  type ArchitecturalSignature,
  createOfficialReichstagDome,
  domeRadius,
} from "../src/ReichstagDome";

const signature: ArchitecturalSignature = {
  anchor_world: [12, 36.4, -8],
  diameter_m: 40,
  geometry_status: "official-dimension test",
  height_m: 23.5,
  horizontal_rings: 17,
  id: "reichstag-dome",
  landmark_name: "Reichstagsgebäude",
  source_url: "https://www.bundestag.de/besuche/architektur/reichstag/kuppel",
  vertical_ribs: 24,
};

describe("official-dimension Reichstag dome", () => {
  test("uses the published diameter and keeps an open crown", () => {
    expect(domeRadius(0, signature.diameter_m)).toBe(20);
    expect(domeRadius(0.5, signature.diameter_m)).toBeLessThan(20);
    expect(domeRadius(1, signature.diameter_m)).toBeCloseTo(2.4, 5);
  });

  test("builds every published rib and horizontal ring", () => {
    const dome = createOfficialReichstagDome(signature);
    expect(dome.children).toHaveLength(46);
    expect(
      dome.children.filter((child) => child.name.startsWith("main steel rib")),
    ).toHaveLength(24);
    expect(
      dome.children.filter((child) =>
        child.name.startsWith("horizontal steel ring"),
      ),
    ).toHaveLength(17);
    expect(dome.userData.heightM).toBe(23.5);
    expect(dome.userData.diameterM).toBe(40);
    const glass = dome.children.find((child) =>
      child.name.includes("glass envelope"),
    );
    expect(glass).toBeDefined();
    if (glass && "geometry" in glass) {
      glass.geometry.computeBoundingBox();
      expect(glass.geometry.boundingBox?.min.y).toBeGreaterThan(5);
    }
  });

  test("anchors the complete structure at metre-scale scene coordinates", () => {
    const dome = createOfficialReichstagDome(signature);
    const bounds = new Box3().setFromObject(dome);
    expect(dome.position.toArray()).toEqual(signature.anchor_world);
    expect(bounds.max.x - bounds.min.x).toBeGreaterThanOrEqual(40);
    expect(bounds.max.x - bounds.min.x).toBeLessThan(41);
    expect(bounds.max.y - bounds.min.y).toBeGreaterThan(23);
    expect(bounds.max.y - bounds.min.y).toBeLessThan(25);
  });
});
