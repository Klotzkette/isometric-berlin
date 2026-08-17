import { describe, expect, test } from "bun:test";

import { Box3, LineSegments, Mesh } from "three";

import { createFuelStations } from "../src/FuelStations";
import type { VoxelPayload } from "../src/MinecraftVoxelWorld";
import type { StreetDetailsPayload } from "../src/TrafficSignals";
import streetDetails from "../public/mesh/regierungsviertel/street-details.json";
import voxelPayload from "../public/mesh/regierungsviertel/minecraft-voxels.json";

const street = streetDetails as unknown as StreetDetailsPayload;
const ground = voxelPayload as unknown as VoxelPayload;

describe("drawn filling stations (OSM amenity=fuel)", () => {
  const stations = street.fuel_stations!;
  const drawn = createFuelStations(street, ground)!;

  test("the payload carries every mapped station in the expanded area with an axis", () => {
    expect(stations.map((entry) => entry.name).sort()).toEqual([
      "Agip",
      "Aral",
      "Aral",
      "Aral",
      "Aral",
      "Esso",
      "SB Tank",
      "Shell",
      "Shell",
      "Sprint",
      "Total",
      "Total",
      "Westfehling",
    ]);
    for (const station of stations) {
      const [ax, az] = station.axis;
      expect(Math.hypot(ax, az)).toBeCloseTo(1, 3);
    }
    // SB Tank, both Shells and one Total are mapped areas; the other nine are
    // nodes whose forecourt is derived from the nearest frontage road.
    const surveyed = stations.filter((entry) => entry.surveyed_outline);
    expect(surveyed.map((entry) => entry.name).sort()).toEqual([
      "SB Tank",
      "Shell",
      "Shell",
      "Total",
    ]);
  });

  test("the node-only Esso keeps the axis of its mapped canopy", () => {
    // OSM way 25780043 is the Esso roof on Lessingstraße; its long side
    // runs (0.859, 0.512) in world coordinates. The exporter derives the
    // axis by turning the street a quarter turn, which has to land there.
    const esso = stations.find((entry) => entry.name === "Esso")!;
    const dot = esso.axis[0] * 0.859 + esso.axis[1] * 0.512;
    expect(Math.abs(dot)).toBeGreaterThan(0.99);
  });

  test("each forecourt is a canopy on posts over pump islands", () => {
    const bodies = drawn.getObjectByName("filling station bodies") as Mesh;
    expect(bodies).toBeInstanceOf(Mesh);
    expect(drawn.getObjectByName("filling station ink lines")).toBeInstanceOf(
      LineSegments,
    );
    // Every canopy has four posts, two islands with two dispensers each and
    // a totem: enough boxes that a bare row of pumps cannot pass this.
    const position = bodies.geometry.getAttribute("position");
    expect(position.count).toBeGreaterThan(stations.length * 18 * 24);
    const bounds = new Box3().setFromObject(bodies);
    // The price totem is the tallest part of a forecourt, and no part of
    // one reaches the height of the buildings around it.
    expect(bounds.max.y).toBeGreaterThan(8);
    expect(bounds.max.y).toBeLessThan(14);
  });

  test("the drawn forecourt kit is flagged as extrapolated", () => {
    // OSM gives position, brand and fuel grades; the canopy, the islands
    // and the totem are a standard forecourt, so they must say so.
    expect(drawn.userData.extrapolated).toBe(true);
  });
});
