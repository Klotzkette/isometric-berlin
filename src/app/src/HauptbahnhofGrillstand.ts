import {
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
} from "three";

import {
  ARCHITECTURAL_EDGE_THRESHOLD_DEGREES,
  markArchitecturalInk,
} from "./architecturalInk";
import { createLetteringTexture } from "./drawnLettering";
import {
  type Builder,
  addBox,
  addCylinder,
  createBuilder,
  finishDrawnGroup,
  paintGeometry,
} from "./drawnKit";
import {
  type VoxelPayload,
  worldGroundSampler,
} from "./MinecraftVoxelWorld";

/**
 * The small kiosk below the western Stadtbahn approach is an OSM point, not a
 * surveyed building footprint. Its position is therefore exact to the shipped
 * OSM snapshot while every fixture dimension is explicitly photo-estimated.
 */
export const HAUPTBAHNHOF_GRILLSTAND_PROFILE = {
  address: "Agnes-Zahn-Harnack-Strasse 1",
  canopyDepthM: 1.65,
  canopyWidthM: 12.9,
  coolerDoorCount: 3,
  deckClearanceM: 5.0,
  depthM: 5.5,
  fairyLightCount: 20,
  geometryStatus:
    "OSM-node-positioned recognition model; kiosk and fixture dimensions are bounded estimates from owner-supplied August 2026 photographs, not surveyed geometry",
  groundYFallbackM: 4.8,
  heightM: 3.75,
  menuPosterCount: 4,
  name: "Grillstand HBF",
  osmNodeId: "2231321435",
  osmSourceUrl: "https://www.openstreetmap.org/node/2231321435",
  outdoorChairCount: 6,
  outdoorTableCount: 2,
  pedestrianBollardCount: 7,
  sourceEpsg25833: [389289.797799, 5820630.088062] as const,
  streetAxisDegrees: 3.53,
  visualReference: "owner-supplied photographs, August 2026",
  widthM: 12.2,
  world: [-210.202201, -630.088062] as const,
} as const;

function addTaperedCylinder(
  builder: Builder,
  color: number,
  x: number,
  y: number,
  z: number,
  topRadius: number,
  bottomRadius: number,
  height: number,
  segments = 12,
): void {
  const geometry = new CylinderGeometry(
    topRadius,
    bottomRadius,
    height,
    segments,
  );
  geometry.translate(x, y, z);
  paintGeometry(geometry, color);
  builder.parts.push(geometry);
  builder.edges.push(
    new EdgesGeometry(geometry, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES),
  );
}

function addLampSphere(
  builder: Builder,
  x: number,
  y: number,
  z: number,
  radius: number,
  color = 0xffd482,
): void {
  const geometry = new SphereGeometry(radius, 8, 6);
  geometry.translate(x, y, z);
  paintGeometry(geometry, color);
  builder.lamps.push(geometry);
}

function createSign(
  name: string,
  text: string,
  width: number,
  height: number,
  position: readonly [number, number, number],
  fieldColor: string,
  letterColor: string,
  rotationY = 0,
): Mesh {
  const texture = createLetteringTexture({
    bandHeightM: height,
    bandWidthM: width,
    capHeightM: height * 0.56,
    fieldColor,
    letterColor,
    text,
    texelsPerMetre: 240,
  });
  const dayMaterial = texture
    ? new MeshBasicMaterial({ map: texture, side: DoubleSide })
    : new MeshBasicMaterial({ color: fieldColor, side: DoubleSide });
  // A warm unlit night face keeps the dark lettering legible. A uniformly
  // emissive StandardMaterial washed the glyphs out against the cream field.
  const nightMaterial = texture
    ? new MeshBasicMaterial({
        color: 0xffdfb0,
        map: texture,
        side: DoubleSide,
      })
    : new MeshBasicMaterial({ color: 0xffdfb0, side: DoubleSide });
  const sign = new Mesh(new PlaneGeometry(width, height), dayMaterial);
  sign.name = name;
  sign.position.set(...position);
  sign.rotation.y = rotationY;
  sign.renderOrder = 10;
  sign.userData.dayMaterial = dayMaterial;
  sign.userData.geometryStatus =
    HAUPTBAHNHOF_GRILLSTAND_PROFILE.geometryStatus;
  sign.userData.lettering = text;
  sign.userData.nightMaterial = nightMaterial;
  sign.userData.visualReference =
    HAUPTBAHNHOF_GRILLSTAND_PROFILE.visualReference;
  return sign;
}

function createLightString(): Group {
  const group = new Group();
  group.name = "Grillstand HBF static patio light strings";
  const builder = createBuilder();
  const points: number[] = [];
  const strings = [
    {
      end: [13.8, 3.9, -3.7] as const,
      start: [5.8, 3.55, -1.45] as const,
    },
    {
      end: [13.2, 3.55, 0.2] as const,
      start: [5.8, 3.55, 1.4] as const,
    },
  ];
  for (const string of strings) {
    let previous: [number, number, number] | null = null;
    for (let index = 0; index < 10; index += 1) {
      const t = index / 9;
      const sag = 0.5 * 4 * t * (1 - t);
      const point: [number, number, number] = [
        string.start[0] + (string.end[0] - string.start[0]) * t,
        string.start[1] + (string.end[1] - string.start[1]) * t - sag,
        string.start[2] + (string.end[2] - string.start[2]) * t,
      ];
      addLampSphere(builder, ...point, 0.085);
      if (previous) {
        points.push(...previous, ...point);
      }
      previous = point;
    }
  }
  const cableGeometry = new BufferGeometry();
  cableGeometry.setAttribute(
    "position",
    new Float32BufferAttribute(points, 3),
  );
  const cables = new LineSegments(
    cableGeometry,
    markArchitecturalInk(
      new LineBasicMaterial({ color: 0x343636 }),
      "detail",
    ),
  );
  cables.name = "Grillstand HBF light-string cables";
  cables.renderOrder = 4;
  group.add(cables);
  const bulbs = finishDrawnGroup(builder, {
    lampEmissive: 0xffc45e,
    lampEmissiveIntensity: 1.45,
    name: "Grillstand HBF fairy lights",
  });
  if (bulbs) group.add(bulbs);
  return group;
}

function addOutdoorSeating(builder: Builder): void {
  const charcoal = 0x353737;
  const chairTone = 0x5c4d42;
  const tablePositions = [
    [7.7, 0.25],
    [10.55, -1.05],
  ] as const;
  for (const [tableX, tableZ] of tablePositions) {
    addCylinder(builder, charcoal, tableX, 0.72, tableZ, 0.08, 1.34, 8);
    addCylinder(builder, 0x706155, tableX, 1.38, tableZ, 0.62, 0.1, 18);
    for (const angle of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) {
      const chairX = tableX + Math.cos(angle) * 1.05;
      const chairZ = tableZ + Math.sin(angle) * 1.05;
      addBox(
        builder,
        chairTone,
        chairX,
        0.62,
        chairZ,
        0.54,
        0.12,
        0.54,
        -angle,
      );
      addBox(
        builder,
        chairTone,
        chairX - Math.cos(angle) * 0.24,
        1.03,
        chairZ - Math.sin(angle) * 0.24,
        0.54,
        0.72,
        0.1,
        -angle,
      );
    }
  }
}

function addFrontRecognitionDetails(builder: Builder): void {
  const profile = HAUPTBAHNHOF_GRILLSTAND_PROFILE;
  const frontZ = profile.depthM / 2 + 0.06;

  // Four illuminated food/menu panels, separated from the wall so they never
  // z-fight with the dark kiosk shell while orbiting.
  const posterCentres = [-5.15, -3.75, -2.35, -0.95];
  for (const [index, x] of posterCentres.entries()) {
    addBox(
      builder,
      index === 0 ? 0xffd46c : 0xf7e8bf,
      x,
      1.45,
      frontZ,
      1.38,
      2.08,
      0.08,
      0,
      true,
    );
    // Menu rows remain broad enough to survive minification; they are graphic
    // cues rather than fabricated readable dish names.
    for (let row = 0; row < 4; row += 1) {
      addBox(
        builder,
        row % 2 === 0 ? 0xc84a36 : 0x5c784e,
        x,
        1.92 - row * 0.31,
        frontZ + 0.052,
        0.86 - (row % 2) * 0.16,
        0.07,
        0.03,
        0,
        false,
      );
    }
  }

  // The left poster's recognisable vertical doner spit, built as geometry
  // rather than copying the photograph.
  addCylinder(builder, 0x55483e, -5.0, 1.43, frontZ + 0.13, 0.035, 1.65, 8);
  addTaperedCylinder(
    builder,
    0xd39243,
    -5.0,
    1.5,
    frontZ + 0.15,
    0.23,
    0.43,
    1.22,
    12,
  );

  // Service hatch and its stainless counter.
  addBox(builder, 0x4b6a70, 1.35, 1.58, frontZ, 3.0, 1.82, 0.1, 0, true);
  addBox(builder, 0xd4d0c5, 1.35, 0.78, frontZ + 0.22, 3.3, 0.13, 0.5);
  addBox(builder, 0x9da7a5, 1.35, 2.52, frontZ + 0.08, 3.12, 0.11, 0.18);
  for (const x of [-0.1, 0.87, 1.83, 2.8]) {
    addBox(builder, 0xb72f2e, x, 1.58, frontZ + 0.1, 0.08, 1.84, 0.08);
  }

  // Three glass refrigerator doors on the right, with shelf and bottle cues.
  for (let door = 0; door < profile.coolerDoorCount; door += 1) {
    const x = 3.45 + door * 0.72;
    addBox(builder, 0x66858b, x, 1.4, frontZ + 0.02, 0.64, 2.18, 0.09);
    addBox(builder, 0xd7d4c9, x, 1.4, frontZ + 0.09, 0.055, 2.1, 0.04);
    for (let shelf = 0; shelf < 4; shelf += 1) {
      addBox(
        builder,
        shelf % 2 === 0 ? 0xd6b23e : 0xa53d36,
        x,
        0.72 + shelf * 0.43,
        frontZ + 0.1,
        0.43,
        0.07,
        0.035,
        0,
        false,
      );
    }
  }

  // Downlights under the projecting canopy.
  for (let index = 0; index < 7; index += 1) {
    addLampSphere(
      builder,
      -5.45 + index * 1.8,
      2.88,
      frontZ + profile.canopyDepthM - 0.25,
      0.11,
    );
  }
}

/** Build the photo-bounded kiosk at its real OSM point below the viaduct. */
export function createHauptbahnhofGrillstand(
  ground: VoxelPayload,
  rail: { deck_top_y_m: number },
): Group | null {
  const profile = HAUPTBAHNHOF_GRILLSTAND_PROFILE;
  const sampleGround = worldGroundSampler(ground);
  const groundY =
    sampleGround(profile.world[0], profile.world[1]) ?? profile.groundYFallbackM;
  const deckUndersideY = rail.deck_top_y_m - 0.9;
  const clearanceM = deckUndersideY - (groundY + profile.heightM);
  if (clearanceM < profile.deckClearanceM - 0.2) {
    return null;
  }

  const group = new Group();
  group.name = "OSM-anchored Grillstand HBF recognition model";
  group.position.set(profile.world[0], groundY, profile.world[1]);
  group.rotation.y = (profile.streetAxisDegrees * Math.PI) / 180;
  group.userData = {
    clearanceM,
    deckUndersideY,
    geometryStatus: profile.geometryStatus,
    groundY,
    profile,
    sourceUrl: profile.osmSourceUrl,
    visualReference: profile.visualReference,
  };

  const builder = createBuilder();
  const shell = 0x292d2e;
  const trim = 0xc63335;
  const roof = 0x202425;
  addBox(
    builder,
    shell,
    0,
    profile.heightM / 2 - 0.24,
    0,
    profile.widthM,
    profile.heightM - 0.48,
    profile.depthM,
  );
  addBox(
    builder,
    roof,
    0,
    profile.heightM - 0.17,
    0,
    profile.widthM + 0.32,
    0.34,
    profile.depthM + 0.32,
  );
  addBox(
    builder,
    0xf4e9c8,
    -0.4,
    3.3,
    profile.depthM / 2 + 0.08,
    10.95,
    0.78,
    0.13,
  );
  addBox(
    builder,
    trim,
    -0.4,
    2.84,
    profile.depthM / 2 + 0.14,
    11.25,
    0.12,
    0.16,
  );
  addBox(
    builder,
    roof,
    0,
    2.92,
    profile.depthM / 2 + profile.canopyDepthM / 2,
    profile.canopyWidthM,
    0.22,
    profile.canopyDepthM,
  );
  addBox(
    builder,
    trim,
    0,
    2.84,
    profile.depthM / 2 + profile.canopyDepthM - 0.03,
    profile.canopyWidthM,
    0.18,
    0.14,
  );
  addFrontRecognitionDetails(builder);
  addOutdoorSeating(builder);

  // The seven stout foreground bollards in the owner's wider photograph.
  for (let index = 0; index < profile.pedestrianBollardCount; index += 1) {
    addCylinder(
      builder,
      0x4d5556,
      -5.55 + index * 1.85,
      0.55,
      profile.depthM / 2 + profile.canopyDepthM + 0.78,
      0.16,
      1.1,
      10,
    );
  }
  // Two litter bins beside the seating court.
  addBox(builder, 0x8d3d51, 11.7, 0.62, 1.3, 0.62, 1.24, 0.62, 0, true);
  addBox(builder, 0x625a78, 12.5, 0.62, 1.1, 0.62, 1.24, 0.62, 0, true);

  const drawn = finishDrawnGroup(builder, {
    lampEmissive: 0xffc96f,
    lampEmissiveIntensity: 1.18,
    name: "Grillstand HBF detailed kiosk",
  });
  if (drawn) group.add(drawn);

  const frontZ = profile.depthM / 2 + 0.17;
  group.add(
    createSign(
      "Grillstand HBF front fascia lettering",
      "GRILLSTAND",
      7.85,
      0.72,
      [-0.95, 3.32, frontZ],
      "#f4e9c8",
      "#303333",
    ),
  );
  group.add(
    createSign(
      "Grillstand HBF front DB-style badge",
      "HBF",
      1.42,
      0.7,
      [4.38, 3.32, frontZ + 0.01],
      "#fff5de",
      "#c83436",
    ),
  );
  group.add(
    createSign(
      "Grillstand HBF menu strip lettering",
      "DOENER NUDELBOX BURGER SALAT",
      10.65,
      0.5,
      [-0.35, 2.7, frontZ + 0.09],
      "#fff0d1",
      "#b63b32",
    ),
  );
  group.add(
    createSign(
      "Grillstand HBF east side lettering",
      "GRILLSTAND",
      5.25,
      0.82,
      [profile.widthM / 2 + 0.08, 3.24, 0.05],
      "#292d2e",
      "#fff2cd",
      Math.PI / 2,
    ),
  );
  group.add(createLightString());
  return group;
}
