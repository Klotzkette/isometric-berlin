import { describe, expect, test } from "bun:test";

import {
  miniMapCardinalRotationDegrees,
  miniMapHeadingRotationDegrees,
  worldToReferenceMapPoint,
} from "../src/pedestrianMiniMapProjection";

const appSource = await Bun.file(
  new URL("../src/App.tsx", import.meta.url),
).text();

describe("pedestrian minimap projection", () => {
  test("uses its marker-free map instead of the numbered reference plate", () => {
    expect(appSource).toContain(
      'assetPath("dzi/regierungsviertel/pedestrian_map.png")',
    );
    expect(appSource).toContain("imageUrl={pedestrianMapUrl}");
    expect(appSource).toContain("src={referenceMapUrl}");
  });

  test("keeps the top-down reference map north-up", () => {
    const center = worldToReferenceMapPoint(0, 0);
    const east = worldToReferenceMapPoint(100, 0);
    const north = worldToReferenceMapPoint(0, -100);

    expect(east.x).toBeGreaterThan(center.x);
    expect(north.y).toBeLessThan(center.y);
  });

  test("rotates the map to the selected cardinal", () => {
    expect(miniMapCardinalRotationDegrees(40, 40)).toBe(0);
    expect(miniMapCardinalRotationDegrees(130, 40)).toBe(-90);
    expect(miniMapCardinalRotationDegrees(220, 40)).toBe(-180);
    expect(miniMapCardinalRotationDegrees(310, 40)).toBe(-270);
  });

  test("keeps the pedestrian heading relative to the map orientation", () => {
    expect(miniMapHeadingRotationDegrees(90, 40, 40)).toBe(90);
    expect(miniMapHeadingRotationDegrees(90, 130, 40)).toBe(0);
  });
});
