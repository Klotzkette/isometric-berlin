import { describe, expect, test } from "bun:test";
import { Group } from "three";

import {
  type ArchitecturalSignature,
  createArchitecturalSignature,
} from "../src/ArchitecturalLandmarks";
import { createCivicLandmarks } from "../src/CivicLandmarks";
import type { VoxelPayload } from "../src/MinecraftVoxelWorld";
import { createSpreebogenOffice } from "../src/SpreebogenOffice";
import {
  setWindFlagWinterPresentation,
  windFlagIcicleCount,
  windFlagMatrixCount,
} from "../src/WindFlags";
import groundPayload from "../public/mesh/regierungsviertel/minecraft-voxels.json";
import scenePayload from "../public/mesh/regierungsviertel/scene.json";

const ground = groundPayload as unknown as VoxelPayload;
const scene = scenePayload as unknown as {
  architectural_signatures: ArchitecturalSignature[];
};

function officialFlagRoots(): { civic: Group; signatures: Group } {
  const signatures = new Group();
  signatures.name = "official flag signature inventory";
  for (const signature of scene.architectural_signatures) {
    if (
      signature.kind !== "reichstag_model" &&
      signature.kind !== "chancellery_model"
    ) {
      continue;
    }
    const model = createArchitecturalSignature(signature);
    if (model) signatures.add(model);
  }
  const office = createSpreebogenOffice(ground);
  if (office) signatures.add(office);

  const civic = createCivicLandmarks([
    {
      name: "Schweizerische Botschaft",
      world: [-5.654743, 8, -246.494572],
    },
    { name: "Fahne der Einheit", world: [226.039773, 8, 57.925456] },
  ]);
  return { civic, signatures };
}

describe("complete official civic flag inventory", () => {
  test("ices nine physical flags while retaining all thirty artwork layers", () => {
    const { civic, signatures } = officialFlagRoots();
    expect(windFlagMatrixCount(signatures)).toBe(22);
    expect(windFlagMatrixCount(civic)).toBe(8);

    setWindFlagWinterPresentation(signatures, true);
    setWindFlagWinterPresentation(civic, true);
    expect(windFlagIcicleCount(signatures)).toBe(21);
    expect(windFlagIcicleCount(civic)).toBe(6);

    let icedLayers = 0;
    for (const root of [signatures, civic]) {
      root.traverse((object) => {
        if (object.userData.windFlagIced === true) icedLayers += 1;
      });
      expect(
        root.children.filter(
          (child) => child.userData.windFlagWinterAccents === true,
        ),
      ).toHaveLength(1);
    }
    expect(icedLayers).toBe(30);
  });

  test("round-trips winter visibility without rebuilding duplicate batches", () => {
    const { civic, signatures } = officialFlagRoots();
    for (const root of [signatures, civic]) {
      setWindFlagWinterPresentation(root, true);
      const first = root.children.find(
        (child) => child.userData.windFlagWinterAccents === true,
      );
      expect(first).toBeDefined();
      setWindFlagWinterPresentation(root, false);
      expect(first!.visible).toBeFalse();
      setWindFlagWinterPresentation(root, true);
      expect(first!.visible).toBeTrue();
      expect(
        root.children.filter(
          (child) => child.userData.windFlagWinterAccents === true,
        ),
      ).toHaveLength(1);
    }
  });
});
