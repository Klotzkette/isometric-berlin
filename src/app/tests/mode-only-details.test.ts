import { describe, expect, test } from "bun:test";
import { Group, Mesh, MeshBasicMaterial } from "three";

import {
  createSnowAccents,
  setModeOnlyDetails,
} from "../src/modeOnlyDetails";

describe("mode-only recognition details", () => {
  test("merges snow accents into one unlit draw and round-trips every mode", () => {
    const snow = createSnowAccents({
      boxes: [{ position: [0, 0.02, 0], size: [2, 0.04, 1] }],
      mounds: [{ position: [1, 0.4, 0], scale: [0.5, 0.08, 0.4] }],
      name: "Test snow accents",
      ridges: [
        {
          end: [2, 1.05, 0],
          start: [-2, 1.05, 0],
          widthM: 0.05,
        },
      ],
    });
    const root = new Group();
    root.add(snow);

    expect(snow.visible).toBeFalse();
    expect(snow.userData.visualModeOnly).toBe("snowstorm");
    expect(snow.children).toHaveLength(1);
    const surface = snow.children[0] as Mesh;
    expect(surface).toBeInstanceOf(Mesh);
    expect(surface.material).toBeInstanceOf(MeshBasicMaterial);
    expect((surface.material as MeshBasicMaterial).toneMapped).toBeFalse();

    for (const mode of [
      "day",
      "night",
      "minecraft",
      "schwellenraum",
    ] as const) {
      setModeOnlyDetails(root, mode);
      expect(snow.visible).toBeFalse();
    }
    setModeOnlyDetails(root, "snowstorm");
    expect(snow.visible).toBeTrue();
    setModeOnlyDetails(root, "day");
    expect(snow.visible).toBeFalse();
  });
});
