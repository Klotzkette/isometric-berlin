import { describe, expect, test } from "bun:test";
import { Group, Object3D } from "three";
import {
  createFriedrichstadtAndTearPalaces,
  FRIEDRICHSTADT_PALAST_MINECRAFT_NAME,
  FRIEDRICHSTADT_PALAST_ROOT_NAME,
  setFriedrichstadtMinecraftPresentation,
  TEAR_PALACE_ROOT_NAME,
} from "../src/FriedrichstadtAndTearPalaces";

import {
  applyMinecraftVisibility,
  restoreMinecraftVisibility,
  type MinecraftVisibilityRoots,
} from "../src/MinecraftVisibility";

function object(name: string, visible = true): Object3D {
  const value = new Object3D();
  value.name = name;
  value.visible = visible;
  return value;
}

function branch(name: string, ...children: Object3D[]): Group {
  const value = new Group();
  value.name = name;
  value.add(...children);
  return value;
}

function miniScene(): MinecraftVisibilityRoots & {
  amtssitz: Group;
  amtssitzBody: Object3D;
  amtssitzFlag: Object3D;
  bridgeDetail: Object3D;
  bridgeSmoothVoxelReplacement: Group;
  centralBrecht: Group;
  centralPublicArt: Group;
  centralPublicArtSnow: Object3D;
  centralSmooth: Object3D;
  centralWeigel: Group;
  civicBody: Object3D;
  refinementOther: Group;
  refinementTiergarten: Group;
  smoothSignature: Group;
  smoothSignatureBody: Object3D;
  smoothSignatureFlag: Object3D;
  smoothSignatureIce: Object3D;
  spotlight: Object3D;
  swissFlag: Object3D;
  unityStripes: Object3D[];
} {
  const bridgeDetail = object("drawn bridge railing", false);
  const bridgeSmoothVoxelReplacement = branch(
    "Weidendammer bridge smooth close detail",
    object("Weidendammer smooth eagle and love locks"),
  );
  bridgeSmoothVoxelReplacement.userData.keepInMinecraft = false;
  const bridges = branch(
    "drawn bridge structures",
    bridgeDetail,
    bridgeSmoothVoxelReplacement,
  );
  const spreebogen = branch(
    "Spreebogenpark landscape window",
    object("Spreebogenpark lawn"),
  );
  const tilla = branch(
    "Tilla-Durieux-Park lawn sculpture",
    object("Tilla-Durieux-Park lawn sculpture bodies"),
  );
  const amtssitzBody = object("Amtssitz am Spreebogen bodies");
  const amtssitzFlag = object("Amtssitz presidential standard gold field");
  const amtssitz = branch(
    "Amtssitz am Spreebogen",
    amtssitzBody,
    branch("flag wrapper", amtssitzFlag),
    object("Amtssitz slender roof antenna"),
  );
  const refinementTiergarten = branch(
    "Tiergarten bridge and memorial fine details",
    object("Tiergarten bridge and memorial fine details bodies", false),
  );
  const refinementOther = branch(
    "Hauptbahnhof and Europacity fine details",
    object("smooth facade details"),
  );
  const refinements = branch(
    "Open-data city recognition refinements",
    refinementTiergarten,
    refinementOther,
  );
  const smoothSignatureBody = object("smooth Reichstag dome");
  const smoothSignatureFlag = object("Reichstag tower 1:1 German flag stripe 1");
  smoothSignatureFlag.userData.windFlag = { kind: "germany" };
  const smoothSignatureIce = object("Civic flags shared winter icicles", false);
  smoothSignatureIce.userData.windFlagWinterAccents = true;
  const smoothSignature = branch(
    "Metre-scale Reichstag recognition model",
    smoothSignatureBody,
    smoothSignatureFlag,
    smoothSignatureIce,
  );
  const signatures = branch(
    "Dimensioned architectural signatures",
    bridges,
    spreebogen,
    tilla,
    amtssitz,
    refinements,
    smoothSignature,
  );

  const civicBody = object("Swiss Embassy 1871 historic palace");
  const swissFlag = object("Swiss Embassy animated red flag field", false);
  const embassy = branch(
    "Metric Swiss Embassy recognition model",
    civicBody,
    branch(
      "Swiss flag wrapper",
      object("Swiss Embassy flagpole"),
      swissFlag,
    ),
  );
  const unityStripes = [1, 2, 3].map((index) =>
    object(`Flag of Unity animated German stripe ${index}`),
  );
  const spotlight = object("Flag of Unity night spotlight 1");
  const unity = branch(
    "Official-dimension Flag of Unity model",
    object("Flag of Unity 28.5 m galvanized-steel pole"),
    ...unityStripes,
    object("Flag of Unity animated German stripe 4"),
    spotlight,
  );
  const civicDetails = branch(
    "Embassy and parliamentary civic recognition details",
    embassy,
    unity,
    branch("unknown smooth civic model", object("unknown civic body")),
  );
  const centralSmooth = object("smooth Hauptbahnhof recognition");
  const centralPublicArtSnow = object(
    "Berliner Ensemble public-art snow accents",
    false,
  );
  centralPublicArtSnow.userData.snowOnly = true;
  const centralBrecht = branch(
    "Bertolt Brecht memorial installation",
    object("Bertolt Brecht memorial installation bodies"),
  );
  const centralWeigel = branch(
    "Für Helene Weigel current memorial",
    object("Helene Weigel vitrine contents and plinth"),
    object("Helene Weigel halftone glass portrait", false),
  );
  const centralPublicArt = branch(
    "Berliner Ensemble public-art details",
    centralBrecht,
    centralWeigel,
    centralPublicArtSnow,
  );

  return {
    amtssitz,
    amtssitzBody,
    amtssitzFlag,
    bridgeDetail,
    bridgeSmoothVoxelReplacement,
    centralBrecht,
    centralDetails: branch("central details", centralSmooth, centralPublicArt),
    centralPublicArt,
    centralPublicArtSnow,
    centralSmooth,
    centralWeigel,
    cityStaffage: branch("city staffage", object("static car")),
    civicBody,
    civicDetails,
    refinementOther,
    refinementTiergarten,
    signatures,
    smoothSignature,
    smoothSignatureBody,
    smoothSignatureFlag,
    smoothSignatureIce,
    spotlight,
    swissFlag,
    unityStripes,
  };
}

function visibilitySnapshot(roots: MinecraftVisibilityRoots): Map<string, boolean> {
  const result = new Map<string, boolean>();
  for (const root of [
    roots.signatures,
    roots.centralDetails,
    roots.civicDetails,
    roots.cityStaffage,
  ]) {
    root.traverse((entry) => result.set(entry.uuid, entry.visible));
  }
  return result;
}

function effectivelyVisible(object: Object3D): boolean {
  for (let node: Object3D | null = object; node; node = node.parent) {
    if (!node.visible) return false;
  }
  return true;
}

describe("Minecraft smooth-scene visibility", () => {
  test("keeps only block-compatible landscape, bridge and flag details", () => {
    const roots = miniScene();
    applyMinecraftVisibility(roots, true);

    expect(roots.centralDetails.visible).toBeTrue();
    expect(roots.centralPublicArt.visible).toBeTrue();
    expect(roots.centralBrecht.visible).toBeFalse();
    expect(roots.centralWeigel.visible).toBeTrue();
    expect(roots.centralPublicArtSnow.visible).toBeFalse();
    expect(roots.centralSmooth.visible).toBeFalse();
    expect(roots.cityStaffage.visible).toBeFalse();
    expect(roots.signatures.visible).toBeTrue();
    expect(roots.bridgeDetail.visible).toBeTrue();
    expect(roots.bridgeSmoothVoxelReplacement.visible).toBeFalse();
    expect(roots.amtssitz.visible).toBeTrue();
    expect(roots.amtssitzBody.visible).toBeFalse();
    expect(roots.amtssitzFlag.visible).toBeTrue();
    expect(roots.refinementTiergarten.visible).toBeTrue();
    expect(roots.refinementTiergarten.children[0].visible).toBeTrue();
    expect(roots.refinementOther.visible).toBeFalse();
    expect(roots.smoothSignature.visible).toBeTrue();
    expect(roots.smoothSignatureBody.visible).toBeFalse();
    expect(roots.smoothSignatureFlag.visible).toBeTrue();
    // Snowstorm is its own drawn mode. The Minecraft leaf filter must not
    // reactivate a hidden winter-only batch in ordinary voxel presentation.
    expect(roots.smoothSignatureIce.visible).toBeFalse();

    expect(roots.civicDetails.visible).toBeTrue();
    expect(roots.civicBody.visible).toBeFalse();
    expect(roots.swissFlag.visible).toBeTrue();
    expect(roots.unityStripes.every(({ visible }) => visible)).toBeTrue();
    expect(
      roots.civicDetails.getObjectByName(
        "Flag of Unity animated German stripe 4",
      )?.visible,
    ).toBeFalse();
    expect(roots.spotlight.visible).toBeFalse();
    expect(roots.civicDetails.children[2].visible).toBeFalse();
  });

  test("restores owned leaves exactly before the next mode relights them", () => {
    const roots = miniScene();
    const before = visibilitySnapshot(roots);

    applyMinecraftVisibility(roots, true);
    restoreMinecraftVisibility(roots);
    // Surface roots are deliberately restored by the caller's current-mode
    // baseline, not from a potentially stale underside snapshot.
    roots.centralDetails.visible = true;
    roots.cityStaffage.visible = true;

    const after = visibilitySnapshot(roots);
    for (const [uuid, visible] of before) {
      expect(after.get(uuid), uuid).toBe(visible);
    }
  });

  test("round-trips underside Minecraft through above-ground Minecraft to Day", () => {
    const roots = miniScene();

    // Enter Minecraft while below ground: ordinary root policy starts false.
    roots.centralDetails.visible = false;
    roots.cityStaffage.visible = false;
    applyMinecraftVisibility(roots, true);
    expect(roots.centralDetails.visible).toBeFalse();

    // Surface in the same mode: caller establishes the surface baseline and
    // the voxel filter keeps only the BE public-art branch for the frame.
    roots.centralDetails.visible = true;
    roots.cityStaffage.visible = true;
    applyMinecraftVisibility(roots, true);
    expect(roots.centralDetails.visible).toBeTrue();
    expect(roots.centralPublicArt.visible).toBeTrue();
    expect(roots.centralBrecht.visible).toBeFalse();
    expect(roots.centralWeigel.visible).toBeTrue();
    expect(roots.centralPublicArtSnow.visible).toBeFalse();
    expect(roots.centralSmooth.visible).toBeFalse();
    expect(roots.cityStaffage.visible).toBeFalse();

    // Mode exit restores owned children first; Day then owns both roots.
    restoreMinecraftVisibility(roots);
    roots.centralDetails.visible = true;
    roots.cityStaffage.visible = true;
    applyMinecraftVisibility(roots, false);
    expect(roots.centralDetails.visible).toBeTrue();
    expect(roots.cityStaffage.visible).toBeTrue();
    expect(roots.smoothSignature.visible).toBeTrue();
    expect(roots.civicBody.visible).toBeTrue();
  });

  test("orders Minecraft, Snow and Day ownership without leaving a smooth/voxel double", () => {
    const roots = miniScene();

    // Warm Minecraft: only the current Weigel work remains smooth; Brecht and
    // the authored Weidendammer close-detail are owned by their voxel roots.
    applyMinecraftVisibility(roots, true);
    expect(roots.centralBrecht.visible).toBeFalse();
    expect(roots.centralWeigel.visible).toBeTrue();
    expect(roots.bridgeSmoothVoxelReplacement.visible).toBeFalse();

    // Mode exit restores Minecraft-owned state before Snow turns its authored
    // cap on. This mirrors the viewer's restore-then-relight ordering.
    restoreMinecraftVisibility(roots);
    roots.centralDetails.visible = true;
    roots.cityStaffage.visible = true;
    roots.centralPublicArtSnow.visible = true;
    applyMinecraftVisibility(roots, false);
    expect(roots.centralBrecht.visible).toBeTrue();
    expect(roots.centralWeigel.visible).toBeTrue();
    expect(roots.centralPublicArtSnow.visible).toBeTrue();
    expect(roots.bridgeSmoothVoxelReplacement.visible).toBeTrue();

    // Cold/re-entered Minecraft suppresses both smooth replacements again and
    // never carries the snow-only layer into ordinary voxel presentation.
    applyMinecraftVisibility(roots, true);
    expect(roots.centralBrecht.visible).toBeFalse();
    expect(roots.centralWeigel.visible).toBeTrue();
    expect(roots.centralPublicArtSnow.visible).toBeFalse();
    expect(roots.bridgeSmoothVoxelReplacement.visible).toBeFalse();

    restoreMinecraftVisibility(roots);
    roots.centralPublicArtSnow.visible = false;
    applyMinecraftVisibility(roots, false);
    expect(roots.centralBrecht.visible).toBeTrue();
    expect(roots.centralPublicArtSnow.visible).toBeFalse();
    expect(roots.bridgeSmoothVoxelReplacement.visible).toBeTrue();
  });

  test("filters and later restores details added after a cold voxel frame", () => {
    const roots = miniScene();
    applyMinecraftVisibility(roots, true);

    const lateSmooth = branch("late smooth building", object("late facade"));
    const lateTerrain = branch(
      "Tilla-Durieux-Park lawn sculpture",
      object("late Tilla body", false),
    );
    roots.signatures.add(lateSmooth, lateTerrain);
    applyMinecraftVisibility(roots, true);
    expect(lateSmooth.visible).toBeFalse();
    expect(lateTerrain.visible).toBeTrue();
    expect(lateTerrain.children[0].visible).toBeTrue();

    restoreMinecraftVisibility(roots);
    expect(lateSmooth.visible).toBeTrue();
    expect(lateTerrain.children[0].visible).toBeFalse();
  });

  for (const profile of ["full", "mobile"] as const) {
    test(`${profile}: cold Palast commit retains its block batch and every wrapper`, () => {
      const roots = miniScene();
      applyMinecraftVisibility(roots, true);
      const palaces = createFriedrichstadtAndTearPalaces(profile);
      roots.centralDetails.add(branch("late civic wrapper", palaces));
      const smooth = palaces.getObjectByName(FRIEDRICHSTADT_PALAST_ROOT_NAME)!;
      const blocks = palaces.getObjectByName(FRIEDRICHSTADT_PALAST_MINECRAFT_NAME)!;
      const tearPalace = palaces.getObjectByName(TEAR_PALACE_ROOT_NAME)!;
      // Covers the old viewer order too: a preceding leaf selector cannot
      // survive if the central visibility pass hides its wrapper afterwards.
      setFriedrichstadtMinecraftPresentation(roots.centralDetails, true);
      for (let frame = 0; frame < 2; frame += 1) {
        applyMinecraftVisibility(roots, true);
        expect(effectivelyVisible(blocks)).toBeTrue();
        expect(blocks.children.every(effectivelyVisible)).toBeTrue();
        expect(effectivelyVisible(smooth)).toBeFalse();
        expect(effectivelyVisible(tearPalace)).toBeFalse();
        expect(effectivelyVisible(roots.centralWeigel)).toBeTrue();
        expect(roots.centralPublicArtSnow.visible).toBeFalse();
      }
      // A prior setter must likewise not be overwritten by saved visibility
      // when leaving Minecraft, even without a separate restoration call.
      setFriedrichstadtMinecraftPresentation(roots.centralDetails, false);
      applyMinecraftVisibility(roots, false);
      expect(effectivelyVisible(smooth)).toBeTrue();
      expect(effectivelyVisible(tearPalace)).toBeTrue();
      expect(effectivelyVisible(blocks)).toBeFalse();
    });

    test(`${profile}: Palast warm mode and underside transitions select one visible body`, () => {
      const roots = miniScene();
      const palaces = createFriedrichstadtAndTearPalaces(profile);
      roots.centralDetails.add(branch("nested civic wrapper", palaces));
      const smooth = palaces.getObjectByName(FRIEDRICHSTADT_PALAST_ROOT_NAME)!;
      const blocks = palaces.getObjectByName(FRIEDRICHSTADT_PALAST_MINECRAFT_NAME)!;
      const tearPalace = palaces.getObjectByName(TEAR_PALACE_ROOT_NAME)!;
      for (const mode of ["day", "minecraft", "night", "minecraft", "snowstorm", "schwellenraum", "minecraft", "day"]) {
        // The real viewer releases saved visibility before relighting and
        // then establishes the ordinary surface/underside root baseline.
        restoreMinecraftVisibility(roots);
        const minecraft = mode === "minecraft";
        for (const underside of [false, true, false]) {
          roots.centralDetails.visible = !underside;
          applyMinecraftVisibility(roots, minecraft);
          expect(effectivelyVisible(blocks)).toBe(minecraft && !underside);
          expect(effectivelyVisible(smooth)).toBe(!minecraft && !underside);
          expect(effectivelyVisible(tearPalace)).toBe(!minecraft && !underside);
          expect(effectivelyVisible(roots.centralWeigel)).toBe(!underside);
        }
      }
    });
  }
});

const viewerSource = await Bun.file(
  new URL("../src/ThreeViewer.tsx", import.meta.url),
)
  .text()
  .then((source) => source.replaceAll("\r\n", "\n"));

describe("Minecraft visibility source wiring", () => {
  test("restores before relighting and applies after both live visibility paths", () => {
    expect(viewerSource).toContain(
      'restoreMinecraftVisibility(minecraftVisibilityRoots(runtime))',
    );
    expect(
      viewerSource.indexOf(
        "restoreMinecraftVisibility(minecraftVisibilityRoots(runtime))",
      ),
    ).toBeLessThan(viewerSource.indexOf("runtime.lightingMode = mode"));
    expect(
      viewerSource.match(
        /applyRuntimeMinecraftVisibility\(runtime, voxelMode\);/g,
      ),
    ).toHaveLength(2);
    expect(viewerSource).toContain(
      "applyMinecraftVisibility(minecraftVisibilityRoots(runtime), voxelMode);",
    );
    expect(
      viewerSource.match(/runtime\.cityStaffage\.visible = !runtime\.underside/g),
    ).toHaveLength(1);
    expect(viewerSource).toContain(
      "runtime.cityStaffage.visible = !underside",
    );
  });

  test("reapplies after manifest replacements and lazy signature additions", () => {
    expect(
      viewerSource.match(
        /applyRuntimeMinecraftVisibility\(runtime, voxelModeActive\(runtime\)\);/g,
      ),
    ).toHaveLength(3);
    for (const sourceAnchor of [
      "runtime.centralDetails = createCentralCivicDetails(",
      "runtime.signatures.add(model)",
      "runtime.signatures.add(tillaDurieux)",
    ]) {
      const anchorIndex = viewerSource.indexOf(sourceAnchor);
      expect(anchorIndex, sourceAnchor).toBeGreaterThan(-1);
      expect(
        viewerSource.indexOf("applyRuntimeMinecraftVisibility(", anchorIndex),
        sourceAnchor,
      ).toBeGreaterThan(anchorIndex);
    }
  });

  test("replaces smooth literary and Wagner roots after voxel commit and preserves fallback", () => {
    const helperStart = viewerSource.indexOf(
      "function setTiergartenLiteraryMemorialSmoothVisibility(",
    );
    const helperEnd = viewerSource.indexOf(
      "function voxelWorldIntentActive(",
      helperStart,
    );
    const helper = viewerSource.slice(helperStart, helperEnd);
    expect(helper).toContain(
      "TIERGARTEN_LITERARY_MEMORIALS_PROFILE.goethe",
    );
    expect(helper).toContain(
      "TIERGARTEN_LITERARY_MEMORIALS_PROFILE.lessing",
    );
    expect(helper).toContain("tiergartenLiteraryMemorialSmooth");

    const lightingStart = viewerSource.indexOf("function setSceneLighting(");
    const lightingEnd = viewerSource.indexOf(
      "function setTiergartenLiteraryMemorialSmoothVisibility(",
      lightingStart,
    );
    const lighting = viewerSource.slice(lightingStart, lightingEnd);
    expect(lighting).toContain(
      "setTiergartenLiteraryMemorialSmoothVisibility(runtime.monuments, !voxelMode)",
    );
    expect(lighting.indexOf("setTiergartenLiteraryMemorialSmoothVisibility("))
      .toBeLessThan(
        lighting.indexOf("setTiergartenLiteraryMemorialsSnow("),
      );
    expect(viewerSource).toContain(
      "!voxelModeActive(runtime),\n          );\n          setTiergartenLiteraryMemorialsSnow(",
    );
    expect(
      viewerSource.match(
        /tiergartenLiteraryMemorialSolidAt\(x, y, z, radius\)/g,
      ),
    ).toHaveLength(2);
    expect(viewerSource).toContain(
      "setWagnerMemorialSmoothVisibility(runtime.monuments, !voxelMode)",
    );
    expect(viewerSource).toContain(
      "setWagnerMemorialSmoothVisibility(\n            runtime.monuments,\n            !voxelModeActive(runtime)",
    );
    expect(
      viewerSource.match(/wagnerMemorialSolidAt\(x, y, z, 0\)/g),
    ).toHaveLength(2);
    expect(viewerSource).toContain(
      "setWagnerMemorialSnow(runtime.monuments, isSnowstorm)",
    );
  });
});
