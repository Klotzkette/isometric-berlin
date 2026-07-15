import { describe, expect, test } from "bun:test";

import { shouldUseSettledSurface } from "../src/surfaceQuality";

describe("progressive official surface quality", () => {
  test("shows six-million-face detail only after desktop loading settles", () => {
    expect(
      shouldUseSettledSurface({
        coarsePointer: false,
        detailReady: true,
        interacting: false,
      }),
    ).toBe(true);
    expect(
      shouldUseSettledSurface({
        coarsePointer: false,
        detailReady: false,
        interacting: false,
      }),
    ).toBe(false);
  });

  test("keeps the interaction surface while orbiting and on touch devices", () => {
    expect(
      shouldUseSettledSurface({
        coarsePointer: false,
        detailReady: true,
        interacting: true,
      }),
    ).toBe(false);
    expect(
      shouldUseSettledSurface({
        coarsePointer: true,
        detailReady: true,
        interacting: false,
      }),
    ).toBe(false);
  });
});
