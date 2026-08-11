import { describe, expect, test } from "bun:test";

import { Box3, Group, LineSegments, Mesh } from "three";

import type { VoxelPayload } from "../src/MinecraftVoxelWorld";
import {
  HBF_EAST_STEEL_SUPPORT_BOUNDS,
  type RailPayload,
  createRailNetwork,
} from "../src/RailNetwork";
import railLines from "../public/mesh/regierungsviertel/rail-lines.json";
import voxelPayload from "../public/mesh/regierungsviertel/minecraft-voxels.json";

const rail = railLines as unknown as RailPayload;
const ground = voxelPayload as unknown as VoxelPayload;

describe("C13: the aboveground railway", () => {
  test("the payload carries a viaduct, piers and drawn tracks", () => {
    expect(rail.schema_version).toBe(2);
    expect(rail.viaduct.length).toBeGreaterThan(0);
    expect(rail.piers.length).toBeGreaterThan(100);
    expect(rail.viaduct_tracks.length).toBeGreaterThan(0);
    expect(rail.embankment_tracks.length).toBeGreaterThan(0);
  });

  test("the deck sits at one height across the whole map", () => {
    // OSM carries no rail elevation, so a level deck is the honest
    // simplification; the height comes from the station model, not thin air.
    expect(rail.deck_top_y_m).toBeGreaterThan(10);
    expect(rail.deck_top_y_m).toBeLessThan(20);
  });

  test("the railway reaches the east edge instead of stopping in mid-air", () => {
    const xs = rail.viaduct.flatMap((surface) =>
      surface.ring.map(([x]) => x / 10),
    );
    // The map's drawn data runs out at x 690; the Stadtbahn crosses it all.
    expect(Math.max(...xs)).toBeGreaterThan(630);
    expect(Math.min(...xs)).toBeLessThan(-2600);
  });

  test("it builds one group of drawn bodies plus ink", () => {
    const group = createRailNetwork(rail, ground);
    expect(group).toBeInstanceOf(Group);
    const bodies = group!.getObjectByName(
      "railway deck, piers and rails",
    ) as Mesh;
    expect(bodies).toBeInstanceOf(Mesh);
    // Flat paint by day, the lit material only under the night rig.
    expect(bodies.userData.dayMaterial).toBeDefined();
    expect(bodies.userData.nightMaterial).toBeDefined();
    expect(bodies.geometry.getAttribute("color")).toBeDefined();
    const ink = group!.getObjectByName("railway deck ink lines");
    expect(ink).toBeInstanceOf(LineSegments);
  });

  test("the piers stand under the deck, not beside or above it", () => {
    const group = createRailNetwork(rail, ground)!;
    const bodies = group.getObjectByName("railway deck, piers and rails")!;
    const bounds = new Box3().setFromObject(bodies);
    // Nothing may poke through the deck except the rails on top of it.
    expect(bounds.max.y).toBeLessThan(
      rail.deck_top_y_m + rail.rail_top_over_deck_m + 0.1,
    );
    // The piers reach down to the surveyed ground.
    expect(bounds.min.y).toBeLessThan(5);
  });

  test("uses rust-red steel trestles on the east Hauptbahnhof approach", () => {
    const group = createRailNetwork(rail, ground)!;
    expect(group.userData.hbfEastSteelSupportCount).toBeGreaterThan(10);
    expect(HBF_EAST_STEEL_SUPPORT_BOUNDS).toEqual({
      maxX: 270,
      maxZ: -580,
      minX: -92,
      minZ: -755,
    });
  });
});
