import { describe, expect, test } from "bun:test";

import {
  isPedestrianJumpKey,
  isReservedBrowserChord,
} from "../src/keyboardShortcuts";

const chord = (key: string, altKey = false, ctrlKey = false, metaKey = false) =>
  ({ altKey, ctrlKey, key, metaKey }) as const;

describe("keyboard shortcut browser-chord guard", () => {
  test("lets all four documented Alt/Option arrow orbit chords reach the viewer", () => {
    for (const key of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]) {
      expect(isReservedBrowserChord(chord(key, true))).toBe(false);
    }
  });

  test("leaves ordinary browser chords untouched", () => {
    expect(isReservedBrowserChord(chord("l", false, false, true))).toBe(true);
    expect(isReservedBrowserChord(chord("d", false, true))).toBe(true);
    expect(isReservedBrowserChord(chord("f", true))).toBe(true);
  });

  test("accepts unmodified viewer shortcuts", () => {
    expect(isReservedBrowserChord(chord("m"))).toBe(false);
  });

  test("recognises the pedestrian jump independently of layout or legacy key names", () => {
    expect(isPedestrianJumpKey({ code: "Space", key: " " })).toBe(true);
    expect(isPedestrianJumpKey({ code: "", key: "Space" })).toBe(true);
    expect(isPedestrianJumpKey({ code: "", key: "Spacebar" })).toBe(true);
    expect(isPedestrianJumpKey({ code: "KeyW", key: "w" })).toBe(false);
  });
});
