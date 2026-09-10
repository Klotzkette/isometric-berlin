import { describe, expect, test } from "bun:test";

import {
  Box3,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  Vector3
} from "three";

import { createBerlinJunction } from "../src/BerlinJunction";
import { createDomAltesMuseum } from "../src/DomAltesMuseum";
import { DOM_ALTES_ARTWORK_KEYS } from "../src/domAltesMuseumIds";
import { setIsoNightPresentation } from "../src/IsometricCityWorld";
import { BERLINER_ENSEMBLE_PUBLIC_ART_OSM_KEYS } from "../src/BerlinerEnsemble";
import { CSD_ATTACK_MEMORIAL_OSM_KEY } from "../src/CsdAttackMemorial";
import { KROLLOPER_SCULPTURE_OSM_KEYS } from "../src/KrolloperSculptures";
import { WAGNER_MEMORIAL_PROFILE } from "../src/WagnerMemorial";
import { MOABIT_PRISON_MEMORIAL_PROFILE } from "../src/MoabitPrisonMemorialPark";
import type { VoxelPayload as GroundPayload } from "../src/MinecraftVoxelWorld";
import type { StreetDetailsPayload } from "../src/TrafficSignals";
import {
  BERLIN_JUNCTION_PROFILE,
  GRAEFE_CHARITE_FACING_TARGET_WORLD,
  GRAEFE_CHARITE_OSM_WORLD,
  GRAEFE_CHARITE_YAW_DEGREES,
  GRAEFE_MONUMENT_SOURCE_URL,
  GRAEFE_REAR_FENCE_HEIGHT_M,
  GRAEFE_STATUE_HEIGHT_M,
  MONUMENTS_ALREADY_MODELLED,
  T4_MEMORIAL_PROFILE,
  createTiergartenMonuments,
  resolveArtworkBuilder,
} from "../src/TiergartenMonuments";
import streetDetails from "../public/mesh/regierungsviertel/street-details.json";
import voxelPayload from "../public/mesh/regierungsviertel/minecraft-voxels.json";

const street = streetDetails as unknown as StreetDetailsPayload;
const ground = voxelPayload as unknown as GroundPayload;

function monumentBodyMeshes(root: Group): Mesh[] {
  const matches: Mesh[] = [];
  root.traverse((object) => {
    if (object instanceof Mesh && object.name === "monument bodies") {
      matches.push(object);
    }
  });
  return matches;
}

function forEachMonumentVertex(root: Group, visit: (vertex: Vector3) => void): void {
  const vertex = new Vector3();
  for (const body of monumentBodyMeshes(root)) {
    const positions = body.geometry.getAttribute("position");
    for (let index = 0; index < positions.count; index += 1) {
      visit(vertex.fromBufferAttribute(positions, index));
    }
  }
}

function monumentBodyBounds(root: Group): Box3 {
  const bounds = new Box3();
  for (const body of monumentBodyMeshes(root)) bounds.expandByObject(body);
  return bounds;
}

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

  test("separates Berlin Junction from the later T4 glass memorial", () => {
    const junctionEntry = street.monuments!.find(
      ({ osm_key }) => osm_key === BERLIN_JUNCTION_PROFILE.osmKey,
    )!;
    const t4Entry = street.monuments!.find(
      ({ osm_key }) => osm_key === T4_MEMORIAL_PROFILE.osmKey,
    )!;
    expect(junctionEntry.name).toContain("Berlin Junction");
    expect(t4Entry.name).toContain("Euthanasie");

    expect(createTiergartenMonuments(
      { ...street, monuments: [junctionEntry] }, ground,
    )).toBeNull();
    const junction = createBerlinJunction();
    const t4 = createTiergartenMonuments(
      { ...street, monuments: [t4Entry] }, ground,
    )!;
    const junctionBounds = new Box3().setFromObject(junction);
    const t4Bounds = monumentBodyBounds(t4);
    expect(junction.userData.berlinJunction).toEqual(
      BERLIN_JUNCTION_PROFILE,
    );
    expect(t4.userData.tiergartenHeritageModels.t4Memorial).toEqual(
      T4_MEMORIAL_PROFILE,
    );
    expect(junctionBounds.max.y - junctionBounds.min.y).toBeCloseTo(3.4, 1);
    expect(Math.max(
      junctionBounds.max.x - junctionBounds.min.x,
      junctionBounds.max.z - junctionBounds.min.z,
    )).toBeGreaterThan(13);
    expect(Math.max(t4Bounds.max.x - t4Bounds.min.x, t4Bounds.max.z - t4Bounds.min.z))
      .toBeGreaterThanOrEqual(29.9);
    expect(monuments.userData.externallyModelledSourceKeys).toContain(BERLIN_JUNCTION_PROFILE.osmKey);
    expect(monuments.userData.sourceUrls).toContain(BERLIN_JUNCTION_PROFILE.sourceUrl);
    expect(monuments.userData.sourceUrls).toContain(T4_MEMORIAL_PROFILE.sourceUrl);
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
    expect(MONUMENTS_ALREADY_MODELLED.test("Fahne der Einheit")).toBe(true);
    expect(MONUMENTS_ALREADY_MODELLED.test("Fahne der Einheiten")).toBe(false);
    expect(MONUMENTS_ALREADY_MODELLED.test("Verkehrsturm")).toBe(false);
    expect(MONUMENTS_ALREADY_MODELLED.test("Gotthold Ephraim Lessing")).toBe(true);
    expect(MONUMENTS_ALREADY_MODELLED.test("Lessing-Denkmal")).toBe(true);
    expect(MONUMENTS_ALREADY_MODELLED.test("Johann Wolfgang von Goethe")).toBe(true);
    expect(MONUMENTS_ALREADY_MODELLED.test("Richard Wagner")).toBe(true);
    expect(MONUMENTS_ALREADY_MODELLED.test("Richard-Wagner-Denkmal")).toBe(true);
    // No drawn-monument geometry near the Soviet memorial's colonnade
    // (its recognition model owns that ground; only the two howitzers
    // between the tanks are ours).

    let tallAtEhrenmal = 0;
    forEachMonumentVertex(monuments, (vertex) => {
      if (
        Math.abs(vertex.x - 27.4) < 30 &&
        Math.abs(vertex.z - 258.1) < 30 &&
        vertex.y > 8
      ) {
        tallAtEhrenmal += 1;
      }
    }
    );
    expect(tallAtEhrenmal).toBe(0);

    const unitySource = street.monuments!.find(
      ({ name }) => name === "Fahne der Einheit",
    );
    expect(unitySource?.osm_key).toBe("node/437140233");
    expect(
      monuments.userData.protectedExternallyModelledSourceKeys,
    ).toContain("node/437140233");
    expect(monuments.userData.externallyModelledSourceKeys).toContain(
      WAGNER_MEMORIAL_PROFILE.osmKey,
    );
    expect(KROLLOPER_SCULPTURE_OSM_KEYS.size).toBe(20);
    const mappedKrolloperKeys = street.monuments!
      .map((entry) => entry.osm_key)
      .filter((osmKey) => KROLLOPER_SCULPTURE_OSM_KEYS.has(osmKey));
    expect(mappedKrolloperKeys).toHaveLength(4);
    for (const osmKey of mappedKrolloperKeys) {
      expect(monuments.userData.externallyModelledSourceKeys).toContain(osmKey);
    }
    for (const osmKey of MOABIT_PRISON_MEMORIAL_PROFILE.modelOwnership
      .genericArtworkSuppressionKeys) {
      expect(monuments.userData.externallyModelledSourceKeys).toContain(osmKey);
      expect(
        monuments.userData.protectedExternallyModelledSourceKeys,
      ).toContain(osmKey);
      expect(monuments.userData.protectedRenderedSourceKeys).not.toContain(
        osmKey,
      );
    }
  });

  test("delegates exactly the two mapped ML-20 guns without dropping their source protection",()=>{
    for(const key of ["node/489765078","node/489766052"]) {
      expect(monuments.userData.externallyModelledSourceKeys).toContain(key);
      expect(monuments.userData.protectedExternallyModelledSourceKeys).toContain(key);
      expect(monuments.userData.protectedRenderedSourceKeys).not.toContain(key);
    }
  });

  test("generic memorials stay merged while the Kindertransport model retains four exact material batches", () => {
    expect(monuments).toBeInstanceOf(Group);
    const bodies = monumentBodyMeshes(monuments);
    const inks: LineSegments[] = [];
    monuments.traverse((object) => {
      if (object instanceof LineSegments && object.name === "monument ink lines") {
        inks.push(object);
      }
    });
    const kindertransport = monuments.getObjectByName("Denkmal zur Erinnerung an Kindertransporte") as Group;
    expect(monumentBodyMeshes(kindertransport)).toHaveLength(4);
    expect(bodies).toHaveLength(6);
    expect(inks).toHaveLength(6);
    for (const body of bodies) {
      expect(body.geometry.getAttribute("color")).toBeDefined();
    }
    for (
    const ink of inks) {
      expect(ink.material).toBeInstanceOf(LineBasicMaterial);
      expect((ink.material as LineBasicMaterial).userData.modeInk
    ).toBeTrue();
    expect(
      (ink .material as LineBasicMaterial).userData
        .architecturalInkRole
    ).toBe("detail");
  }});

  test("renders source-protected records in a separate exact-Day batch", () => {
    const protectedEntry = street.monuments!.find((entry) => entry.name=== "Sophie Charlotte"
    )!;
    const ordinaryEntry = street.monuments!.find((entry) => entry.name === "Knut")!;
    expect(protectedEntry.schwellenraum_protected).toBeTrue();
    expect(ordinaryEntry.schwellenraum_protected).toBeFalse();

    const pair = createTiergartenMonuments({ ...street, monuments: [protectedEntry, ordinaryEntry] }, ground)!;
    const protectedBatch = pair.getObjectByName("OSM protected memorial Day batch") as Group;
    const protectedBody = protectedBatch.getObjectByName("monument bodies") as Mesh;
    const protectedInk = protectedBatch.getObjectByName("monument ink lines") as LineSegments;
    const ordinaryBody = pair.children.find((child) => child.name === "monument bodies") as Mesh;
    expect(protectedBatch.userData.schwellenraumGeschuetzt).toBeTrue();
    expect(protectedBatch.userData.sourceKeys).toContain(protectedEntry.osm_key);
    expect(protectedBody).toBeInstanceOf(Mesh);
    expect(ordinaryBody).toBeInstanceOf(Mesh);

    setIsoNightPresentation(pair, false, true, "day");
    const dayMaterial = protectedBody.material;
    const dayBodyColor = (dayMaterial as LineBasicMaterial).color.getHex();
    const dayInkColor = (protectedInk.material as LineBasicMaterial).color.getHex();
    const dayMatrix = protectedBody.matrix.toArray();
    const dayPosition = protectedBody.position .clone();
    setIsoNightPresentation(pair, true, true, "night");
    expect(protectedBody.material).not.toBe(dayMaterial);
    setIsoNightPresentation(pair, false, true, "schwellenraum");
    expect(protectedBody.material).toBe(dayMaterial);
    expect((protectedBody.material as LineBasicMaterial).color.getHex()).toBe(dayBodyColor);
    expect((protectedInk.material as LineBasicMaterial).color.getHex()).toBe(dayInkColor);
    expect(protectedBody.matrix.toArray()).toEqual(dayMatrix);
    expect(protectedBody.position).toEqual(dayPosition);
  });

  test("accounts for every protected source in exactly one Day-owned geometry layer", () => {
    const protectedEntries = street.monuments!.filter((entry) => entry.schwellenraum_protected);
    const sourceKeys = monuments.userData.protectedSourceKeys as string[];
    const renderedKeys = monuments.userData.protectedRenderedSourceKeys as string[];
    const externallyModelledKeys = monuments.userData.protectedExternallyModelledSourceKeys as string[];
    const ownership = [...renderedKeys, ...externallyModelledKeys];

    expect(sourceKeys).toHaveLength(protectedEntries.length);
    expect( new Set(sourceKeys).size).toBe(sourceKeys.length);
    expect(new Set(ownership).size).toBe(ownership.length);
    expect(new Set(ownership)).toEqual(new Set(sourceKeys));
    expect(renderedKeys.length).toBeGreaterThan(1_400);
    expect(externallyModelledKeys.length).toBeGreaterThan(0);
    expect(externallyModelledKeys).toContain(CSD_ATTACK_MEMORIAL_OSM_KEY);
    expect(renderedKeys).not.toContain(CSD_ATTACK_MEMORIAL_OSM_KEY);
    expect(
      externallyModelledKeys,
    ).toEqual(
      expect.arrayContaining([
        ...MOABIT_PRISON_MEMORIAL_PROFILE.modelOwnership
          .genericArtworkSuppressionKeys,
      ]),
    );
  });

  test("the original Verkehrsturm source remains while its dedicated tower owns the geometry", () => {
    const entry = street.monuments!.find((candidate) => candidate.name.includes("Verkehrsturm"))!;
    expect(entry.osm_key).toBe("way/241572310");
    expect(monuments.userData.externallyModelledSourceKeys).toContain(entry.osm_key);
    expect(monuments.userData.protectedExternallyModelledSourceKeys).toContain(entry.osm_key);
    let duplicateVertices = 0;
    forEachMonumentVertex(monuments, (vertex) => {
      if (Math.abs(vertex.x - entry.x_dm / 10) < 3 && Math.abs(vertex.z - entry.z_dm / 10) < 3)
        duplicateVertices++;
    });
    expect(duplicateVertices).toBe(0);
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
        .every((entry) => entry.name.length > 0)
    ).toBe(true,
    );
  });

  test("every named artwork has an explicit presentation builder and a height band", () => {
    // Named artwork has explicit ownership, either in the generic dispatcher
    // or in the source-bound museum scene; both paths must contain real art.
    const museum = createDomAltesMuseum();
    museum.updateMatrixWorld(true);
    const museumArtworkBounds = new Map<string, Box3>();
    const museumEntries = street.monuments!.filter(entry =>
      DOM_ALTES_ARTWORK_KEYS.has(entry.osm_key));
    expect(new Set(museumEntries.map(entry => entry.osm_key))).toEqual(
      DOM_ALTES_ARTWORK_KEYS);
    const transform = new Matrix4();
    const vertex = new Vector3();
    const color = new Color();
    for (const entry of museumEntries) {
      const bounds = new Box3();
      let contributions = 0;
      museum.traverse(object => {
        if (!(object instanceof Mesh)) return;
        if (entry.osm_key === "node/376689138" &&
          object.name.startsWith("Granitschale ")) {
          bounds.expandByObject(object);
          contributions += 1;
        }
        if (!(object instanceof InstancedMesh)) return;
        const positions = object.geometry.getAttribute("position");
        for (let instance = 0; instance < object.count; instance += 1) {
          object.getMatrixAt(instance, transform);
          transform.premultiply(object.matrixWorld);
          vertex.setFromMatrixPosition(transform);
          if (Math.hypot(vertex.x - entry.x_dm / 10,
            vertex.z - entry.z_dm / 10) > 4) continue;
          object.getColorAt(instance, color);
          if (entry.osm_key !== "node/376689138" &&
            color.getHex() !== 0x416f5c) continue;
          contributions += 1;
          for (let index = 0; index < positions.count; index += 1) {
            bounds.expandByPoint(vertex.fromBufferAttribute(positions, index)
              .applyMatrix4(transform));
          }
        }
      });
      expect(contributions).toBeGreaterThan(
        entry.osm_key === "node/376689138" ? 7 : 10);
      expect(bounds.isEmpty()).toBe(false);
      museumArtworkBounds.set(entry.osm_key, bounds);
    }
    for (const entry of street.monuments!.filter(
      (candidate) =>
        candidate.kind === "artwork" &&
        !BERLINER_ENSEMBLE_PUBLIC_ART_OSM_KEYS.has(candidate.osm_key) &&
        !KROLLOPER_SCULPTURE_OSM_KEYS.has(candidate.osm_key) &&
        !MOABIT_PRISON_MEMORIAL_PROFILE.modelOwnership
          .genericArtworkSuppressionKeys.includes(candidate.osm_key) &&
        !MONUMENTS_ALREADY_MODELLED.test(candidate.name),
    )) {
      const dedicated = museumArtworkBounds.get(entry.osm_key);
      if (DOM_ALTES_ARTWORK_KEYS.has(entry.osm_key)) {
        expect(createDomAltesMuseum).toBeFunction();
        expect(dedicated).toBeDefined();
        const size = dedicated!.getSize(new Vector3());
        if (entry.osm_key === "node/376689138") {
          // Actual hollow bowl plus platform: 6.9 m basin, 8.84 m lower
          // plinth and approximately 2.27 m overall presentation height.
          expect(size.y).toBeGreaterThan(2.2);
          expect(size.y).toBeLessThan(2.4);
          expect(size.x).toBeCloseTo(8.84, 2);
          expect(size.z).toBeCloseTo(8.84, 2);
        } else {
          // Bronze horse/rider geometry only, excluding the taller source
          // museum and stone pedestal. These are recognition subdivisions,
          // in the 3.7–4.5 m sculpture band, rather than generic low markers.
          expect(size.y).toBeGreaterThan(3.7);
          expect(size.y).toBeLessThan(4.5);
          expect(size.x).toBeGreaterThan(2.5);
          expect(size.z).toBeGreaterThan(1.5);
          expect(dedicated!.min.y).toBeGreaterThan(9);
          expect(dedicated!.max.y).toBeLessThan(13.5);
        }
      } else {
        expect(resolveArtworkBuilder(entry.name)).toBeFunction();
        const height = tallestAtArtwork(entry.name);
        if (height <= 1.2) {
          throw new Error(`${entry.name} remained in the marker height band (${height} m)`);
        }
      }
    }
  expect(monuments.userData.fallbackArtworkCount).toBeGreaterThan(100);
    expect(monuments.userData.fallbackArtworkGeometry).toContain("not surveyed");
  });

  function tallestNear(name: string): number {
    const entry = street.monuments!.find((candidate) =>
      candidate.name=== name) ??
      street.monuments!.find((candidate) => candidate.name.includes(name)
    )!;
    let top = -Infinity;
    let foot = Infinity;
    forEachMonumentVertex(monuments, (vertex) => {
      if (
        Math.abs(vertex.x - entry.x_dm / 10) < 9 &&
        Math.abs(vertex.z - entry.z_dm / 10) < 9
      ) {
        top = Math.max(top, vertex.y);
        foot = Math.min(foot, vertex.y);
      }
    }
    );
    return top - foot;
  }

  function tallestAtArtwork(name: string): number {
    const entry = street.monuments!.find(
      (candidate) => candidate.kind === "artwork" && candidate.name === name
    )!;
    let top = -Infinity;
    let foot = Infinity;
    forEachMonumentVertex(monuments, (vertex) => {
      if (
        Math.abs(vertex.x - entry.x_dm / 10) < 9 &&
        Math.abs(vertex.z - entry.z_dm / 10) < 9
      ) {
        top = Math.max(top, vertex.y);
        foot = Math.min(foot, vertex.y);
      }
    }
    );
    return top - foot;
  }

  function boundsForSingleMemorial(name: string): Box3 {
    const entry = street.monuments!.find((candidate) => candidate.name === name)!;
    const single = createTiergartenMonuments(
      { ...street, monuments: [entry] },
      ground
    )!;
    return monumentBodyBounds( single);
  }

  test("OSM memorial subtypes replace the universal grey block", () => {
    expect(monuments.userData.memorialTypeCounts.stolperstein).toBeGreaterThan(200);
    expect(monuments.userData.quietMemorialGeometry).toContain("0.10 m");

    const stolperstein = boundsForSingleMemorial("Martha Gabali");
    expect(stolperstein.max.x - stolperstein.min.x).toBeCloseTo(0.1, 4);
    expect(stolperstein.max.y - stolperstein.min.y).toBeCloseTo(0.025, 4);
    expect(stolperstein.max.z - stolperstein.min.z).toBeCloseTo(0.1, 4);

    const statue = boundsForSingleMemorial("Sophie Charlotte");
    expect(statue.max.y - statue.min.y).toBeGreaterThan(2.3);
    expect(statue.max.y - statue.min.y).toBeLessThan(2.6);
  });

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

  test("Wagner is owned exclusively by the source-bound memorial model", () => {
    const entry = street.monuments!.find(
      (candidate) => candidate.osm_key === WAGNER_MEMORIAL_PROFILE.osmKey,
    )!;
    expect(entry.name).toBe(WAGNER_MEMORIAL_PROFILE.name);
    expect(
      createTiergartenMonuments({ ...street, monuments: [entry] }, ground),
    ).toBeNull();
    // The white marble Moltke is owned by its dedicated source-bound model.
    expect(tallestNear("Moltke")).toBe(-Infinity);
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
      (candidate) => candidate.name === "Albrecht von Graefe"
    );
    expect(entries).toHaveLength(2);
    const charite = entries.find((candidate) => candidate.x_dm > 0)!;
    expect([charite.x_dm / 10, charite.z_dm / 10]).toEqual(
      GRAEFE_CHARITE_OSM_WORLD
    );
    expect(GRAEFE_STATUE_HEIGHT_M).toBe(1.66);
    expect(monuments.userData.graefeCharite).toMatchObject({
      facingTargetWorld: GRAEFE_CHARITE_FACING_TARGET_WORLD,
      osmWorld: GRAEFE_CHARITE_OSM_WORLD,
      rearFenceHeightM: GRAEFE_REAR_FENCE_HEIGHT_M,
      rearFencePickets: 31,
      statueHeightM: GRAEFE_STATUE_HEIGHT_M,
      yawDegrees: GRAEFE_CHARITE_YAW_DEGREES,
    });
    expect(monuments.userData.sourceUrls).toContain(
      GRAEFE_MONUMENT_SOURCE_URL
    );
    const inscription = monuments.getObjectByName(
      "ALBRECHT VON GRAEFE monument inscription"
    ) as Mesh;
    expect(inscription).toBeInstanceOf(Mesh);
    expect((inscription.rotation.y * 180) / Math.PI).toBeCloseTo(
      GRAEFE_CHARITE_YAW_DEGREES,
      5
    );
    const front = new Vector3(0, 0, 1).applyAxisAngle(
      new Vector3(0, 1, 0),
      inscription.rotation.y
    );
    const toStreetCorner = new Vector3(
      GRAEFE_CHARITE_FACING_TARGET_WORLD[0] - GRAEFE_CHARITE_OSM_WORLD[0],
      0,
      GRAEFE_CHARITE_FACING_TARGET_WORLD[1] - GRAEFE_CHARITE_OSM_WORLD[1],
    ).normalize();
    expect(front.dot(toStreetCorner)).toBeGreaterThan(0.9999);


    let top = -Infinity;
    let foot = Infinity;
    let nearbyVertices = 0;
    let rearFenceTopVertices = 0;
    const yaw = (GRAEFE_CHARITE_YAW_DEGREES * Math.PI) / 180;
    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);
    const monumentGroundY = inscription.position.y - 0.97;
    forEachMonumentVertex(monuments, (vertex) => {
      const dx = vertex.x - charite.x_dm / 10;
      const dz = vertex.z - charite.z_dm / 10;
      const localX = cosYaw * dx - sinYaw * dz;
      const localZ = sinYaw * dx + cosYaw * dz;
      const localY = vertex.y - monumentGroundY;
      if (
        Math.abs(localX) < 5.6 &&
        Math.abs(localZ + 1.08) < 0.12 &&
        localY > 1.65
      ) {
        rearFenceTopVertices += 1;
      }
      if (
        Math.abs(dx) < 6.5 &&
        Math.abs(dz) < 6.5
      ) {
        nearbyVertices += 1;
        top = Math.max(top, vertex.y);
        foot = Math.min(foot, vertex.y);
      }
    }
    );
    expect(nearbyVertices).toBeGreaterThan(2_000);
    expect(rearFenceTopVertices).toBeGreaterThan(100);
    expect(top - foot).toBeGreaterThan(5);
    expect(top - foot).toBeLessThan(6);
  });

  test("delegates Goethe and Lessing to the dedicated literary models exactly once", () => {
    const externallyModelled = monuments.userData
      .protectedExternallyModelledSourceKeys as string[];
    const rendered = monuments.userData.protectedRenderedSourceKeys as string[];
    for (const sourceKey of ["node/278738513", "node/884700390"]) {
      expect(externallyModelled).toContain(sourceKey);
      expect(rendered).not.toContain(sourceKey);
    }
    expect(tallestNear("Johann Wolfgang von Goethe")).toBe(-Infinity);
    expect(tallestNear("Gotthold Ephraim Lessing")).toBe(-Infinity);
  });

  test("Bismarck is not drawn twice at the Großer Stern", () => {
    // The source-bound BismarckMoltkeMonuments owns the two exact OSM points.
    // Generic markers must not survive under its sculptural replacements.
    expect(MONUMENTS_ALREADY_MODELLED.test("Otto von Bismarck")).toBe(true);
    expect(tallestNear("Otto von Bismarck")).toBe(-Infinity);
    expect(monuments.userData.externallyModelledSourceKeys).toContain("node/278706862");
  });

  test("the Luiseninsel carries its marble figures, not pebbles", () => {
    for (const name of ["Königin Luise", "Wilhelm von Preußen"]) {
      expect(tallestNear(name)).toBeGreaterThan(6);
      expect(tallestNear(name)).toBeLessThan(8);
    }
  });

  test("the New Partie memorials keep their documented individual forms", () => {
    const rousseau = tallestNear("Rousseau-Säule");
    expect(rousseau).toBeGreaterThan(2.05);
    expect(rousseau).toBeLessThan(2.35);
    const lortzing = tallestNear("Lortzing-Denkmal");
    expect(lortzing).toBeGreaterThan(6.2);
    expect(lortzing).toBeLessThan(6.8);
    const baumdank = tallestNear("Baumdank-Denkmal");
    expect(baumdank).toBeGreaterThan(3.1);
    expect(baumdank).toBeLessThan(3.7);
    expect(monuments.userData.tiergartenHeritageModels.rousseau).toContain(
      "2.2 m"
    );
    expect(monuments.userData.tiergartenHeritageModels.lortzing).toContain(
      "6.5 m"
    );
  });

  test("Flora and the German song are figure groups, not generic steles", () => {
    expect(tallestNear("Florastatue")).toBeGreaterThan(3);
    expect(tallestNear("Das deutsche Volkslied")).toBeGreaterThan(2.4);
    expect(monuments.userData.tiergartenHeritageModels.flora).toContain(
      "putto"
    );
    expect(monuments.userData.tiergartenHeritageModels.volkslied).toContain(
      "lyre"
    );
  });

});
