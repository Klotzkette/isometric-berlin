import { describe, expect, test } from "bun:test";
import {
  DEFAULT_FOCUS_LANDMARK,
  DEFAULT_THREE_CAMERA_OFFSET,
  DEFAULT_THREE_TARGET_WORLD,
  DEFAULT_VIEW,
  NORTH_UP_ROTATION,
  type ViewState,
  isDefaultView,
  resolveResetView,
} from "../src/resetView";

const WRECKED_STATES: Array<[string, ViewState]> = [
  [
    "night mode, orbited camera, wrong landmark",
    {
      focus: "Berlin Hauptbahnhof",
      isFlipped: true,
      isUnderside: false,
      lightingMode: "night",
      rotationDegrees: 12.5,
    },
  ],
  [
    "Minecraft mode seen from underneath",
    {
      focus: "Moltkebrücke",
      isFlipped: false,
      isUnderside: true,
      lightingMode: "minecraft",
      rotationDegrees: 203,
    },
  ],
  [
    "day mode but zoomed off to a mirrored corner",
    {
      focus: "Humboldthafen",
      isFlipped: true,
      isUnderside: true,
      lightingMode: "day",
      rotationDegrees: NORTH_UP_ROTATION + 90,
    },
  ],
];

describe("reset returns to the default view", () => {
  test("the default view is the Reichstag from above its front lawn", () => {
    expect(DEFAULT_VIEW.focus).toBe("Reichstagsgebäude");
    expect(DEFAULT_VIEW.focus).toBe(DEFAULT_FOCUS_LANDMARK);
    expect(DEFAULT_VIEW.lightingMode).toBe("day");
    expect(DEFAULT_VIEW.rotationDegrees).toBe(NORTH_UP_ROTATION);
    expect(DEFAULT_VIEW.isFlipped).toBe(false);
    expect(DEFAULT_VIEW.isUnderside).toBe(false);
    expect(DEFAULT_THREE_TARGET_WORLD).toEqual([317.729, 21.595, 40.477]);
    expect(DEFAULT_THREE_CAMERA_OFFSET[1]).toBeGreaterThan(35);
    expect(
      DEFAULT_THREE_TARGET_WORLD[0] + DEFAULT_THREE_CAMERA_OFFSET[0],
    ).toBeCloseTo(151.762, 3);
    expect(
      DEFAULT_THREE_TARGET_WORLD[2] + DEFAULT_THREE_CAMERA_OFFSET[2],
    ).toBeCloseTo(107.532, 3);
  });

  test.each(WRECKED_STATES)("recovers from %s", (_label, state) => {
    expect(isDefaultView(state)).toBe(false);
    const target = resolveResetView();
    expect(isDefaultView(target)).toBe(true);
    expect(target.lightingMode).toBe("day");
    expect(target.focus).toBe("Reichstagsgebäude");
  });

  test("resetting an already-default view is a no-op", () => {
    expect(isDefaultView(resolveResetView())).toBe(true);
  });

  test("callers cannot mutate the shared default through the result", () => {
    const target = resolveResetView();
    target.lightingMode = "night";
    expect(DEFAULT_VIEW.lightingMode).toBe("day");
    expect(resolveResetView().lightingMode).toBe("day");
  });
});
