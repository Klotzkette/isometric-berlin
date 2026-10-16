import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { GALLERY_FLIGHT_START_V223 as start, startupViewSelection } from "../src/startupView";
import { DEFAULT_THREE_CAMERA_OFFSET, DEFAULT_VIEW } from "../src/resetView";
import { sightSlug } from "../src/viewNavigation";
import { directStartupMode } from "../src/modeLinks";
import landmarks from "../src/data/regierungsviertel-landmarks.json";
import scene from "../public/mesh/regierungsviertel/scene.json";

describe("gallery flight startup v223", () => {
  test("ordinary entry keeps the gallery area and all explicit place/theme links keep priority", () => {
    const ordinary = { name: "Neue Nationalgalerie", automatic: true };
    expect(startupViewSelection(landmarks.landmarks)).toEqual(ordinary);
    expect(startupViewSelection(landmarks.landmarks, "#landmark=missing")).toEqual(ordinary);
    for (const landmark of landmarks.landmarks) {
      expect(startupViewSelection(landmarks.landmarks, `#landmark=${sightSlug(landmark.name)}`))
        .toEqual({ name: landmark.name, automatic: false });
    }
    for (const mode of ["day", "night", "snowstorm", "schwellenraum", "flood", "minecraft"] as const)
      expect(directStartupMode(`?theme=${mode}`)).toBe(mode);
    expect(DEFAULT_VIEW.focus).toBe("Reichstagsgebäude");
  });

  test("the early pose matches the existing gallery focus at its normal flight altitude and lens", () => {
    expect(start.pose.target).toEqual(scene.landmarks.find(landmark => landmark.name === start.landmarkName)!.world);
    expect(start.fov).toBe(16);
    expect(start.pose.position[1]).toBeCloseTo(107.53597544053264, 8);
    const offset = start.pose.position.map((value, i) => value - start.pose.target[i]);
    const distance = Math.hypot(...offset), directionLength = Math.hypot(...DEFAULT_THREE_CAMERA_OFFSET);
    expect(distance * Math.tan(start.fov * Math.PI / 360)).toBeCloseTo(190 * Math.tan(39 * Math.PI / 360), 8);
    for (let i = 0; i < 3; i++)
      expect(offset[i] / distance).toBeCloseTo(DEFAULT_THREE_CAMERA_OFFSET[i] / directionLength, 10);
    expect(start.pose.position[1]).toBeGreaterThan(100);
  });

  test("the actual initial app render has only the loading scene, with no map or navigation HUD", async () => {
    const originals = new Map(["window", "document", "navigator"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    const location = new URL("https://example.test/berlin/?theme=day&lang=en");
    try {
      Object.defineProperty(globalThis, "window", { configurable: true, value: {
        location, localStorage: { getItem: () => null, setItem: () => undefined },
        matchMedia: () => ({ matches: false }),
      } });
      Object.defineProperty(globalThis, "document", { configurable: true, value: { baseURI: location.href } });
      Object.defineProperty(globalThis, "navigator", { configurable: true, value: { language: "en", maxTouchPoints: 0 } });
      const { App } = await import("../src/App");
      const markup = renderToStaticMarkup(<App />);
      expect(markup).toContain('aria-busy="true"');
      expect(markup).toContain('class="three-startup-curtain"');
      expect(markup).toContain('role="status"');
      for (const hud of ["pedestrian-minimap", "flight-joystick", "pedestrian-jump-button", "topbar", "landmark-rail", "view-controls"])
        expect(markup).not.toContain(`class="${hud}`);
      expect(markup).not.toContain("pedestrian_map.png");
      expect(markup).not.toContain("app-shell--pedestrian");
    } finally {
      for (const [key, descriptor] of originals)
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
    }
  });
});
