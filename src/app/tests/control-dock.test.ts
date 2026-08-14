import { describe, expect, test } from "bun:test";

import {
  CONTROL_DOCK_SIDE_STORAGE_KEY,
  controlDockSideFromStored,
  oppositeControlDockSide,
} from "../src/controlDock";

describe("control dock placement", () => {
  test("defaults missing and invalid preferences to the lower left", () => {
    expect(controlDockSideFromStored(null)).toBe("left");
    expect(controlDockSideFromStored("top")).toBe("left");
  });

  test("restores an explicit right-side preference", () => {
    expect(controlDockSideFromStored("right")).toBe("right");
    expect(CONTROL_DOCK_SIDE_STORAGE_KEY).toBe(
      "isometric-berlin.controlDockSide",
    );
  });

  test("moves the complete dock between both sides", () => {
    expect(oppositeControlDockSide("left")).toBe("right");
    expect(oppositeControlDockSide("right")).toBe("left");
  });
});
