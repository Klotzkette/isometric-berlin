import { describe, expect, test } from "bun:test";

import {
  FEATURED_SIGHT_NAMES,
  SIMULATION_START_SIGHT_NAMES,
  SIMULATION_START_STORAGE_KEY,
  featuredSights,
  findSightBySlug,
  nextSimulationStartSight,
  parseViewHash,
  sightSlug,
} from "../src/viewNavigation";

describe("view navigation", () => {
  test("keeps the rail to five curated sights without shrinking the catalog", () => {
    const catalog = [
      { name: "Luiseninsel" },
      ...FEATURED_SIGHT_NAMES.map((name) => ({ name })),
      { name: "Quadriga mit Victoria" },
    ];

    expect(featuredSights(catalog).map((sight) => sight.name)).toEqual([
      ...FEATURED_SIGHT_NAMES,
    ]);
    expect(catalog).toHaveLength(7);
  });

  test("normalizes German sight names for portable deep links", () => {
    expect(sightSlug("Reichstagsgebäude")).toBe("reichstagsgebaude");
    expect(sightSlug("Bahnhof Berlin Friedrichstraße")).toBe(
      "bahnhof-berlin-friedrichstrasse",
    );
    expect(
      findSightBySlug(
        [{ name: "Reichstagsgebäude" }, { name: "Siegessäule" }],
        "siegessaule",
      )?.name,
    ).toBe("Siegessäule");
    expect(
      findSightBySlug(
        [{ name: "Bahnhof Berlin Friedrichstraße" }],
        "bahnhof-berlin-friedrichstra-e",
      )?.name,
    ).toBe("Bahnhof Berlin Friedrichstraße");
    expect(
      findSightBySlug(
        [{ name: "Queer Rainbow Memorial Berlin" }],
        "queer-rainbow-memorial-berlin",
      )?.name,
    ).toBe("Queer Rainbow Memorial Berlin");
  });

  test("parses full and shorthand hashes", () => {
    expect(parseViewHash("#landmark=brandenburger-tor&view=N&flip=1")).toEqual({
      flipped: true,
      landmarkSlug: "brandenburger-tor",
      rotationValue: "N",
    });
    expect(parseViewHash("#bundeskanzleramt")).toEqual({
      flipped: null,
      landmarkSlug: "bundeskanzleramt",
      rotationValue: null,
    });
  });

  test("uses a different civic start on every reload and wraps safely", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    expect(nextSimulationStartSight(storage)).toBe("Reichstagsgebäude");
    expect(nextSimulationStartSight(storage)).toBe("Bundeskanzleramt");
    expect(nextSimulationStartSight(storage)).toBe("Berlin Hauptbahnhof");
    expect(nextSimulationStartSight(storage)).toBe("Siegessäule");
    expect(nextSimulationStartSight(storage)).toBe("Reichstagsgebäude");
    expect(values.get(SIMULATION_START_STORAGE_KEY)).toBe(
      SIMULATION_START_SIGHT_NAMES[0],
    );
  });
});
