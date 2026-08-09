import { describe, expect, test } from "bun:test";

import { shouldUseSettledSurface } from "../src/surfaceQuality";

describe("stable official surface quality", () => {
  test("shows six-million-face detail once desktop loading completes", () => {
    expect(
      shouldUseSettledSurface({
        coarsePointer: false,
        detailReady: true,
        interactionTierLocked: false,
      }),
    ).toBe(true);
    expect(
      shouldUseSettledSurface({
        coarsePointer: false,
        detailReady: false,
        interactionTierLocked: false,
      }),
    ).toBe(false);
  });

  test("does not replace the desktop surface during camera interaction", () => {
    expect(
      shouldUseSettledSurface({
        coarsePointer: false,
        detailReady: true,
        interactionTierLocked: false,
      }),
    ).toBe(true);
  });

  test("keeps the interaction surface on touch and in locked modes", () => {
    expect(
      shouldUseSettledSurface({
        coarsePointer: true,
        detailReady: true,
        interactionTierLocked: false,
      }),
    ).toBe(false);
    expect(
      shouldUseSettledSurface({
        coarsePointer: false,
        detailReady: true,
        interactionTierLocked: true,
      }),
    ).toBe(false);
  });
});
