import { describe, expect, test } from "bun:test";
import {
  DEFAULT_FOCUS_LANDMARK,
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
  test("the default view is the Chancellery in daylight, north up", () => {
    expect(DEFAULT_VIEW.focus).toBe("Bundeskanzleramt");
    expect(DEFAULT_VIEW.focus).toBe(DEFAULT_FOCUS_LANDMARK);
    expect(DEFAULT_VIEW.lightingMode).toBe("day");
    expect(DEFAULT_VIEW.rotationDegrees).toBe(NORTH_UP_ROTATION);
    expect(DEFAULT_VIEW.isFlipped).toBe(false);
    expect(DEFAULT_VIEW.isUnderside).toBe(false);
  });

  test.each(WRECKED_STATES)("recovers from %s", (_label, state) => {
    expect(isDefaultView(state)).toBe(false);
    const target = resolveResetView();
    expect(isDefaultView(target)).toBe(true);
    expect(target.lightingMode).toBe("day");
    expect(target.focus).toBe("Bundeskanzleramt");
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
