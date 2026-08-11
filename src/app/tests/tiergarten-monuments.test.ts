import { describe, expect, test } from "bun:test";

import {
  Box3,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  Vector3,
} from "three";

import type { VoxelPayload } from "../src/MinecraftVoxelWorld";
import type { StreetDetailsPayload } from "../src/TrafficSignals";
import {
  ARTWORK_BUILDERS,
  GRAEFE_CHARITE_OSM_WORLD,
  GRAEFE_MONUMENT_SOURCE_URL,
  GRAEFE_STATUE_HEIGHT_M,
  MONUMENTS_ALREADY_MODELLED,
  createTiergartenMonuments,
} from "../src/TiergartenMonuments";
import streetDetails from "../public/mesh/regierungsviertel/street-details.json";
import voxelPayload from "../public/mesh/regierungsviertel/minecraft-voxels.json";

const street = streetDetails as unknown as StreetDetailsPayload;
const ground = voxelPayload as unknown as VoxelPayload;

describe("drawn Tiergarten monuments (OSM historic layer)", () => {
  const monuments = createTiergartenMonuments(street, ground)!;

  test("the payload carries the requested monuments by name", () => {
    const names = street.monuments!.map((entry) => entry.name).join("|");
    expect(names).toContain("ermordeten Juden Europas");
    expect(names).toContain("Sowjetisches Ehrenmal");
    expect(names).toContain("Verkehrsturm");
    expect(names).toContain("Lessing");
    // The Soviet memorial's surveyed hardware is present too.
    const kinds = street.monuments!.map((entry) => entry.kind);
    expect(kinds.filter((kind) => kind === "tank").length).toBe(2);
    expect(kinds.filter((kind) => kind === "cannon").length).toBe(2);
  });

  test("Floraplatz has exactly eight differentiated restored animals", () => {
    const animals = street.monuments!.filter(
      (entry) =>
        /^(Hirsch|Bison|Liegender Bison Ⅱ|Elch|Bär|Stier)$/.test(entry.name) &&
        entry.x_dm >= -2_100 &&
        entry.x_dm <= -1_200 &&
        entry.z_dm >= 4_100 &&
        entry.z_dm <= 5_200,
    );
    expect(animals).toHaveLength(8);
    expect(monuments.userData.floraplatzAnimalCount).toBe(8);
    expect(monuments.userData.floraplatzGeometry).toContain("species-specific");
    expect(monuments.userData.sourceUrls).toContain(
      "https://bildhauerei-in-berlin.de/bildwerk/acht-tierfiguren-am-floraplatz/",
    );
  });

  test("landmarks the recognition layer already models are skipped here", () => {
    expect(MONUMENTS_ALREADY_MODELLED.test("Denkmal für die ermordeten Juden Europas")).toBe(true);
    expect(MONUMENTS_ALREADY_MODELLED.test("Sowjetisches Ehrenmal Tiergarten")).toBe(true);
    expect(MONUMENTS_ALREADY_MODELLED.test("Verkehrsturm")).toBe(false);
    expect(MONUMENTS_ALREADY_MODELLED.test("Gotthold Ephraim Lessing")).toBe(false);
    // No drawn-monument geometry near the Soviet memorial's colonnade
    // (its recognition model owns that ground; only the two howitzers
    // between the tanks are ours).
    const bodies = monuments.getObjectByName("monument bodies") as Mesh;
    const position = bodies.geometry.getAttribute("position");
    const vertex = new Vector3();
    let tallAtEhrenmal = 0;
    for (let index = 0; index < position.count; index += 1) {
      vertex.fromBufferAttribute(position, index);
      if (
        Math.abs(vertex.x - 27.4) < 30 &&
        Math.abs(vertex.z - 258.1) < 30 &&
        vertex.y > 8
      ) {
        tallAtEhrenmal += 1;
      }
    }
    expect(tallAtEhrenmal).toBe(0);
  });

  test("monuments merge into one drawn mesh with ink lines", () => {
    expect(monuments).toBeInstanceOf(Group);
    const bodies = monuments.getObjectByName("monument bodies");
    const ink = monuments.getObjectByName("monument ink lines");
    expect(bodies).toBeInstanceOf(Mesh);
    expect(ink).toBeInstanceOf(LineSegments);
    expect((bodies as Mesh).geometry.getAttribute("color")).toBeDefined();
    expect((ink as LineSegments).material).toBeInstanceOf(LineBasicMaterial);
    expect(
      ((ink as LineSegments).material as LineBasicMaterial).userData.modeInk,
    ).toBeTrue();
    expect(
      ((ink as LineSegments).material as LineBasicMaterial).userData
        .architecturalInkRole,
    ).toBe("detail");
  });

  test("the Verkehrsturm rises at the surveyed Potsdamer Platz corner", () => {
    const entry = street.monuments!.find((candidate) =>
      candidate.name.includes("Verkehrsturm"),
    )!;
    const bodies = monuments.getObjectByName("monument bodies") as Mesh;
    const position = bodies.geometry.getAttribute("position");
    const vertex = new Vector3();
    let towerTop = 0;
    for (let index = 0; index < position.count; index += 1) {
      vertex.fromBufferAttribute(position, index);
      if (
        Math.abs(vertex.x - entry.x_dm / 10) < 4 &&
        Math.abs(vertex.z - entry.z_dm / 10) < 4
      ) {
        towerTop = Math.max(towerTop, vertex.y);
      }
    }
    // ~8.9 m tower head above the plaza (ground ≈ 34 m NHN offset).
    const groundBounds = new Box3().setFromObject(bodies);
    expect(towerTop - groundBounds.min.y).toBeGreaterThan(7);
  });
  test("the Tiergarten's marble is drawn, not just its historic= tags", () => {
    // Most Tiergarten statuary is tagged tourism=artwork, not historic=*.
    const kinds = street.monuments!.map((entry) => entry.kind);
    expect(kinds.filter((kind) => kind === "artwork").length).toBeGreaterThan(60);
    const names = street.monuments!.map((entry) => entry.name);
    expect(names).toContain("Richard Wagner");
    // An unnamed sculpture has nothing to recognise; it must not be exported.
    // (Unnamed historic=memorial stones stay: they are surveyed markers.)
    expect(
      street
        .monuments!.filter((entry) => entry.kind === "artwork")
        .every((entry) => entry.name.length > 0),
    ).toBe(true);
  });

  test("every named artwork has a dedicated presentation builder and a height band", () => {
    // `buildStone` is intentionally retained only for quiet memorial
    // markers/Stolpersteine. A named `tourism=artwork` must instead enter the
    // explicit artwork dispatcher and lift clear of the marker's 0.7 m band.
    for (const entry of street.monuments!.filter(
      (candidate) =>
        candidate.kind === "artwork" &&
        !MONUMENTS_ALREADY_MODELLED.test(candidate.name),
    )) {
      expect(ARTWORK_BUILDERS[entry.name]).toBeDefined();
      const height = tallestAtArtwork(entry.name);
      if (height <= 1.2) {
        throw new Error(`${entry.name} remained in the marker height band (${height} m)`);
      }
    }
  });

  function tallestNear(name: string): number {
    const entry = street.monuments!.find((candidate) =>
      candidate.name.includes(name),
    )!;
    const bodies = monuments.getObjectByName("monument bodies") as Mesh;
    const position = bodies.geometry.getAttribute("position");
    const vertex = new Vector3();
    let top = -Infinity;
    let foot = Infinity;
    for (let index = 0; index < position.count; index += 1) {
      vertex.fromBufferAttribute(position, index);
      if (
        Math.abs(vertex.x - entry.x_dm / 10) < 9 &&
        Math.abs(vertex.z - entry.z_dm / 10) < 9
      ) {
        top = Math.max(top, vertex.y);
        foot = Math.min(foot, vertex.y);
      }
    }
    return top - foot;
  }

  function tallestAtArtwork(name: string): number {
    const entry = street.monuments!.find(
      (candidate) => candidate.kind === "artwork" && candidate.name === name,
    )!;
    const bodies = monuments.getObjectByName("monument bodies") as Mesh;
    const position = bodies.geometry.getAttribute("position");
    const vertex = new Vector3();
    let top = -Infinity;
    let foot = Infinity;
    for (let index = 0; index < position.count; index += 1) {
      vertex.fromBufferAttribute(position, index);
      if (
        Math.abs(vertex.x - entry.x_dm / 10) < 9 &&
        Math.abs(vertex.z - entry.z_dm / 10) < 9
      ) {
        top = Math.max(top, vertex.y);
        foot = Math.min(foot, vertex.y);
      }
    }
    return top - foot;
  }

  test("the Amazone rides her horse instead of being a stone block", () => {
    // Tuaillon's bronze: pedestal + horse (barrel, neck, head, four legs)
    // + upright rider — about 5.8 m overall, far taller than the generic
    // 0.7 m stone it used to be.
    expect(tallestNear("Amazone zu Pferde")).toBeGreaterThan(5);
  });

  test("the Löwengruppe is a reclining group on its rock, not a marker", () => {
    // Wolff's lioness with her cubs: low and long — clearly taller than a
    // stone marker but nowhere near a standing statue.
    const height = tallestNear("Löwengruppe");
    expect(height).toBeGreaterThan(2.5);
    expect(height).toBeLessThan(5);
  });

  test("Wagner stands under his protective roof", () => {
    // The canopy over Eberlein's marble reaches about 7.4 m.
    expect(tallestNear("Richard Wagner")).toBeGreaterThan(6.5);
    expect(tallestNear("Richard Wagner")).toBeLessThan(9);
    // Moltke and Roon are generals on pedestals, not 15 m chancellors.
    expect(tallestNear("Moltke")).toBeGreaterThan(10);
    expect(tallestNear("Moltke")).toBeLessThan(13);
  });

  test("Robert Koch sits in marble on the surveyed Robert-Koch-Platz anchor", () => {
    const height = tallestNear("Robert Koch");
    expect(height).toBeGreaterThan(5);
    expect(height).toBeLessThan(6.5);
    expect(monuments.userData.sourceUrls).toContain(
      "https://www.berlin.de/ba-mitte/ueber-den-bezirk/sehenswertes/denkmaeler/denkmaeler-suchen/index.php/detail/216",
    );
  });

  test("the Charite Graefe memorial is the full three-axis 1882 screen", () => {
    const entries = street.monuments!.filter(
      (candidate) => candidate.name === "Albrecht von Graefe",
    );
    expect(entries).toHaveLength(2);
    const charite = entries.find((candidate) => candidate.x_dm > 0)!;
    expect([charite.x_dm / 10, charite.z_dm / 10]).toEqual(
      GRAEFE_CHARITE_OSM_WORLD,
    );
    expect(GRAEFE_STATUE_HEIGHT_M).toBe(1.66);
    expect(monuments.userData.graefeCharite).toMatchObject({
      osmWorld: GRAEFE_CHARITE_OSM_WORLD,
      statueHeightM: GRAEFE_STATUE_HEIGHT_M,
    });
    expect(monuments.userData.sourceUrls).toContain(
      GRAEFE_MONUMENT_SOURCE_URL,
    );
    expect(
      monuments.getObjectByName("ALBRECHT VON GRAEFE monument inscription"),
    ).toBeInstanceOf(Mesh);

    const bodies = monuments.getObjectByName("monument bodies") as Mesh;
    const position = bodies.geometry.getAttribute("position");
    const vertex = new Vector3();
    let top = -Infinity;
    let foot = Infinity;
    let nearbyVertices = 0;
    for (let index = 0; index < position.count; index += 1) {
      vertex.fromBufferAttribute(position, index);
      if (
        Math.abs(vertex.x - charite.x_dm / 10) < 5.2 &&
        Math.abs(vertex.z - charite.z_dm / 10) < 2.4
      ) {
        nearbyVertices += 1;
        top = Math.max(top, vertex.y);
        foot = Math.min(foot, vertex.y);
      }
    }
    expect(nearbyVertices).toBeGreaterThan(1_000);
    expect(top - foot).toBeGreaterThan(5);
    expect(top - foot).toBeLessThan(6);
  });

  test("Lessing stands on his own jointed granite pedestal, not a generic cube stack", () => {
    // The real monument is a 3 m marble Lessing on a 4 m granite
    // pedestal (~7 m total), with the bronze "Genius der Humanität"
    // reclining at the front. https://de.wikipedia.org/wiki/Lessing-Denkmal_(Berlin)
    expect(tallestNear("Gotthold Ephraim Lessing")).toBeGreaterThan(6);
    expect(tallestNear("Gotthold Ephraim Lessing")).toBeLessThan(8);
    const entry = street.monuments!.find(
      (candidate) => candidate.name === "Gotthold Ephraim Lessing",
    )!;
    const bodies = monuments.getObjectByName("monument bodies") as Mesh;
    const position = bodies.geometry.getAttribute("position");
    const vertex = new Vector3();
    const figureYValues = new Set<number>();
    for (let index = 0; index < position.count; index += 1) {
      vertex.fromBufferAttribute(position, index);
      if (
        Math.abs(vertex.x - entry.x_dm / 10) < 1 &&
        Math.abs(vertex.z - entry.z_dm / 10) < 1 &&
        vertex.y > 3.5
      ) {
        figureYValues.add(Math.round(vertex.y * 10) / 10);
      }
    }
    // Coat/legs, torso, and head are three distinct elevations.
    expect(figureYValues.size).toBeGreaterThanOrEqual(3);
  });

  test("Bismarck is not drawn twice at the Großer Stern", () => {
    // createSiegessaeule() in IsometricCityWorld.ts already draws the
    // Bismarck-Nationaldenkmal as part of its verified recognition
    // model; the OSM "Otto von Bismarck" artwork point must be skipped
    // here so the two chancellors don't stand ~58 m apart.
    expect(MONUMENTS_ALREADY_MODELLED.test("Otto von Bismarck")).toBe(true);
    expect(tallestNear("Otto von Bismarck")).toBe(-Infinity);
  });

  test("the Luiseninsel carries its marble figures, not pebbles", () => {
    for (const name of ["Königin Luise", "Wilhelm von Preußen"]) {
      expect(tallestNear(name)).toBeGreaterThan(6);
      expect(tallestNear(name)).toBeLessThan(8);
    }
  });

  test("Wagner's canopy is a stepped vault above four posts, not a flat lid", () => {
    // v0.58.0: the real 1987/88 Schutzdach is a barrel vault, so the
    // highest vertices near the monument must come from a stack of at
    // least four shrinking slabs (the vault steps) sitting above the
    // four canopy posts, not a single flat roof plate.
    const entry = street.monuments!.find(
      (candidate) => candidate.name === "Richard Wagner",
    )!;
    const bodies = monuments.getObjectByName("monument bodies") as Mesh;
    const position = bodies.geometry.getAttribute("position");
    const vertex = new Vector3();
    const vaultTopYValues = new Set<number>();
    let postTop = -Infinity;
    let marbleGroupTop = -Infinity;
    for (let index = 0; index < position.count; index += 1) {
      vertex.fromBufferAttribute(position, index);
      if (
        Math.abs(vertex.x - entry.x_dm / 10) < 6 &&
        Math.abs(vertex.z - entry.z_dm / 10) < 6
      ) {
        if (vertex.y > 6) {
          vaultTopYValues.add(Math.round(vertex.y * 100) / 100);
        }
        if (Math.abs(vertex.x - entry.x_dm / 10) < 0.3) {
          marbleGroupTop = Math.max(marbleGroupTop, Math.min(vertex.y, 6));
        }
      }
      if (
        Math.abs(vertex.x - (entry.x_dm / 10 + 3.6)) < 0.3 &&
        Math.abs(vertex.z - (entry.z_dm / 10 + 2.8)) < 0.3
      ) {
        postTop = Math.max(postTop, vertex.y);
      }
    }
    // At least four distinct vault-step top elevations above y=6.
    expect(vaultTopYValues.size).toBeGreaterThanOrEqual(4);
    // The posts must reach up into the vault's height range.
    expect(postTop).toBeGreaterThan(6);
  });
});
