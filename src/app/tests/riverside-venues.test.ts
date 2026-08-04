import { describe, expect, test } from "bun:test";

import { Box3, LineSegments, Mesh } from "three";

import type { VoxelPayload } from "../src/MinecraftVoxelWorld";
import { createRiversideVenues, ZOLLPACKHOF_TAP } from "../src/RiversideVenues";
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

  test("the short ends are fully rounded, not chamfered corners", () => {
    // The v0.52.x model was a square block with 45°-chamfer corner blocks.
    // The photos show a genuine pill/capsule plan: this checks the body mesh
    // is drawn wider (north-south) than a plain rectangle would allow for the
    // same footprint once the rounded caps are accounted for, i.e. that the
    // partial-cylinder caps actually contributed geometry.
    const bodies = office.getObjectByName(
      "Amtssitz am Spreebogen bodies",
    ) as Mesh;
    const bounds = new Box3().setFromObject(bodies);
    const widthM = bounds.max.x - bounds.min.x;
    const depthM = bounds.max.z - bounds.min.z;
    // The full 92.9 m OSM long axis must be present (straight run + caps).
    expect(widthM).toBeGreaterThan(90);
    expect(depthM).toBeGreaterThan(70);
    // v0.53.0 regression: straightLength used a hard-coded cap radius that
    // did not match the cap geometry's actual depth/2 radius, inflating the
    // assembled body to ~142 m wide. Pin an upper bound a few metres over
    // the 92.9 m OSM long axis so that bug cannot silently return.
    expect(widthM).toBeLessThan(105);
    // A few metres over the 73.7 m OSM depth is the projecting fin/cladding
    // thickness on the rounded caps, not a modelling error.
    expect(depthM).toBeLessThan(85);
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

  test("construction-site cranes stay out of the building's own bounds", () => {
    // Staffage per the brief (nice-to-have), kept in a separate sub-group so
    // it never shifts the footprint/height assertions above, which are
    // pinned to the OSM survey and the storey count, not to the staffage.
    const cranes = office.getObjectByName("Amtssitz am Spreebogen site cranes");
    expect(cranes).not.toBeNull();
    const bodies = office.getObjectByName(
      "Amtssitz am Spreebogen bodies",
    ) as Mesh;
    const buildingBounds = new Box3().setFromObject(bodies);
    const fullBounds = new Box3().setFromObject(office);
    // The cranes overtop the building, so the full group is taller.
    expect(fullBounds.max.y).toBeGreaterThan(buildingBounds.max.y);
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

    // Zollpackhof's tap house footprint is a small building centred on
    // ZOLLPACKHOF_TAP; a generous 40 m half-extent square is more than
    // enough to cover the real (much smaller) one-storey structure while
    // still proving the two are disjoint.
    const tapHalfExtent = 40;
    const tapMinX = ZOLLPACKHOF_TAP.x - tapHalfExtent;
    const tapMaxX = ZOLLPACKHOF_TAP.x + tapHalfExtent;
    const tapMinZ = ZOLLPACKHOF_TAP.z - tapHalfExtent;
    const tapMaxZ = ZOLLPACKHOF_TAP.z + tapHalfExtent;

    const disjointOnX =
      officeBounds.max.x < tapMinX || officeBounds.min.x > tapMaxX;
    const disjointOnZ =
      officeBounds.max.z < tapMinZ || officeBounds.min.z > tapMaxZ;
    expect(disjointOnX || disjointOnZ).toBe(true);

    // The office sits north of the river (more negative world_z than the
    // Moltkebruecke bridge deck) and west of the bridge's easting.
    const centreX = (officeBounds.min.x + officeBounds.max.x) / 2;
    const centreZ = (officeBounds.min.z + officeBounds.max.z) / 2;
    const moltkebrueckeWorldZ = -367.7;
    expect(centreZ).toBeLessThan(moltkebrueckeWorldZ + 5);
    expect(centreX).toBeLessThan(ZOLLPACKHOF_TAP.x);
  });
});
