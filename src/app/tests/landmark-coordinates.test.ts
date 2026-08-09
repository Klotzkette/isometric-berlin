import { describe, expect, test } from "bun:test";

import { landmarkPixelCoordinates } from "../src/landmarkCoordinates";

describe("DZI landmark coordinates", () => {
  test("targets the same normalized place in hosted and compact DZI images", () => {
    const landmark = { nx: 0.530884, ny: 0.582989 };

    const hosted = landmarkPixelCoordinates(landmark, 16_384, 11_616);
    const compact = landmarkPixelCoordinates(landmark, 8192, 5808);

    expect(hosted.x).toBeCloseTo(8698.003456, 6);
    expect(hosted.y).toBeCloseTo(6772.000224, 6);
    expect(compact.x).toBeCloseTo(hosted.x / 2, 6);
    expect(compact.y).toBeCloseTo(hosted.y / 2, 6);
  });

  test("clamps malformed normalized values to the image", () => {
    expect(
      landmarkPixelCoordinates({ nx: -0.2, ny: 1.4 }, 8192, 5808),
    ).toEqual({ x: 0, y: 5808 });
  });
});
