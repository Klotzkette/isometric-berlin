import { describe, expect, test } from "bun:test";
import { Group, Mesh, MeshBasicMaterial, PlaneGeometry } from "three";

import {
  markWindFlag,
  type WindFlagKind,
  updateWindFlags,
} from "../src/WindFlags";
import { createCivicLandmarks } from "../src/CivicLandmarks";
import { createCsdAttackMemorial } from "../src/CsdAttackMemorial";
import {
  SCHWELLENRAUM_FLAG_FRAME_INTERVAL_MS,
  SCHWELLENRAUM_MOVING_FLAG_KINDS,
  countSchwellenraumMovingFlags,
  isSchwellenraumWorldMotionAllowed,
  schwellenraumMotionDecision,
  updateSchwellenraumMovingFlags,
} from "../src/visual-modes/schwellenraum/motion";
import { createSchwellenraumPraesentation } from "../src/visual-modes/schwellenraum/presentation";
import { installSchwellenraumStaticProps } from "../src/visual-modes/schwellenraum/staticProps";

const stylesSource = await Bun.file(
  new URL("../src/styles.css", import.meta.url),
).text();

function flag(kind: WindFlagKind): Mesh {
  const geometry = new PlaneGeometry(4, 1.5, 8, 2);
  geometry.translate(2, 0, 0);
  const mesh = new Mesh(geometry, new MeshBasicMaterial());
  markWindFlag(mesh, 4, { amplitudeM: 0.32, kind, phase: 0.4 });
  return mesh;
}

function positionSnapshot(mesh: Mesh): number[] {
  return Array.from(mesh.geometry.getAttribute("position").array);
}

function matrixSnapshot(root: Group): Map<string, number[]> {
  root.updateMatrixWorld(true);
  const snapshot = new Map<string, number[]>();
  root.traverse((object) => {
    snapshot.set(`${object.id}:${object.name}`, object.matrixWorld.toArray());
  });
  return snapshot;
}

describe("Schwellenraum closed world-motion contract", () => {
  test("contains exactly the four explicitly recognised civic flag classes", () => {
    expect(SCHWELLENRAUM_MOVING_FLAG_KINDS).toEqual([
      "federal-president",
      "germany",
      "european-union",
      "switzerland",
    ]);
    expect(new Set(SCHWELLENRAUM_MOVING_FLAG_KINDS).size).toBe(4);
    for (const flagKind of SCHWELLENRAUM_MOVING_FLAG_KINDS) {
      expect(
        isSchwellenraumWorldMotionAllowed({
          flagKind,
          kind: "wind-flag",
        }),
      ).toBeTrue();
    }
    expect(
      isSchwellenraumWorldMotionAllowed({
        flagKind: "other",
        kind: "wind-flag",
      }),
    ).toBeFalse();
    for (const kind of [
      "light",
      "minecraft-mob",
      "particle",
      "prop",
      "rain",
      "snow",
      "vegetation",
      "vessel",
      "water",
    ] as const) {
      expect(isSchwellenraumWorldMotionAllowed({ kind }), kind).toBeFalse();
    }
    expect(
      isSchwellenraumWorldMotionAllowed({ kind: "water-light" }),
    ).toBeTrue();
  });

  test("updates all four allowed classes and leaves every other wind flag frozen", () => {
    const root = new Group();
    const allowed = SCHWELLENRAUM_MOVING_FLAG_KINDS.map((kind) => flag(kind));
    const other = flag("other");
    root.add(...allowed, other);
    const beforeAllowed = allowed.map(positionSnapshot);
    const beforeOther = positionSnapshot(other);

    expect(countSchwellenraumMovingFlags([root])).toBe(4);
    updateSchwellenraumMovingFlags([root], 1.7);

    for (const [index, mesh] of allowed.entries()) {
      expect(positionSnapshot(mesh)).not.toEqual(beforeAllowed[index]);
    }
    expect(positionSnapshot(other)).toEqual(beforeOther);

    const animated = positionSnapshot(allowed[0]);
    updateWindFlags(root, 0.9);
    expect(positionSnapshot(allowed[0])).not.toEqual(animated);
    expect(positionSnapshot(other)).not.toEqual(beforeOther);
  });

  test("classifies the Flag of Unity as a German flag in the authored civic model", () => {
    const civic = createCivicLandmarks([
      { name: "Fahne der Einheit", world: [0, 0, 0] },
    ]);
    const unity = civic.getObjectByName(
      "Official-dimension Flag of Unity model",
    );
    expect(unity).toBeDefined();
    const authoredKinds: WindFlagKind[] = [];
    unity?.traverse((object) => {
      const data = object.userData.windFlag as
        { kind?: WindFlagKind } | undefined;
      if (data?.kind) authoredKinds.push(data.kind);
    });
    expect(authoredKinds).toEqual(["germany", "germany", "germany"]);
  });

  test("suppresses Rain, Snow and Mob updates even when their visibility flags are true", () => {
    const beforeTick = schwellenraumMotionDecision({
      lastFlagFrameAt: 100,
      lastWaterFrameAt: 100,
      minecraftMobsVisible: true,
      mode: "schwellenraum",
      movingFlagCount: 4,
      rainVisible: true,
      reducedMotion: false,
      snowVisible: true,
      timestamp: 100 + SCHWELLENRAUM_FLAG_FRAME_INTERVAL_MS - 0.01,
      waterLightCount: 0,
    });
    expect(beforeTick).toEqual({
      animateFlags: false,
      animateOrdinaryEnvironment: false,
      animateWaterLight: false,
      environmentalMotion: false,
    });

    const tick = schwellenraumMotionDecision({
      lastFlagFrameAt: 100,
      lastWaterFrameAt: 100,
      minecraftMobsVisible: true,
      mode: "schwellenraum",
      movingFlagCount: 4,
      rainVisible: true,
      reducedMotion: false,
      snowVisible: true,
      timestamp: 100 + SCHWELLENRAUM_FLAG_FRAME_INTERVAL_MS,
      waterLightCount: 0,
    });
    expect(tick).toEqual({
      animateFlags: true,
      animateOrdinaryEnvironment: false,
      animateWaterLight: false,
      environmentalMotion: true,
    });
    expect(stylesSource).toContain(".app-shell--schwellenraum .map-rain");
    expect(stylesSource).toMatch(
      /\.app-shell--schwellenraum \.map-rain,\s*\.app-shell--schwellenraum \.map-snowstorm\s*\{\s*display: none;/,
    );
    expect(stylesSource).toContain(
      '.mobile-overflow-grid button:disabled[aria-pressed="true"]',
    );
  });

  test("reuses one decision object during continuous rendering", () => {
    const output = {
      animateFlags: false,
      animateOrdinaryEnvironment: false,
      animateWaterLight: false,
      environmentalMotion: false,
    };
    const result = schwellenraumMotionDecision(
      {
        lastFlagFrameAt: 0,
        lastWaterFrameAt: 0,
        minecraftMobsVisible: false,
        mode: "schwellenraum",
        movingFlagCount: 4,
        rainVisible: false,
        reducedMotion: false,
        snowVisible: false,
        timestamp: SCHWELLENRAUM_FLAG_FRAME_INTERVAL_MS,
        waterLightCount: 1,
      },
      output,
    );
    expect(result).toBe(output);
    expect(result.animateFlags).toBe(true);
  });

  test("cadences the four civic flags in every ordinary visual mode", () => {
    for (const mode of ["day", "night", "snowstorm", "minecraft"] as const) {
      const decision = schwellenraumMotionDecision({
        lastFlagFrameAt: 0,
        lastWaterFrameAt: 0,
        minecraftMobsVisible: false,
        mode,
        movingFlagCount: 4,
        rainVisible: false,
        reducedMotion: false,
        snowVisible: false,
        timestamp: 10_000,
        waterLightCount: 3,
      });
      expect(decision, mode).toEqual({
        animateFlags: true,
        animateOrdinaryEnvironment: true,
        animateWaterLight: false,
        environmentalMotion: true,
      });
    }
  });

  test("freezes cloth for reduced motion without suppressing ordinary weather", () => {
    const decision = schwellenraumMotionDecision({
      lastFlagFrameAt: 0,
      lastWaterFrameAt: 0,
      minecraftMobsVisible: false,
      mode: "snowstorm",
      movingFlagCount: 4,
      rainVisible: false,
      reducedMotion: true,
      snowVisible: true,
      timestamp: 10_000,
      waterLightCount: 0,
    });
    expect(decision).toEqual({
      animateFlags: false,
      animateOrdinaryEnvironment: true,
      animateWaterLight: false,
      environmentalMotion: true,
    });
  });

  test("keeps static light thresholds and fixed props on identical matrices over time", () => {
    const presentation = createSchwellenraumPraesentation();
    expect(installSchwellenraumStaticProps(presentation, () => 4.2)).toBe(12);
    const before = matrixSnapshot(presentation);

    for (const elapsed of [0.25, 1.7, 8.4, 42]) {
      updateSchwellenraumMovingFlags([presentation], elapsed);
      presentation.updateMatrixWorld(true);
    }

    expect(matrixSnapshot(presentation)).toEqual(before);
    presentation.traverse((object) => {
      if (object.userData.schwellenraumStatic === true) {
        expect(object.userData.windFlag).toBeUndefined();
        expect(object.userData.windFlagInstances).toBeUndefined();
      }
    });
  });

  test("keeps the CSD memorial's small Pride flags static", () => {
    const memorial = createCsdAttackMemorial();
    expect(memorial.userData.staticPrideFlagCount).toBe(3);
    const before = matrixSnapshot(memorial);

    for (const elapsed of [0.25, 1.7, 8.4, 42]) {
      updateSchwellenraumMovingFlags([memorial], elapsed);
      memorial.updateMatrixWorld(true);
    }

    expect(matrixSnapshot(memorial)).toEqual(before);
    memorial.traverse((object) => {
      expect(object.userData.windFlag).toBeUndefined();
      expect(object.userData.windFlagInstances).toBeUndefined();
    });
  });
});
