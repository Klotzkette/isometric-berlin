import { describe, expect, test } from "bun:test";

import {
  FEATURED_SIGHT_NAMES,
  featuredSights,
  findSightBySlug,
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
    expect(
      findSightBySlug(
        [{ name: "Reichstagsgebäude" }, { name: "Siegessäule" }],
        "siegessaule",
      )?.name,
    ).toBe("Siegessäule");
  });

  test("parses full and shorthand hashes", () => {
    expect(
      parseViewHash("#landmark=brandenburger-tor&view=N&flip=1"),
    ).toEqual({
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
});
