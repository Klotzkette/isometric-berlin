import { describe, expect, test } from "bun:test";

import {
  Box3,
  Color,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineDashedMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector3,
} from "three";

import {
  appendKollhoffClinkerJoints,
  ADLON_LOD2_ID,
  ADLON_WORLD,
  CHARITE_BETTENHOCHHAUS_IDS,
  CHARITE_BETTENHOCHHAUS_PROFILE,
  CHARITE_CAMPUS_BRIDGE_ID,
  FACADE_AXIS_V07231_ATTRIBUTE_BYTES,
  PLAZA_FACADE_DETAIL_ZONES,
  PLACE_DETAIL_ATTRIBUTE_DELTA_BUDGET_BYTES,
  PRISM_SUPPRESSED_IDS,
  type PrismWall,
  type PrismPayload,
  VISIBLE_RADIUS_M,
  buildRoofGeometry,
  createIsometricCity,
  curvedWaterRipple,
  facadeWallsOf,
  fitRectangle,
  ISO_EDGE_THRESHOLD_DEGREES,
  ISO_FACADE_AXIS_OPACITY,
  ISO_FACADE_DETAIL_FADE_M,
  ISO_FACADE_WINDOW_DASH_M,
  ISO_FACADE_WINDOW_GAP_M,
  ISO_GLASS_DAY_OPACITY,
  ISO_GLASS_MULLION_OPACITY,
  ISO_GROUND_SHADES,
  ISO_INK_COLOR,
  ISO_WINDOW_BAY_PITCH_M,
  ISO_WINDOW_FLOOR_PITCH_M,
  HERO_PRISM_ROOF_TONES,
  HERO_PRISM_TONES,
  KOLLHOFF_TOWER_PRISM_IDS,
  PAUL_LOEBE_WEST_FACE_X,
  PRISM_GLASSED_IDS,
  plazaFacadeDetailZoneForWall,
  createLandmarkRefinements,
  createHotelAdlon,
  createTillaDurieuxGroundTester,
  isTillaDurieuxLawn,
  createPaulLoebeCanopy,
  ROOF_GABLED,
  ROOF_HIPPED,
  ROOF_MIN_RECTANGULARITY,
  ROOF_SHED,
  ROOF_TENT,
  SOURCE_FACADE_IVORY_BLEND,
  roofRise,
  setIsoNightPresentation,
  windowGrid,
  windowFormatForBuilding,
} from "../src/IsometricCityWorld";
import { ARCHITECTURAL_INK_PALETTE } from "../src/architecturalInk";
import { ADLER_BRIDGE_PROFILE } from "../src/AdlerBridge";
import { KOLLHOFF_TOWER_PROFILE } from "../src/expandedCityProfiles";
import {
  SANDKRUG_OSM_DECK,
  SANDKRUG_STRUCTURE_PROFILE,
} from "../src/HumboldthafenSources";
import {
  WEIDENDAMMER_BRIDGE_EAGLE_COUNT,
  WEIDENDAMMER_BRIDGE_PROFILE,
  WEIDENDAMMER_BRIDGE_RAILING_SYSTEM_COUNT,
  WEIDENDAMMER_BRIDGE_SMOOTH_ROOT_NAME,
} from "../src/WeidendammerBridgeDetails";
import prismPayload from "../public/mesh/regierungsviertel/lod2-prisms.json";
import voxelGroundPayload from "../public/mesh/regierungsviertel/minecraft-voxels.json";
import surfacePolygonPayload from "../public/mesh/regierungsviertel/surface-polygons.json";
import type { SurfacePayload } from "../src/IsometricCityWorld";

const payload = prismPayload as unknown as PrismPayload;
const surfacesFixture = surfacePolygonPayload as unknown as SurfacePayload;
const city = createIsometricCity(payload, null);
// Task 13 adds another exact 500 m source ring on every side. A small set
// of regressions deliberately rebuilds the complete city; keep their timeout
// bounded while allowing for parallel runner load on the larger payload.
// Repeated full-world builds can reach roughly two minutes after a long
// Windows suite when synchronous construction and security scanning overlap.
// Keep a finite guard without making the regression suite load-order dependent.
const TASK_13_FULL_CITY_TIMEOUT_MS = 180_000;

describe("drawn isometric city (LoD2 prisms)", () => {
  const bodies = city.getObjectByName("LoD2 prism buildings") as Mesh;
  const ink = city.getObjectByName("LoD2 prism ink lines") as LineSegments;

  test("merges thousands of surveyed footprints into prisms with ink lines", () => {
    expect(payload.buildings.length).toBeGreaterThan(2000);
    expect(bodies).toBeInstanceOf(Mesh);
    expect(ink).toBeInstanceOf(LineSegments);
    expect(ISO_EDGE_THRESHOLD_DEGREES).toBeGreaterThan(0);
    // Fine grey pencil ink — light lines, no black marker.
    expect(ISO_INK_COLOR).toBeGreaterThan(0x404040);
    expect(ISO_INK_COLOR).toBeLessThan(0x909090);
    expect(bodies.geometry.getAttribute("color")).toBeDefined();
    expect(bodies.material).toBeInstanceOf(MeshBasicMaterial);
    expect(
      (ink.material as LineBasicMaterial).userData.architecturalInkRole,
    ).toBe("silhouette");
  });

  test("gives the complete building drawing its own ink in every mode", () => {
    const material = ink.material as LineBasicMaterial;
    for (const mode of ["snowstorm", "minecraft", "night", "day"] as const) {
      setIsoNightPresentation(city, mode === "night", true, mode);
      expect(material.color.getHex()).toBe(
        ARCHITECTURAL_INK_PALETTE[mode].silhouette,
      );
    }
  });

  test("registers the authored landmark outlines in the shared drawing system", () => {
    const expectedRoles = new Map([
      ["Siegessäule and Bismarck ink lines", "detail"],
      ["Adlon ink lines", "silhouette"],
      ["Paul-Löbe canopy ink lines", "detail"],
      ["Gymnasium Tiergarten ink lines", "silhouette"],
      ["Landmark refinement ink lines", "detail"],
    ]);
    for (const [name, role] of expectedRoles) {
      const lines = city.getObjectByName(name);
      expect(lines).toBeInstanceOf(LineSegments);
      const material = (lines as LineSegments).material as LineBasicMaterial;
      expect(material.userData.modeInk).toBeTrue();
      expect(material.userData.architecturalInkRole).toBe(role);
    }
  });

  test("keeps the Reichstag as a tall prism with courtyard holes", () => {
    const reichstag = payload.buildings.filter((building) => {
      const xs = building.ring.map(([x]) => x / 10);
      const zs = building.ring.map(([, z]) => z / 10);
      const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
      const cz = zs.reduce((a, b) => a + b, 0) / zs.length;
      return cx >= 260 && cx <= 372 && cz >= -34 && cz <= 115;
    });
    expect(reichstag.length).toBeGreaterThan(0);
    expect(Math.max(...reichstag.map((b) => b.h_dm))).toBeGreaterThanOrEqual(
      240,
    );
    expect(
      reichstag.some((building) => (building.holes ?? []).length >= 1),
    ).toBe(true);
  });

  test("replaces only the Reichstag's closed LoD2 west-portico boxes", async () => {
    const { PRISM_SUPPRESSED_IDS } = await import("../src/IsometricCityWorld");
    expect(PRISM_SUPPRESSED_IDS.has("UbQkgNZe")).toBe(true);
    expect(PRISM_SUPPRESSED_IDS.has("ycOYQRVL")).toBe(true);
    expect(PRISM_SUPPRESSED_IDS.has("K0002MCN")).toBe(false);
    // This bridge envelope is likewise a valid LoD2 part but a footprint
    // extrusion fills the complete height and becomes a wall over the Spree.
    expect(PRISM_SUPPRESSED_IDS.has("K0001zDa")).toBe(true);
    // Both Invalidenfriedhof memorial structures are rebuilt as complete,
    // open recognition models; their source footprints remain metric anchors
    // but must not become opaque full-height prism extrusions.
    expect(PRISM_SUPPRESSED_IDS.has("K0001yqp")).toBe(true);
    expect(PRISM_SUPPRESSED_IDS.has("1pC0000R")).toBe(true);
    // The Wagner LoD2 object is a closed canopy envelope; the authored
    // source-bound model keeps the public approaches open.
    expect(PRISM_SUPPRESSED_IDS.has("SR00009n")).toBe(true);

    const mainBody = payload.buildings.find(
      (building) => building.id === "K0002MCN",
    );
    expect(mainBody).toBeDefined();
    expect(mainBody!.ring.length).toBe(101);
    expect(mainBody!.holes).toHaveLength(6);
  });

  test("city geometry spans the quarter and sits above ground", () => {
    const bounds = new Box3().setFromObject(bodies);
    const size = bounds.getSize(new Vector3());
    expect(size.x).toBeGreaterThan(800);
    expect(size.z).toBeGreaterThan(800);
    expect(bounds.min.y).toBeGreaterThan(-10);
    expect(bounds.max.y).toBeLessThan(200);
  });
});

describe("ligne-claire fenestration", () => {
  const city = createIsometricCity(payload, null);

  test("windowGrid derives real floors and bays from surveyed geometry", () => {
    // A 20 m wall on a 12 m body: bays span the wall, floors the height.
    const grid = windowGrid(20, 12);
    expect(grid).not.toBeNull();
    expect(grid!.bays).toBeGreaterThanOrEqual(5);
    expect(grid!.floors).toBe(3);
    // The bay run stays centred inside the wall.
    const lastOffset =
      grid!.firstOffset + (grid!.bays - 1) * ISO_WINDOW_BAY_PITCH_M;
    expect(grid!.firstOffset).toBeGreaterThan(0);
    expect(lastOffset).toBeLessThan(20);
    // Storey pitch is architectural, not decorative.
    expect(ISO_WINDOW_FLOOR_PITCH_M).toBeGreaterThan(2.5);
    expect(ISO_WINDOW_FLOOR_PITCH_M).toBeLessThan(4);
    // Walls too short and bodies too low carry no windows.
    expect(windowGrid(2, 12)).toBeNull();
    expect(windowGrid(20, 2.5)).toBeNull();
  });

  test("facades are articulated by glazing axes and storey bands", () => {
    // The facade grid is drawn: slender vertical bay axes crossed by a
    // dashed sill rhythm per storey, so openings stay legible when exact
    // panes are unavailable without duplicating almost a million vertices.
    const axes = city.getObjectByName("LoD2 facade axes") as LineSegments;
    expect(axes).toBeInstanceOf(LineSegments);
    expect(axes.material).toBeInstanceOf(LineDashedMaterial);
    const position = axes.geometry.getAttribute("position");
    const lineDistance = axes.geometry.getAttribute("lineDistance");
    expect(lineDistance.count).toBe(position.count);
    expect(position.count).toBeGreaterThan(20_000);
    let verticals = 0;
    let bands = 0;
    let dashedBands = 0;
    let invalidSegments = 0;
    for (let index = 0; index < position.count; index += 2) {
      const sameXZ =
        Math.abs(position.getX(index) - position.getX(index + 1)) < 1e-3 &&
        Math.abs(position.getZ(index) - position.getZ(index + 1)) < 1e-3;
      if (sameXZ) {
        if (
          position.getY(index + 1) <= position.getY(index) ||
          lineDistance.getX(index) !== 0 ||
          lineDistance.getX(index + 1) !== 0
        ) {
          invalidSegments += 1;
        }
        verticals += 1;
      } else {
        // Storey bands run level along the wall.
        if (
          Math.abs(position.getY(index) - position.getY(index + 1)) >= 1e-3 ||
          lineDistance.getX(index) !== 0
        ) {
          invalidSegments += 1;
        }
        if (lineDistance.getX(index + 1) > 0) dashedBands += 1;
        bands += 1;
      }
    }
    expect(invalidSegments).toBe(0);
    expect(verticals).toBeGreaterThan(5_000);
    expect(bands).toBeGreaterThan(5_000);
    // Source-authored Charite bands remain solid; the generic LoD2 bands
    // carry the lightweight inferred window rhythm.
    expect(dashedBands).toBeGreaterThan(5_000);
    expect(dashedBands).toBeLessThan(bands);
    const material = axes.material as LineDashedMaterial;
    expect(material.scale).toBe(0.01);
    expect(material.dashSize).toBe(ISO_FACADE_WINDOW_DASH_M);
    expect(material.gapSize).toBe(ISO_FACADE_WINDOW_GAP_M);
    expect(material.dashSize + material.gapSize).toBe(ISO_WINDOW_BAY_PITCH_M);
    expect(axes.userData.facadeRhythm).toEqual({
      basis: "measured LoD2 wall length and building height",
      lineKinds: [
        "bay-axis",
        "storey-sill",
        "plaza-front-window-head",
        "window-dash",
      ],
      openingCoordinates: "inferred rhythm; not surveyed individual panes",
    });
    expect(axes.userData.detailFadeM).toBe(ISO_FACADE_DETAIL_FADE_M);
  });

  test("night lights only a warm minority of facade axes, hidden by day", () => {
    const strips = city.getObjectByName(
      "LoD2 facade night strips",
    ) as InstancedMesh;
    expect(strips).toBeInstanceOf(InstancedMesh);
    // Off by day.
    expect(strips.visible).toBe(false);
    const axes = city.getObjectByName("LoD2 facade axes") as LineSegments;
    const axisCount = axes.geometry.getAttribute("position").count / 2;
    // The lit strips are a minority (~38%) of all axes.
    expect(strips.count).toBeGreaterThan(0);
    expect(strips.count / axisCount).toBeLessThan(0.5);
    // The strips are warm (r ≥ b) on average.
    const colors = strips.instanceColor!.array as Float32Array;
    let warm = 0;
    for (let index = 0; index < strips.count; index += 1) {
      if (colors[index * 3] >= colors[index * 3 + 2]) warm += 1;
    }
    expect(warm / strips.count).toBeGreaterThan(0.5);
  });

  test("records facade-axis mode opacity as the distance-fade base", () => {
    const axes = city.getObjectByName("LoD2 facade axes") as LineSegments;
    const material = axes.material as LineBasicMaterial;

    setIsoNightPresentation(city, true);
    expect(material.opacity).toBe(0.12);
    expect(material.userData.stableInkAuthoredOpacity).toBe(0.12);
    expect(material.userData.stableInkAppliedOpacity).toBeNull();

    setIsoNightPresentation(city, false);
    expect(material.opacity).toBe(ISO_FACADE_AXIS_OPACITY);
    expect(material.userData.stableInkAuthoredOpacity).toBe(
      ISO_FACADE_AXIS_OPACITY,
    );
    expect(material.userData.stableInkAppliedOpacity).toBeNull();
  });

  test("glass-class prisms and the Hauptbahnhof towers render transparent", () => {
    const glass = city.getObjectByName("LoD2 glass prisms") as Mesh;
    expect(glass).toBeInstanceOf(Mesh);
    const material = glass.material as {
      opacity: number;
      transparent: boolean;
    };
    expect(glass.material).toBeInstanceOf(MeshBasicMaterial);
    expect(material.transparent).toBe(true);
    expect(material.opacity).toBeGreaterThan(0.3);
    expect(material.opacity).toBeLessThan(0.8);
    // The 24 Hauptbahnhof Bügel prisms plus the Charite campus bridge are
    // glassed, and all of them exist in the official payload.
    expect(PRISM_GLASSED_IDS.size).toBe(25);
    for (const id of PRISM_GLASSED_IDS) {
      expect(payload.buildings.some((b) => b.id === id)).toBe(true);
    }
  });

  test("glass swaps losslessly between flat day and lit night materials", () => {
    const glass = city.getObjectByName("LoD2 glass prisms") as Mesh;
    const dayMaterial = glass.material;
    setIsoNightPresentation(city, true);
    expect(glass.material).toBeInstanceOf(MeshStandardMaterial);
    setIsoNightPresentation(city, false);
    expect(glass.material).toBe(dayMaterial);
  });

  test("night masonry keeps a cool readable floor instead of collapsing to black", () => {
    const bodies = city.getObjectByName("LoD2 prism buildings") as Mesh;
    const dayMaterial = bodies.material;
    setIsoNightPresentation(city, true);
    const nightMaterial = bodies.material as MeshStandardMaterial;
    expect(nightMaterial).toBeInstanceOf(MeshStandardMaterial);
    expect(nightMaterial.emissive.getHex()).toBe(0x252c39);
    expect(nightMaterial.emissiveIntensity).toBeGreaterThanOrEqual(0.65);
    setIsoNightPresentation(city, false);
    expect(bodies.material).toBe(dayMaterial);
  });

  test("the presentation paper closes distant camera views without data claims", () => {
    const backdrop = city.getObjectByName(
      "presentation paper backdrop",
    ) as Mesh;
    expect(backdrop).toBeInstanceOf(Mesh);
    expect(backdrop.material).toBeInstanceOf(MeshBasicMaterial);
    expect(backdrop.userData.presentationOnly).toBe(true);
    const dayMaterial = backdrop.material;
    setIsoNightPresentation(city, true);
    expect(backdrop.material).not.toBe(dayMaterial);
    setIsoNightPresentation(city, false);
    expect(backdrop.material).toBe(dayMaterial);
  });

  describe('"Licht aus" moonlight (v0.52.0)', () => {
    // Lamp heads and the water surface only get built when ground +
    // surfaces payloads are supplied, so this block builds its own richer
    // fixture rather than reusing the lighter `city` above. Every test
    // restores day mode at the end so nothing here can bleed into other
    // tests in this file.
    const litCity = createIsometricCity(
      payload,
      voxelGroundPayload as never,
      null,
      surfacesFixture,
    );

    test("turns the facade night strips fully invisible, unlike lights-on night", () => {
      const strips = litCity.getObjectByName(
        "LoD2 facade night strips",
      ) as InstancedMesh;
      setIsoNightPresentation(litCity, true, true);
      expect(strips.visible).toBe(true);
      setIsoNightPresentation(litCity, true, false);
      expect(strips.visible).toBe(false);
      setIsoNightPresentation(litCity, false);
      expect(strips.visible).toBe(false);
    });

    test("street lamps (ParkDetails night-only cones + emissive heads) are unaffected here — they relight centrally", () => {
      // The drawn-city group itself has no standalone streetlamp mesh; real
      // street lighting is "Geoportal Berlin public-lighting lamp heads"
      // and "… night-only instanced street-light cones" in ParkDetails.ts,
      // which carry nightEmissive/nightOnly userData and are relit through
      // applyMaterialLighting/applyLightingToRoot in ThreeViewer.tsx (see
      // setSceneLighting's lightsOn threading). Nothing to assert on
      // litCity directly — this is a documentation test so the absence of
      // a local mesh is not mistaken for a gap.
      expect(
        litCity.getObjectByName("extrapolated lamp heads"),
      ).toBeUndefined();
    });

    test("darkens the real (surfaces-backed) water plate further than ordinary lit night, without lighting it", () => {
      const water = litCity.getObjectByName("smooth water surface") as Mesh;
      expect(water).toBeInstanceOf(Mesh);
      setIsoNightPresentation(litCity, true, true);
      const litMaterial = water.material as MeshBasicMaterial;
      const litHex = litMaterial.color.getHex();
      const litOpacity = litMaterial.opacity;

      setIsoNightPresentation(litCity, true, false);
      const moonlitMaterial = water.material as MeshBasicMaterial;
      expect(moonlitMaterial.color.getHex()).toBe(0x131f2c);
      expect(moonlitMaterial.color.getHex()).not.toBe(litHex);
      expect(moonlitMaterial.opacity).toBeGreaterThan(litOpacity);

      // Round-trip: lights back on restores the exact lit-night material,
      // day restores the exact original day material (lossless).
      setIsoNightPresentation(litCity, true, true);
      expect(water.material).toBe(litMaterial);
      const dayMaterial = water.userData.dayMaterial;
      setIsoNightPresentation(litCity, false);
      expect(water.material).toBe(dayMaterial);
    });

    test("the drawn-water fallback mesh (no surfaces payload) also darkens under moonlight", () => {
      // This is the OTHER water path: createIsometricCity falls back to a
      // rasterised "drawn water surface" InstancedMesh only when no
      // surfaces payload is supplied at all.
      const fallbackCity = createIsometricCity(
        payload,
        voxelGroundPayload as never,
        null,
        null,
      );
      const water = fallbackCity.getObjectByName(
        "drawn water surface",
      ) as InstancedMesh;
      expect(water).toBeInstanceOf(InstancedMesh);
      setIsoNightPresentation(fallbackCity, true, true);
      const litHex = (water.material as MeshBasicMaterial).color.getHex();
      const litOpacity = (water.material as MeshBasicMaterial).opacity;
      setIsoNightPresentation(fallbackCity, true, false);
      const moonlitHex = (water.material as MeshBasicMaterial).color.getHex();
      const moonlitOpacity = (water.material as MeshBasicMaterial).opacity;
      expect(moonlitHex).toBe(0x131f2c);
      expect(moonlitHex).not.toBe(litHex);
      expect(moonlitOpacity).toBeGreaterThan(litOpacity);
      setIsoNightPresentation(fallbackCity, false);
    });

    test("leaves masonry emissive, ink colour and facade axis opacity untouched by the lights toggle", () => {
      // These are structural/self-visibility elements, not artificial
      // lights, so "Licht aus" must not touch them (spec: silhouettes,
      // outlines and isoFaceShade stay intact).
      const bodies = city.getObjectByName("LoD2 prism buildings") as Mesh;
      const ink = city.getObjectByName("LoD2 prism ink lines") as LineSegments;
      const axes = city.getObjectByName("LoD2 facade axes") as LineSegments;

      setIsoNightPresentation(city, true, true);
      const litEmissive = (
        bodies.material as MeshStandardMaterial
      ).emissive.getHex();
      const litInk = (
        ink.material as { color: { getHex(): number } }
      ).color.getHex();
      const litAxisOpacity = (axes.material as { opacity: number }).opacity;

      setIsoNightPresentation(city, true, false);
      expect((bodies.material as MeshStandardMaterial).emissive.getHex()).toBe(
        litEmissive,
      );
      expect(
        (ink.material as { color: { getHex(): number } }).color.getHex(),
      ).toBe(litInk);
      expect((axes.material as { opacity: number }).opacity).toBe(
        litAxisOpacity,
      );

      setIsoNightPresentation(city, false);
    });

    test("round-trips losslessly through day \u2192 night-on \u2192 night-off \u2192 night-on \u2192 day", () => {
      const bodies = city.getObjectByName("LoD2 prism buildings") as Mesh;
      const glass = city.getObjectByName("LoD2 glass prisms") as Mesh;
      const dayBodiesMaterial = bodies.material;
      const dayGlassMaterial = glass.material;

      setIsoNightPresentation(city, true, true);
      const litBodiesMaterial = bodies.material;
      const litGlassMaterial = glass.material;

      setIsoNightPresentation(city, true, false);
      // Material identity is unaffected by the lights toggle — only colour
      // fields on the same night material change.
      expect(bodies.material).toBe(litBodiesMaterial);
      expect(glass.material).toBe(litGlassMaterial);

      setIsoNightPresentation(city, true, true);
      expect(bodies.material).toBe(litBodiesMaterial);
      expect(glass.material).toBe(litGlassMaterial);

      setIsoNightPresentation(city, false);
      expect(bodies.material).toBe(dayBodiesMaterial);
      expect(glass.material).toBe(dayGlassMaterial);
    });
  });

  test("the station's low slabs are suppressed (by footprint, not id) but stay in the payload", async () => {
    // v0.56.1: the Hauptbahnhof's own low LoD2 slabs are no longer
    // suppressed via a hand-picked PRISM_SUPPRESSED_IDS entry per part
    // -- a beige part-prism the old list never picked up (the user's
    // screenshot complaint) proved a fixed id list silently misses new
    // or re-tiled parts. isHauptbahnhofFootprintSuppressed replaces that
    // with a geometric footprint-overlap test against the model's own
    // hall+bridge envelope, so any of the station's low slabs -- known
    // ids or not -- are still suppressed, while staying present in the
    // raw payload (only the drawn-city loop skips them at render time).
    const { PRISM_SUPPRESSED_IDS, isHauptbahnhofFootprintSuppressed } =
      await import("../src/IsometricCityWorld");
    for (const id of ["K0002KiE", "YK0000Cm", "q7Axk9GG"]) {
      const building = payload.buildings.find((b) => b.id === id);
      expect(building).toBeDefined();
      expect(isHauptbahnhofFootprintSuppressed(building!)).toBe(true);
      expect(PRISM_GLASSED_IDS.has(id)).toBe(false);
    }
    // No suppressed or glassed id overlaps the other set.
    for (const id of PRISM_GLASSED_IDS) {
      expect(PRISM_SUPPRESSED_IDS.has(id)).toBe(false);
    }
  });

  test("every Hauptbahnhof-envelope LoD2 slab is suppressed by footprint overlap, none of them beige boxes", async () => {
    // Regression guard for the user's exact screenshot complaint: a large
    // opaque flat-roof box was still rendering over/beside the glass
    // hall because its id was never added to the old suppress list. This
    // walks the WHOLE real payload (not just three known ids) and
    // asserts that every building whose footprint overlaps the station
    // envelope is either suppressed or explicitly glassed -- so no
    // opaque leftover can ever again slip through undetected.
    const { isHauptbahnhofFootprintSuppressed } =
      await import("../src/IsometricCityWorld");
    let suppressedCount = 0;
    for (const building of payload.buildings) {
      if (PRISM_GLASSED_IDS.has(building.id)) {
        continue;
      }
      if (isHauptbahnhofFootprintSuppressed(building)) {
        suppressedCount += 1;
      }
    }
    // The known culprit from the reference screenshot must be caught.
    const knownCulprit = payload.buildings.find((b) => b.id === "rg8J0PRu");
    expect(knownCulprit).toBeDefined();
    expect(isHauptbahnhofFootprintSuppressed(knownCulprit!)).toBe(true);
    expect(suppressedCount).toBeGreaterThan(15);
  });

  test("the Friedrichstraße twin shed replaces its source shell without swallowing the Tränenpalast", async () => {
    const {
      PRISM_SUPPRESSED_IDS,
      isFriedrichstrasseStationFootprintSuppressed,
    } = await import("../src/IsometricCityWorld");
    for (const id of ["pY0000Jk", "cfqGVYyI"]) {
      const stationShell = payload.buildings.find(
        (building) => building.id === id,
      );
      expect(stationShell).toBeDefined();
      expect(isFriedrichstrasseStationFootprintSuppressed(stationShell!)).toBe(
        true,
      );
    }
    const tearPalace = payload.buildings.find(
      (building) => building.id === "U4ubriIq",
    );
    expect(tearPalace).toBeDefined();
    expect(isFriedrichstrasseStationFootprintSuppressed(tearPalace!)).toBe(
      false,
    );
    expect(PRISM_SUPPRESSED_IDS.has(tearPalace!.id)).toBe(true);
    for (const id of ["oIIado5x", "wkZPVUnx"]) {
      const officeBeyondEastGable = payload.buildings.find(
        (building) => building.id === id,
      );
      expect(officeBeyondEastGable).toBeDefined();
      expect(
        isFriedrichstrasseStationFootprintSuppressed(officeBeyondEastGable!),
      ).toBe(false);
    }
  });

  test("the interim-office former-site prism is suppressed by OSM-footprint overlap, not id", async () => {
    const { isInterimOfficeFootprintSuppressed } =
      await import("../src/IsometricCityWorld");
    const formerSite = payload.buildings.find(
      (building) => building.id === "fNQrO6eN",
    );
    const nearbyButSeparate = payload.buildings.find(
      (building) => building.id === "K0002TYI",
    );
    expect(formerSite).toBeDefined();
    expect(nearbyButSeparate).toBeDefined();
    expect(isInterimOfficeFootprintSuppressed(formerSite!)).toBe(true);
    // The adjacent building only brushes the conservative envelope and must
    // remain in the city; this pins a geometric overlap threshold, not a
    // blanket rectangular deletion around the Amtssitz.
    expect(isInterimOfficeFootprintSuppressed(nearbyButSeparate!)).toBe(false);
  });

  test("does not invent entrance or window panes without source points", () => {
    // The LoD2 payload carries shells, heights and roof forms, but no exact
    // entrance/window coordinates. A former heuristic placed 9,837 doors at
    // the centre of each longest wall; source-faithful prisms add none.
    expect(city.getObjectByName("LoD2 prism windows")).toBeUndefined();
    expect(city.getObjectByName("LoD2 prism window bars")).toBeUndefined();
  });

  test("ordinary blocks are articulated by drawn axes, not invented panes", () => {
    // The facade rhythm instead comes from the drawn axis/band grid.
    const axes = city.getObjectByName("LoD2 facade axes") as LineSegments;
    expect(axes.geometry.getAttribute("position").count).toBeGreaterThan(
      20_000,
    );
  });

  test("adds place-specific facade detail only to source-facing public fronts", () => {
    expect(PLAZA_FACADE_DETAIL_ZONES.map(({ name }) => name)).toEqual([
      "Pariser Platz",
      "Leipziger Platz",
      "Potsdamer Platz",
      "Tilla-Durieux-Park",
      "Breitscheidplatz",
      "Platz der Republik",
      "Europaplatz",
      "Washingtonplatz",
      "Hauptbahnhof-Umfeld",
    ]);
    for (const zone of PLAZA_FACADE_DETAIL_ZONES) {
      const distance = (zone.minimumDistanceM + zone.radiusM) / 2;
      let offsetX = 0;
      let offsetZ = 1;
      if (zone.anchorLineWorldM) {
        const [[startX, startZ], [endX, endZ]] = zone.anchorLineWorldM;
        const axisLength = Math.hypot(endX - startX, endZ - startZ);
        offsetX = -(endZ - startZ) / axisLength;
        offsetZ = (endX - startX) / axisLength;
      }
      const midpointX = zone.centreWorldM[0] + offsetX * distance;
      const midpointZ = zone.centreWorldM[1] + offsetZ * distance;
      const dirX = offsetZ;
      const dirZ = -offsetX;
      const facingWall: PrismWall = {
        dirX,
        dirZ,
        index: 0,
        isCourtyard: false,
        length: 20,
        nx: -offsetX,
        nz: -offsetZ,
        x1: midpointX - dirX * 10,
        z1: midpointZ - dirZ * 10,
      };
      expect(plazaFacadeDetailZoneForWall(facingWall)?.name).toBe(zone.name);
      expect(
        plazaFacadeDetailZoneForWall({
          ...facingWall,
          nx: -facingWall.nx,
          nz: -facingWall.nz,
        }),
      ).toBeNull();
      expect(
        plazaFacadeDetailZoneForWall({ ...facingWall, isCourtyard: true }),
      ).toBeNull();
      expect(zone.facadeRhythm.bayPitch).toBe(ISO_WINDOW_BAY_PITCH_M);
      expect(zone.facadeRhythm.floorPitch).toBeGreaterThanOrEqual(3.2);
      expect(zone.facadeRhythm.maximumDetailedStoreys).toBeLessThanOrEqual(18);
    }
    const axes = city.getObjectByName("LoD2 facade axes") as LineSegments;
    expect(axes.userData.plazaFacadeDetails.zones).toEqual(
      PLAZA_FACADE_DETAIL_ZONES,
    );
    for (const zone of PLAZA_FACADE_DETAIL_ZONES) {
      expect(
        axes.userData.plazaFacadeDetails.detailedWallCounts[zone.name],
      ).toBeGreaterThan(0);
    }
    const detailedWallCounts =
      axes.userData.plazaFacadeDetails.detailedWallCounts;
    expect(detailedWallCounts["Pariser Platz"]).toBeGreaterThan(100);
    expect(detailedWallCounts["Leipziger Platz"]).toBeGreaterThan(200);
    expect(detailedWallCounts["Potsdamer Platz"]).toBeGreaterThan(300);
    expect(detailedWallCounts["Tilla-Durieux-Park"]).toBeGreaterThan(200);
    expect(
      detailedWallCounts.Europaplatz +
        detailedWallCounts.Washingtonplatz +
        detailedWallCounts["Hauptbahnhof-Umfeld"],
    ).toBeGreaterThan(110);
    expect(axes.userData.plazaFacadeDetails.heroFacadesExcluded).toBe(true);
    expect(axes.userData.plazaFacadeDetails.extraRenderables).toBe(0);
    expect(PRISM_SUPPRESSED_IDS.has("25999445")).toBe(true);
  });

  test("keeps the richer place facades inside a sub-96 KiB buffer delta", () => {
    const axes = city.getObjectByName("LoD2 facade axes") as LineSegments;
    const position = axes.geometry.getAttribute("position");
    const lineDistance = axes.geometry.getAttribute("lineDistance");
    const attributeBytes =
      position.array.byteLength + lineDistance.array.byteLength;
    expect(axes.userData.plazaFacadeDetails.attributeBytes).toBe(
      attributeBytes,
    );
    expect(attributeBytes - FACADE_AXIS_V07231_ATTRIBUTE_BYTES).toBeLessThanOrEqual(
      PLACE_DETAIL_ATTRIBUTE_DELTA_BUDGET_BYTES,
    );
  });

  test("transparent glass buildings carry drawn curtain-wall mullions", () => {
    const mullions = city.getObjectByName("LoD2 glass mullions");
    expect(mullions).toBeInstanceOf(LineSegments);
    const positions = (mullions as LineSegments).geometry.getAttribute(
      "position",
    );
    expect(positions.count).toBeGreaterThan(1000);
  });

  test("the ground grid draws kerb ink where roads meet lawns and plazas", async () => {
    const voxelPayload =
      (await import("../public/mesh/regierungsviertel/minecraft-voxels.json")) as {
        default: unknown;
      };
    const grounded = createIsometricCity(
      payload,
      voxelPayload.default as never,
      null,
    );
    const kerbs = grounded.getObjectByName("drawn kerb lines");
    expect(kerbs).toBeInstanceOf(LineSegments);
    const positions = (kerbs as LineSegments).geometry.getAttribute("position");
    expect(positions.count).toBeGreaterThan(2000);
  });

  test("the Tiergartentunnel stays below the isometric surface between its mouths", async () => {
    const voxelPayload =
      (await import("../public/mesh/regierungsviertel/minecraft-voxels.json")) as {
        default: unknown;
      };
    const points: [number, number, number][] = [
      [-115, -8.5, -280],
      [-111, -8.5, -14],
      [-113, -8.5, 336],
    ];
    const traced = createIsometricCity(
      payload,
      voxelPayload.default as never,
      points,
    );
    // The surface city never owns a tunnel trace, mouth or ramp. The 39
    // sampled buried middle positions of the historic contract therefore
    // resolve to 0/39 visible surface objects; TunnelPortals.ts alone owns
    // the two daylight troughs.
    expect(
      traced.getObjectByName("Tiergartentunnel underground trace"),
    ).toBeUndefined();
    expect(traced.getObjectByName("Tiergartentunnel portals")).toBeUndefined();
    expect(traced.getObjectByName("tunnel portal ramps")).toBeUndefined();
    expect(traced.getObjectByName("tunnel portal ink lines")).toBeUndefined();
  });
});

describe("west Tiergarten extrapolation and the recessed Spree", () => {
  test("the day park palette stays quiet, bright and closely spaced", () => {
    const channels = ISO_GROUND_SHADES.grass.map((tone) => [
      (tone >> 16) & 0xff,
      (tone >> 8) & 0xff,
      tone & 0xff,
    ]);
    for (let channel = 0; channel < 3; channel += 1) {
      const values = channels.map((rgb) => rgb[channel]);
      expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(2);
    }
    for (const [red, green, blue] of channels) {
      expect(green).toBeGreaterThan(red);
      expect(green).toBeGreaterThan(blue);
      expect((red + green + blue) / 3).toBeGreaterThan(170);
    }
  });

  test("the paper margin rings the surveyed hull without inventing content", async () => {
    const { createExtrapolatedMargin } =
      await import("../src/IsometricCityWorld");
    const { extrapolatedEnvelopeBounds } = await import("../src/worldEnvelope");
    const margin = createExtrapolatedMargin();
    expect(margin.userData.extrapolated).toBe(true);
    expect(margin.userData.visibleRadiusM).toBe(VISIBLE_RADIUS_M);
    const envelope = extrapolatedEnvelopeBounds();
    const bounds = new Box3().setFromObject(margin);
    expect(bounds.min.x).toBeLessThanOrEqual(envelope.minX);
    expect(bounds.max.x).toBeGreaterThanOrEqual(envelope.maxX);
    expect(bounds.min.z).toBeLessThanOrEqual(envelope.minZ);
    expect(bounds.max.z).toBeGreaterThanOrEqual(envelope.maxZ);
    // Flat paper only: quiet tone plates, nothing standing.
    expect(bounds.max.y).toBeLessThan(6);
    // Since task-09 the real Tiergarten is surveyed, so the generated trees
    // and lamps that used to fill the west are gone for good.
    expect(margin.getObjectByName("extrapolated tree trunks")).toBeUndefined();
    expect(margin.getObjectByName("extrapolated lamp poles")).toBeUndefined();
    // NO cartographic ruling. The v0.40.0 140 m hairline grid read as a
    // black square lattice around the whole model at every zoom and was
    // removed on the owner's instruction; it must not come back.
    expect(
      margin.getObjectByName("extrapolated margin field grid"),
    ).toBeUndefined();
    const body = margin.getObjectByName("extrapolated margin ground") as Mesh;
    expect(body.material).toBeInstanceOf(MeshBasicMaterial);
  });

  test("the Siegessäule model carries the full 67 m column", async () => {
    const { PRISM_SUPPRESSED_IDS, createSiegessaeule } =
      await import("../src/IsometricCityWorld");
    const { AXIS_TO } = await import("../src/worldEnvelope");
    const column = createSiegessaeule();
    expect(column.userData.recognitionModel).toBe(true);
    const bounds = new Box3().setFromObject(column);
    // The column with Viktoria tops out around 67 m over the park.
    expect(bounds.max.y).toBeGreaterThan(60);
    expect(bounds.max.y).toBeLessThan(85);
    // It sits on the surveyed Großer Stern, not on an invented apron.
    expect(bounds.min.x).toBeGreaterThan(AXIS_TO[0] - 130);
    expect(bounds.max.x).toBeLessThan(AXIS_TO[0] + 130);
    // LoD2 stops at the 25 m socle; its three prisms must be suppressed so
    // they cannot stand inside the modelled shaft.
    for (const id of ["3wUufHpn", "iHbVUwP0", "xzlowEa3"]) {
      expect(PRISM_SUPPRESSED_IDS.has(id)).toBe(true);
    }
  });

  test("Bismarck is a jointed figure with corner groups, not plain cubes", async () => {
    // v0.58.0: the Bismarck-Nationaldenkmal used to be three stacked
    // cuboids (pedestal, "torso" block, "head" block) plus four plain
    // cubes at the corners. Verify the figure now has a distinct
    // coat/waist section, shoulder section, and head, each a different
    // size, and that the corner groups carry a separate plinth, torso,
    // and head instead of one block.
    // https://de.wikipedia.org/wiki/Bismarck-Nationaldenkmal_(Berlin)
    const { createSiegessaeule } = await import("../src/IsometricCityWorld");
    const { AXIS_TO } = await import("../src/worldEnvelope");
    const column = createSiegessaeule();
    const bodies = column.getObjectByName(
      "Siegessäule and Bismarck bodies",
    ) as Mesh;
    const position = bodies.geometry.getAttribute("position");
    const vertex = new Vector3();
    const BX = AXIS_TO[0] + 24;
    const BZ = AXIS_TO[1] - 118;
    const figureYValues = new Set<number>();
    let swordFound = false;
    for (let index = 0; index < position.count; index += 1) {
      vertex.fromBufferAttribute(position, index);
      if (
        Math.abs(vertex.x - BX) < 2 &&
        Math.abs(vertex.z - BZ) < 2 &&
        vertex.y > 10
      ) {
        figureYValues.add(Math.round(vertex.y * 10) / 10);
      }
      // The Reichsschwert sits off-centre from the column's own axis.
      if (
        Math.abs(vertex.x - (BX + 1.5)) < 0.3 &&
        Math.abs(vertex.z - (BZ + 0.6)) < 0.3 &&
        vertex.y > 10
      ) {
        swordFound = true;
      }
    }
    // Coat, shoulders, and head are three distinct elevations.
    expect(figureYValues.size).toBeGreaterThanOrEqual(3);
    expect(swordFound).toBe(true);
    // Each corner group now has plinth + torso + head vertices at three
    // distinct heights above the pedestal instead of two flat cubes.
    for (const cornerX of [-1, 1]) {
      for (const cornerZ of [-1, 1]) {
        const cx = BX + cornerX * 8.2;
        const cz = BZ + cornerZ * 8.2;
        const cornerYValues = new Set<number>();
        for (let index = 0; index < position.count; index += 1) {
          vertex.fromBufferAttribute(position, index);
          if (
            Math.abs(vertex.x - cx) < 2 &&
            Math.abs(vertex.z - cz) < 2 &&
            vertex.y > 2
          ) {
            cornerYValues.add(Math.round(vertex.y * 10) / 10);
          }
        }
        expect(cornerYValues.size).toBeGreaterThanOrEqual(3);
      }
    }
  });

  test(
    "quay walls drop from the banks wherever land meets water",
    async () => {
      const voxelPayload =
        (await import("../public/mesh/regierungsviertel/minecraft-voxels.json")) as {
          default: unknown;
        };
      const city = createIsometricCity(
        payload,
        voxelPayload.default as never,
        null,
      );
      const quays = city.getObjectByName("drawn quay walls") as Mesh;
      expect(quays).toBeInstanceOf(Mesh);
      // Thousands of embankment triangles along Spree + Humboldthafen.
      expect(quays.geometry.getAttribute("position").count).toBeGreaterThan(
        3000,
      );
    },
    TASK_13_FULL_CITY_TIMEOUT_MS,
  );

  test("the Reichstag wears its pinned stately window rhythm", async () => {
    const { HERO_WINDOW_FORMATS } = await import("../src/IsometricCityWorld");
    const format = HERO_WINDOW_FORMATS.K0002MCN;
    expect(format.height).toBeGreaterThan(4);
    expect(format.sillStart).toBeGreaterThan(4);
    // Tall base + stately pitch → exactly 3 rows on the 28 m body.
    const grid = windowGrid(30, 28.1, format);
    expect(grid).not.toBeNull();
    expect(grid!.floors).toBe(3);
  });

  test("uses the renovated Charite tower rhythm and its LoD2 glass bridge", () => {
    expect(CHARITE_BETTENHOCHHAUS_IDS.size).toBe(16);
    expect(CHARITE_BETTENHOCHHAUS_PROFILE).toMatchObject({
      basePanelPitchM: 4.2,
      baseStoreys: 4,
      facadeElementHeightM: 1.8,
      footprintM: [78, 36],
      publishedHeightM: 82,
      storeys: 21,
      upperPanelPitchM: 3.3,
    });
    for (const id of CHARITE_BETTENHOCHHAUS_IDS) {
      const building = payload.buildings.find(
        (candidate) => candidate.id === id,
      );
      expect(building).toBeDefined();
      expect(building!.h_dm / 10).toBeGreaterThan(79);
      const format = windowFormatForBuilding(id, true);
      expect(format.bayPitch).toBeCloseTo(3.3, 5);
      expect(format.floorPitch).toBeCloseTo(3.7, 5);
      expect(format.height).toBeCloseTo(1.8, 5);
    }
    const windows = city.getObjectByName(
      "Charite aluminium facade window panes",
    ) as InstancedMesh;
    const litWindows = city.getObjectByName(
      "Charite lit facade window panes",
    ) as InstancedMesh;
    expect(windows).toBeInstanceOf(InstancedMesh);
    expect(windows.count).toBeGreaterThan(2_000);
    expect(windows.userData.architecturalProfile).toBe(
      CHARITE_BETTENHOCHHAUS_PROFILE,
    );
    expect(litWindows).toBeInstanceOf(InstancedMesh);
    expect(litWindows.visible).toBe(false);
    const presentation = new Group();
    const presentationWindows = windows.clone();
    const presentationLights = litWindows.clone();
    presentation.add(presentationWindows, presentationLights);
    const dayMaterial = presentationWindows.userData.dayMaterial;
    setIsoNightPresentation(presentation, true, true);
    expect(presentationWindows.material).toBe(
      presentationWindows.userData.nightMaterial,
    );
    expect(presentationLights.visible).toBe(true);
    setIsoNightPresentation(presentation, false, true);
    expect(presentationWindows.material).toBe(dayMaterial);
    expect(presentationLights.visible).toBe(false);
    expect(PRISM_GLASSED_IDS.has(CHARITE_CAMPUS_BRIDGE_ID)).toBe(true);
    const bridge = payload.buildings.find(
      (candidate) => candidate.id === CHARITE_CAMPUS_BRIDGE_ID,
    );
    expect(bridge).toBeDefined();
    expect(bridge!.h_dm / 10).toBeGreaterThan(8);
    expect(bridge!.h_dm / 10).toBeLessThan(10);
  });
});

describe("source-faithful facade topology", () => {
  const courtyardBuilding = {
    class: 0,
    h_dm: 120,
    holes: [
      [
        [20, 20],
        [80, 20],
        [80, 80],
        [20, 80],
      ],
    ],
    id: "courtyard-fixture",
    ring: [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ],
    roof: 1000,
    tone: [220, 214, 198] as [number, number, number],
    y0_dm: 0,
  };

  test("includes exact courtyard walls with normals into the void", () => {
    const walls = facadeWallsOf(courtyardBuilding);
    const outer = walls.filter((wall) => !wall.isCourtyard);
    const courtyard = walls.filter((wall) => wall.isCourtyard);
    expect(outer).toHaveLength(4);
    expect(courtyard).toHaveLength(4);
    expect(walls.reduce((sum, wall) => sum + wall.length, 0)).toBeCloseTo(
      64,
      6,
    );
    for (const wall of outer) {
      const mx = wall.x1 + (wall.dirX * wall.length) / 2;
      const mz = wall.z1 + (wall.dirZ * wall.length) / 2;
      expect(wall.nx * (mx - 5) + wall.nz * (mz - 5)).toBeGreaterThan(0);
    }
    for (const wall of courtyard) {
      const mx = wall.x1 + (wall.dirX * wall.length) / 2;
      const mz = wall.z1 + (wall.dirZ * wall.length) / 2;
      expect(wall.nx * (5 - mx) + wall.nz * (5 - mz)).toBeGreaterThan(0);
    }
    expect(facadeWallsOf(courtyardBuilding)).toEqual(walls);
  });

  test("courtyard rings add detail to the existing batched facade layer", () => {
    const withCourtyard: PrismPayload = {
      buildings: [courtyardBuilding],
      classes: ["concrete"],
      schema_version: 1,
    };
    const withoutCourtyard: PrismPayload = {
      ...withCourtyard,
      buildings: [{ ...courtyardBuilding, holes: undefined }],
    };
    const withAxes = createIsometricCity(withCourtyard, null).getObjectByName(
      "LoD2 facade axes",
    ) as LineSegments;
    const withoutAxes = createIsometricCity(
      withoutCourtyard,
      null,
    ).getObjectByName("LoD2 facade axes") as LineSegments;
    expect(withAxes).toBeInstanceOf(LineSegments);
    expect(withAxes.geometry.getAttribute("position").count).toBeGreaterThan(
      withoutAxes.geometry.getAttribute("position").count,
    );
  });
});

describe("procedural pitched roofs from ALKIS codes", () => {
  // A 20 m × 10 m rectangle rotated 30° — fitRectangle must recover it.
  const angle = Math.PI / 6;
  const rotated: Array<[number, number]> = (
    [
      [-10, -5],
      [10, -5],
      [10, 5],
      [-10, 5],
    ] as Array<[number, number]>
  ).map(([x, z]) => [
    x * Math.cos(angle) - z * Math.sin(angle) + 100,
    x * Math.sin(angle) + z * Math.cos(angle) + 200,
  ]);

  test("fitRectangle recovers an oriented rectangle exactly", () => {
    const rect = fitRectangle(rotated);
    expect(rect).not.toBeNull();
    expect(rect!.halfLength).toBeCloseTo(10, 4);
    expect(rect!.halfWidth).toBeCloseTo(5, 4);
    expect(rect!.center[0]).toBeCloseTo(100, 4);
    expect(rect!.center[1]).toBeCloseTo(200, 4);
    expect(rect!.rectangularity).toBeCloseTo(1, 4);
    // A perfect rectangle sails past the roofing threshold.
    expect(rect!.rectangularity).toBeGreaterThanOrEqual(
      ROOF_MIN_RECTANGULARITY,
    );
  });

  test("official gable, hip, shed and tent codes produce bounded facets", () => {
    const rect = fitRectangle(rotated)!;
    for (const code of [ROOF_GABLED, ROOF_HIPPED, ROOF_SHED, ROOF_TENT]) {
      const triangles = buildRoofGeometry(rect, 10, 13, code);
      expect(triangles).not.toBeNull();
      expect(triangles!.length % 9).toBe(0);
      // Every vertex lies between eave and ridge.
      for (let i = 1; i < triangles!.length; i += 3) {
        expect(triangles![i]).toBeGreaterThanOrEqual(10);
        expect(triangles![i]).toBeLessThanOrEqual(13);
      }
      // The ridge is actually reached.
      let ridgeHit = false;
      for (let i = 1; i < triangles!.length; i += 3) {
        if (triangles![i] === 13) ridgeHit = true;
      }
      expect(ridgeHit).toBe(true);
    }
    const tent = buildRoofGeometry(rect, 10, 13, ROOF_TENT)!;
    const tentApexes = new Set<string>();
    for (let index = 0; index < tent.length; index += 3) {
      if (tent[index + 1] === 13) {
        tentApexes.add(
          `${tent[index].toFixed(4)},${tent[index + 2].toFixed(4)}`,
        );
      }
    }
    expect(tentApexes).toEqual(
      new Set([`${rect.center[0].toFixed(4)},${rect.center[1].toFixed(4)}`]),
    );
    // Flat (1000), unknown (9999) and dome (5000) codes keep the flat cap.
    expect(buildRoofGeometry(rect, 10, 13, 1000)).toBeNull();
    expect(buildRoofGeometry(rect, 10, 13, 9999)).toBeNull();
    expect(buildRoofGeometry(rect, 10, 13, 5000)).toBeNull();
  });

  test("roofRise stays plausible and yields to squat buildings", () => {
    const rect = fitRectangle(rotated)!;
    // 10 m wide → 3 m rise, within [1.2, 5].
    expect(roofRise(rect, 20)).toBeCloseTo(3, 4);
    // A building barely taller than the rise keeps its flat cap.
    expect(roofRise(rect, 4)).toBe(0);
  });

  test("hundreds of surveyed pitched-roof buildings actually get roofs", () => {
    const codes = new Set([ROOF_GABLED, ROOF_HIPPED, ROOF_SHED, ROOF_TENT]);
    let roofed = 0;
    let tentRoofed = 0;
    for (const building of payload.buildings) {
      if (!codes.has(building.roof ?? 0)) continue;
      const ring = building.ring.map(
        ([x, z]) => [x / 10, z / 10] as [number, number],
      );
      const rect = fitRectangle(ring);
      if (!rect || rect.rectangularity < ROOF_MIN_RECTANGULARITY) continue;
      if (roofRise(rect, Math.max(2.5, building.h_dm / 10)) > 0) {
        roofed += 1;
        if (building.roof === ROOF_TENT) tentRoofed += 1;
      }
    }
    expect(roofed).toBeGreaterThan(5_200);
    expect(tentRoofed).toBeGreaterThan(10);
  });
});

describe("real-colour facade tones", () => {
  test("pins Scharoun's measured Kulturforum envelopes to gold", async () => {
    const { isScharounGoldPrism, SCHAROUN_ROOF_SEAM_IDS } =
      await import("../src/IsometricCityWorld");
    const at = (x: number, z: number) => ({
      ring: [
        [(x - 1) * 10, (z - 1) * 10],
        [(x + 1) * 10, (z - 1) * 10],
        [x * 10, (z + 2) * 10],
      ] as [number, number][],
    });
    expect(isScharounGoldPrism(at(-139.9, 988.2))).toBe(true);
    expect(isScharounGoldPrism(at(-190, 1056.8))).toBe(true);
    expect(isScharounGoldPrism(at(-86.9, 1304.2))).toBe(true);
    expect(isScharounGoldPrism(at(300, 1100))).toBe(false);
    expect([...SCHAROUN_ROOF_SEAM_IDS]).toEqual(["XzEkeXsu", "aJ0e8oAr"]);
  });

  test("cleanedTone keeps grey grey and clamps lightness to paint bands", async () => {
    const { cleanedTone, HERO_PRISM_TONES } =
      await import("../src/IsometricCityWorld");
    // A dark grey sample stays a readable dark grey (never black, never warm).
    const grey = cleanedTone([92, 90, 86]);
    expect(grey.r).toBeGreaterThan(0.2);
    expect(Math.abs(grey.r - grey.b)).toBeLessThan(0.06);
    // A blown-out white sample is capped below pure white. v0.39.0 raised the
    // ceiling from 8/9 to 14/15 ("alle Flächen sind noch zu grau"), so bright
    // masonry reaches warm white — it still may not clip.
    const bright = cleanedTone([250, 250, 250]);
    expect(bright.r).toBeLessThan(1);
    expect(bright.r).toBeGreaterThan(0.9);
    // Every facade now lands in the bright paint band, floor included: the
    // darkest possible sample must not fall back into the mid register.
    expect(cleanedTone([18, 18, 20]).r).toBeGreaterThan(0.72);
    // The Reichstag pin is pale neutral limestone, never yellow or muddy.
    const reichstag = HERO_PRISM_TONES.K0002MCN;
    const r = (reichstag >> 16) & 255;
    const b = reichstag & 255;
    expect(r - b).toBeLessThan(40);
    expect(r).toBeGreaterThanOrEqual(215);
    expect(r).toBeLessThanOrEqual(235);
  });

  test("keeps a bright but materially distinct day palette", () => {
    expect(SOURCE_FACADE_IVORY_BLEND).toBeLessThanOrEqual(0.4);
    expect(ISO_FACADE_AXIS_OPACITY).toBeLessThan(ISO_GLASS_MULLION_OPACITY);
    expect(ISO_GLASS_MULLION_OPACITY).toBeLessThan(ISO_GLASS_DAY_OPACITY);

    const channels = (hex: number) => [
      (hex >> 16) & 255,
      (hex >> 8) & 255,
      hex & 255,
    ];
    const [grassRed, grassGreen] = channels(ISO_GROUND_SHADES.grass[0]);
    const [waterRed, , waterBlue] = channels(ISO_GROUND_SHADES.water[0]);
    const [plazaRed, , plazaBlue] = channels(ISO_GROUND_SHADES.plazaBrick[0]);
    expect(grassGreen - grassRed).toBeGreaterThan(18);
    expect(waterBlue - waterRed).toBeGreaterThan(35);
    expect(plazaRed - plazaBlue).toBeGreaterThan(30);

    const glass = city.getObjectByName("LoD2 glass prisms") as Mesh;
    const mullions = city.getObjectByName(
      "LoD2 glass mullions",
    ) as LineSegments;
    const axes = city.getObjectByName("LoD2 facade axes") as LineSegments;
    expect((glass.material as MeshBasicMaterial).opacity).toBe(
      ISO_GLASS_DAY_OPACITY,
    );
    expect((mullions.material as LineBasicMaterial).opacity).toBe(
      ISO_GLASS_MULLION_OPACITY,
    );
    expect((axes.material as LineBasicMaterial).opacity).toBe(
      ISO_FACADE_AXIS_OPACITY,
    );
  });
});

describe("hero prism pins", () => {
  test("anchors the Adlon and embassy palettes to their LoD2 parts", () => {
    expect(ADLON_LOD2_ID).toBe("K00006ot");
    expect(ADLON_WORLD).toEqual([591.135, 316.75]);
    expect(HERO_PRISM_TONES[ADLON_LOD2_ID]).toBe(0xeee5d4);
    expect(HERO_PRISM_ROOF_TONES[ADLON_LOD2_ID]).toBe(0x668574);
    expect(HERO_PRISM_TONES["9qerwgls"]).toBe(0xe4ddcf);
    expect(HERO_PRISM_TONES.Vkos5eqV).toBe(0xd9cfbd);
    expect(HERO_PRISM_TONES.dVaNVYh5).toBe(0xd8d0b7);

    const adlon = createHotelAdlon();
    expect(adlon.userData.extrapolated).toBe(false);
    expect(adlon.userData.lod2BuildingId).toBe(ADLON_LOD2_ID);
    expect(adlon.getObjectByName("Adlon bodies")).toBeInstanceOf(Mesh);
    expect(adlon.getObjectByName("Adlon ink lines")).toBeInstanceOf(
      LineSegments,
    );
  });

  test("replaces only the Chancellery leadership cube, not its office bands", async () => {
    const { CHANCELLERY_CENTRAL_PRISM_IDS, PRISM_SUPPRESSED_IDS } =
      await import("../src/IsometricCityWorld");

    expect(CHANCELLERY_CENTRAL_PRISM_IDS.size).toBe(13);
    for (const id of CHANCELLERY_CENTRAL_PRISM_IDS) {
      expect(payload.buildings.some((building) => building.id === id)).toBe(
        true,
      );
      expect(PRISM_SUPPRESSED_IDS.has(id)).toBe(true);
    }

    // The 21.8 m LoD2 office bands surrounding the 36 m central cube stay as
    // surveyed geometry and must never disappear with the replacement shell.
    for (const id of ["o2mpm3tp", "EUNWDW97", "qroWLJfL"]) {
      expect(payload.buildings.some((building) => building.id === id)).toBe(
        true,
      );
      expect(PRISM_SUPPRESSED_IDS.has(id)).toBe(false);
    }
  });

  test("the Chancellery is pinned light grey, per the owner's direction", async () => {
    const { HERO_PRISM_TONES } = await import("../src/IsometricCityWorld");
    const chancellery = HERO_PRISM_TONES.MLwG4KW9;
    const r = (chancellery >> 16) & 255;
    const g = (chancellery >> 8) & 255;
    const b = chancellery & 255;
    // Light (luma high) and neutral (channels close together).
    expect((r + g + b) / 3).toBeGreaterThan(190);
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(12);
  });

  test("treats all 16 Kollhoff parts as one red ceramic LoD2 tower", async () => {
    const { HERO_PRISM_TONES, HERO_WINDOW_FORMATS } =
      await import("../src/IsometricCityWorld");
    expect(KOLLHOFF_TOWER_PRISM_IDS.size).toBe(16);
    expect(KOLLHOFF_TOWER_PROFILE.sourceBuildingIds).toHaveLength(16);
    let maxHeight = 0;
    for (const id of KOLLHOFF_TOWER_PRISM_IDS) {
      const building = payload.buildings.find(
        (candidate) => candidate.id === id,
      );
      expect(building).toBeDefined();
      maxHeight = Math.max(maxHeight, building!.h_dm / 10);
      const tone = HERO_PRISM_TONES[id];
      const red = (tone >> 16) & 255;
      const green = (tone >> 8) & 255;
      const blue = tone & 255;
      expect(red).toBeGreaterThan(green);
      expect(green).toBeGreaterThan(blue);
      expect(HERO_WINDOW_FORMATS[id].floorPitch).toBeCloseTo(103 / 25, 6);
    }
    // The compact web payload stores decimetres (101.4 m); the GeoPackage
    // profile retains the source value at centimetre precision (101.44 m).
    expect(maxHeight).toBeCloseTo(KOLLHOFF_TOWER_PROFILE.lod2MaxHeightM, 1);

    const joints = city.getObjectByName("Kollhoff clinker mortar joints");
    expect(joints).toBeInstanceOf(LineSegments);
    expect(
      (joints as LineSegments).geometry.getAttribute("position").count,
    ).toBeGreaterThan(400_000);
    expect(joints!.userData.detailStatus).toContain("exact LoD2");

    const panes = city.getObjectByName("Kollhoff recessed window panes");
    const litPanes = city.getObjectByName("Kollhoff lit window panes");
    expect(panes).toBeInstanceOf(InstancedMesh);
    expect((panes as InstancedMesh).count).toBeGreaterThan(1_000);
    expect(litPanes).toBeInstanceOf(InstancedMesh);
    setIsoNightPresentation(city, true, true);
    expect(litPanes!.visible).toBe(true);
    setIsoNightPresentation(city, false, true);
    expect(litPanes!.visible).toBe(false);

    const target: number[] = [];
    expect(
      appendKollhoffClinkerJoints(
        payload.buildings.find((candidate) => candidate.id === "WtTpo3vD")!,
        target,
      ),
    ).toBeGreaterThan(10_000);
    expect(target.length % 6).toBe(0);
  });
});

describe("prism suppression for full recognition models", () => {
  test("all three Brandenburg Gate prisms are skipped (model carries them)", async () => {
    const { PRISM_SUPPRESSED_IDS, createIsometricCity } =
      await import("../src/IsometricCityWorld");
    const { Matrix4, Mesh, Vector3 } = await import("three");
    const payloadModule =
      await import("../public/mesh/regierungsviertel/lod2-prisms.json");
    const data = payloadModule.default as never as {
      buildings: Array<{ id: string; ring: number[][] }>;
      classes: string[];
      schema_version: number;
    };
    for (const id of ["K0001xqy", "QDYNK7dL", "VpZW4Luf"]) {
      expect(PRISM_SUPPRESSED_IDS.has(id)).toBe(true);
      // Every suppressed source building remains in the payload; only the
      // renderer gives way to the complete metric recognition model.
      expect(data.buildings.some((building) => building.id === id)).toBe(true);
    }
    // …but produces no geometry at the gate anchor above pavilion height.
    const city = createIsometricCity(data as never, null);
    const bodies = city.getObjectByName("LoD2 prism buildings") as InstanceType<
      typeof Mesh
    >;
    const position = bodies.geometry.getAttribute("position");
    const matrix = new Matrix4();
    void matrix;
    const vertex = new Vector3();
    let tallGateVertices = 0;
    for (let index = 0; index < position.count; index += 1) {
      vertex.fromBufferAttribute(position, index);
      if (
        vertex.x > 407 &&
        vertex.x < 429 &&
        vertex.z > 290 &&
        vertex.z < 312 &&
        vertex.y > 18
      ) {
        tallGateVertices += 1;
      }
    }
    expect(tallGateVertices).toBe(0);
  });
});

describe("real bridge structures", () => {
  const createBridgeTestCity = (
    ground: Parameters<typeof createIsometricCity>[1],
  ) => {
    // Each bridge assertion owns a fresh procedural scene; release the prior
    // fixture before allocating the next large BufferGeometry collection.
    Bun.gc(true);
    return createIsometricCity(payload, ground, null, null, {
      buildings: [],
      includeContext: false,
    });
  };

  test("bridges carry an elevated deck on piers that reach the riverbed", async () => {
    const { BRIDGE_MIN_CLUSTER_CELLS } = await import(
      "../src/IsometricCityWorld"
    );
    const voxelPayload =
      (await import("../public/mesh/regierungsviertel/minecraft-voxels.json")) as {
        default: { water_top_y_m: number };
      };
    expect(BRIDGE_MIN_CLUSTER_CELLS).toBeGreaterThan(0);
    const city = createBridgeTestCity(voxelPayload.default as never);
    const bodies = city.getObjectByName("bridge structure bodies") as Mesh;
    expect(bodies).toBeInstanceOf(Mesh);
    const bounds = new Box3().setFromObject(bodies);
    const waterTop = voxelPayload.default.water_top_y_m;
    // Piers stand in the riverbed…
    expect(bounds.min.y).toBeLessThan(waterTop - 1.5);
    // …and the deck with its parapets rides well above the water.
    expect(bounds.max.y).toBeGreaterThan(waterTop + 3);
    // The flat bridge slabs are gone from the ground layer.
    const slabs = city.getObjectByName("Drawn ground slabs") as InstancedMesh;
    expect(slabs).toBeInstanceOf(InstancedMesh);
    expect(city.getObjectByName("bridge structure ink lines")).toBeDefined();
    const group = city.getObjectByName("drawn bridge structures") as Group;
    expect(group.userData.bridgeClusterCount).toBeGreaterThan(50);
    expect(group.userData.smallBridgeClusterCount).toBeGreaterThan(0);
    expect(group.userData.sandkrugStructure).toEqual(
      SANDKRUG_STRUCTURE_PROFILE,
    );
  });

  test(
    "retains narrow one-cell park stegs without widening them into roads",
    async () => {
      const { BRIDGE_MIN_CLUSTER_CELLS } = await import(
        "../src/IsometricCityWorld"
      );
      const ground = (
        await import("../public/mesh/regierungsviertel/minecraft-voxels.json")
      ).default as never;
      expect(BRIDGE_MIN_CLUSTER_CELLS).toBe(1);
      const city = createBridgeTestCity(ground);
      const group = city.getObjectByName("drawn bridge structures") as Group;
      expect(group.userData.smallBridgeClusterCount).toBeGreaterThan(20);
    },
    TASK_13_FULL_CITY_TIMEOUT_MS,
  );

  test(
    "the Gustav-Heinemann-Brücke reaches both banks of the Spree",
    async () => {
      const { BRIDGE_PROFILES } = await import("../src/IsometricCityWorld");
      const voxelPayload =
        (await import("../public/mesh/regierungsviertel/minecraft-voxels.json")) as {
          default: { water_top_y_m: number };
        };
      const profile = BRIDGE_PROFILES.find(
        (entry) => entry.name === "Gustav-Heinemann-Brücke",
      );
      expect(profile?.surveyedDeck?.halfLengthM).toBeGreaterThan(40);
      const city = createBridgeTestCity(voxelPayload.default as never);
      const bodies = city.getObjectByName("bridge structure bodies") as Mesh;
      const position = bodies.geometry.getAttribute("position");
      // The 4 m ground grid only caught 52 m of this narrow footbridge, so the
      // deck used to stop over open water. Measure what is actually drawn in
      // the crossing's own x band rather than trusting the cluster fit.
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (let index = 0; index < position.count; index += 1) {
        if (Math.abs(position.getX(index) - (profile?.world[0] ?? 0)) > 12) {
          continue;
        }
        const z = position.getZ(index);
        if (z < -520 || z > -370) continue;
        minZ = Math.min(minZ, z);
        maxZ = Math.max(maxZ, z);
      }
      expect(maxZ - minZ).toBeGreaterThan(88);
    },
    TASK_13_FULL_CITY_TIMEOUT_MS,
  );

  test(
    "pins the corrected bridges to published dimensions and identities",
    async () => {
      const {
        BRIDGE_PROFILES,
        GUSTAV_HEINEMANN_STRUCTURE_PROFILE,
        GOLDA_PERFORATION_BAYS,
        HUGO_PREUSS_STRUCTURE_PROFILE,
        KRONPRINZEN_SPAN_LAYOUT_M,
        MOLTKE_ARCH_COUNT,
        MOLTKE_BALUSTERS_PER_OPEN_BAY,
        MOLTKE_BALUSTRADE_BAY_COUNT,
        MOLTKE_CANDELABRA_COUNT,
        MOLTKE_CANDELABRA_FIGURE_COUNT,
        MOLTKE_GRIFFIN_COUNT,
        MOLTKE_KEYSTONE_HEAD_COUNT,
        MOLTKE_TROPHY_COUNT,
        PARLIAMENT_BRIDGE_LEVELS,
        usesGenericBridgeDeckOrnament,
      } = await import("../src/IsometricCityWorld");
      const ground = (
        await import("../public/mesh/regierungsviertel/minecraft-voxels.json")
      ).default as never;
      const profile = (name: string) =>
        BRIDGE_PROFILES.find((entry) => entry.name === name)!;

      expect(profile("Golda-Meir-Steg").surveyedDeck).toEqual({
        halfLengthM: 38.43,
        halfWidthM: 2,
      });
      expect(profile("Golda-Meir-Steg").kind).toBe("golda");
      expect(profile("Golda-Meir-Steg").axis).toEqual([0.85749, -0.5145]);
      expect(profile("Golda-Meir-Steg").palette?.structure).toBe(0xf2b600);
      expect(GOLDA_PERFORATION_BAYS).toBe(39);
      expect(profile("Gustav-Heinemann-Brücke").surveyedDeck).toEqual({
        halfLengthM: 43.88,
        halfWidthM: 2,
      });
      expect(profile("Gustav-Heinemann-Brücke").kind).toBe("vierendeel");
      expect(profile("Gustav-Heinemann-Brücke").palette).toMatchObject({
        deck: 0x715b45,
        metal: 0x58776e,
        structure: 0x91aaa1,
      });
      expect(GUSTAV_HEINEMANN_STRUCTURE_PROFILE).toMatchObject({
        bayCount: 20,
        clearPathWidthM: 4,
        inventoryLengthM: 87.76,
        overallWidthM: 5,
        supportOffsetM: 33,
        trussHeightM: 2.25,
      });
      expect(GUSTAV_HEINEMANN_STRUCTURE_PROFILE.sourceUrls).toHaveLength(3);
      expect(profile("Hugo-Preuß-Brücke").surveyedDeck).toEqual({
        halfLengthM: 44.205,
        halfWidthM: 11.78,
      });
      expect(profile("Hugo-Preuß-Brücke").kind).toBe("curvedBox");
      expect(profile("Hugo-Preuß-Brücke").curveSagittaM).toBeCloseTo(-2.98);
      expect(profile("Hugo-Preuß-Brücke").palette).toMatchObject({
        metal: 0x444b4e,
        structure: 0x9ca4a4,
      });
      expect(HUGO_PREUSS_STRUCTURE_PROFILE).toMatchObject({
        fasciaBayCount: 32,
        inventoryLengthM: 88.41,
        inventoryWidthM: 23.56,
        namePlateText: "Hugo-Preuß-Brücke 2004",
        picketCount: 60,
        structuralDepthRangeM: [3.3, 4.1],
      });
      expect(profile("Sandkrugbrücke").surveyedDeck).toEqual({
        halfLengthM: 16.3,
        halfWidthM: 14.4,
      });
      expect(profile("Sandkrugbrücke")).toMatchObject({
        axis: SANDKRUG_OSM_DECK.axis,
        kind: "openFrame",
        world: SANDKRUG_OSM_DECK.centreWorldM,
      });
      expect(profile("Löwenbrücke")).toMatchObject({
        axis: [0.894279, 0.447511],
        kind: "suspension",
        surveyedDeck: { halfLengthM: 9.15, halfWidthM: 0.94 },
        world: [-1766.908, 680.6395],
      });
      expect(profile("Adlerbruecke")).toMatchObject({
        axis: ADLER_BRIDGE_PROFILE.axis,
        kind: "adler",
        surveyedDeck: { halfLengthM: 3.65, halfWidthM: 1.675 },
        world: [-1197.926, 931.565],
      });
      expect(profile("Moltkebrücke").surveyedDeck).toEqual({
        halfLengthM: 38.79,
        halfWidthM: 12.85,
      });
      expect(profile("Moltkebrücke").axis).toEqual([-0.7174, -0.6967]);
      expect(profile("Moltkebrücke").palette?.structure).toBe(0xb86c5a);
      expect(profile("Kronprinzenbrücke")).toMatchObject({
        axis: [0.87895, -0.47692],
        kind: "steelArch",
        surveyedDeck: { halfLengthM: 37.492, halfWidthM: 11.7915 },
        world: [303.519, -323.32],
      });
      expect(KRONPRINZEN_SPAN_LAYOUT_M).toEqual([15.492, 44, 15.492]);
      expect(MOLTKE_ARCH_COUNT).toBe(3);
      expect(MOLTKE_BALUSTRADE_BAY_COUNT).toBe(12);
      expect(MOLTKE_BALUSTERS_PER_OPEN_BAY).toBe(7);
      expect(MOLTKE_CANDELABRA_COUNT).toBe(8);
      expect(MOLTKE_CANDELABRA_FIGURE_COUNT).toBe(24);
      expect(MOLTKE_GRIFFIN_COUNT).toBe(4);
      expect(MOLTKE_KEYSTONE_HEAD_COUNT).toBe(6);
      expect(MOLTKE_TROPHY_COUNT).toBe(4);
      expect(profile("Sprung über die Spree")).toMatchObject({
        axis: [1, 0],
        kind: "parliament",
      });
      expect(PARLIAMENT_BRIDGE_LEVELS).toBe(2);
      expect(profile(WEIDENDAMMER_BRIDGE_PROFILE.name)).toMatchObject({
        axis: [...WEIDENDAMMER_BRIDGE_PROFILE.axis],
        kind: "ironArch",
        surveyedDeck: {
          halfLengthM: WEIDENDAMMER_BRIDGE_PROFILE.inventory.lengthM / 2,
          halfWidthM: WEIDENDAMMER_BRIDGE_PROFILE.inventory.widthM / 2,
        },
        world: [...WEIDENDAMMER_BRIDGE_PROFILE.centreWorldM],
      });
      expect(
        usesGenericBridgeDeckOrnament(
          profile(WEIDENDAMMER_BRIDGE_PROFILE.name),
        ),
      ).toBeFalse();
      expect(
        usesGenericBridgeDeckOrnament(profile("Kronprinzenbrücke")),
      ).toBeTrue();

      const city = createBridgeTestCity(ground);
      const bridgeGroup = city.getObjectByName(
        "drawn bridge structures",
      ) as Group;
      expect(bridgeGroup.userData.moltkeOrnamentCounts).toEqual({
        balustradeBays: 12,
        balusters: 84,
        candelabra: 8,
        candelabraFigures: 24,
        griffins: 4,
        keystoneHeads: 6,
        trophies: 4,
      });
      expect(bridgeGroup.userData.gustavHeinemannStructure).toEqual(
        GUSTAV_HEINEMANN_STRUCTURE_PROFILE,
      );
      expect(bridgeGroup.userData.hugoPreussStructure).toEqual(
        HUGO_PREUSS_STRUCTURE_PROFILE,
      );
      expect(bridgeGroup.userData.weidendammerDetailOwnership).toEqual({
        authoredEagleCount: WEIDENDAMMER_BRIDGE_EAGLE_COUNT,
        authoredRailingSystemCount: WEIDENDAMMER_BRIDGE_RAILING_SYSTEM_COUNT,
        baseArchGirderCount: 10,
        baseArchSystemCount: 1,
        genericEagleCount: 0,
        genericLampStandardCount: 0,
        genericRailingSystemCount: 0,
      });
      const weidendammerRoots: Group[] = [];
      city.traverse((object) => {
        if (
          object instanceof Group &&
          object.name === WEIDENDAMMER_BRIDGE_SMOOTH_ROOT_NAME
        ) {
          weidendammerRoots.push(object);
        }
      });
      expect(weidendammerRoots).toHaveLength(1);
      expect(weidendammerRoots[0].userData).toMatchObject({
        eagleCount: 2,
        lampStandardCount: 8,
        railingSystemCount: 1,
      });
      const moltkeDetails = city.getObjectByName(
        "Moltkebrücke ornamental stone bodies",
      ) as Mesh;
      const moltkeLamps = city.getObjectByName(
        "Moltkebrücke ornamental stone lamps",
      ) as Mesh;
      const moltkeInk = city.getObjectByName(
        "Moltkebrücke ornamental stone ink lines",
      ) as LineSegments;
      expect(moltkeDetails).toBeInstanceOf(Mesh);
      expect(moltkeLamps).toBeInstanceOf(Mesh);
      expect(moltkeInk).toBeInstanceOf(LineSegments);
      const detailDayMaterial = moltkeDetails.material;
      const lampDayMaterial = moltkeLamps.material;
      const inkDayColor = (
        moltkeInk.material as LineBasicMaterial
      ).color.getHex();
      const { setIsoNightPresentation } =
        await import("../src/IsometricCityWorld");
      setIsoNightPresentation(city, true, true, "night");
      expect(moltkeDetails.material).toBe(moltkeDetails.userData.nightMaterial);
      expect(moltkeLamps.material).toBe(moltkeLamps.userData.nightMaterial);
      expect(
        (moltkeLamps.material as MeshStandardMaterial).emissive.getHex(),
      ).toBe(0xffc75c);
      expect((moltkeInk.material as LineBasicMaterial).color.getHex()).not.toBe(
        inkDayColor,
      );
      setIsoNightPresentation(city, false, true, "day");
      expect(moltkeDetails.material).toBe(detailDayMaterial);
      expect(moltkeLamps.material).toBe(lampDayMaterial);
      expect((moltkeInk.material as LineBasicMaterial).color.getHex()).toBe(
        inkDayColor,
      );
      const moltkeBounds = new Box3().setFromObject(moltkeDetails);
      expect(moltkeBounds.max.y - moltkeBounds.min.y).toBeGreaterThan(4.5);
      expect(
        moltkeDetails.geometry.getAttribute("position").count,
      ).toBeGreaterThan(25_000);
      const lamps = city.getObjectByName("bridge structure lamps") as Mesh;
      expect(lamps).toBeInstanceOf(Mesh);
      const lampPositions = lamps.geometry.getAttribute("position");
      const goldaBounds = new Box3();
      for (let index = 0; index < lampPositions.count; index += 1) {
        const vertex = new Vector3().fromBufferAttribute(lampPositions, index);
        if (vertex.z < -1550) {
          goldaBounds.expandByPoint(vertex);
        }
      }
      expect((goldaBounds.min.x + goldaBounds.max.x) / 2).toBeCloseTo(
        -170.5,
        0,
      );
      expect((goldaBounds.min.z + goldaBounds.max.z) / 2).toBeCloseTo(
        -1647.1,
        0,
      );
      expect(
        Math.hypot(
          goldaBounds.max.x - goldaBounds.min.x,
          goldaBounds.max.z - goldaBounds.min.z,
        ),
      ).toBeGreaterThan(76);

      // Procedural boxes must expose their upward face. A reversed winding
      // used to make every bridge deck disappear under back-face culling,
      // leaving only transverse piers and producing a ladder-like Moltkebrücke.
      const bodies = city.getObjectByName("bridge structure bodies") as Mesh;
      const positions = bodies.geometry.getAttribute("position");
      expect(bodies.geometry.getAttribute("normal")).toBeUndefined();
      expect(bodies.geometry.index).toBeNull();
      const loewenBridge = city.getObjectByName(
        "Löwenbrücke recognition model",
      ) as Group;
      expect(loewenBridge).toBeInstanceOf(Group);
      expect(loewenBridge.userData).toMatchObject({
        hangerCount: 22,
        lionCount: 4,
        mainCableCount: 4,
        modernSafetyHandrailCount: 2,
        modernSafetyMeshFieldCount: 18,
        modernSafetyPostCount: 20,
        osmWayId: "1411957328",
      });
      expect(
        loewenBridge.getObjectByName(
          "Löwenbrücke modern safety handrails bodies",
        ),
      ).toBeInstanceOf(Mesh);
      expect(
        loewenBridge.getObjectByName("Löwenbrücke modern safety mesh fields"),
      ).toBeInstanceOf(LineSegments);
      const adlerBridge = city.getObjectByName(
        "Adlerbruecke recognition model",
      ) as Group;
      expect(adlerBridge).toBeInstanceOf(Group);
      expect(adlerBridge.userData).toMatchObject({
        eagleCount: 2,
        genericBridgeReplacement: true,
        osmWayId: "28872983",
        railBayCount: 14,
      });
      // The dedicated timber model replaces, rather than overlays, the old
      // four-cell grey raster slab at the same coordinate.
      let genericLoewenVertices = 0;
      for (let index = 0; index < positions.count; index += 1) {
        if (
          Math.hypot(
            positions.getX(index) - profile("Löwenbrücke").world[0],
            positions.getZ(index) - profile("Löwenbrücke").world[1],
          ) < 18
        ) {
          genericLoewenVertices += 1;
        }
      }
      expect(genericLoewenVertices).toBe(0);
      let genericAdlerVertices = 0;
      for (let index = 0; index < positions.count; index += 1) {
        if (
          Math.hypot(
            positions.getX(index) - profile("Adlerbruecke").world[0],
            positions.getZ(index) - profile("Adlerbruecke").world[1],
          ) < 12
        ) {
          genericAdlerVertices += 1;
        }
      }
      expect(genericAdlerVertices).toBe(0);
      let upwardMoltkeVertices = 0;
      for (let index = 0; index + 2 < positions.count; index += 3) {
        const centerX =
          (positions.getX(index) +
            positions.getX(index + 1) +
            positions.getX(index + 2)) /
          3;
        const centerZ =
          (positions.getZ(index) +
            positions.getZ(index + 1) +
            positions.getZ(index + 2)) /
          3;
        if (
          Math.hypot(
            centerX - profile("Moltkebrücke").world[0],
            centerZ - profile("Moltkebrücke").world[1],
          ) < 55
        ) {
          const abX = positions.getX(index + 1) - positions.getX(index);
          const abY = positions.getY(index + 1) - positions.getY(index);
          const abZ = positions.getZ(index + 1) - positions.getZ(index);
          const acX = positions.getX(index + 2) - positions.getX(index);
          const acY = positions.getY(index + 2) - positions.getY(index);
          const acZ = positions.getZ(index + 2) - positions.getZ(index);
          const normalX = abY * acZ - abZ * acY;
          const normalY = abZ * acX - abX * acZ;
          const normalZ = abX * acY - abY * acX;
          if (
            normalY /
              Math.max(1e-12, Math.hypot(normalX, normalY, normalZ)) >
            0.9
          ) {
            upwardMoltkeVertices += 3;
          }
        }
      }
      expect(upwardMoltkeVertices).toBeGreaterThan(100);
    },
    TASK_13_FULL_CITY_TIMEOUT_MS,
  );

  test(
    "leaves the parliament crossing to its open recognition model and keeps the Kronprinzen prow supports",
    async () => {
      const {
        BRIDGE_MIN_CLEARANCE_M,
        BRIDGE_PROFILES,
        KRONPRINZEN_SPAN_LAYOUT_M,
      } = await import("../src/IsometricCityWorld");
      const ground = (
        await import("../public/mesh/regierungsviertel/minecraft-voxels.json")
      ).default as { water_top_y_m: number };
      const city = createBridgeTestCity(ground as never);
      const bodies = city.getObjectByName("bridge structure bodies") as Mesh;
      const positions = bodies.geometry.getAttribute("position");
      const parliament = BRIDGE_PROFILES.find(
        (entry) => entry.name === "Sprung über die Spree",
      )!;
      const kronprinzen = BRIDGE_PROFILES.find(
        (entry) => entry.name === "Kronprinzenbrücke",
      )!;
      const [ax, az] = kronprinzen.axis!;
      const [nx, nz] = [-az, ax];
      const breakU = KRONPRINZEN_SPAN_LAYOUT_M[1] / 2;
      const pierTargets = [-breakU, breakU].flatMap((u) =>
        [-1, 1].map((side) => [
          kronprinzen.world[0] +
            ax * u +
            nx * side * (kronprinzen.surveyedDeck!.halfWidthM - 1.2),
          kronprinzen.world[1] +
            az * u +
            nz * side * (kronprinzen.surveyedDeck!.halfWidthM - 1.2),
        ]),
      );
      let upperParliamentVertices = 0;
      let submergedProwVertices = 0;
      for (let index = 0; index < positions.count; index += 1) {
        const x = positions.getX(index);
        const y = positions.getY(index);
        const z = positions.getZ(index);
        if (
          Math.hypot(x - parliament.world[0], z - parliament.world[1]) < 30 &&
          y > ground.water_top_y_m + BRIDGE_MIN_CLEARANCE_M + 3.5
        ) {
          upperParliamentVertices += 1;
        }
        if (
          y < ground.water_top_y_m &&
          pierTargets.some(
            ([targetX, targetZ]) => Math.hypot(x - targetX, z - targetZ) < 2.2,
          )
        ) {
          submergedProwVertices += 1;
        }
      }
      expect(upperParliamentVertices).toBe(0);
      expect(submergedProwVertices).toBeGreaterThan(24);
      // The exact task-13 OSM hull adds mapped road/rail crossings throughout
      // the additional 500 m ring. Keep the measured expansion bounded without discarding
      // those structures or relaxing to an unbounded instance count.
      expect(positions.count).toBeGreaterThan(520_000);
      expect(positions.count).toBeLessThan(555_000);
    },
    TASK_13_FULL_CITY_TIMEOUT_MS,
  );

  test(
    "Gustav-Heinemann has a green Vierendeel frame and Hugo-Preuß stays pier-free",
    async () => {
      const {
        BRIDGE_PROFILES,
        GUSTAV_HEINEMANN_STRUCTURE_PROFILE,
        HUGO_PREUSS_STRUCTURE_PROFILE,
      } = await import("../src/IsometricCityWorld");
      const ground = (
        await import("../public/mesh/regierungsviertel/minecraft-voxels.json")
      ).default as { water_top_y_m: number };
      const city = createBridgeTestCity(ground as never);
      const group = city.getObjectByName("drawn bridge structures") as Group;
      const bodies = city.getObjectByName("bridge structure bodies") as Mesh;
      const positions = bodies.geometry.getAttribute("position");
      const colors = bodies.geometry.getAttribute("color");
      expect(group.userData.bridgeProfiles).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "vierendeel",
            name: "Gustav-Heinemann-Brücke",
          }),
          expect.objectContaining({
            curveSagittaM: -2.98,
            kind: "curvedBox",
            name: "Hugo-Preuß-Brücke",
          }),
        ]),
      );

      const gustavTone = new Color(
        BRIDGE_PROFILES.find(
          (entry) => entry.name === "Gustav-Heinemann-Brücke",
        )!.palette!.structure,
      );
      const compactPaletteTolerance = 1 / 255 + Number.EPSILON;
      expect(colors.array).toBeInstanceOf(Uint8Array);
      expect(colors.normalized).toBe(true);
      let greenFrameVertices = 0;
      let greenFrameMinY = Number.POSITIVE_INFINITY;
      let greenFrameMaxY = Number.NEGATIVE_INFINITY;
      let hugoCentralUnderwaterVertices = 0;
      for (let index = 0; index < positions.count; index += 1) {
        if (
          Math.abs(colors.getX(index) - gustavTone.r) <=
            compactPaletteTolerance &&
          Math.abs(colors.getY(index) - gustavTone.g) <=
            compactPaletteTolerance &&
          Math.abs(colors.getZ(index) - gustavTone.b) <= compactPaletteTolerance
        ) {
          greenFrameVertices += 1;
          greenFrameMinY = Math.min(greenFrameMinY, positions.getY(index));
          greenFrameMaxY = Math.max(greenFrameMaxY, positions.getY(index));
        }
        const x = positions.getX(index);
        const y = positions.getY(index);
        const z = positions.getZ(index);
        if (
          x > 23 &&
          x < 91 &&
          z > -535 &&
          z < -492 &&
          y < ground.water_top_y_m + 0.2
        ) {
          hugoCentralUnderwaterVertices += 1;
        }
      }
      expect(greenFrameVertices).toBeGreaterThan(4_000);
      expect(greenFrameMaxY - greenFrameMinY).toBeGreaterThanOrEqual(
        GUSTAV_HEINEMANN_STRUCTURE_PROFILE.trussHeightM,
      );
      expect(group.userData.gustavHeinemannStructure).toBe(
        GUSTAV_HEINEMANN_STRUCTURE_PROFILE,
      );
      expect(group.userData.hugoPreussStructure).toBe(
        HUGO_PREUSS_STRUCTURE_PROFILE,
      );
      expect(hugoCentralUnderwaterVertices).toBe(0);
    },
    TASK_13_FULL_CITY_TIMEOUT_MS,
  );

  test("the Gymnasium Tiergarten Altbau replaces its flat LoD2 prism", async () => {
    const { createGymnasiumTiergarten, PRISM_SUPPRESSED_IDS } =
      await import("../src/IsometricCityWorld");
    // The 1902 brick school carries ALKIS roof code 5000 (Mischform), which the
    // procedural roof fitter skips, so the prism stood as a flat 32 m box.
    expect(PRISM_SUPPRESSED_IDS.has("jBXhIsDK")).toBe(true);
    expect(PRISM_SUPPRESSED_IDS.has("EHKONVCW")).toBe(true);
    const school = createGymnasiumTiergarten();
    const bodies = school.getObjectByName(
      "Gymnasium Tiergarten bodies",
    ) as Mesh;
    expect(bodies).toBeInstanceOf(Mesh);
    expect(
      school.getObjectByName("Gymnasium Tiergarten ink lines"),
    ).toBeInstanceOf(LineSegments);
    const bounds = new Box3().setFromObject(bodies);
    // LoD2 gives 32.33 m to the ridge and 34.75 m to the observation deck on a
    // 36.42 m × 18.62 m block; the balustrade stands above the deck.
    expect(bounds.max.y).toBeGreaterThan(5.2 + 34.75);
    expect(bounds.max.y).toBeLessThan(5.2 + 38);
    const spanX = bounds.max.x - bounds.min.x;
    const spanZ = bounds.max.z - bounds.min.z;
    expect(Math.max(spanX, spanZ)).toBeGreaterThan(34);
    expect(Math.max(spanX, spanZ)).toBeLessThan(45);
    expect(bounds.min.x).toBeLessThan(-2130);
  });

  test("the Paul-Löbe-Haus carries a cantilevered west entrance canopy", () => {
    const canopy = createPaulLoebeCanopy();
    const bodies = canopy.getObjectByName("Paul-Löbe canopy bodies") as Mesh;
    expect(bodies).toBeInstanceOf(Mesh);
    const bounds = new Box3().setFromObject(bodies);
    // Only the hinted stair runs sit behind the glass; everything else
    // cantilevers west over the forecourt towards the Chancellery.
    expect(bounds.max.x).toBeLessThan(PAUL_LOEBE_WEST_FACE_X + 4);
    // Roof plate, columns, paving bands and both fountain rows.
    expect(PAUL_LOEBE_WEST_FACE_X - bounds.min.x).toBeGreaterThan(38);
    // …carried by columns that reach the forecourt, with the slab well above
    // head height so the roof reads as a canopy rather than a porch wall.
    expect(bounds.min.y).toBeLessThan(6);
    expect(bounds.max.y).toBeGreaterThan(26);
    // The plate spans the full ~102 m west facade, not just the entrance bay.
    expect(bounds.max.z - bounds.min.z).toBeGreaterThan(100);
    expect(canopy.getObjectByName("Paul-Löbe canopy ink lines")).toBeInstanceOf(
      LineSegments,
    );
  });

  test("the four coarsest LoD2 blocks carry their missing signatures", () => {
    const refined = createLandmarkRefinements();
    const bodies = refined.getObjectByName(
      "Landmark refinement bodies",
    ) as Mesh;
    expect(bodies).toBeInstanceOf(Mesh);
    expect(
      refined.getObjectByName("Landmark refinement ink lines"),
    ).toBeInstanceOf(LineSegments);
    const bounds = new Box3().setFromObject(bodies);
    // West as far as the Haus-der-Kulturen reflecting pool, east to the
    // Jakob-Kaiser-Haus arcade.
    expect(bounds.min.x).toBeLessThan(-550);
    expect(bounds.max.x).toBeGreaterThan(400);
    // The saddle shell and the Lüders rotunda both rise well over the
    // 7 m boxes LoD2 gives them.
    expect(bounds.max.y).toBeGreaterThan(35);
  });
});

describe("smooth OSM water and parkland", () => {
  test("does not stack flat OSM lawns below the Tilla-Durieux sculpture", () => {
    const tillaLawns = surfacesFixture.parks.filter(isTillaDurieuxLawn);
    expect(tillaLawns).toHaveLength(2);
    expect(tillaLawns.map((surface) => surface.area_m2).sort()).toEqual([
      5082, 6913,
    ]);
    expect(
      isTillaDurieuxLawn({
        ...tillaLawns[0],
        area_m2: 5082,
        ring: tillaLawns[0].ring.map(([x, z]) => [x + 40_000, z]),
      }),
    ).toBeFalse();

    const insideTilla = createTillaDurieuxGroundTester(surfacesFixture);
    expect(insideTilla(250, 1314)).toBeTrue();
    expect(insideTilla(166, 1520)).toBeTrue();
    expect(insideTilla(204, 1435)).toBeFalse();
    expect(insideTilla(340, 1314)).toBeFalse();
  });

  test("draws static curved wave ribbons instead of straight water dashes", () => {
    const ripple = curvedWaterRipple([0, 0], 4.2, 0, 6, 0.6);
    expect(ripple).toHaveLength(6 * 18);
    expect(ripple.every(Number.isFinite)).toBeTrue();
    for (let index = 1; index < ripple.length; index += 3) {
      expect(ripple[index]).toBeCloseTo(4.2);
    }
    const zValues = ripple.filter((_, index) => index % 3 === 2);
    expect(Math.max(...zValues)).toBeGreaterThan(0.6);
    expect(Math.min(...zValues)).toBeLessThan(0.1);
    expect(curvedWaterRipple([0, 0], 0, 0, -1, 0.2)).toEqual([]);
  });

  test(
    "real polygons replace the rasterised river with a continuous shoreline",
    async () => {
      const {
        BEAVER_EASTER_EGG_COUNT,
        createSmoothSurfaces,
        isDedicatedSintiRomaPool,
        isElevatedParkWater,
      } = await import("../src/IsometricCityWorld");
      const surfaces =
        (await import("../public/mesh/regierungsviertel/surface-polygons.json")) as {
          default: { parks: unknown[]; water: unknown[] };
        };
      const payloadSurfaces = surfaces.default as never as Parameters<
        typeof createSmoothSurfaces
      >[0];
      expect(payloadSurfaces.water.length).toBeGreaterThan(10);
      expect(payloadSurfaces.parks.length).toBeGreaterThan(100);
      const group = createSmoothSurfaces(payloadSurfaces, -1.15, 4.2);
      // A transparent water plate over a sandy bed, plus smooth quay
      // walls and one continuous shoreline ink run.
      const water = group.getObjectByName("smooth water surface") as Mesh;
      expect(water).toBeInstanceOf(Mesh);
      expect((water.material as MeshBasicMaterial).transparent).toBe(true);
      expect(group.getObjectByName("smooth river bed")).toBeInstanceOf(Mesh);
      expect(group.getObjectByName("smooth parkland lawns")).toBeInstanceOf(
        Mesh,
      );
      expect(
        isElevatedParkWater(
          payloadSurfaces.water.find(
            (surface) => surface.name === "Venusbassin",
          )!,
        ),
      ).toBe(true);
      expect(
        isElevatedParkWater(
          payloadSurfaces.water.find(
            (surface) => surface.name === "Humboldthafen",
          )!,
        ),
      ).toBe(false);
      expect(
        isElevatedParkWater(
          payloadSurfaces.water.find(
            (surface) => surface.name === "Nordhafen",
          )!,
        ),
      ).toBe(false);
      const sintiRomaPool = payloadSurfaces.water.find(
        (surface) => surface.kind === "basin" && surface.area_m2 === 113,
      )!;
      expect(isDedicatedSintiRomaPool(sintiRomaPool)).toBe(true);
      expect(
        isDedicatedSintiRomaPool(
          payloadSurfaces.water.find(
            (surface) => surface.kind === "basin" && surface.name === "Phönix",
          )!,
        ),
      ).toBe(false);
      expect(group.getObjectByName("basin water")).toBeInstanceOf(Mesh);
      expect(group.getObjectByName("natural pond water")).toBeInstanceOf(Mesh);
      expect(group.getObjectByName("natural pond floors")).toBeInstanceOf(Mesh);
      expect(group.getObjectByName("natural pond bank slopes")).toBeInstanceOf(
        Mesh,
      );
      const depthWalls = group.getObjectByName(
        "basin display-depth walls",
      ) as Mesh;
      expect(depthWalls).toBeInstanceOf(Mesh);
      expect(depthWalls.userData.depthStatus).toContain("not surveyed");
      expect(
        group.getObjectByName("static water ripple ribbons"),
      ).toBeInstanceOf(Mesh);
      const beavers = group.getObjectByName("three hidden Tiergarten beavers");
      expect(beavers?.children).toHaveLength(BEAVER_EASTER_EGG_COUNT);
      const ottoFountain = group.getObjectByName(
        "Otto-Weidt-Platz fountain water",
      ) as Mesh;
      expect(ottoFountain).toBeInstanceOf(Mesh);
      expect(
        (ottoFountain.userData.dayMaterial as MeshBasicMaterial).color.getHex(),
      ).toBe(0x628da1);
      const walls = group.getObjectByName("smooth quay walls") as Mesh;
      expect(walls).toBeInstanceOf(Mesh);
      const shore = group.getObjectByName(
        "smooth shoreline ink",
      ) as LineSegments;
      expect(shore).toBeInstanceOf(LineSegments);
      // The shoreline follows the polygon rings, so its segments are NOT
      // axis-aligned staircases: most have both dx and dz non-zero.
      const position = shore.geometry.getAttribute("position");
      let diagonal = 0;
      let segments = 0;
      for (let index = 0; index < position.count; index += 2) {
        const dx = Math.abs(position.getX(index) - position.getX(index + 1));
        const dz = Math.abs(position.getZ(index) - position.getZ(index + 1));
        segments += 1;
        if (dx > 0.15 && dz > 0.15) {
          diagonal += 1;
        }
      }
      expect(segments).toBeGreaterThan(200);
      expect(diagonal / segments).toBeGreaterThan(0.3);
      // The bank plate sits above the water plate: a real recessed river.
      const waterBounds = new Box3().setFromObject(water);
      const wallBounds = new Box3().setFromObject(walls);
      expect(wallBounds.max.y).toBeGreaterThan(waterBounds.max.y + 3);
      expect(wallBounds.min.y).toBeLessThan(waterBounds.max.y - 2);
    },
    TASK_13_FULL_CITY_TIMEOUT_MS,
  );

  test(
    "draws the shipped banks granularly, with no facets left",
    async () => {
      const { createSmoothSurfaces } =
        await import("../src/IsometricCityWorld");
      const { sharpestTurnDeg } = await import("../src/bankCurves");
      const surfaces =
        (await import("../public/mesh/regierungsviertel/surface-polygons.json")) as {
          default: unknown;
        };
      const payload = surfaces.default as never as Parameters<
        typeof createSmoothSurfaces
      >[0];
      const shore = createSmoothSurfaces(payload, -1.15, 4.2).getObjectByName(
        "smooth shoreline ink",
      ) as LineSegments;
      const position = shore.geometry.getAttribute("position");
      const indexBuffer = shore.geometry.index;
      const sequenceCount = indexBuffer?.count ?? position.count;
      const vertexIndex = (sequenceIndex: number): number =>
        indexBuffer?.getX(sequenceIndex) ?? sequenceIndex;
      const runs: number[] = [];
      const bends: number[] = [];
      for (let index = 0; index + 3 < sequenceCount; index += 2) {
        const a = vertexIndex(index);
        const b = vertexIndex(index + 1);
        const c = vertexIndex(index + 2);
        const d = vertexIndex(index + 3);
        const dx = position.getX(b) - position.getX(a);
        const dz = position.getZ(b) - position.getZ(a);
        const ex = position.getX(d) - position.getX(c);
        const ez = position.getZ(d) - position.getZ(c);
        const run = Math.hypot(dx, dz);
        const next = Math.hypot(ex, ez);
        if (run < 1e-6 || next < 1e-6) {
          continue;
        }
        runs.push(run);
        // Only where this segment ends exactly where the next begins: ring
        // ends and jumps between water bodies are not visible facets.
        const joined = Math.hypot(
          position.getX(c) - position.getX(b),
          position.getZ(c) - position.getZ(b),
        );
        if (joined < 1e-6) {
          const dot = (dx * ex + dz * ez) / (run * next);
          bends.push(
            (Math.acos(Math.min(1, Math.max(-1, dot))) * 180) / Math.PI,
          );
        }
      }
      expect(bends.length).toBeGreaterThan(500);
      runs.sort((a, b) => a - b);
      bends.sort((a, b) => a - b);
      // Roughly a drawn stroke per segment, and the typical bend a small
      // fraction of the chords the raw OSM rings hand over.
      expect(runs[runs.length >> 1]).toBeLessThan(6);
      const rawBends: number[] = [];
      for (const surface of payload.water) {
        if (surface.area_m2 < 400) {
          continue;
        }
        const points = surface.ring.map(
          ([x, z]) => [x / 10, z / 10] as [number, number],
        );
        for (let index = 0; index < points.length; index += 1) {
          const [ax, az] = points[(index + points.length - 1) % points.length];
          const [bx, bz] = points[index];
          const [cx, cz] = points[(index + 1) % points.length];
          const inRun = Math.hypot(bx - ax, bz - az);
          const outRun = Math.hypot(cx - bx, cz - bz);
          if (inRun < 1e-6 || outRun < 1e-6) {
            continue;
          }
          const dot =
            ((bx - ax) * (cx - bx) + (bz - az) * (cz - bz)) / (inRun * outRun);
          rawBends.push(
            (Math.acos(Math.min(1, Math.max(-1, dot))) * 180) / Math.PI,
          );
        }
      }
      rawBends.sort((a, b) => a - b);
      expect(bends[bends.length >> 1]).toBeLessThan(
        rawBends[rawBends.length >> 1] / 2.5,
      );
      expect(bends[bends.length >> 1]).toBeLessThan(2);
      // Built corners survive: the Humboldthafen basin keeps its right angles
      // even though the bends along the Spree are gone.
      const basin = payload.water.find(
        (surface) => surface.name === "Humboldthafen",
      );
      expect(basin).toBeDefined();
      const ring = (basin?.ring ?? []).map(
        ([x, z]) => [x / 10, z / 10] as [number, number],
      );
      expect(sharpestTurnDeg(ring)).toBeGreaterThan(80);
    },
    TASK_13_FULL_CITY_TIMEOUT_MS,
  );
});

describe("isometric face shading", () => {
  test("faces step by facing direction without gradients", async () => {
    const { isoFaceShade, ISO_FACE_SHADE } =
      await import("../src/IsometricCityWorld");
    // Tops stay full; the two visible wall directions step down.
    expect(isoFaceShade(0, 1, 0)).toBe(ISO_FACE_SHADE.top);
    expect(isoFaceShade(1, 0, 0)).toBe(ISO_FACE_SHADE.east);
    expect(isoFaceShade(-1, 0, 0)).toBe(ISO_FACE_SHADE.west);
    expect(isoFaceShade(0, 0, 1)).toBe(ISO_FACE_SHADE.south);
    expect(isoFaceShade(0, 0, -1)).toBe(ISO_FACE_SHADE.north);
    // A real drawing convention: top brightest, all sides below it,
    // every step a constant (no interpolation between facings).
    const sides = [
      ISO_FACE_SHADE.east,
      ISO_FACE_SHADE.north,
      ISO_FACE_SHADE.south,
      ISO_FACE_SHADE.west,
    ];
    for (const side of sides) {
      expect(side).toBeLessThan(ISO_FACE_SHADE.top);
      // Compressed into the bright ivory register (v0.38.0): with the film
      // curve gone, a 0.795 west wall landed on a mid grey — the "alle
      // Gebäude … grau" report. Four distinct steps survive, all bright.
      expect(side).toBeGreaterThanOrEqual(0.86);
    }
    expect(new Set(sides).size).toBe(4);
  });

  test("ordinary flat roofs stay inside their measured vertical envelope", () => {
    const fixture: PrismPayload = {
      buildings: [
        {
          class: 0,
          h_dm: 120,
          id: "metric-flat-roof",
          ring: [
            [0, 0],
            [300, 0],
            [300, 300],
            [0, 300],
          ],
          roof: 1000,
          tone: [220, 214, 198],
          y0_dm: 0,
        },
      ],
      classes: ["concrete"],
      schema_version: 1,
    };
    const first = createIsometricCity(fixture, null);
    const second = createIsometricCity(fixture, null);
    const firstBody = first.getObjectByName("LoD2 prism buildings") as Mesh;
    const secondBody = second.getObjectByName("LoD2 prism buildings") as Mesh;
    const bounds = new Box3().setFromObject(firstBody);

    // No generic HVAC box or skylight may rise above the 12.0 m LoD2 top.
    expect(bounds.max.y).toBeCloseTo(12, 5);
    expect(first.getObjectByName("LoD2 glass prisms")).toBeUndefined();
    expect(first.getObjectByName("LoD2 prism windows")).toBeUndefined();
    // All data-derived positions are stable across rebuilds.
    expect(
      Array.from(firstBody.geometry.getAttribute("position").array),
    ).toEqual(Array.from(secondBody.geometry.getAttribute("position").array));
  });
});
