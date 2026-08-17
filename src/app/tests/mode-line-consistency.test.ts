import { describe, expect, test } from "bun:test";
import { LineBasicMaterial, LineSegments } from "three";

import groundPayload from "../public/mesh/regierungsviertel/minecraft-voxels.json";
import railPayload from "../public/mesh/regierungsviertel/rail-lines.json";
import { createCulturalLandmarks } from "../src/CulturalLandmarks";
import type { VoxelPayload } from "../src/MinecraftVoxelWorld";
import {
  type ParkDetailsPayload,
  createParkDetails,
} from "../src/ParkDetails";
import { type RailPayload, createRailNetwork } from "../src/RailNetwork";
import { applyArchitecturalInkMode } from "../src/architecturalInk";

function expectModeAwareAccent(lines: LineSegments): void {
  const material = lines.material as LineBasicMaterial;
  const day = material.color.getHex();
  expect(material.userData.modeInk).toBeTrue();
  expect(material.userData.architecturalInkDayColor).toBe(day);

  applyArchitecturalInkMode(material, "night");
  expect(material.color.getHex()).not.toBe(day);
  applyArchitecturalInkMode(material, "minecraft");
  expect(material.color.getHex()).not.toBe(day);
  applyArchitecturalInkMode(material, "snowstorm");
  expect(material.color.getHex()).not.toBe(day);
  applyArchitecturalInkMode(material, "schwellenraum");
  expect(material.color.getHex()).toBe(day);
  applyArchitecturalInkMode(material, "day");
  expect(material.color.getHex()).toBe(day);
}

describe("purposeful line accents in every visual mode", () => {
  test("keeps the railway drawing material-aware after dark and in winter", () => {
    const railway = createRailNetwork(
      railPayload as unknown as RailPayload,
      groundPayload as unknown as VoxelPayload,
    );
    expectModeAwareAccent(
      railway?.getObjectByName("railway deck ink lines") as LineSegments,
    );
  });

  test("keeps Spree crest highlights cool without glowing unchanged at night", () => {
    const landmarks = createCulturalLandmarks([]);
    expectModeAwareAccent(
      landmarks.getObjectByName(
        "Spree broken three-dimensional wave crest highlights",
      ) as LineSegments,
    );
  });

  test("keeps playground rope identity while adapting its contrast", () => {
    const payload: ParkDetailsPayload = {
      paths: [],
      playgrounds: [
        {
          equipment: [
            {
              id: "mode-rope",
              kind: "climbingframe",
              material: "rope",
              points: [],
              position: [0, 5, 0],
            },
          ],
          id: "mode-playground",
          name: "Mode playground",
          outline: [
            [-4, 5, -4],
            [4, 5, -4],
            [4, 5, 4],
            [-4, 5, 4],
            [-4, 5, -4],
          ],
          source_url: "https://www.openstreetmap.org/",
          surface: "sand",
          wheelchair: null,
        },
      ],
      schema_version: 6,
      source: {
        attribution: "© OpenStreetMap contributors",
        geometry_status: "test fixture",
        name: "OpenStreetMap",
      },
      street_lights: [],
      trees: [],
      wall_traces: [],
    };
    const park = createParkDetails(payload);
    expectModeAwareAccent(
      park.getObjectByName(
        "climbingframe mode-rope climbing net",
      ) as LineSegments,
    );
  });
});
