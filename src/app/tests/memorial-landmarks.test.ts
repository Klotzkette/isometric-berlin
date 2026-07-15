import { describe, expect, test } from "bun:test";
import { Box3, InstancedMesh, Vector3 } from "three";

import {
  createMemorialLandmarks,
  memorialFocusDistance,
  type MemorialLandmark,
} from "../src/MemorialLandmarks";

const names = [
  "Denkmal für die ermordeten Juden Europas",
  "Denkmal für die im Nationalsozialismus ermordeten Sinti und Roma Europas",
  "Denkmal für die im Nationalsozialismus verfolgten Homosexuellen",
  "Sowjetisches Ehrenmal Tiergarten",
  "Goethe-Denkmal",
  "Beethoven-Haydn-Mozart-Denkmal",
  "Mahnmal für verfolgte Zeugen Jehovas",
];

const landmarks: MemorialLandmark[] = names.map((name, index) => ({
  name,
  world: [index * 200, 8, 0],
}));

describe("granular memorial recognition models", () => {
  test("creates all seven documented monument models", () => {
    const root = createMemorialLandmarks(landmarks);
    expect(root.children).toHaveLength(7);
    expect(root.userData.modelCount).toBe(7);
    names.forEach((name) => expect(root.getObjectByName(name)).not.toBeNull());
  });

  test("grounds every model on the sampled official mesh instead of the camera anchor", () => {
    const root = createMemorialLandmarks(landmarks);
    names.forEach((name) => {
      const model = root.getObjectByName(name);
      expect(model?.position.y).toBeGreaterThan(3.5);
      expect(model?.position.y).toBeLessThan(5);
      expect(model?.position.y).not.toBe(8);
    });
  });

  test("renders the official 2710 Holocaust stelae in one draw call", () => {
    const root = createMemorialLandmarks(landmarks);
    const stelae = root.getObjectByName(
      "Holocaust Memorial 2710 instanced stelae",
    );
    expect(stelae).toBeInstanceOf(InstancedMesh);
    expect((stelae as InstancedMesh).count).toBe(2_710);
    expect(stelae?.userData.heightBands).toEqual({
      edge: 112,
      high: 872,
      low: 811,
      medium: 915,
    });
    expect(stelae?.castShadow).toBeFalse();
  });

  test("keeps the Soviet composition and 10 m composer silhouette legible", () => {
    const root = createMemorialLandmarks(landmarks);
    const westHull = root.getObjectByName("Soviet memorial T-34 west hull");
    expect(westHull).not.toBeNull();
    expect(root.getObjectByName("Soviet memorial T-34 east hull")).not.toBeNull();
    expect(westHull?.userData.vehicleType).toBe("T-34/76");
    const hullSize = new Box3().setFromObject(westHull!).getSize(new Vector3());
    expect(hullSize.z).toBeGreaterThan(hullSize.x);
    const westWheels = root.getObjectByName(
      "Soviet memorial T-34 west ten T-34 road wheels",
    );
    expect(westWheels).toBeInstanceOf(InstancedMesh);
    expect((westWheels as InstancedMesh).count).toBe(10);
    expect(
      root.getObjectByName("Soviet memorial eight metre soldier body"),
    ).not.toBeNull();

    const composer = root.getObjectByName("Beethoven-Haydn-Mozart-Denkmal");
    const bounds = new Box3().setFromObject(composer!);
    expect(bounds.max.y - bounds.min.y).toBeGreaterThan(9);
    expect(bounds.max.y - bounds.min.y).toBeLessThan(11);
  });

  test("uses close presentation distances for small monuments", () => {
    expect(memorialFocusDistance("Goethe-Denkmal")).toBeLessThan(70);
    expect(
      memorialFocusDistance("Denkmal für die ermordeten Juden Europas"),
    ).toBeGreaterThan(140);
    expect(memorialFocusDistance("Brandenburger Tor")).toBeNull();
  });
});
