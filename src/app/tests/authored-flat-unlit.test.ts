import { describe, expect, test } from "bun:test";
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
} from "three";

import {
  applyMaterialLighting,
  markAuthoredFlatUnlit,
} from "../src/ThreeViewer";

describe("flat-unlit authored landmark contract", () => {
  test("marks opaque architecture but preserves transparent glass cleanup", () => {
    const root = new Group();
    const stone = new Mesh(
      new BoxGeometry(1, 1, 1),
      new MeshStandardMaterial({ color: 0xe8dfca }),
    );
    const glass = new Mesh(
      new BoxGeometry(1, 1, 1),
      new MeshPhysicalMaterial({
        color: 0xbcdde5,
        opacity: 0.42,
        transparent: true,
      }),
    );
    root.add(stone, glass);

    markAuthoredFlatUnlit(root);

    const stoneMaterial = stone.material as MeshStandardMaterial;
    const glassMaterial = glass.material as MeshPhysicalMaterial;
    expect(stoneMaterial.userData.drawnFacadeApplied).toBe(true);
    expect(stoneMaterial.userData.flatUnlitInstalled).toBe(true);
    expect(stoneMaterial.userData.flatClean).toBe(1);
    expect(glassMaterial.userData.drawnFacadeApplied).toBe(true);
    expect(glassMaterial.userData.flatUnlitInstalled).toBe(true);
    expect(glassMaterial.userData.flatClean).toBe(0);
    expect(glassMaterial.transparent).toBe(true);
    expect(glassMaterial.opacity).toBeCloseTo(0.42);
  });

  test("does not lift deliberately dark authored recesses into ivory", () => {
    const root = new Group();
    const recess = new Mesh(
      new BoxGeometry(1, 1, 1),
      new MeshStandardMaterial({ color: 0x111416 }),
    );
    (recess.material as MeshStandardMaterial).userData.preserveAuthoredDark =
      true;
    root.add(recess);

    markAuthoredFlatUnlit(root);

    const material = recess.material as MeshStandardMaterial;
    expect(material.userData.flatUnlitInstalled).toBe(true);
    expect(material.userData.flatClean).toBe(0);
  });

  test("keeps official drawn facades readable at night without changing day", () => {
    const material = new MeshStandardMaterial({ color: 0xd9d5cb });
    material.userData.drawnFacadeApplied = true;
    material.userData.drawnKind = "vertex";
    material.userData.sourceMaterial = true;

    applyMaterialLighting(material, "night");
    expect(material.emissive.getHex()).toBe(0x7088a7);
    expect(material.emissiveIntensity).toBe(0.34);

    applyMaterialLighting(material, "day");
    expect(material.emissive.getHex()).toBe(0x000000);
    expect(material.emissiveIntensity).toBe(1);
  });
});
