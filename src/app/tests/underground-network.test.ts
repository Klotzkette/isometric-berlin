import { describe, expect, test } from "bun:test";
import { Group, LineSegments, Mesh } from "three";

import type { VoxelPayload } from "../src/MinecraftVoxelWorld";
import type { RailPayload } from "../src/RailNetwork";
import {
  createTramCatenary,
  createUndergroundNetwork,
  setUndergroundPresentation,
} from "../src/UndergroundNetwork";
import railJson from "../public/mesh/regierungsviertel/rail-lines.json";
import groundJson from "../public/mesh/regierungsviertel/minecraft-voxels.json";

const rail = railJson as unknown as RailPayload;
const ground = groundJson as unknown as VoxelPayload;

describe("the mapped underground passenger cutaway", () => {
  test("contains real routes but no invented utility network", () => {
    expect(rail.schema_version).toBe(2);
    expect(rail.underground.utility_networks_included).toBe(false);
    expect(
      rail.underground.tracks.filter((track) => track.line_family === "u5")
        .length,
    ).toBeGreaterThan(10);
    expect(
      rail.underground.tracks.filter(
        (track) => track.line_family === "north_south_sbahn",
      ).length,
    ).toBeGreaterThan(10);
    expect(JSON.stringify(rail.underground)).not.toContain("pipe");
  });

  test("builds a bounded batched cutaway controlled by its scene parent", () => {
    const group = createUndergroundNetwork(rail);
    expect(group).toBeInstanceOf(Group);
    expect(group!.visible).toBe(true);
    expect(group!.userData.utilityNetworksIncluded).toBe(false);
    const drawObjects: Array<Mesh | LineSegments> = [];
    group!.traverse((object) => {
      if (object instanceof Mesh || object instanceof LineSegments) {
        drawObjects.push(object);
      }
    });
    expect(drawObjects.length).toBeLessThanOrEqual(16);
    expect(
      group!.getObjectByName("mapped underground station platforms"),
    ).toBeInstanceOf(Mesh);
    expect(
      group!.getObjectByName(
        "mapped subway entrances with schematic shafts and landings",
      ),
    ).toBeInstanceOf(LineSegments);
  });

  test("changes its restrained route palette losslessly by mode", () => {
    const group = createUndergroundNetwork(rail)!;
    const u5 = group.getObjectByName("underground u5 track beds") as Mesh;
    const day = u5.material;
    expect(Array.isArray(day)).toBe(false);
    setUndergroundPresentation(group, "night");
    const nightHex = !Array.isArray(u5.material)
      ? (u5.material as { color: { getHex: () => number } }).color.getHex()
      : 0;
    setUndergroundPresentation(group, "day");
    const dayHex = !Array.isArray(u5.material)
      ? (u5.material as { color: { getHex: () => number } }).color.getHex()
      : 0;
    expect(nightHex).not.toBe(dayHex);
    expect(dayHex).toBe(0xc99b32);
  });

  test("tram wire plan courses come from the same OSM payload", () => {
    const group = createTramCatenary(rail, ground);
    expect(group).toBeInstanceOf(Group);
    expect(group!.getObjectByName("tram contact wires")).toBeInstanceOf(
      LineSegments,
    );
    expect(group!.getObjectByName("tram catenary masts")).toBeInstanceOf(
      LineSegments,
    );
    expect(group!.userData.geometryStatus).toContain("approximation");
  });
});
