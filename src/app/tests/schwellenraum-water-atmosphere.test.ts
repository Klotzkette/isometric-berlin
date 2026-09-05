import { describe, expect, test } from "bun:test";
import {
  AdditiveBlending,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  ShaderMaterial,
} from "three";

import {
  SCHWELLENRAUM_WATER_FRAME_INTERVAL_MS,
  SCHWELLENRAUM_WATER_GLINT_PERIOD_SECONDS,
  SCHWELLENRAUM_WATER_OVERLAY_NAME,
  SCHWELLENRAUM_WATER_PROTECTED_MASKS,
  installSchwellenraumWaterAtmosphere,
  isSchwellenraumWaterAtmospherePointProtected,
  isSchwellenraumWaterSurface,
  schwellenraumWaterBreath,
  setSchwellenraumWaterAtmospherePresentation,
  updateSchwellenraumWaterAtmosphere,
} from "../src/visual-modes/schwellenraum/waterAtmosphere";
import { schwellenraumMotionDecision } from "../src/visual-modes/schwellenraum/motion";
import {
  isDedicatedSintiRomaPool,
  type SurfacePayload,
} from "../src/IsometricCityWorld";
import surfacePayload from "../public/mesh/regierungsviertel/surface-polygons.json";
import { SCHWELLENRAUM_PROTECTED_VOLUMES } from "../src/SchwellenraumInteriors";

const viewerSource = await Bun.file(
  new URL("../src/ThreeViewer.tsx", import.meta.url),
)
  .text()
  .then((source) => source.replaceAll("\r\n", "\n"));
const productionSurfaces = surfacePayload as unknown as SurfacePayload;
const pariserPlatzIdle = {
  lastPariserPlatzFrameAt: 0,
  pariserPlatzEntitiesOnScreen: false,
  pariserPlatzEntityCount: 0,
  pariserPlatzFrameIntervalMs: 1_000 / 30,
} as const;

const ELIGIBLE_WATER_NAMES = [
  "smooth water surface",
  "natural pond water",
  "basin water",
  "Otto-Weidt-Platz fountain water",
  "drawn water surface",
  "Sony Center Forum reflecting pool",
] as const;

const DUPLICATE_SPREE_WAVE_NAME =
  "Spree metrically aligned undulating water surface";

function water(name: string): Mesh {
  const mesh = new Mesh(new PlaneGeometry(12, 8), new MeshBasicMaterial());
  mesh.name = name;
  return mesh;
}

function matrices(root: Group): Map<number, number[]> {
  root.updateMatrixWorld(true);
  const result = new Map<number, number[]>();
  root.traverse((object) => {
    if (object.userData.schwellenraumWaterAtmosphere !== true) {
      result.set(object.id, object.matrixWorld.toArray());
    }
  });
  return result;
}

function overlays(root: Group): Mesh[] {
  const result: Mesh[] = [];
  root.traverse((object) => {
    if (
      object instanceof Mesh &&
      object.userData.schwellenraumWaterAtmosphere === true
    ) {
      result.push(object);
    }
  });
  return result;
}

function pointInWaterRing(
  x: number,
  z: number,
  ring: ReadonlyArray<ReadonlyArray<number>>,
): boolean {
  let inside = false;
  for (
    let current = 0, previous = ring.length - 1;
    current < ring.length;
    previous = current, current += 1
  ) {
    const [currentX, currentZ] = ring[current].map((value) => value / 10);
    const [previousX, previousZ] = ring[previous].map((value) => value / 10);
    const crosses =
      currentZ > z !== previousZ > z &&
      x <
        ((previousX - currentX) * (z - currentZ)) / (previousZ - currentZ) +
          currentX;
    if (crosses) inside = !inside;
  }
  return inside;
}

describe("Schwellenraum ethereal water atmosphere", () => {
  test("covers the complete mapped water inventory except the protected memorial pool", () => {
    expect(productionSurfaces.water).toHaveLength(175);
    const protectedPools = productionSurfaces.water.filter(
      isDedicatedSintiRomaPool,
    );
    expect(protectedPools).toHaveLength(1);
    expect(protectedPools[0].kind).toBe("basin");
    expect(productionSurfaces.water.length - protectedPools.length).toBe(174);
    expect(
      new Set(productionSurfaces.water.map((surface) => surface.kind)),
    ).toEqual(new Set(["basin", "pond", "river", "stream"]));
  });

  test("targets real water tops while rejecting beds, walls, ink, wakes and static engraving", () => {
    for (const name of ELIGIBLE_WATER_NAMES) {
      expect(isSchwellenraumWaterSurface(water(name)), name).toBeTrue();
    }
    const duplicateSpreeWave = water(DUPLICATE_SPREE_WAVE_NAME);
    duplicateSpreeWave.userData.schwellenraumWaterSurface = true;
    expect(isSchwellenraumWaterSurface(duplicateSpreeWave)).toBeFalse();
    expect(
      isSchwellenraumWaterSurface(water("small circular basin water")),
    ).toBeTrue();
    for (const name of [
      "natural pond bank slopes",
      "basin display-depth walls",
      "basin and sunken wall ink",
      "static water ripple ribbons",
      "Spree vessel static wake ribbons",
      "river bed",
      "fountain jets",
    ]) {
      expect(isSchwellenraumWaterSurface(water(name)), name).toBeFalse();
    }
  });

  test("installs one texture-free geometry-sharing light layer per ordinary water mesh", () => {
    const root = new Group();
    const hosts = ELIGIBLE_WATER_NAMES.map(water);
    const duplicateSpreeWave = water(DUPLICATE_SPREE_WAVE_NAME);
    hosts.forEach((host, index) => {
      host.position.set(index * 17, 2.5 + index * 0.1, -index * 9);
      root.add(host);
    });
    root.add(duplicateSpreeWave);
    const originalMaterials = hosts.map((host) => host.material);
    const originalGeometries = hosts.map((host) => host.geometry);
    const before = matrices(root);

    expect(installSchwellenraumWaterAtmosphere(root)).toBe(hosts.length);
    expect(installSchwellenraumWaterAtmosphere(root)).toBe(0);
    const layers = overlays(root);
    expect(layers).toHaveLength(hosts.length);
    for (const [index, layer] of layers.entries()) {
      expect(layer.parent).toBe(hosts[index]);
      expect(layer.geometry).toBe(originalGeometries[index]);
      expect(hosts[index].material).toBe(originalMaterials[index]);
      expect(layer.name).toStartWith(SCHWELLENRAUM_WATER_OVERLAY_NAME);
      expect(layer.material).toBeInstanceOf(ShaderMaterial);
      const material = layer.material as ShaderMaterial;
      expect(material.blending).toBe(AdditiveBlending);
      expect(material.depthWrite).toBeFalse();
      expect(material.transparent).toBeTrue();
      expect(material.toneMapped).toBeFalse();
      expect(material.uniforms.uStrength.value).toBeLessThan(0.8);
      expect(material.uniforms.uProtectedWaterMaskCount.value).toBe(
        SCHWELLENRAUM_PROTECTED_VOLUMES.length,
      );
      expect(material.uniforms.uProtectedWaterMasks.value).toHaveLength(
        SCHWELLENRAUM_PROTECTED_VOLUMES.length,
      );
      expect(material.fragmentShader).toContain(
        "if (isProtectedWaterPoint(point)) discard",
      );
      expect(material.fragmentShader).toContain(
        "if (waterNormal.y < 0.55) discard",
      );
      expect(material.fragmentShader).toContain(
        "dFdx(vWaterWorldPosition)",
      );
      expect(material.fragmentShader).toContain("selected = step(0.91, seed)");
      expect(material.vertexShader).toContain("USE_INSTANCING");
      expect(material.vertexShader).toContain(
        "vWaterWorldPosition = worldPosition.xyz",
      );
      expect((material as unknown as { map?: unknown }).map).toBeUndefined();
      expect(layer.userData.geometryMotion).toBe("none");
    }
    expect(overlays(duplicateSpreeWave)).toHaveLength(0);
    expect(matrices(root)).toEqual(before);
  });

  test("copies fallback instance transforms without touching the source instances", () => {
    const root = new Group();
    const host = new InstancedMesh(
      new PlaneGeometry(4, 4),
      new MeshBasicMaterial(),
      2,
    );
    host.name = "drawn water surface";
    host.setMatrixAt(0, new Matrix4().makeTranslation(4, 2, 8));
    host.setMatrixAt(1, new Matrix4().makeTranslation(-12, 3, 20));
    host.instanceMatrix.needsUpdate = true;
    const before = Array.from(host.instanceMatrix.array);
    root.add(host);

    expect(installSchwellenraumWaterAtmosphere(root)).toBe(1);
    const layer = overlays(root)[0];
    expect(layer).toBeInstanceOf(InstancedMesh);
    expect(Array.from((layer as InstancedMesh).instanceMatrix.array)).toEqual(
      before,
    );
    expect(Array.from(host.instanceMatrix.array)).toEqual(before);
  });

  test("reinstalls once on a fresh progressive batch without retaining the released batch", () => {
    const released = new Group();
    released.add(water("smooth water surface"));
    expect(installSchwellenraumWaterAtmosphere(released)).toBe(1);
    expect(overlays(released)).toHaveLength(1);
    released.removeFromParent();

    const resumed = new Group();
    resumed.add(water("smooth water surface"));
    expect(installSchwellenraumWaterAtmosphere(resumed)).toBe(1);
    expect(installSchwellenraumWaterAtmosphere(resumed)).toBe(0);
    expect(overlays(resumed)).toHaveLength(1);
  });

  test("never adds atmosphere inside a protected memorial subtree", () => {
    const root = new Group();
    const memorial = new Group();
    memorial.name =
      "Denkmal für die im Nationalsozialismus ermordeten Sinti und Roma Europas";
    memorial.add(water("Sinti and Roma memorial black reflecting water"));
    const soviet = new Group();
    soviet.name = "Soviet memorial exact model";
    soviet.add(water("Soviet memorial west circular basin water"));
    root.add(memorial, soviet, water("smooth water surface"));

    expect(installSchwellenraumWaterAtmosphere(root)).toBe(1);
    expect(overlays(memorial)).toHaveLength(0);
    expect(overlays(soviet)).toHaveLength(0);
    expect(overlays(root)).toHaveLength(1);
  });

  test("derives a conservative fragment mask for every protected source volume", () => {
    expect(SCHWELLENRAUM_WATER_PROTECTED_MASKS).toHaveLength(
      SCHWELLENRAUM_PROTECTED_VOLUMES.length,
    );
    expect(
      new Set(SCHWELLENRAUM_WATER_PROTECTED_MASKS.map((mask) => mask.sourceId)),
    ).toEqual(
      new Set(SCHWELLENRAUM_PROTECTED_VOLUMES.map((volume) => volume.id)),
    );

    const moabit = SCHWELLENRAUM_WATER_PROTECTED_MASKS.find(
      (mask) => mask.sourceId === "protected-moabit-prison-memorial-park",
    );
    expect(moabit?.kind).toBe("box");
    expect(moabit?.sourceShape).toBe("polygon");
  });

  test("clips both real Neuer-See intersections plus the Sinti and Soviet protections", () => {
    // Points immediately inside the committed water rings nearest the two
    // memorial circles. These exercise the citywide water host, not a named
    // memorial subtree, which is why fragment-space protection is required.
    const realIntersections = [
      {
        label: "Karl-Liebknecht-Denkmal / Neuer See",
        point: [-2060.8031267633505, 677.5420734405651] as const,
      },
      {
        label: "Rosa-Luxemburg-Denkmal / Neuer See outflow",
        point: [-1930.2934821664155, 1064.2594454759562] as const,
      },
    ];
    for (const { label, point } of realIntersections) {
      expect(
        productionSurfaces.water.some((surface) =>
          pointInWaterRing(point[0], point[1], surface.ring),
        ),
        label,
      ).toBeTrue();
      expect(
        isSchwellenraumWaterAtmospherePointProtected(point[0], point[1]),
        label,
      ).toBeTrue();
    }

    expect(
      isSchwellenraumWaterAtmospherePointProtected(
        307.700225593755,
        186.2301389835775,
      ),
      "Sinti and Roma memorial pool",
    ).toBeTrue();
    expect(
      isSchwellenraumWaterAtmospherePointProtected(31, 265),
      "Soviet memorial ensemble",
    ).toBeTrue();
  });

  test("round-trips modes and obstruction without changing any world matrix", () => {
    const root = new Group();
    root.add(water("smooth water surface"), water("natural pond water"));
    const before = matrices(root);

    expect(
      setSchwellenraumWaterAtmospherePresentation([root], "day", false),
    ).toEqual({ changed: false, installed: 0, visibleCount: 0 });
    const entered = setSchwellenraumWaterAtmospherePresentation(
      [root],
      "schwellenraum",
      false,
    );
    expect(entered).toEqual({ changed: true, installed: 2, visibleCount: 2 });
    expect(overlays(root).every((layer) => layer.visible)).toBeTrue();

    const obscured = setSchwellenraumWaterAtmospherePresentation(
      [root],
      "schwellenraum",
      true,
    );
    expect(obscured.visibleCount).toBe(0);
    expect(overlays(root).every((layer) => !layer.visible)).toBeTrue();

    const restored = setSchwellenraumWaterAtmospherePresentation(
      [root],
      "schwellenraum",
      false,
    );
    expect(restored.installed).toBe(0);
    expect(restored.visibleCount).toBe(2);
    expect(
      setSchwellenraumWaterAtmospherePresentation([root], "night", false)
        .visibleCount,
    ).toBe(0);
    expect(matrices(root)).toEqual(before);
  });

  test("uses slow deterministic light modulation and freezes it for reduced motion", () => {
    expect(SCHWELLENRAUM_WATER_FRAME_INTERVAL_MS).toBeCloseTo(266.6667, 3);
    expect(SCHWELLENRAUM_WATER_GLINT_PERIOD_SECONDS).toEqual([18, 38]);
    const samples = Array.from({ length: 97 }, (_, index) =>
      schwellenraumWaterBreath(index * 0.25),
    );
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(0.72);
    expect(Math.max(...samples)).toBeLessThanOrEqual(1);
    expect(schwellenraumWaterBreath(0)).toBeCloseTo(
      schwellenraumWaterBreath(24),
      12,
    );

    const root = new Group();
    root.add(water("basin water"));
    setSchwellenraumWaterAtmospherePresentation([root], "schwellenraum", false);
    const before = matrices(root);
    expect(updateSchwellenraumWaterAtmosphere([root], 11.5)).toBe(1);
    const material = overlays(root)[0].material as ShaderMaterial;
    expect(material.uniforms.uTime.value).toBe(11.5);
    expect(material.uniforms.uStrength.value).toBe(0.72);
    expect(material.uniforms.uGlintStrength.value).toBe(1);
    expect(updateSchwellenraumWaterAtmosphere([root], 18, true)).toBe(1);
    expect(material.uniforms.uStrength.value).toBe(0.48);
    expect(material.uniforms.uGlintStrength.value).toBe(0.22);
    expect(matrices(root)).toEqual(before);
  });

  test("schedules water light independently from flags and never animates it for reduced motion", () => {
    const before = schwellenraumMotionDecision({
      ...pariserPlatzIdle,
      lastFlagFrameAt: 100,
      lastWaterFrameAt: 100,
      minecraftMobsVisible: true,
      mode: "schwellenraum",
      movingFlagCount: 0,
      rainVisible: true,
      reducedMotion: false,
      snowVisible: true,
      timestamp: 100 + SCHWELLENRAUM_WATER_FRAME_INTERVAL_MS - 0.01,
      waterLightCount: 4,
    });
    expect(before.animateWaterLight).toBeFalse();
    expect(before.environmentalMotion).toBeFalse();

    const tick = schwellenraumMotionDecision({
      ...pariserPlatzIdle,
      lastFlagFrameAt: 100,
      lastWaterFrameAt: 100,
      minecraftMobsVisible: true,
      mode: "schwellenraum",
      movingFlagCount: 0,
      rainVisible: true,
      reducedMotion: false,
      snowVisible: true,
      timestamp: 100 + SCHWELLENRAUM_WATER_FRAME_INTERVAL_MS,
      waterLightCount: 4,
    });
    expect(tick).toEqual({
      animateFlags: false,
      animateOrdinaryEnvironment: false,
      animatePariserPlatzEntities: false,
      animateWaterLight: true,
      environmentalMotion: true,
    });

    const sharedTick = schwellenraumMotionDecision({
      ...pariserPlatzIdle,
      lastFlagFrameAt: 100,
      lastWaterFrameAt: 100,
      minecraftMobsVisible: false,
      mode: "schwellenraum",
      movingFlagCount: 4,
      rainVisible: false,
      reducedMotion: false,
      snowVisible: false,
      timestamp: 100 + SCHWELLENRAUM_WATER_FRAME_INTERVAL_MS,
      waterLightCount: 4,
    });
    expect(sharedTick.animateFlags).toBeTrue();
    expect(sharedTick.animateWaterLight).toBeTrue();

    const reduced = schwellenraumMotionDecision({
      ...pariserPlatzIdle,
      lastFlagFrameAt: 0,
      lastWaterFrameAt: 0,
      minecraftMobsVisible: false,
      mode: "schwellenraum",
      movingFlagCount: 0,
      rainVisible: false,
      reducedMotion: true,
      snowVisible: false,
      timestamp: 10_000,
      waterLightCount: 4,
    });
    expect(reduced.animateWaterLight).toBeFalse();
    expect(reduced.environmentalMotion).toBeFalse();
  });

  test("integrates through the existing RAF and progressive presentation path", () => {
    expect(viewerSource).toContain(
      "setSchwellenraumWaterAtmospherePresentation(",
    );
    expect(viewerSource).toContain(
      "if (schwellenraumMotion.animateWaterLight)",
    );
    expect(viewerSource).toContain("updateSchwellenraumWaterAtmosphere(");
    expect(viewerSource).toContain("if (enteringSchwellenraum)");
    expect(viewerSource).toContain(
      "runtime.schwellenraumWaterElapsedSeconds =",
    );
    expect(viewerSource).not.toContain("setInterval(");
  });
});
