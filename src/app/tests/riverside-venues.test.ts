import { describe, expect, test } from "bun:test";

import { Box3, LineSegments, Mesh } from "three";

import type { VoxelPayload } from "../src/MinecraftVoxelWorld";
import { createRiversideVenues, ZOLLPACKHOF_TAP } from "../src/RiversideVenues";
import {
  createSpreebogenOffice,
  INTERIM_OFFICE_FOOTPRINT_RING,
} from "../src/SpreebogenOffice";
import type { StreetDetailsPayload } from "../src/TrafficSignals";
import streetDetails from "../public/mesh/regierungsviertel/street-details.json";
import voxelPayload from "../public/mesh/regierungsviertel/minecraft-voxels.json";

const street = streetDetails as unknown as StreetDetailsPayload;
const ground = voxelPayload as unknown as VoxelPayload;

describe("Capital Beach and the beer gardens", () => {
  const venues = createRiversideVenues(street, ground)!;

  test("Capital Beach is the one bar OSM has only a node for", () => {
    const bars = street.riverside_bars!;
    expect(bars.map((entry) => entry.name)).toEqual(["Capital Beach"]);
    const beach = bars[0];
    expect(beach.surveyed_outline).toBe(false);
    // The deck chairs stand on the surveyed bench rows on the quay, so the
    // layout is not an invented grid even though the bar is a bare node.
    expect(beach.seats.length).toBeGreaterThanOrEqual(10);
  });

  test("Zollpackhof keeps the surveyed beer-garden ring", () => {
    const garden = street.beer_gardens!.find(
      (entry) => entry.name === "Zollpackhof",
    )!;
    // OSM way 422205278, measured at 1601 m² on the full planet extract.
    expect(garden.area_m2).toBeGreaterThan(1550);
    expect(garden.area_m2).toBeLessThan(1650);
    expect(garden.ring_dm.length).toBeGreaterThanOrEqual(4);
  });

  test("the furniture is drawn as flat tones with ink lines", () => {
    expect(venues.getObjectByName("riverside venue bodies")).toBeInstanceOf(
      Mesh,
    );
    expect(venues.getObjectByName("riverside venue ink lines")).toBeInstanceOf(
      LineSegments,
    );
    expect(venues.userData.extrapolated).toBe(true);
  });

  test("nothing on the bank stands taller than the chestnut", () => {
    const bodies = venues.getObjectByName("riverside venue bodies") as Mesh;
    const bounds = new Box3().setFromObject(bodies);
    // node/4219261197 carries height=20 and is the tallest thing here.
    expect(bounds.max.y).toBeLessThan(26);
    expect(bounds.max.y).toBeGreaterThan(12);
  });
});

describe("Amtssitz am Spreebogen (interim Bundespräsidialamt)", () => {
  const office = createSpreebogenOffice(ground)!;

  test("it stands on the OSM footprint of way/1535591727", () => {
    const bodies = office.getObjectByName(
      "Amtssitz am Spreebogen bodies",
    ) as Mesh;
    const bounds = new Box3().setFromObject(bodies);
    // Exact projected bbox of the current OSM way, plus < 0.5 m fins.
    expect(bounds.min.x).toBeCloseTo(-346.8, 0);
    expect(bounds.max.x).toBeCloseTo(-253.9, 0);
    expect(bounds.min.z).toBeCloseTo(-396.5, 0);
    expect(bounds.max.z).toBeCloseTo(-322.8, 0);
  });

  test("seven storeys, and the inferred height is flagged as such", () => {
    const bodies = office.getObjectByName(
      "Amtssitz am Spreebogen bodies",
    ) as Mesh;
    const bounds = new Box3().setFromObject(bodies);
    // Plinth, five upper storeys, a set-back state-room floor and a parapet.
    expect(bounds.max.y).toBeGreaterThan(24);
    expect(bounds.max.y).toBeLessThan(34);
    // No metre height is published for this building anywhere.
    expect(office.userData.extrapolated).toBe(true);
  });

  test("uses the surveyed bent bar, not a capsule or bounding-box block", () => {
    const bodies = office.getObjectByName(
      "Amtssitz am Spreebogen bodies",
    ) as Mesh;
    const bounds = new Box3().setFromObject(bodies);
    const widthM = bounds.max.x - bounds.min.x;
    const depthM = bounds.max.z - bounds.min.z;
    expect(INTERIM_OFFICE_FOOTPRINT_RING.length).toBe(37);
    expect(office.userData.massing).toBe("surveyed bent-bar footprint");
    // The true OSM extent is preserved without the old ~142 m pill inflation.
    expect(widthM).toBeGreaterThan(90);
    expect(depthM).toBeGreaterThan(70);
    expect(widthM).toBeLessThan(95);
    expect(depthM).toBeLessThan(76);
  });

  test("the facade fins mix many colours, not a repeating stripe", () => {
    const bodies = office.getObjectByName(
      "Amtssitz am Spreebogen bodies",
    ) as Mesh;
    const colours = bodies.geometry.getAttribute("color");
    const seen = new Set<string>();
    for (let index = 0; index < colours.count; index += 1) {
      seen.add(
        `${colours.getX(index).toFixed(2)},${colours.getY(index).toFixed(2)},${colours.getZ(index).toFixed(2)}`,
      );
    }
    // Plinth, glazing body, attic, parapet, plus at least four distinct fin
    // colours: the photographed facade is a genuine multicolour mix.
    expect(seen.size).toBeGreaterThanOrEqual(8);
  });

  test("does not wrap the completed outline in a rectangular worksite", () => {
    const cranes = office.getObjectByName("Amtssitz am Spreebogen site cranes");
    expect(cranes).toBeUndefined();
    const bodies = office.getObjectByName(
      "Amtssitz am Spreebogen bodies",
    ) as Mesh;
    const buildingBounds = new Box3().setFromObject(bodies);
    const fullBounds = new Box3().setFromObject(office);
    expect(fullBounds.min.x).toBeCloseTo(buildingBounds.min.x, 5);
    expect(fullBounds.max.x).toBeCloseTo(buildingBounds.max.x, 5);
    expect(fullBounds.min.z).toBeCloseTo(buildingBounds.min.z, 5);
    expect(fullBounds.max.z).toBeCloseTo(buildingBounds.max.z, 5);
  });

  test("its footprint sits clear of the Zollpackhof tap house, not merged with it", () => {
    // v0.53.0 regression: the oversized ~142 m body visually swallowed the
    // one-storey Zollpackhof Schankhaus. Assert the two AABBs are disjoint
    // on the ground plane and that the office's own centroid lands in the
    // north-of-the-river, north-west-of-Moltkebruecke region rather than on
    // top of the beer garden south of it.
    const bodies = office.getObjectByName(
      "Amtssitz am Spreebogen bodies",
    ) as Mesh;
    const officeBounds = new Box3().setFromObject(bodies);

    // The tap house is one storey and far smaller than the former 40 m test
    // envelope, which almost touched the real Amtssitz bbox by construction.
    const tapHalfExtent = 15;
    const tapMinX = ZOLLPACKHOF_TAP.x - tapHalfExtent;
    const tapMaxX = ZOLLPACKHOF_TAP.x + tapHalfExtent;
    const tapMinZ = ZOLLPACKHOF_TAP.z - tapHalfExtent;
    const tapMaxZ = ZOLLPACKHOF_TAP.z + tapHalfExtent;

    const disjointOnX =
      officeBounds.max.x < tapMinX || officeBounds.min.x > tapMaxX;
    const disjointOnZ =
      officeBounds.max.z < tapMinZ || officeBounds.min.z > tapMaxZ;
    expect(disjointOnX || disjointOnZ).toBe(true);

    // The office sits north of the river and west of the tap house.
    const centreX = (officeBounds.min.x + officeBounds.max.x) / 2;
    const centreZ = (officeBounds.min.z + officeBounds.max.z) / 2;
    expect(centreZ).toBeLessThan(-350);
    expect(centreX).toBeLessThan(ZOLLPACKHOF_TAP.x);
  });
});
