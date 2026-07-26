import { describe, expect, test } from "bun:test";
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
} from "three";

import { markAuthoredFlatUnlit } from "../src/ThreeViewer";

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
});
