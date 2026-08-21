import { describe, expect, test } from "bun:test";
import {
  Box3,
  InstancedMesh,
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
    expect(profile.brecht.sources).toEqual(
      expect.arrayContaining([
        expect.stringContaining("deutsche-digitale-bibliothek.de/item/"),
        expect.stringContaining("defa-stiftung.de/"),
        expect.stringContaining("commons.wikimedia.org/wiki/File:"),
      ]),
    );
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
  });

  test("renders Cremer's seated installation instead of the former block person", () => {
    const root = createBerlinerEnsemblePublicArt();
    const brecht = root.getObjectByName(
      "Bertolt Brecht memorial installation",
    )!;
    expect(brecht.userData.detailCounts).toEqual({
      chairLegs: 4,
      platformDiameterM: 6,
      seatedFullBodyFigure: 1,
      segmentedSteles: 3,
    });
    expect(brecht.userData.exactOwnOsmKey).toBe("node/988668382");
    expect(
      brecht.getObjectByName("Bertolt Brecht memorial installation bodies"),
    ).toBeInstanceOf(Mesh);
    const bounds = new Box3().setFromObject(brecht);
    const size = bounds.getSize(new Vector3());
    expect(size.x).toBeGreaterThan(5.8);
    expect(size.x).toBeLessThan(6.1);
    expect(size.z).toBeGreaterThan(5.8);
    expect(size.y).toBeGreaterThan(2.4);
    expect(bounds.getCenter(new Vector3()).x).toBeCloseTo(
      BERLINER_ENSEMBLE_PROFILE.brechtMonumentWorld[0],
      1,
    );
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
    expect(berlinerEnsemblePublicArtSolidAt(weigelX, 5.3, weigelZ, 0.25)).toBeTrue();
    expect(berlinerEnsemblePublicArtSolidAt(weigelX + 4, 5.3, weigelZ, 0.25)).toBeFalse();
    expect(berlinerEnsemblePublicArtSolidAt(Number.NaN, 5, weigelZ, 0)).toBeFalse();
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
      "registerBerlinerEnsembleRoofSignTargets(\n        runtime,\n        provisionalVoxelWorld",
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
  });
});
