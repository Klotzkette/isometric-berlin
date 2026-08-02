import { describe, expect, test } from "bun:test";

import { Box3, LineSegments, Mesh } from "three";

import type { VoxelPayload } from "../src/MinecraftVoxelWorld";
import { createRiversideVenues } from "../src/RiversideVenues";
import { createSpreebogenOffice } from "../src/SpreebogenOffice";
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
    // bbox wx −346.8…−253.9, wz −396.5…−322.8, plus the site fence.
    expect((bounds.min.x + bounds.max.x) / 2).toBeCloseTo(-296.2, 0);
    expect((bounds.min.z + bounds.max.z) / 2).toBeCloseTo(-366.5, 0);
  });

  test("seven storeys, and the inferred height is flagged as such", () => {
    const bounds = new Box3().setFromObject(office);
    // Plinth, five upper storeys, a set-back state-room floor and a parapet.
    expect(bounds.max.y).toBeGreaterThan(24);
    expect(bounds.max.y).toBeLessThan(34);
    // No metre height is published for this building anywhere.
    expect(office.userData.extrapolated).toBe(true);
  });
});
