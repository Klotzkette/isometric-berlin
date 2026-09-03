import { describe, expect, test } from "bun:test";
import {
  Box3,
  BoxGeometry,
  Color,
  InstancedMesh,
  Matrix4,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Vector3,
} from "three";

import {
  BERLINER_ENSEMBLE_FACADE_SURFACE_PROJECTION_M,
  BERLINER_ENSEMBLE_CORNER_ID,
  BERLINER_ENSEMBLE_FOCUS_AZIMUTH_DEGREES,
  BERLINER_ENSEMBLE_IDS,
  BERLINER_ENSEMBLE_MAIN_ID,
  BERLINER_ENSEMBLE_MAIN_SHOW_WALL_INDEX,
  BERLINER_ENSEMBLE_MAX_FACADE_DETAIL_PROJECTION_M,
  BERLINER_ENSEMBLE_PROFILE,
  BERLINER_ENSEMBLE_PUBLIC_FACADE_AZIMUTH_DEGREES,
  BERLINER_ENSEMBLE_PROJECTING_INTERNAL_WALL_INDEX,
  BERLINER_ENSEMBLE_PROJECTING_RETURN_WALL_INDICES,
  BERLINER_ENSEMBLE_PROJECTING_SHOW_WALL_INDICES,
  BERLINER_ENSEMBLE_PUBLIC_ART_OSM_KEYS,
  BERLINER_ENSEMBLE_RETURN_ID,
  BERLINER_ENSEMBLE_ROOF_SIGN_CENTRE_Y_M,
  BERLINER_ENSEMBLE_ROOF_SIGN_DIAMETER_M,
  BERLINER_ENSEMBLE_ROOF_SIGN_ROTATION_PERIOD_SECONDS,
  BERLINER_ENSEMBLE_SHOW_FACADE_ID,
  BERLINER_ENSEMBLE_TONES,
  BERLINER_ENSEMBLE_TOWER_FRONT_WALL_INDEX,
  berlinerEnsembleRoofSignMotionDecision,
  collectBerlinerEnsembleRoofSignTargets,
  createBerlinerEnsemble,
  isBerlinerEnsembleRoofSignOnScreen,
  updateBerlinerEnsembleRoofSign,
} from "../src/BerlinerEnsemble";
import {
  centralCivicFocusCamera,
  type CentralCivicLandmark,
} from "../src/CentralCivicDetails";
import {
  GENERIC_FACADE_TRIM_SUPPRESSED_IDS,
  HERO_PRISM_ROOF_TONES,
  HERO_PRISM_TONES,
  PRISM_SUPPRESSED_IDS,
  WINDOWS_SUPPRESSED_IDS,
  createIsometricCity,
  setIsoNightPresentation,
  type PrismBuilding,
  type PrismPayload,
} from "../src/IsometricCityWorld";
import {
  MINECRAFT_ARCHITECTURAL_PROFILES,
  createMinecraftArchitecturalLandmarks,
} from "../src/MinecraftArchitecturalLandmarks";
import {
  worldGroundSampler,
  type VoxelPayload,
} from "../src/MinecraftVoxelWorld";
import { createTiergartenMonuments } from "../src/TiergartenMonuments";
import type { StreetDetailsPayload } from "../src/TrafficSignals";
import { MINECRAFT_PALETTE } from "../src/visual-modes/minecraft/palette";
import prismJson from "../public/mesh/regierungsviertel/lod2-prisms.json";
import streetJson from "../public/mesh/regierungsviertel/street-details.json";
import voxelJson from "../public/mesh/regierungsviertel/minecraft-voxels.json";

const prisms = prismJson as unknown as PrismPayload;
const ensemblePrisms: PrismPayload = {
  ...prisms,
  buildings: prisms.buildings.filter(({ id }) => BERLINER_ENSEMBLE_IDS.has(id)),
};

function model() {
  return createBerlinerEnsemble(ensemblePrisms);
}

function outwardNormal(
  building: PrismBuilding,
  index: number,
): [number, number] {
  let doubleArea = 0;
  for (let cursor = 0; cursor < building.ring.length; cursor += 1) {
    const [x1, z1] = building.ring[cursor];
    const [x2, z2] = building.ring[(cursor + 1) % building.ring.length];
    doubleArea += x1 * z2 - x2 * z1;
  }
  const [x1, z1] = building.ring[index];
  const [x2, z2] = building.ring[(index + 1) % building.ring.length];
  const dx = x2 - x1;
  const dz = z2 - z1;
  const length = Math.hypot(dx, dz);
  const flip = doubleArea >= 0 ? 1 : -1;
  return [(dz / length) * flip, (-dx / length) * flip];
}

function pointInRing(
  point: readonly [number, number],
  ringDm: number[][],
): boolean {
  const ring = ringDm.map(([x, z]) => [x / 10, z / 10] as const);
  for (let index = 0; index < ring.length; index += 1) {
    const [x1, z1] = ring[index];
    const [x2, z2] = ring[(index + 1) % ring.length];
    const cross =
      (point[0] - x1) * (z2 - z1) - (point[1] - z1) * (x2 - x1);
    const dot =
      (point[0] - x1) * (point[0] - x2) +
      (point[1] - z1) * (point[1] - z2);
    if (Math.abs(cross) <= 1e-7 && dot <= 1e-7) return true;
  }
  let inside = false;
  for (
    let index = 0, previous = ring.length - 1;
    index < ring.length;
    previous = index++
  ) {
    const [x, z] = ring[index];
    const [previousX, previousZ] = ring[previous];
    if (
      z > point[1] !== previousZ > point[1] &&
      point[0] <
        ((previousX - x) * (point[1] - z)) / (previousZ - z) + x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

describe("source-bound Berliner Ensemble exterior", () => {
  test("binds exactly the four official LoD2 parts and the theatre OSM way", () => {
    expect([...BERLINER_ENSEMBLE_IDS]).toEqual([
      "6lQyofA6",
      "5UbqhW10",
      "o3ZOA8rr",
      "7Nu07Ngx",
    ]);
    expect(BERLINER_ENSEMBLE_PROFILE.lod2Parent).toBe("DEBE01YYK00004vY");
    expect(BERLINER_ENSEMBLE_PROFILE.lod2Function).toBe(3032);
    expect(BERLINER_ENSEMBLE_PROFILE.osm).toEqual({
      amenity: "theatre",
      buildingRefLda: "09011192",
      buildingWayId: "43017010",
      siteWayId: "422928025",
    });
    const payloadIds = new Set(prisms.buildings.map(({ id }) => id));
    for (const id of BERLINER_ENSEMBLE_IDS) {
      expect(payloadIds.has(id)).toBeTrue();
      expect(BERLINER_ENSEMBLE_PROFILE.sourcePartRoles[id]).toBeDefined();
    }
    expect(BERLINER_ENSEMBLE_PUBLIC_ART_OSM_KEYS).toEqual(
      new Set(["node/988668382", "node/13841652635"]),
    );
  });

  test("retains every LoD2 shell and suppresses only generic windows and trim", () => {
    for (const id of BERLINER_ENSEMBLE_IDS) {
      expect(HERO_PRISM_TONES[id]).toBe(BERLINER_ENSEMBLE_TONES.facade);
      expect(HERO_PRISM_ROOF_TONES[id]).toBe(BERLINER_ENSEMBLE_TONES.slate);
      expect(WINDOWS_SUPPRESSED_IDS.has(id)).toBeTrue();
      expect(GENERIC_FACADE_TRIM_SUPPRESSED_IDS.has(id)).toBeTrue();
      expect(PRISM_SUPPRESSED_IDS.has(id)).toBeFalse();
    }
    const details = model();
    expect(details.userData.replacesLoD2).toBeFalse();
    expect(details.userData.hasOpaqueEnvelope).toBeFalse();
    expect(details.userData.facadeSurfaceProjectionM).toBe(
      BERLINER_ENSEMBLE_FACADE_SURFACE_PROJECTION_M,
    );
    expect(details.userData.maxFacadeProjectionM).toBe(
      BERLINER_ENSEMBLE_MAX_FACADE_DETAIL_PROJECTION_M,
    );
    expect(details.userData.maxFacadeProjectionM).toBe(0.79);
    expect(details.userData.maxFacadeProjectionM).toBeGreaterThanOrEqual(
      0.48 + 0.62 / 2,
    );
  });

  test("bakes the slate pin into pitched-roof runtime vertex colours", () => {
    const expected = new Color(BERLINER_ENSEMBLE_TONES.slate);
    for (const id of [
      BERLINER_ENSEMBLE_MAIN_ID,
      BERLINER_ENSEMBLE_CORNER_ID,
      BERLINER_ENSEMBLE_RETURN_ID,
    ]) {
      const building = ensemblePrisms.buildings.find(
        (candidate) => candidate.id === id,
      )!;
      const isolatedPayload: PrismPayload = {
        ...ensemblePrisms,
        buildings: [building],
      };
      const city = createIsometricCity(isolatedPayload, null);
      const bodies = city.getObjectByName("LoD2 prism buildings") as Mesh;
      const positions = bodies.geometry.getAttribute("position");
      const colors = bodies.geometry.getAttribute("color");
      const roofTopY = building.y0_dm / 10 + building.h_dm / 10;
      const colorQuantizationTolerance = 2 / 255;
      let matchingTopVertices = 0;
      for (let index = 0; index < positions.count; index += 1) {
        if (positions.getY(index) < roofTopY - 0.01) continue;
        const shade = colors.getX(index) / expected.r;
        if (
          Math.abs(colors.getY(index) - expected.g * shade) <=
            colorQuantizationTolerance &&
          Math.abs(colors.getZ(index) - expected.b * shade) <=
            colorQuantizationTolerance
        ) {
          matchingTopVertices += 1;
        }
      }
      expect(matchingTopVertices).toBeGreaterThan(0);
    }
  });

  test("pins the public facade to the surveyed walls and exposed main-body ends", () => {
    const main = ensemblePrisms.buildings.find(
      ({ id }) => id === BERLINER_ENSEMBLE_MAIN_ID,
    )!;
    const projecting = ensemblePrisms.buildings.find(
      ({ id }) => id === BERLINER_ENSEMBLE_SHOW_FACADE_ID,
    )!;
    const mainNormal = outwardNormal(
      main,
      BERLINER_ENSEMBLE_MAIN_SHOW_WALL_INDEX,
    );
    expect(mainNormal[0]).toBeCloseTo(0.785052, 5);
    expect(mainNormal[1]).toBeCloseTo(-0.619429, 5);
    expect(BERLINER_ENSEMBLE_PUBLIC_FACADE_AZIMUTH_DEGREES).toBe(128.274);
    const focusRadians =
      (BERLINER_ENSEMBLE_FOCUS_AZIMUTH_DEGREES * Math.PI) / 180;
    expect(
      mainNormal[0] * Math.sin(focusRadians) +
        mainNormal[1] * Math.cos(focusRadians),
    ).toBeGreaterThan(0.97);
    for (const index of BERLINER_ENSEMBLE_PROJECTING_SHOW_WALL_INDICES) {
      const normal = outwardNormal(projecting, index);
      expect(normal[0]).toBeGreaterThan(0.78);
      expect(normal[1]).toBeLessThan(-0.61);
    }

    const bindings = model().userData.wallBindings;
    expect(bindings).toMatchObject({
      main: {
        sourcePrismId: BERLINER_ENSEMBLE_MAIN_ID,
        wallIndex: BERLINER_ENSEMBLE_MAIN_SHOW_WALL_INDEX,
      },
      projection: {
        internalWallIndex: BERLINER_ENSEMBLE_PROJECTING_INTERNAL_WALL_INDEX,
        returnWallIndices: BERLINER_ENSEMBLE_PROJECTING_RETURN_WALL_INDICES,
        sourcePrismId: BERLINER_ENSEMBLE_SHOW_FACADE_ID,
        wallIndices: BERLINER_ENSEMBLE_PROJECTING_SHOW_WALL_INDICES,
      },
      tower: {
        sourcePrismId: BERLINER_ENSEMBLE_CORNER_ID,
        wallIndex: BERLINER_ENSEMBLE_TOWER_FRONT_WALL_INDEX,
      },
    });
    expect(bindings.main.exposedEndWidthsM[0]).toBeCloseTo(4.4821, 3);
    expect(bindings.main.exposedEndWidthsM[1]).toBeCloseTo(4.4201, 3);
  });

  test("draws the present-day facade rhythm and bounded open roof sign", () => {
    const details = model();
    expect(details.userData.detailCounts).toEqual({
      downpipes: 2,
      graniteColumns: 4,
      groundEntrances: 1,
      groundWindows: 6,
      lanterns: 14,
      neutralPosters: 2,
      returnSkins: 3,
      sourcePrisms: 4,
      upperWindows: 4,
      ventOpenings: 6,
    });
    expect(
      details.getObjectByName("Berliner Ensemble architectural details bodies"),
    ).toBeInstanceOf(Mesh);
    expect(
      details.getObjectByName("Berliner Ensemble architectural details lamps"),
    ).toBeInstanceOf(Mesh);
    const ring = details.getObjectByName(
      "Berliner Ensemble open circular roof-sign ring",
    ) as Mesh;
    expect(ring).toBeInstanceOf(Mesh);
    expect(ring.geometry.type).toBe("TorusGeometry");
    expect(ring.position.y).toBe(BERLINER_ENSEMBLE_ROOF_SIGN_CENTRE_Y_M);
    const ringWorld = ring.getWorldPosition(new Vector3());
    expect(ringWorld.x).toBeCloseTo(
      BERLINER_ENSEMBLE_PROFILE.roofTower.anchorWorldM[0],
      6,
    );
    expect(ringWorld.z).toBeCloseTo(
      BERLINER_ENSEMBLE_PROFILE.roofTower.anchorWorldM[1],
      6,
    );
    const pivot = ring.parent!;
    const main = ensemblePrisms.buildings.find(
      ({ id }) => id === BERLINER_ENSEMBLE_MAIN_ID,
    )!;
    const showFacadeNormal = outwardNormal(
      main,
      BERLINER_ENSEMBLE_MAIN_SHOW_WALL_INDEX,
    );
    const signNormal: [number, number] = [
      Math.sin(pivot.rotation.y),
      Math.cos(pivot.rotation.y),
    ];
    expect(
      signNormal[0] * showFacadeNormal[0] +
        signNormal[1] * showFacadeNormal[1],
    ).toBeGreaterThan(0.99);
    for (const line of ["BERLINER", "ENSEMBLE"] as const) {
      const lettering = details.getObjectByName(
        `Berliner Ensemble roof-sign ${line} lettering`,
      );
      expect(lettering?.parent).toBe(pivot);
      expect(lettering?.rotation.y).toBe(0);
    }
    expect(details.userData.roofSignBinding).toMatchObject({
      rotationY: pivot.rotation.y,
      sourcePrismId: BERLINER_ENSEMBLE_MAIN_ID,
      wallIndex: BERLINER_ENSEMBLE_MAIN_SHOW_WALL_INDEX,
    });
    const mainRoofPart = ensemblePrisms.buildings.find(
      ({ id }) => id === BERLINER_ENSEMBLE_MAIN_ID,
    )!;
    const towerBinding = details.userData.roofTowerBinding;
    expect(towerBinding).toMatchObject({
      containmentFramePrismId: BERLINER_ENSEMBLE_CORNER_ID,
      containmentFrameWallIndex: BERLINER_ENSEMBLE_TOWER_FRONT_WALL_INDEX,
      footprintSourcePrismIds: [...BERLINER_ENSEMBLE_IDS],
      sourcePrismId: BERLINER_ENSEMBLE_MAIN_ID,
    });
    expect(towerBinding.anchorWorldM).toEqual([1006.916, -323.789]);
    expect(pointInRing(towerBinding.anchorWorldM, mainRoofPart.ring)).toBeTrue();
    expect(towerBinding.baseFootprintWorld).toHaveLength(4);
    for (const corner of towerBinding.baseFootprintWorld) {
      expect(
        ensemblePrisms.buildings.some(({ ring }) => pointInRing(corner, ring)),
      ).toBeTrue();
    }
    const [corner0, corner1, , corner3] =
      towerBinding.baseFootprintWorld as readonly (readonly [number, number])[];
    let containedSamples = 0;
    const sampleSteps = 60;
    for (let uStep = 0; uStep <= sampleSteps; uStep += 1) {
      for (let vStep = 0; vStep <= sampleSteps; vStep += 1) {
        const u = uStep / sampleSteps;
        const v = vStep / sampleSteps;
        const sample: [number, number] = [
          corner0[0] +
            (corner1[0] - corner0[0]) * u +
            (corner3[0] - corner0[0]) * v,
          corner0[1] +
            (corner1[1] - corner0[1]) * u +
            (corner3[1] - corner0[1]) * v,
        ];
        if (
          ensemblePrisms.buildings.some(({ ring }) =>
            pointInRing(sample, ring),
          )
        ) {
          containedSamples += 1;
        }
      }
    }
    expect(containedSamples / (sampleSteps + 1) ** 2).toBeGreaterThan(0.99);
    const ringBounds = new Box3().setFromObject(ring);
    const ringSize = ringBounds.getSize(new Vector3());
    expect(ringSize.y).toBeCloseTo(5.06, 2);
    expect(Math.hypot(ringSize.x, ringSize.z)).toBeLessThan(5.32);

    const bounds = new Box3().setFromObject(details);
    expect(bounds.min.x).toBeGreaterThanOrEqual(984.4);
    expect(bounds.max.x).toBeLessThanOrEqual(1013.4);
    expect(bounds.min.z).toBeGreaterThanOrEqual(-350.7);
    expect(bounds.max.z).toBeLessThanOrEqual(-317.4);
    expect(bounds.max.y).toBeLessThanOrEqual(37.13);
    expect(bounds.max.y).toBeGreaterThan(37.09);
    expect(
      details.getObjectByName("BERLINER ENSEMBLE civic lettering"),
    ).toBeUndefined();
    expect(
      details.getObjectByName("Berliner Ensemble circular rooftop sign"),
    ).toBeUndefined();
  });

  test("round-trips materials while one absolute phase rotates the sign without drift", () => {
    const details = model();
    const presentationMeshes: Mesh[] = [];
    details.traverse((object) => {
      if (
        object instanceof Mesh &&
        object.userData.dayMaterial instanceof Material &&
        object.userData.nightMaterial instanceof Material
      ) {
        presentationMeshes.push(object);
      }
      expect(object.userData.animated).not.toBe(true);
    });
    expect(presentationMeshes.length).toBeGreaterThanOrEqual(5);
    const dayMaterials = presentationMeshes.map(
      ({ userData }) => userData.dayMaterial,
    );
    const ring = details.getObjectByName(
      "Berliner Ensemble open circular roof-sign ring",
    ) as Mesh;
    const pivot = ring.parent!;
    const initialRotationY = pivot.rotation.y;

    setIsoNightPresentation(details, true, true, "night");
    presentationMeshes.forEach((mesh, index) => {
      expect(mesh.material).not.toBe(dayMaterials[index]);
    });
    setIsoNightPresentation(details, false, true, "schwellenraum");
    presentationMeshes.forEach((mesh, index) => {
      expect(mesh.material).toBe(mesh.userData.schwellenraumMaterial);
      expect(mesh.material).not.toBe(dayMaterials[index]);
    });
    setIsoNightPresentation(details, false, true, "day");
    presentationMeshes.forEach((mesh, index) => {
      expect(mesh.material).toBe(dayMaterials[index]);
    });
    expect(pivot.rotation.y).toBe(initialRotationY);
    expect(pivot.userData).toMatchObject({
      berlinerEnsembleRoofSignPivot: true,
      rotationPeriodSeconds: 120,
    });
    const targets = collectBerlinerEnsembleRoofSignTargets(details);
    expect(targets).toEqual([pivot]);
    updateBerlinerEnsembleRoofSign(
      targets,
      BERLINER_ENSEMBLE_ROOF_SIGN_ROTATION_PERIOD_SECONDS / 4,
    );
    expect(pivot.rotation.y).toBeCloseTo(initialRotationY + Math.PI / 2, 10);
    const absolutePhaseRotation = pivot.rotation.y;
    updateBerlinerEnsembleRoofSign(
      targets,
      BERLINER_ENSEMBLE_ROOF_SIGN_ROTATION_PERIOD_SECONDS / 4,
    );
    expect(pivot.rotation.y).toBe(absolutePhaseRotation);
    setIsoNightPresentation(details, true, true, "night");
    setIsoNightPresentation(details, false, true, "schwellenraum");
    expect(pivot.rotation.y).toBe(absolutePhaseRotation);
  });

  test("gates slow rotation for mobile, accessibility and hidden/off-screen views", () => {
    const ready = {
      enabled: true,
      fineDetailVisible: true,
      frameIntervalMs: 125,
      hidden: false,
      lastFrameAt: 1_000,
      onScreen: true,
      reducedMotion: false,
      timestamp: 1_125,
      underside: false,
    };
    expect(berlinerEnsembleRoofSignMotionDecision(ready)).toEqual({
      animate: true,
      environmentalMotion: true,
    });
    const output = { animate: false, environmentalMotion: false };
    expect(berlinerEnsembleRoofSignMotionDecision(ready, output)).toBe(output);
    expect(output).toEqual({ animate: true, environmentalMotion: true });
    for (const blocked of [
      { hidden: true },
      { onScreen: false },
      { reducedMotion: true },
      { underside: true },
      { fineDetailVisible: false },
      { timestamp: 1_124 },
    ]) {
      expect(
        berlinerEnsembleRoofSignMotionDecision({ ...ready, ...blocked }),
      ).toEqual({ animate: false, environmentalMotion: false });
    }
    expect(BERLINER_ENSEMBLE_PROFILE.roofSign.visualModes).toEqual([
      "day",
      "night",
      "snowstorm",
      "minecraft",
      "schwellenraum",
    ]);

    const details = model();
    const targets = collectBerlinerEnsembleRoofSignTargets(details);
    const [centreX, centreZ] =
      BERLINER_ENSEMBLE_PROFILE.roofTower.anchorWorldM;
    const camera = new PerspectiveCamera(50, 1, 0.1, 1_000);
    camera.position.set(
      centreX,
      BERLINER_ENSEMBLE_ROOF_SIGN_CENTRE_Y_M,
      centreZ + 20,
    );
    camera.lookAt(
      centreX,
      BERLINER_ENSEMBLE_ROOF_SIGN_CENTRE_Y_M,
      centreZ,
    );
    expect(isBerlinerEnsembleRoofSignOnScreen(targets, camera)).toBeTrue();
    details.visible = false;
    expect(isBerlinerEnsembleRoofSignOnScreen(targets, camera)).toBeFalse();
    details.visible = true;
    camera.lookAt(
      centreX + 200,
      BERLINER_ENSEMBLE_ROOF_SIGN_CENTRE_Y_M,
      centreZ,
    );
    expect(isBerlinerEnsembleRoofSignOnScreen(targets, camera)).toBeFalse();
  });

  test("uses one opaque, source-bound block-native draw in Minecraft", () => {
    const group = createMinecraftArchitecturalLandmarks();
    const mesh = group.getObjectByName(
      "Minecraft Berliner Ensemble block signature",
    ) as InstancedMesh;
    expect(mesh).toBeInstanceOf(InstancedMesh);
    expect(mesh.geometry).toBeInstanceOf(BoxGeometry);
    expect(mesh.material).toBeInstanceOf(MeshStandardMaterial);
    expect((mesh.material as MeshStandardMaterial).map).toBeNull();
    expect(mesh.userData).toMatchObject({
      blockCount: mesh.count,
      blockNative: true,
      landmarkId: "berliner-ensemble",
      boundedAnimatedInstances: 34,
      staticAntiFlicker: false,
      transparentGeometry: false,
    });
    expect(mesh.userData.profile).toEqual(
      MINECRAFT_ARCHITECTURAL_PROFILES.berlinerEnsemble,
    );
    expect(mesh.userData.profile.blockLoD.maxDrawCalls).toBe(1);
    expect(mesh.userData.profile.towerFrame.anchorWorld).toEqual([
      1006.916, 4.05, -323.789,
    ]);
    expect(mesh.userData.profile.towerFrame.rotationDegrees).not.toBeCloseTo(
      mesh.userData.profile.signFrame.rotationDegrees,
      2,
    );
    const showFacade = ensemblePrisms.buildings.find(
      ({ id }) => id === BERLINER_ENSEMBLE_MAIN_ID,
    )!;
    const showNormal = outwardNormal(
      showFacade,
      BERLINER_ENSEMBLE_MAIN_SHOW_WALL_INDEX,
    );
    const signRadians =
      (mesh.userData.profile.signFrame.rotationDegrees * Math.PI) / 180;
    expect(
      Math.abs(
        Math.sin(signRadians) * showNormal[0] +
          Math.cos(signRadians) * showNormal[1],
      ),
    ).toBeGreaterThan(0.99);
    expect(mesh.userData.cueCounts).toMatchObject({
      "Berliner Ensemble lower lettering cue": 7,
      "Berliner Ensemble open circular sign": 20,
      "Berliner Ensemble roof-sign support": 2,
      "Berliner Ensemble stepped hipped roof": 8,
      "Berliner Ensemble taupe roof tower": 9,
      "Berliner Ensemble tower opening": 3,
      "Berliner Ensemble upper lettering cue": 7,
    });
    type BoundBlock = {
      cue: string;
      position: readonly [number, number, number];
      rotationY: number;
      size: readonly [number, number, number];
    };
    const sourceBoundBlocks = mesh.userData
      .sourceBoundBlocks as readonly BoundBlock[];
    const towerRoofBlocks = mesh.userData
      .sourceBoundTowerRoofBlocks as readonly BoundBlock[];
    expect(towerRoofBlocks.length).toBeGreaterThan(0);
    expect(sourceBoundBlocks).toHaveLength(mesh.count);
    for (const block of sourceBoundBlocks) {
      const cosine = Math.cos(block.rotationY);
      const sine = Math.sin(block.rotationY);
      for (const localX of [-block.size[0] / 2, block.size[0] / 2]) {
        for (const localZ of [-block.size[2] / 2, block.size[2] / 2]) {
          const corner: [number, number] = [
            block.position[0] + cosine * localX + sine * localZ,
            block.position[2] - sine * localX + cosine * localZ,
          ];
          expect(
            ensemblePrisms.buildings.some(({ ring }) =>
              pointInRing(corner, ring),
            ),
          ).toBeTrue();
        }
      }
    }
    const palette = new Set<number>(MINECRAFT_PALETTE);
    const colour = new Color();
    for (let index = 0; index < mesh.count; index += 1) {
      mesh.getColorAt(index, colour);
      expect(palette.has(colour.getHex())).toBeTrue();
    }
    const bounds = new Box3().setFromObject(mesh);
    expect(bounds.min.y).toBeGreaterThanOrEqual(22.14);
    expect(bounds.max.y).toBeLessThanOrEqual(37.3);
    expect(BERLINER_ENSEMBLE_ROOF_SIGN_DIAMETER_M).toBe(4.8);
    const rotatingTargets = collectBerlinerEnsembleRoofSignTargets(group);
    expect(rotatingTargets).toEqual([mesh]);
    const rotatingIndex = mesh.userData.rotatingInstances[0].index as number;
    const fixedIndex = sourceBoundBlocks.findIndex(
      ({ cue }) => cue === "Berliner Ensemble roof-sign support",
    );
    const beforeRotating = new Matrix4();
    const beforeFixed = new Matrix4();
    mesh.getMatrixAt(rotatingIndex, beforeRotating);
    mesh.getMatrixAt(fixedIndex, beforeFixed);
    updateBerlinerEnsembleRoofSign(
      rotatingTargets,
      BERLINER_ENSEMBLE_ROOF_SIGN_ROTATION_PERIOD_SECONDS / 4,
    );
    const afterRotating = new Matrix4();
    const afterFixed = new Matrix4();
    mesh.getMatrixAt(rotatingIndex, afterRotating);
    mesh.getMatrixAt(fixedIndex, afterFixed);
    expect(afterRotating.elements).not.toEqual(beforeRotating.elements);
    expect(afterFixed.elements).toEqual(beforeFixed.elements);
  });

  test("focuses the real show facade and degrades atomically when a source part is missing", () => {
    const landmark: CentralCivicLandmark = {
      name: "Berliner Ensemble",
      world: [0, 4, 0],
    };
    expect(centralCivicFocusCamera(landmark)).toEqual({
      azimuth_degrees: 121,
      distance_m: 128,
      polar_degrees: 62,
      target_height_m: 10.5,
      target_world: [988.9, 4, -327.3],
    });

    const missing = createBerlinerEnsemble({
      ...ensemblePrisms,
      buildings: ensemblePrisms.buildings.filter(
        ({ id }) => id !== BERLINER_ENSEMBLE_RETURN_ID,
      ),
    });
    expect(missing.children).toHaveLength(0);
    expect(missing.userData.geometryStatus).toBe("required LoD2 parts missing");
  });

  test("gives both exact artwork nodes to the dedicated models with no generic doubles", () => {
    const street = streetJson as unknown as StreetDetailsPayload;
    const filtered = {
      ...street,
      monuments: street.monuments?.filter(({ osm_key }) =>
        BERLINER_ENSEMBLE_PUBLIC_ART_OSM_KEYS.has(osm_key),
      ),
    };
    expect(filtered.monuments?.map(({ osm_key }) => osm_key).sort()).toEqual([
      "node/13841652635",
      "node/988668382",
    ]);
    const generic = createTiergartenMonuments(
      filtered,
      voxelJson as unknown as VoxelPayload,
    );
    const sample = worldGroundSampler(voxelJson as unknown as VoxelPayload);
    expect(sample(1026.376, -349.777)).not.toBeNull();
    expect(sample(965.8, -361.8)).not.toBeNull();
    expect(generic).toBeNull();
    expect(BERLINER_ENSEMBLE_PROFILE.brechtMonumentWorld).toEqual([
      1026.376, -349.777,
    ]);
    expect(BERLINER_ENSEMBLE_PROFILE.heleneWeigelCourtyardWorld).toEqual([
      965.8, -361.8,
    ]);
  });

  test("distinguishes the legacy theatre POI from the protected exact building", async () => {
    const landmarks = (await Bun.file(
      new URL(
        "../../../geo_data/regierungsviertel/landmarks.geojson",
        import.meta.url,
      ),
    ).json()) as {
      features: Array<{ properties: { name: string; source: string } }>;
    };
    const ensemble = landmarks.features.find(
      ({ properties }) => properties.name === "Berliner Ensemble",
    );
    expect(ensemble?.properties.source).toContain(
      "theatre site/POI way 422928025",
    );
    expect(ensemble?.properties.source).toContain(
      "protected building geometry way 43017010",
    );
    const alignment = await Bun.file(
      new URL("../../../docs/landmark-alignment.md", import.meta.url),
    ).text();
    const row = alignment
      .split("\n")
      .find((line) => line.startsWith("| Berliner Ensemble |"));
    expect(row).toContain("legacy tour-point/site way 422928025");
    expect(row).toContain("exact model uses LoD2 parent DEBE01YYK00004vY");
    expect(row).toContain("protected building way 43017010");
  });

  test("packages exact reusable visual credits without photo textures", () => {
    expect(BERLINER_ENSEMBLE_PROFILE.visualReferences).toEqual([
      expect.objectContaining({
        artist: "Yair Haklai",
        license: "CC BY-SA 4.0",
        title: "Berliner Ensemble building (Theater am Schiffbauerdamm).jpg",
      }),
      expect.objectContaining({
        artist: "Fridolin freudenfett",
        license: "CC BY-SA 4.0",
        title: "Mitte Bertolt-Brecht-Platz Theater am Schiffbauerdamm.JPG",
      }),
      expect.objectContaining({
        artist: "Derbrauni",
        license: "CC BY 4.0",
        title: "Theater am Schiffbauerdamm 01.jpg",
      }),
    ]);
    expect(
      BERLINER_ENSEMBLE_PROFILE.visualReferences.every(({ geometryStatus }) =>
        geometryStatus.includes("not used as a texture"),
      ),
    ).toBeTrue();
    const architecturalBodies = model().getObjectByName(
      "Berliner Ensemble architectural details bodies",
    ) as Mesh;
    expect(architecturalBodies.material).toBeInstanceOf(MeshBasicMaterial);
    expect((architecturalBodies.material as MeshBasicMaterial).map).toBeNull();
  });
});
