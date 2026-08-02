import { describe, expect, test } from "bun:test";
import { Box3, InstancedMesh, Matrix4, Vector3 } from "three";

import {
  createMemorialLandmarks,
  jehovahDiscRadius,
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

  test("the NS memorials carry their own detail", () => {
    const root = createMemorialLandmarks(landmarks);
    for (const name of [
      "Sinti and Roma memorial camp name stones",
      "Sinti and Roma memorial glass chronicle wall",
      "Memorial to persecuted homosexuals window reveal",
    ]) {
      expect(root.getObjectByName(name)).not.toBeNull();
    }
    // Eisenman's floor rolls; a field whose stelae all sit on one cone has
    // rows of identical feet, which is exactly what the place is not.
    const stelae = root.getObjectByName(
      "Holocaust Memorial 2710 instanced stelae",
    ) as InstancedMesh;
    // A pure funnel gives every stele at the same radius the same foot, so
    // measuring the spread within one narrow ring is the real test.
    const matrix = new Matrix4();
    const scale = new Vector3();
    const ring: number[] = [];
    for (let index = 0; index < stelae.count; index += 1) {
      stelae.getMatrixAt(index, matrix);
      const x = matrix.elements[12];
      const z = matrix.elements[14];
      if (Math.abs(Math.hypot(x / 63.7, z / 73.9) - 0.55) > 0.02) {
        continue;
      }
      scale.setFromMatrixScale(matrix);
      ring.push(matrix.elements[13] - scale.y / 2);
    }
    expect(ring.length).toBeGreaterThan(20);
    expect(Math.max(...ring) - Math.min(...ring)).toBeGreaterThan(0.6);
  });

  test("the composers and Goethe are built, not blocked out", () => {
    const root = createMemorialLandmarks(landmarks);
    for (const name of [
      "Composer memorial step ring",
      "Composer memorial three bust niches",
      "Composer memorial corner piers",
      "Goethe memorial lower step",
      "Goethe memorial pedestal cornice",
      "Goethe memorial allegorical figure pedestals",
    ]) {
      expect(root.getObjectByName(name)).not.toBeNull();
    }
    // The busts belong on the three faces of the stele, which a three-sided
    // cylinder puts at half its circumradius — not floating at the corners.
    const niches = root.getObjectByName("Composer memorial three bust niches");
    expect((niches as InstancedMesh).count).toBe(3);
    const goethe = root.getObjectByName("Goethe-Denkmal")!;
    const goetheHeight = new Box3().setFromObject(goethe).getSize(new Vector3()).y;
    expect(goetheHeight).toBeGreaterThan(8);
    expect(goetheHeight).toBeLessThan(10.5);
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

  test("the Polish memorial is the 2025 Findling, not an unbuilt building", () => {
    const root = createMemorialLandmarks(landmarks);
    const site = root.getObjectByName("Gedenkort für Polen 1939-1945")!;
    // Unveiled 16 June 2025: an erratic with a weathering steel plaque, two
    // trilingual panels and one wild apple tree on an oval gravel plaza.
    for (const part of [
      "Polish memorial Findling",
      "Polish memorial oval gravel plaza",
      "Polish memorial weathering steel plaque",
      "Polish memorial trilingual information panels",
      "Polish memorial wild apple tree crown",
    ]) {
      expect(root.getObjectByName(part)).not.toBeNull();
    }
    const boulder = root.getObjectByName("Polish memorial Findling")!;
    const boulderHeight = new Box3()
      .setFromObject(boulder)
      .getSize(new Vector3()).y;
    expect(boulderHeight).toBeGreaterThan(1.2);
    expect(boulderHeight).toBeLessThan(2.4);
    // The tree is the only thing on the site that rises above head height.
    const height = new Box3().setFromObject(site).getSize(new Vector3()).y;
    expect(height).toBeLessThan(6);
    expect(site.userData.geometryStatus).toContain("not built");
    expect(site.userData.geometryStatus).toContain("photo-derived");
  });

  test("the Zeugen-Jehovas stele is a five-metre stack that pinches at the waist", () => {
    // Matthias Leeck's trunk stele: a base plate plus fifteen discs, flaring at
    // foot and crown and narrowest in between.
    expect(jehovahDiscRadius(0.5)).toBeLessThan(jehovahDiscRadius(0.02));
    expect(jehovahDiscRadius(0.5)).toBeLessThan(jehovahDiscRadius(0.98));
    expect(jehovahDiscRadius(0.98)).toBeGreaterThan(jehovahDiscRadius(0.02));
    const root = createMemorialLandmarks(landmarks);
    const site = root.getObjectByName("Mahnmal für verfolgte Zeugen Jehovas")!;
    expect(root.getObjectByName("Jehovahs Witnesses memorial base plate")).not
      .toBeNull();
    const discs = root.getObjectByName(
      "Jehovahs Witnesses memorial stacked bronze discs",
    ) as InstancedMesh;
    expect(discs.count).toBe(15);
    const height = new Box3().setFromObject(site).getSize(new Vector3()).y;
    expect(height).toBeGreaterThan(4.6);
    expect(height).toBeLessThan(5.4);
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
