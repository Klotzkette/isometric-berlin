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
  "Gedenkort für Polen 1939-1945",
];

const landmarks: MemorialLandmark[] = names.map((name, index) => ({
  name,
  world: [index * 200, 8, 0],
}));

describe("granular memorial recognition models", () => {
  test("creates all eight documented monument models", () => {
    const root = createMemorialLandmarks(landmarks);
    expect(root.children).toHaveLength(8);
    expect(root.userData.modelCount).toBe(8);
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

  test("shows two tanks and two howitzers, each on its own plinth", () => {
    const root = createMemorialLandmarks(landmarks);
    for (const side of ["west", "east"]) {
      const tube = root.getObjectByName(
        `Soviet memorial ML-20 howitzer ${side} 152 mm tube`,
      );
      expect(tube).not.toBeNull();
      const wheels = root.getObjectByName(
        `Soviet memorial ML-20 howitzer ${side} two carriage wheels`,
      );
      expect((wheels as InstancedMesh).count).toBe(2);
    }
    const soviet = root.getObjectByName("Sowjetisches Ehrenmal Tiergarten")!;
    const plinths = soviet.children.filter(
      (child) =>
        child.name === "Soviet memorial T-34 plinth" ||
        child.name === "Soviet memorial howitzer plinth",
    );
    expect(plinths).toHaveLength(4);
    // Every gun barrel and hull must clear its plinth rather than sink in.
    const hull = root.getObjectByName("Soviet memorial T-34 west hull")!;
    const plinth = soviet.children.find(
      (child) => child.name === "Soviet memorial T-34 plinth",
    )!;
    expect(hull.position.y - 1.18 / 2).toBeGreaterThan(plinth.position.y);
  });

  test("the Polish memorial is a stone on a field, not an unbuilt building", () => {
    const root = createMemorialLandmarks(landmarks);
    const site = root.getObjectByName("Gedenkort für Polen 1939-1945")!;
    expect(root.getObjectByName("Polish memorial inscribed stone")).not.toBeNull();
    expect(
      root.getObjectByName("Polish memorial bronze inscription plate"),
    ).not.toBeNull();
    const height = new Box3().setFromObject(site).getSize(new Vector3()).y;
    expect(height).toBeLessThan(2);
    expect(site.userData.geometryStatus).toContain("not built");
  });

  test("the persecuted-homosexuals cuboid actually leans", () => {
    const root = createMemorialLandmarks(landmarks);
    const body = root.getObjectByName(
      "Memorial to persecuted homosexuals tilted body",
    )!;
    expect(Math.abs(body.rotation.z) + Math.abs(body.rotation.x)).toBeGreaterThan(
      0.05,
    );
  });

  test("uses close presentation distances for small monuments", () => {
    expect(memorialFocusDistance("Goethe-Denkmal")).toBeLessThan(70);
    expect(
      memorialFocusDistance("Denkmal für die ermordeten Juden Europas"),
    ).toBeGreaterThan(140);
    expect(memorialFocusDistance("Brandenburger Tor")).toBeNull();
  });
});
