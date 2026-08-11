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
import type { VisualMode } from "../src/visualMode";

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

  test("changes its restrained route palette losslessly in all four modes", () => {
    const group = createUndergroundNetwork(rail)!;
    const u5 = group.getObjectByName("underground u5 track beds") as Mesh;
    const drawObjects: Array<Mesh | LineSegments> = [];
    group.traverse((object) => {
      if (object instanceof Mesh || object instanceof LineSegments) {
        drawObjects.push(object);
      }
    });
    const geometries = drawObjects.map((object) => object.geometry);
    const modes: VisualMode[] = ["day", "night", "minecraft", "snowstorm"];

    for (const mode of modes) {
      setUndergroundPresentation(group, mode);
      for (const object of drawObjects) {
        const material = object.material;
        expect(Array.isArray(material)).toBe(false);
        if (Array.isArray(material)) continue;
        const palette = material.userData.modePalette as Record<
          VisualMode,
          number
        >;
        expect(Object.keys(palette).sort()).toEqual([...modes].sort());
        expect(material.color.getHex()).toBe(palette[mode]);
      }
      expect(drawObjects.map((object) => object.geometry)).toEqual(geometries);
      expect(group.visible).toBe(true);
    }

    setUndergroundPresentation(group, "day");
    const dayHex = !Array.isArray(u5.material)
      ? (u5.material as { color: { getHex: () => number } }).color.getHex()
      : 0;
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
