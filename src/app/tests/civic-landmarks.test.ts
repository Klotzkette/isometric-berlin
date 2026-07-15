import { describe, expect, test } from "bun:test";
import { Box3, Vector3 } from "three";
import { createCivicLandmarks } from "../src/CivicLandmarks";
import { windFlagMatrixCount } from "../src/WindFlags";

const landmarks = [
  {
    name: "Schweizerische Botschaft",
    world: [-5.654743, 8, -246.494572] as [number, number, number],
  },
  {
    name: "TIPI am Kanzleramt",
    world: [-297.284279, 8, 52.50208] as [number, number, number],
  },
  {
    name: "Fahne der Einheit",
    world: [226.039773, 8, 57.925456] as [number, number, number],
  },
];

describe("metric civic landmark details", () => {
  test("anchors the Swiss Embassy to its LoD2 envelope and adds its flag", () => {
    const root = createCivicLandmarks(landmarks);
    const embassy = root.getObjectByName("Metric Swiss Embassy recognition model");
    expect(embassy).toBeDefined();
    expect(embassy!.userData.footprintWidthM).toBe(50.927);
    expect(embassy!.userData.footprintDepthM).toBe(22.804);
    expect(embassy!.position.x).toBeCloseTo(-5.21648, 5);
    const size = new Box3().setFromObject(embassy!).getSize(new Vector3());
    expect(size.x).toBeGreaterThan(49);
    expect(size.x).toBeLessThan(56);
    expect(
      embassy!.getObjectByName("Swiss Embassy Diener and Diener modern extension"),
    ).toBeDefined();
    expect(embassy!.getObjectByName("Swiss Embassy flagpole")).toBeDefined();
    expect(windFlagMatrixCount(embassy!)).toBe(3);
  });

  test("renders the Bundestag's 28.5 m pole and 60 square metre flag", () => {
    const root = createCivicLandmarks(landmarks);
    const flag = root.getObjectByName("Official-dimension Flag of Unity model");
    expect(flag).toBeDefined();
    expect(flag!.userData.poleHeightM).toBe(28.5);
    expect(flag!.userData.flagAreaSquareM).toBe(60);
    expect(
      flag!.children.filter((child) =>
        child.name.startsWith("Flag of Unity animated German stripe"),
      ),
    ).toHaveLength(3);
    expect(windFlagMatrixCount(flag!)).toBe(3);
  });

});
