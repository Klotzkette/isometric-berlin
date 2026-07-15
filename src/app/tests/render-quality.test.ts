import { describe, expect, test } from "bun:test";

import { renderPixelRatio } from "../src/renderQuality";

describe("adaptive 3D render quality", () => {
  test("raises settled phone detail without exceeding the mobile cap", () => {
    expect(
      renderPixelRatio({
        coarsePointer: true,
        devicePixelRatio: 3,
        height: 844,
        interacting: false,
        width: 390,
      }),
    ).toBe(2);
  });

  test("drops interaction resolution for smooth touch movement", () => {
    expect(
      renderPixelRatio({
        coarsePointer: true,
        devicePixelRatio: 3,
        height: 844,
        interacting: true,
        width: 390,
      }),
    ).toBe(1);
  });

  test("bounds large desktop canvases by a fixed pixel budget", () => {
    const ratio = renderPixelRatio({
      coarsePointer: false,
      devicePixelRatio: 2.5,
      height: 2160,
      interacting: false,
      width: 3840,
    });
    expect(ratio).toBeGreaterThanOrEqual(1);
    expect(3840 * 2160 * ratio ** 2).toBeLessThanOrEqual(11_600_000);
  });
});
