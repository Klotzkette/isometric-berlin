import { describe, expect, test } from "bun:test";
import { Box3, InstancedMesh, Vector3 } from "three";
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
    const embassy = root.getObjectByName(
      "Metric Swiss Embassy recognition model",
    );
    expect(embassy).toBeDefined();
    expect(embassy!.userData.footprintWidthM).toBe(50.927);
    expect(embassy!.userData.footprintDepthM).toBe(22.804);
    expect(embassy!.position.x).toBeCloseTo(-5.21648, 5);
    const size = new Box3().setFromObject(embassy!).getSize(new Vector3());
    expect(size.x).toBeGreaterThan(49);
    expect(size.x).toBeLessThan(56);
    expect(
      embassy!.getObjectByName(
        "Swiss Embassy Diener and Diener modern extension",
      ),
    ).toBeDefined();
    expect(
      embassy!.getObjectByName("Swiss Embassy historic hipped roof"),
    ).toBeUndefined();
    expect(
      embassy!.getObjectByName("Swiss Embassy historic flat roof slab"),
    ).toBeDefined();
    const balusters = embassy!.getObjectByName(
      "Swiss Embassy instanced historic roof balusters",
    );
    expect(balusters).toBeInstanceOf(InstancedMesh);
    expect((balusters as InstancedMesh).count).toBe(104);
    const pilasters = embassy!.getObjectByName(
      "Swiss Embassy instanced historic facade pilasters",
    );
    expect(pilasters).toBeInstanceOf(InstancedMesh);
    expect((pilasters as InstancedMesh).count).toBe(10);
    const streetFrontColumns = embassy!.getObjectByName(
      "Swiss Embassy instanced street-front engaged columns",
    );
    expect(streetFrontColumns).toBeInstanceOf(InstancedMesh);
    expect((streetFrontColumns as InstancedMesh).count).toBe(8);
    const extensionSlots = embassy!.getObjectByName(
      "Swiss Embassy instanced modern end-wall slot windows",
    );
    expect(extensionSlots).toBeInstanceOf(InstancedMesh);
    expect((extensionSlots as InstancedMesh).count).toBe(12);
    const streetFront = embassy!.getObjectByName(
      "Swiss Embassy historic street-front fine detail",
    );
    expect(streetFront).toBeDefined();
    expect(
      embassy!.getObjectByName("Swiss Embassy historic roof fine detail"),
    ).toBeDefined();
    const streetFrontWindows = embassy!.getObjectByName(
      "Swiss Embassy instanced three-storey street-front windows",
    );
    expect(streetFrontWindows).toBeInstanceOf(InstancedMesh);
    expect((streetFrontWindows as InstancedMesh).count).toBe(26);
    expect(
      embassy!.getObjectByName(
        "Swiss Embassy historic timber entrance left leaf",
      ),
    ).toBeDefined();
    expect(
      embassy!.getObjectByName(
        "Swiss Embassy historic entrance portico columns",
      ),
    ).toBeUndefined();
    const dentils = embassy!.getObjectByName(
      "Swiss Embassy instanced historic cornice dentils",
    );
    expect(dentils).toBeInstanceOf(InstancedMesh);
    expect((dentils as InstancedMesh).count).toBe(34);
    expect(embassy!.userData.historicFacadeBayCount).toBe(9);
    expect(embassy!.userData.historicStreetFacadeWindowCount).toBe(26);
    expect(embassy!.userData.swissFlagWidthM).toBe(2.2);
    expect(embassy!.userData.visualReferenceStatus).toContain(
      "not survey observations",
    );
    const flagpole = embassy!.getObjectByName("Swiss Embassy flagpole");
    expect(flagpole).toBeDefined();
    const flagpoleBounds = new Box3().setFromObject(flagpole!);
    const embassyGroundY = embassy!.position.y;
    expect(flagpoleBounds.min.y - embassyGroundY).toBeGreaterThan(20);
    expect(flagpoleBounds.max.y - embassyGroundY).toBeGreaterThan(28);
    const flag = embassy!.getObjectByName(
      "Swiss Embassy animated red flag field",
    );
    expect(flag).toBeDefined();
    expect(
      new Box3().setFromObject(flag!).min.y - embassyGroundY,
    ).toBeGreaterThan(24);
    expect(
      embassy!.getObjectByName(
        "Swiss Embassy animated white flag cross horizontal front",
      ),
    ).toBeDefined();
    expect(
      embassy!.getObjectByName(
        "Swiss Embassy animated white flag cross horizontal back",
      ),
    ).toBeDefined();
    expect(windFlagMatrixCount(embassy!)).toBe(5);
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
