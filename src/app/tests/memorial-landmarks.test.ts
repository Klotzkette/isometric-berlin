import { describe, expect, test } from "bun:test";
import {
  Box3,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Vector3,
} from "three";

import {
  createKrolloperSculptureEnsemble,
  createMemorialLandmarks,
  jehovahDiscRadius,
  memorialFocusDistance,
  SINTI_ROMA_MEMORIAL,
  KROLLOPER_SCULPTURE_PROFILE,
  SOVIET_WAR_MEMORIAL_PROFILE,
  type MemorialLandmark,
} from "../src/MemorialLandmarks";
import { TIERGARTEN_LITERARY_MEMORIALS_PROFILE } from "../src/TiergartenLiteraryMemorials";

const names = [
  "Denkmal für die ermordeten Juden Europas",
  "Denkmal für die im Nationalsozialismus ermordeten Sinti und Roma Europas",
  "Denkmal für die im Nationalsozialismus verfolgten Homosexuellen",
  "Sowjetisches Ehrenmal Tiergarten",
  "Goethe-Denkmal",
  "Lessing-Denkmal",
  "Beethoven-Haydn-Mozart-Denkmal",
  "Mahnmal für verfolgte Zeugen Jehovas",
  "Gedenkort für Polen 1939-1945",
  "Denkzeichen Georg Elser",
];

const landmarks: MemorialLandmark[] = names.map((name, index) => ({
  name,
  world: [index * 200, 8, 0],
}));

describe("granular memorial recognition models", () => {
  test("places all four Krolloper anti-war sculptures at their OSM nodes", () => {
    const ensemble = createKrolloperSculptureEnsemble();
    expect(ensemble.children).toHaveLength(4);
    expect(ensemble.userData.modelCount).toBe(4);
    for (const work of KROLLOPER_SCULPTURE_PROFILE.works) {
      const model = ensemble.getObjectByName(`Krolloper sculpture ${work.name}`);
      expect(model).not.toBeNull();
      expect(model!.position.x).toBeCloseTo(work.worldM[0], 3);
      expect(model!.position.z).toBeCloseTo(work.worldM[1], 3);
      expect(model!.position.y).toBe(KROLLOPER_SCULPTURE_PROFILE.groundY);
    }
    expect(
      ensemble.getObjectByName("Himmelschlüssel crown aperture"),
    ).not.toBeNull();
    expect(
      ensemble.getObjectByName("Todes Mauer Bruch split weathered steel plates"),
    ).toBeInstanceOf(InstancedMesh);
  });

  test("creates all ten documented monument models", () => {
    const root = createMemorialLandmarks(landmarks);
    expect(root.children).toHaveLength(10);
    expect(root.userData.modelCount).toBe(10);
    names.forEach((name) => expect(root.getObjectByName(name)).not.toBeNull());
    const ink: LineSegments[] = [];
    root.traverse((object) => {
      if (object instanceof LineSegments) ink.push(object);
    });
    expect(ink.length).toBeGreaterThan(20);
    expect(
      ink.every(
        (line) =>
          (line.material as LineBasicMaterial).userData.modeInk === true,
      ),
    ).toBeTrue();
  });

  test("attaches only requested literary models at their exact source anchors", () => {
    const goetheOnly = createMemorialLandmarks([
      { name: "Goethe-Denkmal", world: [9_999, 99, 9_999] },
    ]);
    expect(goetheOnly.children).toHaveLength(1);
    expect(goetheOnly.getObjectByName("Lessing-Denkmal")).toBeUndefined();
    const goethe = goetheOnly.getObjectByName("Goethe-Denkmal")!;
    expect(goethe.position.toArray()).toEqual([
      ...TIERGARTEN_LITERARY_MEMORIALS_PROFILE.goethe.worldM,
    ]);
    expect(goethe.userData).toMatchObject({
      exactOwnOsmKey: TIERGARTEN_LITERARY_MEMORIALS_PROFILE.goethe.osmKey,
      sourceOwned: true,
      tiergartenLiteraryMemorialSmooth: true,
    });

    const lessingOnly = createMemorialLandmarks([
      { name: "Lessing-Denkmal", world: [-9_999, 99, -9_999] },
    ]);
    expect(lessingOnly.children).toHaveLength(1);
    expect(lessingOnly.getObjectByName("Goethe-Denkmal")).toBeUndefined();
    expect(lessingOnly.getObjectByName("Lessing-Denkmal")?.position.toArray())
      .toEqual([...TIERGARTEN_LITERARY_MEMORIALS_PROFILE.lessing.worldM]);
  });

  test("grounds every model on the sampled official mesh instead of the camera anchor", () => {
    const root = createMemorialLandmarks(landmarks);
    names
      .filter((name) => name !== "Denkzeichen Georg Elser")
      .forEach((name) => {
        const model = root.getObjectByName(name);
        expect(model?.position.y).toBeGreaterThan(3.5);
        expect(model?.position.y).toBeLessThan(5);
        expect(model?.position.y).not.toBe(8);
      });
  });

  test("renders the documented 2711 Holocaust stelae in one draw call", () => {
    const root = createMemorialLandmarks(landmarks);
    const stelae = root.getObjectByName(
      "Holocaust Memorial 2711 instanced stelae",
    );
    expect(stelae).toBeInstanceOf(InstancedMesh);
    expect((stelae as InstancedMesh).count).toBe(2_711);
    // The height bands were a property of the old hand-banded lattice.
    // The field is now generated from the documented figures in
    // holocaustField.ts, whose own tests pin the count, the 0.95 m alleys
    // in both directions and the 0.2-4.7 m height range.
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
      "Sinti and Roma memorial 69 camp name stones",
      "Sinti and Roma memorial glass chronicle wall",
      "Memorial to persecuted homosexuals window reveal",
    ]) {
      expect(root.getObjectByName(name)).not.toBeNull();
    }
    // Eisenman's floor rolls; a field whose stelae all sit on one cone has
    // rows of identical feet, which is exactly what the place is not.
    const stelae = root.getObjectByName(
      "Holocaust Memorial 2711 instanced stelae",
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

  test("rebuilds Karavan's Sinti and Roma memorial from documented elements", () => {
    const root = createMemorialLandmarks(landmarks);
    const memorial = root.getObjectByName(names[1])!;
    expect(memorial.userData.evidence).toEqual({
      overallExtentM: 60,
      placeStoneCount: 69,
      poolDiameterM: 12,
    });
    expect(SINTI_ROMA_MEMORIAL.poolDiameterM).toBe(12);

    const water = root.getObjectByName(
      "Sinti and Roma memorial black reflecting water",
    )!;
    const waterSize = new Box3().setFromObject(water).getSize(new Vector3());
    expect(waterSize.x).toBeCloseTo(12, 2);
    expect(waterSize.z).toBeCloseTo(12, 2);

    const stones = root.getObjectByName(
      "Sinti and Roma memorial 69 camp name stones",
    ) as InstancedMesh;
    expect(stones.count).toBe(69);
    const stoneMatrix = new Matrix4();
    for (let index = 0; index < stones.count; index += 1) {
      stones.getMatrixAt(index, stoneMatrix);
      expect(
        Math.hypot(stoneMatrix.elements[12], stoneMatrix.elements[14]),
      ).toBeGreaterThan(6.2);
    }

    expect(
      (
        root.getObjectByName(
          "Sinti and Roma memorial daily flower petals",
        ) as InstancedMesh
      ).count,
    ).toBe(12);
    expect(
      (
        root.getObjectByName(
          "Sinti and Roma memorial German and English poem engraving",
        ) as InstancedMesh
      ).count,
    ).toBe(84);
    expect(
      (
        root.getObjectByName(
          "Sinti and Roma memorial nine biography portraits",
        ) as InstancedMesh
      ).count,
    ).toBe(9);
    expect(
      (
        root.getObjectByName(
          "Sinti and Roma memorial three exhibition benches",
        ) as InstancedMesh
      ).count,
    ).toBe(3);
  });

  test("the composers and both literary memorials are built, not blocked out", () => {
    const root = createMemorialLandmarks(landmarks);
    for (const name of [
      "Composer memorial step ring",
      "Composer memorial three bust niches",
      "Composer memorial corner piers",
      "Goethe memorial structural silhouette",
      "Goethe memorial fine allegory and fence cues",
      "Lessing memorial structural silhouette",
      "Lessing memorial relief allegory and fence cues",
    ]) {
      expect(root.getObjectByName(name)).not.toBeNull();
    }
    // The busts belong on the three faces of the stele, which a three-sided
    // cylinder puts at half its circumradius — not floating at the corners.
    const niches = root.getObjectByName("Composer memorial three bust niches");
    expect((niches as InstancedMesh).count).toBe(3);
    const goethe = root.getObjectByName("Goethe-Denkmal")!;
    const goetheHeight = new Box3().setFromObject(goethe).getSize(new Vector3()).y;
    expect(goetheHeight).toBeGreaterThan(6);
    expect(goetheHeight).toBeLessThan(6.3);
    const lessing = root.getObjectByName("Lessing-Denkmal")!;
    const lessingHeight = new Box3()
      .setFromObject(lessing)
      .getSize(new Vector3()).y;
    expect(lessingHeight).toBeGreaterThan(7);
    expect(lessingHeight).toBeLessThan(7.2);
  });

  test("the literary memorials and composers carry ink-line edges", () => {
    const root = createMemorialLandmarks(landmarks);
    for (const layerName of [
      "Goethe memorial structural silhouette ink lines",
      "Lessing memorial structural silhouette ink lines",
    ]) {
      expect(root.getObjectByName(layerName)).not.toBeNull();
    }
    for (const meshName of [
      "Composer memorial step ring",
      "Composer memorial three-sided coloured stele",
      "Composer memorial gilded cupola",
    ]) {
      expect(root.getObjectByName(`${meshName} model edges`)).not.toBeNull();
    }
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

  test("reconstructs the documented Soviet memorial architecture", () => {
    const root = createMemorialLandmarks(landmarks);
    const soviet = root.getObjectByName("Sowjetisches Ehrenmal Tiergarten")!;

    expect(soviet.userData.profile).toBe(SOVIET_WAR_MEMORIAL_PROFILE);
    expect(SOVIET_WAR_MEMORIAL_PROFILE.dedicationLines.join(" ")).toBe(
      "ВЕЧНАЯ СЛАВА ГЕРОЯМ ПАВШИМ В БОЯХ С НЕМЕЦКО- ФАШИСТСКИМИ ЗАХВАТЧИКАМИ ЗА СВОБОДУ И НЕЗАВИСИМОСТЬ СОВЕТСКОГО СОЮЗА",
    );
    expect(
      soviet.children.filter(
        (child) => child.name === "Soviet memorial six side pylons",
      ),
    ).toHaveLength(SOVIET_WAR_MEMORIAL_PROFILE.sidePylonCount);
    expect(
      soviet.children.filter(
        (child) => child.name === "Soviet memorial colonnade cornice",
      ),
    ).toHaveLength(6);
    expect(
      soviet.children.filter((child) =>
        child.name.endsWith("officers sarcophagus"),
      ),
    ).toHaveLength(SOVIET_WAR_MEMORIAL_PROFILE.sarcophagusCount);
    expect(
      soviet.children.filter((child) => child.name.endsWith("fountain jets")),
    ).toHaveLength(SOVIET_WAR_MEMORIAL_PROFILE.fountainCount);
    expect(
      soviet.children.filter((child) =>
        child.name.startsWith("Soviet memorial gilded dedication line"),
      ),
    ).toHaveLength(SOVIET_WAR_MEMORIAL_PROFILE.dedicationLines.length);

    const forecourt = root.getObjectByName(
      "Soviet memorial broad granite forecourt",
    )!;
    expect(new Box3().setFromObject(forecourt).getSize(new Vector3()).x).toBeCloseTo(
      SOVIET_WAR_MEMORIAL_PROFILE.forecourtWidthM,
      2,
    );
    expect(
      new Box3().setFromObject(soviet).max.y - soviet.position.y,
    ).toBeCloseTo(SOVIET_WAR_MEMORIAL_PROFILE.totalHeightM, 0);
  });

  test("gives both restored T-34s their documented display numbers", () => {
    const root = createMemorialLandmarks(landmarks);
    for (const [side, number] of [
      ["west", "300"],
      ["east", "200"],
    ] as const) {
      for (const face of ["left", "right"]) {
        const panel = root.getObjectByName(
          `Soviet memorial T-34 ${side} turret number ${number} ${face}`,
        );
        expect(panel).not.toBeNull();
        expect(panel?.userData.lettering).toBe(number);
      }
      expect(
        (
          root.getObjectByName(
            `Soviet memorial T-34 ${side} forty-eight individual track shoes`,
          ) as InstancedMesh
        ).count,
      ).toBe(48);
    }
  });

  test("each T-34 carries its running gear and stays clear of the colonnade", () => {
    // v0.58.0: the tanks sat directly under the colonnade beams (x in
    // [21.9, 28.1] for the plinth vs [4.8, 29.2] for the cornice), so the
    // hulls were always occluded from the presentation camera. Every
    // vehicle must clear the colonnade footprint on the X axis.
    const root = createMemorialLandmarks(landmarks);
    for (const side of ["west", "east"]) {
      const wheels = root.getObjectByName(
        `Soviet memorial T-34 ${side} ten T-34 road wheels`,
      );
      expect(wheels).toBeInstanceOf(InstancedMesh);
      expect((wheels as InstancedMesh).count).toBeGreaterThanOrEqual(10);
      expect(
        root.getObjectByName(`Soviet memorial T-34 ${side} turret`),
      ).not.toBeNull();
      expect(
        root.getObjectByName(`Soviet memorial T-34 ${side} 76 mm barrel`),
      ).not.toBeNull();
      expect(
        root.getObjectByName(`Soviet memorial T-34 ${side} left track`),
      ).not.toBeNull();
      expect(
        root.getObjectByName(`Soviet memorial T-34 ${side} right track`),
      ).not.toBeNull();
    }
    const soviet = root.getObjectByName("Sowjetisches Ehrenmal Tiergarten")!;
    const cornice = soviet.children.find(
      (child) => child.name === "Soviet memorial colonnade cornice",
    )!;
    const corniceBox = new Box3().setFromObject(cornice);
    for (const side of ["west", "east"]) {
      const hull = root.getObjectByName(`Soviet memorial T-34 ${side} hull`)!;
      const hullBox = new Box3().setFromObject(hull);
      const clearsOnLeft = hullBox.max.x < corniceBox.min.x;
      const clearsOnRight = hullBox.min.x > corniceBox.max.x;
      expect(clearsOnLeft || clearsOnRight).toBeTrue();
    }
  });

  test("places both T-34s left and right of the street-facing entrance", () => {
    // Berlin's official site places the two tanks at the main entrance on
    // Strasse des 17. Juni, with the guns diagonally behind at the first stair.
    // In project-world coordinates south/street is +z and east is +x.
    const root = createMemorialLandmarks(landmarks);
    const soviet = root.getObjectByName("Sowjetisches Ehrenmal Tiergarten")!;
    const westTank = root.getObjectByName("Soviet memorial T-34 west hull")!;
    const eastTank = root.getObjectByName("Soviet memorial T-34 east hull")!;
    const westGun = root.getObjectByName(
      "Soviet memorial ML-20 howitzer west cradle",
    )!;
    const eastGun = root.getObjectByName(
      "Soviet memorial ML-20 howitzer east cradle",
    )!;
    const westTankWorld = westTank.getWorldPosition(new Vector3());
    const eastTankWorld = eastTank.getWorldPosition(new Vector3());
    const westGunWorld = westGun.getWorldPosition(new Vector3());
    const eastGunWorld = eastGun.getWorldPosition(new Vector3());

    expect(soviet.userData.streetFrontWorldAxis).toBe("+z");
    expect(westTankWorld.x).toBeLessThan(soviet.position.x);
    expect(eastTankWorld.x).toBeGreaterThan(soviet.position.x);
    expect(westTankWorld.z).toBeGreaterThan(soviet.position.z);
    expect(eastTankWorld.z).toBeGreaterThan(soviet.position.z);
    expect(westTankWorld.z).toBeGreaterThan(westGunWorld.z);
    expect(eastTankWorld.z).toBeGreaterThan(eastGunWorld.z);
    expect(Math.abs(westTankWorld.x - soviet.position.x)).toBeGreaterThan(
      Math.abs(westGunWorld.x - soviet.position.x),
    );
    expect(Math.abs(eastTankWorld.x - soviet.position.x)).toBeGreaterThan(
      Math.abs(eastGunWorld.x - soviet.position.x),
    );
    expect(root.getObjectByName("Soviet memorial T-34 west vehicle")!.rotation.y)
      .toBeCloseTo(Math.PI / 2);
    expect(root.getObjectByName("Soviet memorial T-34 east vehicle")!.rotation.y)
      .toBeCloseTo(-Math.PI / 2);
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
    expect(memorialFocusDistance("Goethe-Denkmal")).toBe(38);
    expect(memorialFocusDistance("Lessing-Denkmal")).toBe(36);
    expect(
      memorialFocusDistance("Denkmal für die ermordeten Juden Europas"),
    ).toBeGreaterThan(140);
    expect(memorialFocusDistance("Brandenburger Tor")).toBeNull();
  });
});
