import { describe, expect, test } from "bun:test";
import {
  Box3,
  InstancedMesh,
  Mesh,
  MeshPhysicalMaterial,
  PointLight,
} from "three";
import {
  type ArchitecturalSignature,
  createOfficialReichstagDome,
  domeRadius,
} from "../src/ReichstagDome";

const signature: ArchitecturalSignature = {
  anchor_world: [12, 36.4, -8],
  diameter_m: 40,
  geometry_status: "official-dimension test",
  height_m: 23.5,
  horizontal_rings: 17,
  id: "reichstag-dome",
  landmark_name: "Reichstagsgebäude",
  source_url: "https://www.bundestag.de/besuche/architektur/reichstag/kuppel",
  vertical_ribs: 24,
};

describe("official-dimension Reichstag dome", () => {
  test("uses the published diameter and keeps an open crown", () => {
    expect(domeRadius(0, signature.diameter_m)).toBe(20);
    expect(domeRadius(0.5, signature.diameter_m)).toBeLessThan(20);
    expect(domeRadius(1, signature.diameter_m)).toBeCloseTo(2.4, 5);
  });

  test("builds every published rib and horizontal ring", () => {
    const dome = createOfficialReichstagDome(signature);
    expect(dome.children.length).toBeGreaterThan(50);
    expect(
      dome.children.filter((child) => child.name.startsWith("main steel rib")),
    ).toHaveLength(24);
    expect(
      dome.children.filter((child) =>
        child.name.startsWith("horizontal steel ring"),
      ),
    ).toHaveLength(17);
    expect(dome.userData.heightM).toBe(23.5);
    expect(dome.userData.diameterM).toBe(40);
    const glass = dome.children.find(
      (child) => child instanceof Mesh && child.userData.glazingSectors === 24,
    );
    expect(glass).toBeDefined();
    if (glass instanceof Mesh) {
      glass.geometry.computeBoundingBox();
      expect(glass.geometry.boundingBox?.min.y).toBeCloseTo(
        (4 / 17) * signature.height_m,
        5,
      );
      expect(glass.userData.glazedRows).toBe(13);
      expect(glass.userData.glazingSectors).toBe(24);
      expect(glass.userData.structuralRows).toBe(17);
      expect(glass.userData.unglazedLowerRows).toBe(4);
      expect(glass.material).toBeInstanceOf(MeshPhysicalMaterial);
      if (glass.material instanceof MeshPhysicalMaterial) {
        expect(glass.material.opacity).toBeLessThanOrEqual(0.13);
        expect(glass.material.transmission).toBeGreaterThanOrEqual(0.78);
        expect(glass.material.depthWrite).toBeFalse();
      }
    }
    expect(
      dome.getObjectByName("dome alternating diagonal glazing braces"),
    ).toBeDefined();
    const nightGlow = dome.getObjectByName(
      "Reichstag dome 13-row interior night glow",
    );
    expect(nightGlow).toBeDefined();
    expect(nightGlow?.userData.nightOnly).toBeTrue();
    expect(nightGlow?.visible).toBeFalse();
    expect(
      dome.getObjectByName("dome crown compression and open oculus ring"),
    ).toBeDefined();
    expect(
      dome.getObjectByName("daylight mirror cone 24-sector facet grid"),
    ).toBeDefined();
    const mirrorPanels = dome.getObjectByName(
      "daylight mirror cone 360 individual panels",
    );
    expect(mirrorPanels).toBeInstanceOf(InstancedMesh);
    expect((mirrorPanels as InstancedMesh).count).toBe(360);
    expect(
      (mirrorPanels as InstancedMesh).material.userData
        .nightEmissiveIntensity,
    ).toBeGreaterThan(2);
    expect(
      dome.children.filter((child) => child.name.endsWith("visitor ramp deck")),
    ).toHaveLength(2);
    expect(
      dome.children.filter((child) => child.name.endsWith("handrail")),
    ).toHaveLength(4);
    const interiorLights = dome.children.filter(
      (child) => child instanceof PointLight && child.userData.nightOnly,
    );
    expect(interiorLights).toHaveLength(2);
    expect(interiorLights.every((light) => !light.visible)).toBeTrue();
    expect(
      dome.children.filter((child) =>
        child.name.endsWith("batched guardrail balusters"),
      ),
    ).toHaveLength(2);
  });

  test("anchors the complete structure at metre-scale scene coordinates", () => {
    const dome = createOfficialReichstagDome(signature);
    const bounds = new Box3().setFromObject(dome);
    expect(dome.position.toArray()).toEqual(signature.anchor_world);
    expect(bounds.max.x - bounds.min.x).toBeGreaterThanOrEqual(40);
    expect(bounds.max.x - bounds.min.x).toBeLessThan(41);
    expect(bounds.max.y - bounds.min.y).toBeGreaterThan(23);
    expect(bounds.max.y - bounds.min.y).toBeLessThan(25);
  });
});
