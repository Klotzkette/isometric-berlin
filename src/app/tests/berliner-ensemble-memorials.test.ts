import { describe, expect, test } from "bun:test";
import {
  Box3,
  InstancedMesh,
  LineSegments,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector3,
} from "three";

import {
  BERLINER_ENSEMBLE_PUBLIC_ART_PROFILE,
  berlinerEnsemblePublicArtSolidAt,
  createBerlinerEnsemblePublicArt,
  createMinecraftBrechtMemorial,
  setBerlinerEnsemblePublicArtSnow,
} from "../src/BerlinerEnsembleMemorials";
import { BERLINER_ENSEMBLE_PROFILE } from "../src/BerlinerEnsemble";
import { FINE_DETAIL_LAYER_NAMES } from "../src/fineDetailFade";
import { setIsoNightPresentation } from "../src/IsometricCityWorld";

describe("current Berliner Ensemble public art", () => {
  test("pins both exact OSM works to official/current and freely licensed sources", () => {
    const profile = BERLINER_ENSEMBLE_PUBLIC_ART_PROFILE;
    expect(profile.ownedOsmKeys).toEqual([
      "node/988668382",
      "node/13841652635",
    ]);
    expect(profile.brecht).toMatchObject({
      artist: "Fritz Cremer",
      installed: 1988,
      osmKey: "node/988668382",
      site: "Bertolt-Brecht-Platz",
      turntableDiameterM: 6,
      visualReference: {
        artist: "Manfred Brückels",
        license: "CC BY-SA 3.0",
      },
    });
    expect(profile.brecht.artists).toEqual({
      installationDesign: "Peter Flierl",
      sculpture: "Fritz Cremer",
      stoneworkAndSteles: "Carlo Wloch",
    });
    expect(profile.brecht.focus).toEqual({
      azimuthDegrees: 144,
      distanceM: 14,
      fovDegrees: 39,
      markerY: 7.7,
      polarDegrees: 72,
      targetHeightM: 1.25,
      targetWorldM: [1026.376, 4.08, -349.777],
    });
    expect(profile.brecht.sources).toEqual(
      expect.arrayContaining([
        expect.stringContaining("bildhauerei-in-berlin.de/bildwerk/"),
        expect.stringContaining("deutsche-digitale-bibliothek.de/item/"),
        expect.stringContaining("defa-stiftung.de/"),
        expect.stringContaining("gedenktafeln-in-berlin.de/gedenktafeln/detail/"),
        expect.stringContaining("commons.wikimedia.org/wiki/File:"),
      ]),
    );
    expect(profile.brecht.geometryStatus).toContain("cylindrical");
    expect(profile.brecht.inscriptionPolicy).toContain("never reproduced");
    expect(profile.heleneWeigel).toMatchObject({
      osmKey: "node/13841652635",
      site: "Helene-Weigel-Hof",
      unveiled: "2026-05-10",
    });
    expect(profile.heleneWeigel.artists).toContain("Monica Bonvicini");
    expect(profile.heleneWeigel.officialSources).toEqual([
      "https://www.berliner-ensemble.de/eine-skulptur-fuer-helene-weigel",
      "https://www.berliner-ensemble.de/magazin/helene-weigel-hat-einen-neuen-platz",
    ]);
    expect(profile.heleneWeigel.photoReferencePolicy).toContain(
      "no photograph is bundled",
    );
    expect(profile.renderPolicy.modes).toEqual([
      "day",
      "night",
      "snowstorm",
      "minecraft",
      "schwellenraum",
    ]);
    expect(profile.renderPolicy.fineLayers).toEqual([
      "Bertolt Brecht seated figure and installation fine detail",
      "Helene Weigel halftone glass portrait",
    ]);
  });

  test("renders Cremer's seated installation instead of the former block person", () => {
    const root = createBerlinerEnsemblePublicArt();
    const brecht = root.getObjectByName(
      "Bertolt Brecht memorial installation",
    )!;
    expect(brecht.userData.detailCounts).toEqual({
      chairLegs: 4,
      cylindricalSteles: 3,
      emptyBenchPlaces: 1,
      fingerCues: 8,
      platformDiameterM: 6,
      seatedFullBodyFigure: 1,
      steleCourses: 9,
    });
    expect(brecht.userData.exactOwnOsmKey).toBe("node/988668382");
    expect(
      brecht.getObjectByName("Bertolt Brecht memorial installation bodies"),
    ).toBeInstanceOf(Mesh);
    const bounds = new Box3().setFromObject(brecht);
    const size = bounds.getSize(new Vector3());
    expect(size.x).toBeGreaterThan(6.3);
    expect(size.x).toBeLessThan(6.6);
    expect(size.z).toBeGreaterThan(6.5);
    expect(size.z).toBeLessThan(6.8);
    expect(size.y).toBeGreaterThan(2.5);
    const fine = brecht.getObjectByName(
      "Bertolt Brecht seated figure and installation fine detail",
    )!;
    expect(fine.userData.detailFadeM).toEqual([34, 105]);
    expect(fine.userData.inscriptionPolicy).toContain("never reproduced");
    expect(FINE_DETAIL_LAYER_NAMES).toContain(fine.name);
    expect(
      Math.abs(
        bounds.getCenter(new Vector3()).x -
          BERLINER_ENSEMBLE_PROFILE.brechtMonumentWorld[0],
      ),
    ).toBeLessThan(0.25);
  });

  test("renders the unveiled 2026 glass work with chair, objects, light/audio and halftone portrait", () => {
    const root = createBerlinerEnsemblePublicArt();
    const weigel = root.getObjectByName(
      "Für Helene Weigel current memorial",
    )!;
    expect(weigel.userData.exactOwnOsmKey).toBe("node/13841652635");
    expect(weigel.userData.detailCounts).toEqual({
      directorChairs: 1,
      glassVitrines: 1,
      lightAndAudioBars: 3,
      plinthVentSlots: 8,
      portraitDots: 110,
    });
    const glass = weigel.getObjectByName(
      "Helene Weigel clear glass vitrine",
    ) as Mesh;
    expect(glass).toBeInstanceOf(Mesh);
    expect(glass.material).toBeInstanceOf(MeshBasicMaterial);
    expect((glass.material as MeshBasicMaterial).transparent).toBeTrue();
    const portrait = weigel.getObjectByName(
      "Helene Weigel halftone glass portrait",
    ) as InstancedMesh;
    expect(portrait).toBeInstanceOf(InstancedMesh);
    expect(portrait.count).toBe(110);
    expect(portrait.userData.textureFree).toBeTrue();
    expect(FINE_DETAIL_LAYER_NAMES).toContain(portrait.name);
    expect(
      weigel.getObjectByName("Helene Weigel vitrine contents and plinth lamps"),
    ).toBeInstanceOf(Mesh);

    const dayGlass = glass.material;
    setIsoNightPresentation(root, true, true, "night");
    expect(glass.material).toBeInstanceOf(MeshStandardMaterial);
    expect(glass.material).not.toBe(dayGlass);
    setIsoNightPresentation(root, false, true, "schwellenraum");
    expect(glass.material).toBe(dayGlass);
  });

  test("never bundles a photo/portrait texture and owns both nodes once", () => {
    const root = createBerlinerEnsemblePublicArt();
    expect(root.userData).toMatchObject({
      ownedOsmKeys: ["node/988668382", "node/13841652635"],
      schwellenraumGeschuetzt: true,
      suppressesGenericModels: true,
    });
    const materials = new Set<Material>();
    root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const entries = Array.isArray(object.material)
        ? object.material
        : [object.material];
      entries.forEach((material) => materials.add(material));
      if (object.userData.dayMaterial instanceof Material) {
        materials.add(object.userData.dayMaterial);
      }
      if (object.userData.nightMaterial instanceof Material) {
        materials.add(object.userData.nightMaterial);
      }
    });
    for (const material of materials) {
      if (material instanceof MeshBasicMaterial || material instanceof MeshStandardMaterial) {
        expect(material.map).toBeNull();
      }
    }
  });

  test("switches reversible snow accents without changing the memorial bodies", () => {
    const root = createBerlinerEnsemblePublicArt();
    const snow = root.getObjectByName(
      "Berliner Ensemble public-art snow accents",
    )!;
    const brecht = root.getObjectByName(
      "Bertolt Brecht memorial installation",
    )!;
    expect(snow.visible).toBeFalse();
    expect(
      snow.getObjectByName("Brecht seated figure head snow cap"),
    ).not.toBeNull();
    expect(
      snow.children.filter((child) =>
        child.name.startsWith("Brecht cylindrical stele"),
      ),
    ).toHaveLength(3);
    setBerlinerEnsemblePublicArtSnow(root, true);
    expect(snow.visible).toBeTrue();
    expect(snow.userData.snowActive).toBeTrue();
    expect(brecht.visible).toBeTrue();
    setBerlinerEnsemblePublicArtSnow(root, false);
    expect(snow.visible).toBeFalse();
    expect(brecht.visible).toBeTrue();
  });

  test("collides only with the figure/chair, three steles and current vitrine", () => {
    const [brechtX, brechtZ] = BERLINER_ENSEMBLE_PROFILE.brechtMonumentWorld;
    const [weigelX, weigelZ] =
      BERLINER_ENSEMBLE_PROFILE.heleneWeigelCourtyardWorld;
    expect(berlinerEnsemblePublicArtSolidAt(brechtX, 5.3, brechtZ, 0.25)).toBeTrue();
    // The six-metre display platform itself remains traversable outside the
    // actual artwork solids; it is not replaced by a six-metre collision disk.
    expect(berlinerEnsemblePublicArtSolidAt(brechtX, 5.3, brechtZ + 2.85, 0.1)).toBeFalse();
    const firstSteleLocalX = Math.cos(-2.2) * 3.34;
    const firstSteleLocalZ = Math.sin(-2.2) * 3.34;
    const cosine = Math.cos(-0.62);
    const sine = Math.sin(-0.62);
    const firstSteleWorldX =
      brechtX + cosine * firstSteleLocalX + sine * firstSteleLocalZ;
    const firstSteleWorldZ =
      brechtZ - sine * firstSteleLocalX + cosine * firstSteleLocalZ;
    expect(
      berlinerEnsemblePublicArtSolidAt(
        firstSteleWorldX,
        5.98,
        firstSteleWorldZ,
      ),
    ).toBeTrue();
    expect(
      berlinerEnsemblePublicArtSolidAt(
        firstSteleWorldX,
        6.25,
        firstSteleWorldZ,
      ),
    ).toBeFalse();
    expect(berlinerEnsemblePublicArtSolidAt(weigelX, 5.3, weigelZ, 0.25)).toBeTrue();
    expect(berlinerEnsemblePublicArtSolidAt(weigelX + 4, 5.3, weigelZ, 0.25)).toBeFalse();
    expect(berlinerEnsemblePublicArtSolidAt(Number.NaN, 5, weigelZ, 0)).toBeFalse();
  });

  test("builds a deterministic bounded block-native Brecht signature for full and mobile", () => {
    const full = createMinecraftBrechtMemorial();
    const mobile = createMinecraftBrechtMemorial();
    expect(full.userData).toMatchObject({
      blockNative: true,
      drawCallCount: 4,
      exactOwnOsmKey: "node/988668382",
      instanceCount: 197,
      sourceBound: true,
    });
    expect(full.children).toHaveLength(4);
    const fullBatches = full.children as InstancedMesh[];
    const mobileBatches = mobile.children as InstancedMesh[];
    const sharedGeometry = fullBatches[0].geometry;
    for (let index = 0; index < fullBatches.length; index += 1) {
      const fullBatch = fullBatches[index];
      const mobileBatch = mobileBatches[index];
      expect(fullBatch).toBeInstanceOf(InstancedMesh);
      expect(fullBatch.geometry).toBe(sharedGeometry);
      expect(fullBatch.geometry.getAttribute("uv")).toBeUndefined();
      expect((fullBatch.material as MeshStandardMaterial).map).toBeNull();
      expect((fullBatch.material as MeshStandardMaterial).transparent).toBeFalse();
      expect(Array.from(fullBatch.instanceMatrix.array)).toEqual(
        Array.from(mobileBatch.instanceMatrix.array),
      );
    }
    const size = new Box3().setFromObject(full).getSize(new Vector3());
    expect(size.x).toBeLessThan(6.4);
    expect(size.y).toBeLessThan(2.6);
    expect(size.z).toBeLessThan(6.6);
  });

  test("freezes identical full/mobile smooth and voxel render budgets", () => {
    const publicArt = createBerlinerEnsemblePublicArt();
    const smooth = publicArt.getObjectByName(
      "Bertolt Brecht memorial installation",
    )!;
    let smoothRenderables = 0;
    let smoothStoredVertices = 0;
    let smoothRenderedVertices = 0;
    smooth.traverse((object) => {
      if (!(object instanceof Mesh) && !(object instanceof LineSegments)) return;
      const vertices = object.geometry.getAttribute("position")?.count ?? 0;
      smoothRenderables += 1;
      smoothStoredVertices += vertices;
      smoothRenderedVertices +=
        vertices * (object instanceof InstancedMesh ? object.count : 1);
    });
    expect({
      renderables: smoothRenderables,
      renderedVertices: smoothRenderedVertices,
      storedVertices: smoothStoredVertices,
    }).toEqual({
      renderables: 3,
      renderedVertices: 24_840,
      storedVertices: 24_840,
    });

    const voxel = createMinecraftBrechtMemorial();
    const geometries = new Set(
      voxel.children.map((child) => (child as InstancedMesh).geometry),
    );
    const renderedVertices = voxel.children.reduce((total, child) => {
      const batch = child as InstancedMesh;
      return (
        total + batch.geometry.getAttribute("position").count * batch.count
      );
    }, 0);
    expect({
      batches: voxel.children.length,
      blocks: voxel.userData.instanceCount,
      renderedVertices,
      uniqueStoredVertices: [...geometries].reduce(
        (total, geometry) =>
          total + geometry.getAttribute("position").count,
        0,
      ),
    }).toEqual({
      batches: 4,
      blocks: 197,
      renderedVertices: 4_728,
      uniqueStoredVertices: 24,
    });
  });
});

const viewerSource = await Bun.file(
  new URL("../src/ThreeViewer.tsx", import.meta.url),
).text();

describe("Berliner Ensemble runtime wiring", () => {
  test("shares the bounded mobile cadence between smooth and block-native signs", () => {
    expect(viewerSource).toContain(
      "const roofSignMotion = berlinerEnsembleRoofSignMotionDecision({",
    );
    for (const gate of [
      "fineDetailVisible: runtime.fineDetailVisible",
      'hidden: document.visibilityState === "hidden"',
      "onScreen: isBerlinerEnsembleRoofSignOnScreen(",
      "reducedMotion,",
      "underside: runtime.underside",
    ]) {
      expect(viewerSource).toContain(gate);
    }
    expect(viewerSource).toContain(
      "runtime.berlinerEnsembleRoofSignElapsedSeconds +=\n            flagFrameIntervalMs / 1_000",
    );
    expect(viewerSource).toContain(
      "registerBerlinerEnsembleRoofSignTargets(runtime, provisionalVoxelWorld)",
    );
    expect(viewerSource).not.toContain(
      "requestAnimationFrame(updateBerlinerEnsembleRoofSign",
    );
  });

  test("wires reversible snow and exact solids into both pedestrian construction paths", () => {
    expect(
      viewerSource.match(/setBerlinerEnsemblePublicArtSnow\(/g),
    ).toHaveLength(2);
    expect(
      viewerSource.match(/berlinerEnsemblePublicArtSolidAt\(/g),
    ).toHaveLength(2);
    expect(viewerSource).toContain(
      "runtime.focusCameraByName.set(\n            BERLINER_ENSEMBLE_PUBLIC_ART_PROFILE.brecht.name",
    );
    expect(viewerSource).toContain(
      "case BERLINER_ENSEMBLE_PUBLIC_ART_PROFILE.brecht.name:",
    );
  });
});
