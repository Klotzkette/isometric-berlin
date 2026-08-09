import { describe, expect, test } from "bun:test";
import { Box3, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";

import {
  createExpandedCityDetails,
  expandedCityFocusCamera,
} from "../src/ExpandedCityDetails";

const landmarks = [
  "Hamburger Bahnhof",
  "Rieckhallen",
  "Sozialgericht Berlin",
  "Berliner Philharmonie",
  "Kammermusiksaal",
  "Staatsbibliothek zu Berlin (Haus Potsdamer Straße)",
  "berlin modern — Museum des 20. Jahrhunderts",
  "Neue Nationalgalerie",
  "Der Bogenschütze (Henry Moore)",
  "Tilla-Durieux-Park",
  "Anhalter Bahnhof",
  "Charlottenburger Tor",
  "WELT Balloon",
  "Kollhoff-Tower",
  "Spanische Botschaft",
  "Café am Neuen See",
  "KPMG Europacity",
  "DKB Campus Upbeat",
].map((name, index) => ({
  name,
  world: [index * 120, 3.8, (index % 4) * 160] as [number, number, number],
}));

describe("task-10 expanded city recognition details", () => {
  test("merges the architecture into one outlined flat-paint draw layer", () => {
    const details = createExpandedCityDetails(landmarks);
    const bodies = details.getObjectByName(
      "Expanded architecture and public-realm details bodies",
    ) as Mesh;
    expect(bodies).toBeInstanceOf(Mesh);
    expect(bodies.geometry.getAttribute("color").count).toBeGreaterThan(1_000);
    expect(bodies.userData.dayMaterial).toBeInstanceOf(MeshBasicMaterial);
    expect(bodies.userData.nightMaterial).toBeInstanceOf(MeshStandardMaterial);
    expect(
      details.getObjectByName(
        "Expanded architecture and public-realm details ink lines",
      ),
    ).toBeDefined();
  });

  test("adds company and balloon signs as drawn lettering", () => {
    const details = createExpandedCityDetails(landmarks);
    expect(details.getObjectByName("KPMG rooftop lettering")).toBeDefined();
    expect(details.getObjectByName("DKB rooftop lettering")).toBeDefined();
    expect(details.getObjectByName("WELT rooftop lettering")).toBeDefined();
  });

  test("grounds both company signs on recognisable building masses", () => {
    const details = createExpandedCityDetails(landmarks);
    const bodies = details.getObjectByName(
      "Expanded architecture and public-realm details bodies",
    ) as Mesh;
    const bounds = new Box3().setFromObject(bodies);
    expect(bounds.max.y).toBeGreaterThan(65);
    expect(details.userData.geometryStatus).toContain("Open-data-positioned");
  });

  test("keeps the WELT balloon tall but introduces no duplicate Carillon", () => {
    const details = createExpandedCityDetails(landmarks);
    const bounds = new Box3().setFromObject(details);
    expect(bounds.max.y).toBeGreaterThan(85);
    expect(
      details.getObjectByName("Granular 42 m Carillon im Tiergarten"),
    ).toBeUndefined();
    expect(details.userData.geometryStatus).toContain("LoD2 remains");
  });

  test("frames tall and edge-of-map additions without clipping", () => {
    const welt = landmarks.find((landmark) => landmark.name === "WELT Balloon");
    const dkb = landmarks.find(
      (landmark) => landmark.name === "DKB Campus Upbeat",
    );
    expect(welt).toBeDefined();
    expect(dkb).toBeDefined();
    expect(expandedCityFocusCamera(welt!)).toMatchObject({
      distance_m: 218,
      target_height_m: 53,
      target_world: welt?.world,
    });
    expect(expandedCityFocusCamera(dkb!)).toMatchObject({
      distance_m: 232,
      target_height_m: 32,
    });
  });
});
