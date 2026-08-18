import { describe, expect, test } from "bun:test";
import {
  Box3,
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from "three";

import {
  MINECRAFT_ARCHITECTURAL_PROFILES,
  MINECRAFT_SMOOTH_SIGNATURE_REPLACEMENTS,
  createMinecraftArchitecturalLandmarks,
  isMinecraftArchitecturalReplacementColumn,
  minecraftArchitecturalVoxelTopAt,
  minecraftArchitecturalReplacementAt,
  minecraftArchitecturalPaletteIsClosed,
  setMinecraftArchitecturePresentation,
} from "../src/MinecraftArchitecturalLandmarks";
import { MINECRAFT_PALETTE } from "../src/visual-modes/minecraft/palette";

const EXPECTED_MODELS = [
  "Minecraft Reichstag block signature",
  "Minecraft Federal Chancellery block signature",
  "Minecraft Berlin Hauptbahnhof block signature",
  "Minecraft Brandenburg Gate block signature",
  "Minecraft parliamentary band block signature",
] as const;

function instancedChildren(): InstancedMesh[] {
  return createMinecraftArchitecturalLandmarks().children as InstancedMesh[];
}

function matrixAndColourFingerprint(mesh: InstancedMesh): string {
  const matrix = new Matrix4();
  const colour = new Color();
  const values: string[] = [];
  for (let index = 0; index < mesh.count; index += 1) {
    mesh.getMatrixAt(index, matrix);
    mesh.getColorAt(index, colour);
    values.push(
      matrix.elements.map((value) => value.toFixed(5)).join(","),
      colour.getHex().toString(16).padStart(6, "0"),
    );
  }
  return values.join("|");
}

describe("block-native Berlin architectural signatures", () => {
  test("uses five shared, opaque cube batches and stays within budget", () => {
    const group = createMinecraftArchitecturalLandmarks();
    expect(group.name).toBe("Minecraft block-native architectural landmarks");
    expect(group.children.map(({ name }) => name)).toEqual(EXPECTED_MODELS);
    expect(group.userData).toMatchObject({
      blockNative: true,
      drawCallBudget: 5,
      noAdditionalPayload: true,
      staticAntiFlicker: true,
    });

    const meshes = instancedChildren();
    expect(meshes.map((mesh) => mesh.userData.landmarkId)).toEqual([
      "reichstag",
      "bundeskanzleramt",
      "berlin-hauptbahnhof",
      "brandenburger-tor",
      "parliamentary-band",
    ]);
    const geometryIds = new Set<string>();
    const materialIds = new Set<string>();
    let totalBlocks = 0;
    for (const mesh of meshes) {
      expect(mesh).toBeInstanceOf(InstancedMesh);
      expect(mesh.geometry).toBeInstanceOf(BoxGeometry);
      expect(mesh.material).toBeInstanceOf(MeshStandardMaterial);
      const material = mesh.material as MeshStandardMaterial;
      expect(material.transparent).toBe(false);
      expect(material.opacity).toBe(1);
      expect(material.map).toBeNull();
      expect(mesh.userData).toMatchObject({
        blockCount: mesh.count,
        blockNative: true,
        staticAntiFlicker: true,
        transparentGeometry: false,
      });
      expect(mesh.userData.maxNonStructuralVerticalSpanM).toBeLessThanOrEqual(
        4.001,
      );
      geometryIds.add(mesh.geometry.uuid);
      materialIds.add(material.uuid);
      totalBlocks += mesh.count;
    }
    expect(geometryIds.size).toBe(1);
    expect(materialIds.size).toBe(1);
    expect(totalBlocks).toBe(15_469);
  });

  test("keeps every colour in the fixed palette with restrained precious accents", () => {
    expect(minecraftArchitecturalPaletteIsClosed()).toBe(true);
    const palette = new Set<number>(MINECRAFT_PALETTE);
    const colour = new Color();
    let total = 0;
    let precious = 0;
    for (const mesh of instancedChildren()) {
      expect(mesh.instanceColor).not.toBeNull();
      expect(mesh.userData.preciousAccentRatio).toBeLessThanOrEqual(0.015);
      for (let index = 0; index < mesh.count; index += 1) {
        mesh.getColorAt(index, colour);
        const hex = colour.getHex();
        expect(palette.has(hex)).toBe(true);
        if (hex === 0xe6bd4c || hex === 0x2e5aa8) precious += 1;
        total += 1;
      }
    }
    expect(precious / total).toBeLessThanOrEqual(0.012);
  });

  test("pins the recognisable architectural cues", () => {
    const byName = new Map(
      instancedChildren().map((mesh) => [mesh.name, mesh.userData.cueCounts]),
    );
    expect(byName.get(EXPECTED_MODELS[0])).toMatchObject({
      "40 m stepped glass dome": 792,
      "bronze dedication band": 4,
      "five-course west stair": 45,
      "four corner-tower crowns": 48,
      "six-column west portico": 42,
      "west entrance glass": 15,
      "west entrance recess": 32,
      "west portico rear glazing": 18,
      "west portico rear masonry": 32,
    });
    expect(byName.get(EXPECTED_MODELS[1])).toMatchObject({
      "leadership aperture glazing": 106,
      "leadership cube masonry shell": 102,
      "four leadership pylons": 144,
      "open upper frame": 54,
      "stepped monumental saddle roof": 117,
      "twin semicircular leadership frames": 50,
    });
    expect(byName.get(EXPECTED_MODELS[2])).toMatchObject({
      "180 m north-south crossing hall": 450,
      "321 m bowed east-west glass hall": 810,
      "east-west station floor blocks": 700,
      "north-south station floor blocks": 450,
      "DB red entrance badge": 4,
      "east-west hall block gables": 40,
      "east-west hall side glazing": 648,
      "east-west raised railway deck": 810,
      "four east-west block tracks": 648,
      "north-south hall side glazing": 360,
      "station crossing floor seams": 20,
      "office-bridge end frames": 200,
      "office-bridge floor bands": 1_800,
      "office-bridge stepped crowns": 450,
      "twin 46 m office bridges": 1_932,
    });
    expect(byName.get(EXPECTED_MODELS[3])).toMatchObject({
      "four Quadriga horse bodies": 4,
      "twelve block Doric columns": 48,
      "two sandstone side pavilions": 72,
    });
    expect(byName.get(EXPECTED_MODELS[4])).toMatchObject({
      "eight Paul-Löbe committee rotundas": 432,
      "eight Paul-Löbe rotunda chord walls": 240,
      "eight Paul-Löbe rotunda roof caps": 48,
      "Lüders-Haus circular Spree opening": 32,
      "Lüders-Haus circular inner glazing": 22,
      "Lüders-Haus widening stair": 92,
      "Lüders-Haus rotunda roof cap": 45,
      "Paul-Löbe thirteen canopy columns": 65,
      "lower public bridge block handrails": 104,
      "lower public bridge deck": 52,
      "upper parliamentary bridge deck": 26,
      "upper bridge stepped diagonal ties": 78,
    });
  });

  test("uses the exact source anchors and metre-scale envelopes", () => {
    const meshes = instancedChildren();
    const reichstag = new Box3().setFromObject(meshes[0]);
    const chancellery = new Box3().setFromObject(meshes[1]);
    const station = new Box3().setFromObject(meshes[2]);
    const gate = new Box3().setFromObject(meshes[3]);
    const parliament = new Box3().setFromObject(meshes[4]);

    expect(MINECRAFT_ARCHITECTURAL_PROFILES.reichstag.anchorWorld).toEqual([
      317.729, 3.595, 40.477,
    ]);
    expect(reichstag.min.x).toBeGreaterThan(250);
    expect(reichstag.max.x).toBeLessThan(373);
    expect(reichstag.min.z).toBeLessThan(-29);
    expect(reichstag.max.z).toBeGreaterThan(110);
    expect(reichstag.max.y).toBeGreaterThan(49);

    expect(chancellery.max.x - chancellery.min.x).toBeGreaterThan(335);
    expect(chancellery.max.x - chancellery.min.x).toBeLessThan(345);
    expect(chancellery.max.y).toBeCloseTo(37.55, 1);
    expect(station.max.x - station.min.x).toBeGreaterThan(335);
    expect(station.max.y).toBeGreaterThan(50);
    expect(MINECRAFT_ARCHITECTURAL_PROFILES.hauptbahnhof).toMatchObject({
      entrances: {
        eastWest: {
          clearHeightM: 13.1,
          clearHalfWidthM: 14,
          endLocalX: 160.6,
        },
        northSouth: {
          clearHeightM: 9.1,
          clearHalfWidthM: 6,
          endLocalZ: 89.1,
        },
      },
      officeBridgeStoreys: 10,
      officeEntrances: {
        bridgeCentresLocalX: [-35, 35],
        clearHeightM: 7.9,
        clearHalfWidthM: 4,
        endLocalZ: 90.4,
      },
      portalCollisionSourcePrismIds: {
        north: "K0003Vlz",
        south: "K0003TlE",
        west: "HGmLi1Ck",
      },
      publicFloorTopLocalY: 1.32,
      trackDeckCentreLocalY: 9.8,
      trackDeckTopLocalY: 10.35,
      trackDeckWidthM: 37,
    });
    expect(gate.max.z - gate.min.z).toBeCloseTo(63.2, 0);
    expect(gate.max.y).toBeCloseTo(31, 0);
    expect(parliament.min.x).toBeLessThan(120);
    expect(parliament.max.x).toBeGreaterThan(447);
  });

  test("keeps the office-bridge portals visibly open to their collision height", () => {
    const profile = MINECRAFT_ARCHITECTURAL_PROFILES.hauptbahnhof;
    const mesh = instancedChildren()[2];
    const radians = (profile.rotationDegrees * Math.PI) / 180;
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    const matrix = new Matrix4();
    const position = new Vector3();
    const quaternion = new Quaternion();
    const scale = new Vector3();
    let portalFrameBlocks = 0;
    let lintelBlocks = 0;

    for (let index = 0; index < mesh.count; index += 1) {
      mesh.getMatrixAt(index, matrix);
      matrix.decompose(position, quaternion, scale);
      const dx = position.x - profile.anchorWorld[0];
      const dz = position.z - profile.anchorWorld[2];
      const localX = cosine * dx - sine * dz;
      const localZ = sine * dx + cosine * dz;
      const relativeOfficeX = Math.min(
        ...profile.officeEntrances.bridgeCentresLocalX.map((centre) =>
          Math.abs(localX - centre),
        ),
      );
      if (
        relativeOfficeX > profile.officeEntrances.clearHalfWidthM + 1e-4 ||
        Math.abs(Math.abs(localZ) - profile.officeEntrances.endLocalZ) > 1e-4
      ) {
        continue;
      }
      portalFrameBlocks += 1;
      const localBottom = position.y - profile.anchorWorld[1] - scale.y / 2;
      expect(localBottom).toBeGreaterThanOrEqual(
        profile.officeEntrances.clearHeightM - 1e-5,
      );
      if (Math.abs(localBottom - profile.officeEntrances.clearHeightM) < 1e-5) {
        lintelBlocks += 1;
      }
    }
    expect(portalFrameBlocks).toBeGreaterThan(lintelBlocks);
    expect(lintelBlocks).toBe(12);
  });

  test("emits finite positive and deterministic non-coincident transforms", () => {
    const first = instancedChildren();
    const second = instancedChildren();
    const matrix = new Matrix4();
    const position = new Vector3();
    const quaternion = new Quaternion();
    const scale = new Vector3();
    for (let meshIndex = 0; meshIndex < first.length; meshIndex += 1) {
      const mesh = first[meshIndex];
      expect(matrixAndColourFingerprint(mesh)).toBe(
        matrixAndColourFingerprint(second[meshIndex]),
      );
      const transforms = new Set<string>();
      for (let index = 0; index < mesh.count; index += 1) {
        mesh.getMatrixAt(index, matrix);
        matrix.decompose(position, quaternion, scale);
        expect(
          [
            ...position.toArray(),
            ...quaternion.toArray(),
            ...scale.toArray(),
          ].every(Number.isFinite),
        ).toBe(true);
        expect(Math.min(scale.x, scale.y, scale.z)).toBeGreaterThan(0);
        const key = matrix.elements.map((value) => value.toFixed(5)).join(",");
        expect(transforms.has(key)).toBe(false);
        transforms.add(key);
      }
    }
  });

  test("uses component-exact ownership instead of broad landmark boxes", () => {
    const gate = MINECRAFT_ARCHITECTURAL_PROFILES.brandenburgGate;
    expect(
      minecraftArchitecturalReplacementAt(
        gate.anchorWorld[0],
        gate.anchorWorld[2],
      ),
    ).toBe("brandenburg-gate");
    expect(
      isMinecraftArchitecturalReplacementColumn(
        gate.anchorWorld[0] + 45,
        gate.anchorWorld[2],
      ),
    ).toBe(false);
    expect(
      minecraftArchitecturalReplacementAt(
        MINECRAFT_ARCHITECTURAL_PROFILES.reichstag.anchorWorld[0],
        MINECRAFT_ARCHITECTURAL_PROFILES.reichstag.anchorWorld[2],
      ),
    ).toBeNull();
    expect(minecraftArchitecturalReplacementAt(266, 26)).toBe(
      "reichstag-west-portico",
    );
    expect(
      minecraftArchitecturalReplacementAt(
        MINECRAFT_ARCHITECTURAL_PROFILES.hauptbahnhof.anchorWorld[0],
        MINECRAFT_ARCHITECTURAL_PROFILES.hauptbahnhof.anchorWorld[2],
      ),
    ).toBe("berlin-hauptbahnhof");
    expect(minecraftArchitecturalReplacementAt(179.5, -108.2)).toBe(
      "paul-loebe-rotunda",
    );
    expect(minecraftArchitecturalReplacementAt(406, -139)).toBe(
      "melh-library-rotunda",
    );
    expect(minecraftArchitecturalReplacementAt(435, -101)).toBe(
      "melh-widening-stair",
    );

    const chancellery = MINECRAFT_ARCHITECTURAL_PROFILES.chancellery;
    const theta = (chancellery.rotationDegrees * Math.PI) / 180;
    const cubeWorldX =
      chancellery.anchorWorld[0] +
      Math.cos(theta) * chancellery.cube.offsetLocal[0] +
      Math.sin(theta) * chancellery.cube.offsetLocal[1];
    const cubeWorldZ =
      chancellery.anchorWorld[2] -
      Math.sin(theta) * chancellery.cube.offsetLocal[0] +
      Math.cos(theta) * chancellery.cube.offsetLocal[1];
    expect(minecraftArchitecturalReplacementAt(cubeWorldX, cubeWorldZ)).toBe(
      "chancellery-leadership-cube",
    );
    // The broad 343 m Chancellery envelope must not erase its open forecourt.
    expect(
      minecraftArchitecturalReplacementAt(
        chancellery.anchorWorld[0] - 150,
        chancellery.anchorWorld[2],
      ),
    ).toBeNull();
  });

  test("clips only coarse roof tops that would hide authored block cues", () => {
    const reichstag = MINECRAFT_ARCHITECTURAL_PROFILES.reichstag;
    expect(
      minecraftArchitecturalVoxelTopAt(
        reichstag.anchorWorld[0],
        reichstag.anchorWorld[2],
        37.2,
      ),
    ).toBeCloseTo(reichstag.dome.anchorWorld[1] - 1.8, 8);
    expect(
      minecraftArchitecturalVoxelTopAt(
        reichstag.anchorWorld[0] + 30,
        reichstag.anchorWorld[2],
        37.2,
      ),
    ).toBe(37.2);
    expect(minecraftArchitecturalVoxelTopAt(380, -150, 38)).toBeCloseTo(
      MINECRAFT_ARCHITECTURAL_PROFILES.marieElisabethLuedersHaus.facade.canopy
        .topY - 0.5,
      8,
    );
    expect(minecraftArchitecturalVoxelTopAt(500, -150, 38)).toBe(38);
  });

  test("pins the full LoD2 source registries behind every replacement", () => {
    expect(MINECRAFT_ARCHITECTURAL_PROFILES.reichstag.sourcePrismIds).toEqual([
      "K0002MCN",
      "UbQkgNZe",
      "ycOYQRVL",
    ]);
    expect(
      MINECRAFT_ARCHITECTURAL_PROFILES.chancellery.centralSourcePrismIds,
    ).toHaveLength(13);
    expect(
      MINECRAFT_ARCHITECTURAL_PROFILES.hauptbahnhof.sourcePrismIds,
    ).toHaveLength(17);
    expect(
      MINECRAFT_ARCHITECTURAL_PROFILES.paulLoebeHaus.sourcePrismIds,
    ).toEqual(["0sVYAxtY", "HA7mKuzG"]);
    expect(
      MINECRAFT_ARCHITECTURAL_PROFILES.paulLoebeHaus.committeeRotundas.map(
        ({ centreWorld, outwardZ, radiusM }) => [
          centreWorld,
          outwardZ,
          radiusM,
        ],
      ),
    ).toEqual([
      [[179.4, -120.4], 1, 8.3],
      [[215.05, -119.6], 1, 8.25],
      [[250.65, -118.7], 1, 8.25],
      [[286.25, -117.9], 1, 8.25],
      [[180.2, -152.4], -1, 8.2],
      [[215.8, -151.6], -1, 8.2],
      [[251.4, -150.75], -1, 8.2],
      [[286.95, -149.9], -1, 8.25],
    ]);
    expect(
      MINECRAFT_ARCHITECTURAL_PROFILES.paulLoebeHaus.committeeRotundas.flatMap(
        ({ sourcePrismIds }) => sourcePrismIds,
      ),
    ).toHaveLength(16);
    expect(
      MINECRAFT_ARCHITECTURAL_PROFILES.marieElisabethLuedersHaus.sourcePrismIds,
    ).toEqual(["RdNEzXe9"]);
  });

  test("atomically swaps smooth hero architecture only in Minecraft", () => {
    const signatures = new Group();
    for (const name of MINECRAFT_SMOOTH_SIGNATURE_REPLACEMENTS) {
      const child = new Group();
      child.name = name;
      signatures.add(child);
    }
    const unrelated = new Group();
    unrelated.name = "Memorial signature retained in Minecraft";
    signatures.add(unrelated);
    const central = new Group();
    const connection = new Group();
    connection.name = "Bundestag Spree connection recognition model";
    central.add(connection);

    setMinecraftArchitecturePresentation(signatures, central, true);
    for (const name of MINECRAFT_SMOOTH_SIGNATURE_REPLACEMENTS) {
      expect(signatures.getObjectByName(name)?.visible).toBe(false);
    }
    expect(unrelated.visible).toBe(true);
    expect(connection.visible).toBe(false);

    setMinecraftArchitecturePresentation(signatures, central, false);
    for (const name of MINECRAFT_SMOOTH_SIGNATURE_REPLACEMENTS) {
      expect(signatures.getObjectByName(name)?.visible).toBe(true);
    }
    expect(connection.visible).toBe(true);
  });
});
