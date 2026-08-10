import { describe, expect, test } from "bun:test";

import {
  Box3,
  Color,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector3,
} from "three";

import {
  appendKollhoffClinkerJoints,
  CHARITE_BETTENHOCHHAUS_IDS,
  CHARITE_CAMPUS_BRIDGE_ID,
  type PrismPayload,
  VISIBLE_RADIUS_M,
  buildRoofGeometry,
  createIsometricCity,
  facadeWallsOf,
  fitRectangle,
  ISO_EDGE_THRESHOLD_DEGREES,
  ISO_FACADE_AXIS_OPACITY,
  ISO_GLASS_DAY_OPACITY,
  ISO_GLASS_MULLION_OPACITY,
  ISO_GROUND_SHADES,
  ISO_INK_COLOR,
  ISO_WINDOW_BAY_PITCH_M,
  ISO_WINDOW_FLOOR_PITCH_M,
  KOLLHOFF_TOWER_PRISM_IDS,
  MELH_CANOPY_SUPPORTS,
  PAUL_LOEBE_WEST_FACE_X,
  PRISM_GLASSED_IDS,
  createLandmarkRefinements,
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
import { KOLLHOFF_TOWER_PROFILE } from "../src/expandedCityProfiles";
import prismPayload from "../public/mesh/regierungsviertel/lod2-prisms.json";
import voxelGroundPayload from "../public/mesh/regierungsviertel/minecraft-voxels.json";
import surfacePolygonPayload from "../public/mesh/regierungsviertel/surface-polygons.json";
import type { SurfacePayload } from "../src/IsometricCityWorld";

const payload = prismPayload as unknown as PrismPayload;
const surfacesFixture = surfacePolygonPayload as unknown as SurfacePayload;
const city = createIsometricCity(payload, null);

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
    // The facade grid is drawn: slender vertical bay axes crossed by one
    // horizontal hairline per storey, so walls stay legible when the
    // panes themselves fall below a pixel.
    const axes = city.getObjectByName("LoD2 facade axes") as LineSegments;
    expect(axes).toBeInstanceOf(LineSegments);
    const position = axes.geometry.getAttribute("position");
    expect(position.count).toBeGreaterThan(20_000);
    let verticals = 0;
    let bands = 0;
    for (let index = 0; index < position.count; index += 2) {
      const sameXZ =
        Math.abs(position.getX(index) - position.getX(index + 1)) < 1e-3 &&
        Math.abs(position.getZ(index) - position.getZ(index + 1)) < 1e-3;
      if (sameXZ) {
        expect(position.getY(index + 1)).toBeGreaterThan(position.getY(index));
        verticals += 1;
      } else {
        // Storey bands run level along the wall.
        expect(
          Math.abs(position.getY(index) - position.getY(index + 1)),
        ).toBeLessThan(1e-3);
        bands += 1;
      }
    }
    expect(verticals).toBeGreaterThan(5_000);
    expect(bands).toBeGreaterThan(5_000);
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
    expect(material.opacity).toBe(0.34);
    expect(material.userData.stableInkAuthoredOpacity).toBe(0.34);
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

  test("quay walls drop from the banks wherever land meets water", async () => {
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
    expect(quays.geometry.getAttribute("position").count).toBeGreaterThan(3000);
  });

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
    for (const id of CHARITE_BETTENHOCHHAUS_IDS) {
      const building = payload.buildings.find(
        (candidate) => candidate.id === id,
      );
      expect(building).toBeDefined();
      expect(building!.h_dm / 10).toBeGreaterThan(79);
      const format = windowFormatForBuilding(id, true);
      expect(format.bayPitch).toBeCloseTo(2.25, 5);
      expect(format.floorPitch).toBeCloseTo(3.7, 5);
    }
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
    // The Reichstag pin is pale neutral sandstone, never yellow or muddy.
    const reichstag = HERO_PRISM_TONES.K0002MCN;
    const r = (reichstag >> 16) & 255;
    const b = reichstag & 255;
    expect(r - b).toBeLessThan(40);
    expect(r).toBeGreaterThanOrEqual(195);
    expect(r).toBeLessThanOrEqual(215);
  });

  test("keeps a bright but materially distinct day palette", () => {
    expect(SOURCE_FACADE_IVORY_BLEND).toBeLessThanOrEqual(0.4);
    expect(ISO_FACADE_AXIS_OPACITY).toBeLessThan(
      ISO_GLASS_MULLION_OPACITY,
    );
    expect(ISO_GLASS_MULLION_OPACITY).toBeLessThan(ISO_GLASS_DAY_OPACITY);

    const channels = (hex: number) => [
      (hex >> 16) & 255,
      (hex >> 8) & 255,
      hex & 255,
    ];
    const [grassRed, grassGreen] = channels(ISO_GROUND_SHADES.grass[0]);
    const [waterRed, , waterBlue] = channels(ISO_GROUND_SHADES.water[0]);
    const [plazaRed, , plazaBlue] = channels(
      ISO_GROUND_SHADES.plazaBrick[0],
    );
    expect(grassGreen - grassRed).toBeGreaterThan(18);
    expect(waterBlue - waterRed).toBeGreaterThan(35);
    expect(plazaRed - plazaBlue).toBeGreaterThan(30);

    const glass = city.getObjectByName("LoD2 glass prisms") as Mesh;
    const mullions = city.getObjectByName("LoD2 glass mullions") as LineSegments;
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
        payload.buildings.find(
          (candidate) => candidate.id === "WtTpo3vD",
        )!,
        target,
      ),
    ).toBeGreaterThan(10_000);
    expect(target.length % 6).toBe(0);
  });
});

describe("prism suppression for full recognition models", () => {
  test("the Brandenburg Gate body prism is skipped (model carries it)", async () => {
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
    expect(PRISM_SUPPRESSED_IDS.has("K0001xqy")).toBe(true);
    // The suppressed building exists in the payload (data untouched)…
    expect(data.buildings.some((b) => b.id === "K0001xqy")).toBe(true);
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
  test("bridges carry an elevated deck on piers that reach the riverbed", async () => {
    const { createIsometricCity, BRIDGE_MIN_CLUSTER_CELLS } =
      await import("../src/IsometricCityWorld");
    const voxelPayload =
      (await import("../public/mesh/regierungsviertel/minecraft-voxels.json")) as {
        default: { water_top_y_m: number };
      };
    expect(BRIDGE_MIN_CLUSTER_CELLS).toBeGreaterThan(0);
    const city = createIsometricCity(
      payload,
      voxelPayload.default as never,
      null,
    );
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
  });

  test("retains narrow one-cell park stegs without widening them into roads", async () => {
    const { createIsometricCity, BRIDGE_MIN_CLUSTER_CELLS } =
      await import("../src/IsometricCityWorld");
    const ground = (
      await import("../public/mesh/regierungsviertel/minecraft-voxels.json")
    ).default as never;
    expect(BRIDGE_MIN_CLUSTER_CELLS).toBe(1);
    const city = createIsometricCity(payload, ground, null);
    const group = city.getObjectByName("drawn bridge structures") as Group;
    expect(group.userData.smallBridgeClusterCount).toBeGreaterThan(20);
  });

  test("the Gustav-Heinemann-Brücke reaches both banks of the Spree", async () => {
    const { createIsometricCity, BRIDGE_PROFILES } =
      await import("../src/IsometricCityWorld");
    const voxelPayload =
      (await import("../public/mesh/regierungsviertel/minecraft-voxels.json")) as {
        default: { water_top_y_m: number };
      };
    const profile = BRIDGE_PROFILES.find(
      (entry) => entry.name === "Gustav-Heinemann-Brücke",
    );
    expect(profile?.surveyedDeck?.halfLengthM).toBeGreaterThan(40);
    const city = createIsometricCity(
      payload,
      voxelPayload.default as never,
      null,
    );
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
  });

  test("pins the corrected bridges to published dimensions and identities", async () => {
    const { createIsometricCity, BRIDGE_PROFILES } =
      await import("../src/IsometricCityWorld");
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
    expect(profile("Golda-Meir-Steg").palette?.structure).toBe(0xf2b600);
    expect(profile("Gustav-Heinemann-Brücke").surveyedDeck).toEqual({
      halfLengthM: 43.88,
      halfWidthM: 2,
    });
    expect(profile("Gustav-Heinemann-Brücke").kind).toBe("vierendeel");
    expect(profile("Gustav-Heinemann-Brücke").palette).toMatchObject({
      deck: 0x715b45,
      metal: 0x315246,
      structure: 0x547766,
    });
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
    expect(profile("Sandkrugbrücke").surveyedDeck).toEqual({
      halfLengthM: 16.3,
      halfWidthM: 14.4,
    });
    expect(profile("Moltkebrücke").surveyedDeck).toEqual({
      halfLengthM: 38.79,
      halfWidthM: 12.85,
    });
    expect(profile("Moltkebrücke").axis).toEqual([-0.7174, -0.6967]);
    expect(profile("Moltkebrücke").palette?.structure).toBe(0xb86c5a);

    const city = createIsometricCity(payload, ground, null);
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
    expect((goldaBounds.min.x + goldaBounds.max.x) / 2).toBeCloseTo(-170.5, 0);
    expect((goldaBounds.min.z + goldaBounds.max.z) / 2).toBeCloseTo(-1647.1, 0);
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
    const normals = bodies.geometry.getAttribute("normal");
    let upwardMoltkeVertices = 0;
    for (let index = 0; index < positions.count; index += 1) {
      if (
        Math.hypot(
          positions.getX(index) - profile("Moltkebrücke").world[0],
          positions.getZ(index) - profile("Moltkebrücke").world[1],
        ) < 55 &&
        normals.getY(index) > 0.9
      ) {
        upwardMoltkeVertices += 1;
      }
    }
    expect(upwardMoltkeVertices).toBeGreaterThan(100);
  });

  test("Gustav-Heinemann has a green Vierendeel frame and Hugo-Preuß stays pier-free", async () => {
    const { createIsometricCity, BRIDGE_PROFILES } =
      await import("../src/IsometricCityWorld");
    const ground = (
      await import("../public/mesh/regierungsviertel/minecraft-voxels.json")
    ).default as { water_top_y_m: number };
    const city = createIsometricCity(payload, ground as never, null);
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
      BRIDGE_PROFILES.find((entry) => entry.name === "Gustav-Heinemann-Brücke")!
        .palette!.structure,
    );
    let greenFrameVertices = 0;
    let hugoCentralUnderwaterVertices = 0;
    for (let index = 0; index < positions.count; index += 1) {
      if (
        Math.abs(colors.getX(index) - gustavTone.r) < 1e-5 &&
        Math.abs(colors.getY(index) - gustavTone.g) < 1e-5 &&
        Math.abs(colors.getZ(index) - gustavTone.b) < 1e-5
      ) {
        greenFrameVertices += 1;
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
    expect(hugoCentralUnderwaterVertices).toBe(0);
  });

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

  test("keeps every Lüders-Haus canopy support out of the Spree", () => {
    const insideRing = (x: number, z: number, ring: number[][]): boolean => {
      let inside = false;
      for (
        let index = 0, previous = ring.length - 1;
        index < ring.length;
        previous = index++
      ) {
        const [xDm, zDm] = ring[index];
        const [previousXDm, previousZDm] = ring[previous];
        const xi = xDm / 10;
        const zi = zDm / 10;
        const xj = previousXDm / 10;
        const zj = previousZDm / 10;
        if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) {
          inside = !inside;
        }
      }
      return inside;
    };
    const inMappedWater = (x: number, z: number): boolean =>
      surfacesFixture.water.some(
        (surface) =>
          insideRing(x, z, surface.ring) &&
          !surface.holes.some((hole) => insideRing(x, z, hole)),
      );

    expect(MELH_CANOPY_SUPPORTS).toHaveLength(4);
    expect(MELH_CANOPY_SUPPORTS.map(([x, z]) => inMappedWater(x, z))).toEqual([
      false,
      false,
      false,
      false,
    ]);
    expect(createLandmarkRefinements().userData.melhCanopySupports).toEqual(
      MELH_CANOPY_SUPPORTS,
    );
  });
});

describe("smooth OSM water and parkland", () => {
  test("real polygons replace the rasterised river with a continuous shoreline", async () => {
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
    expect(group.getObjectByName("smooth parkland lawns")).toBeInstanceOf(Mesh);
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
    const depthWalls = group.getObjectByName(
      "pond display-depth walls",
    ) as Mesh;
    expect(depthWalls).toBeInstanceOf(Mesh);
    expect(depthWalls.userData.depthStatus).toContain("not surveyed");
    expect(group.getObjectByName("static water ripple ribbons")).toBeInstanceOf(
      Mesh,
    );
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
    const shore = group.getObjectByName("smooth shoreline ink") as LineSegments;
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
  });

  test("draws the shipped banks granularly, with no facets left", async () => {
    const { createSmoothSurfaces } = await import("../src/IsometricCityWorld");
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
    const runs: number[] = [];
    const bends: number[] = [];
    for (let index = 0; index + 3 < position.count; index += 2) {
      const dx = position.getX(index + 1) - position.getX(index);
      const dz = position.getZ(index + 1) - position.getZ(index);
      const ex = position.getX(index + 3) - position.getX(index + 2);
      const ez = position.getZ(index + 3) - position.getZ(index + 2);
      const run = Math.hypot(dx, dz);
      const next = Math.hypot(ex, ez);
      if (run < 1e-6 || next < 1e-6) {
        continue;
      }
      runs.push(run);
      // Only where this segment ends exactly where the next begins: ring
      // ends and jumps between water bodies are not visible facets.
      const joined = Math.hypot(
        position.getX(index + 2) - position.getX(index + 1),
        position.getZ(index + 2) - position.getZ(index + 1),
      );
      if (joined < 1e-6) {
        const dot = (dx * ex + dz * ez) / (run * next);
        bends.push((Math.acos(Math.min(1, Math.max(-1, dot))) * 180) / Math.PI);
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
  });
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
