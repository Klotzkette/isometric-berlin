import { describe, expect, test } from "bun:test";
import { Group, Mesh, MeshBasicMaterial } from "three";

import groundPayload from "../public/mesh/regierungsviertel/minecraft-voxels.json";
import { createAdlerBridge } from "../src/AdlerBridge";
import { setIsoNightPresentation } from "../src/IsometricCityWorld";
import { createLoewenBridge } from "../src/LoewenBridge";
import { FINE_DETAIL_LAYER_NAMES } from "../src/fineDetailFade";

describe("historic park bridge presentation refinements", () => {
  test.each([
    ["Adlerbruecke snow accents", createAdlerBridge],
    ["Löwenbrücke snow accents", createLoewenBridge],
  ] as const)("shows %s only in Snowstorm", (name, createBridge) => {
    const bridge = createBridge(groundPayload as never);
    const snow = bridge.getObjectByName(name) as Group;
    expect(snow).toBeInstanceOf(Group);
    expect(snow.userData.visualModeOnly).toBe("snowstorm");
    expect(snow.visible).toBeFalse();
    expect(snow.children).toHaveLength(1);
    expect(snow.children[0]).toBeInstanceOf(Mesh);
    expect((snow.children[0] as Mesh).material).toBeInstanceOf(
      MeshBasicMaterial,
    );

    setIsoNightPresentation(bridge, false, true, "snowstorm");
    expect(snow.visible).toBeTrue();
    for (const mode of [
      "day",
      "night",
      "minecraft",
      "schwellenraum",
    ] as const) {
      setIsoNightPresentation(bridge, mode === "night", true, mode);
      expect(snow.visible).toBeFalse();
    }
    expect(FINE_DETAIL_LAYER_NAMES).toContain(name);
  });
});
