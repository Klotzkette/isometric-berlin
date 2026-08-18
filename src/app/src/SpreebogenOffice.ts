import {
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  EdgesGeometry,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Path,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
} from "three";

import { ARCHITECTURAL_EDGE_THRESHOLD_DEGREES } from "./architecturalInk";
import {
  addBox,
  createBuilder,
  finishDrawnGroup,
  paintGeometry,
  type Builder,
} from "./drawnKit";
import { type VoxelPayload, worldGroundSampler } from "./MinecraftVoxelWorld";
import { markWindFlag, markWindFlagInstances } from "./WindFlags";

/**
 * Amtssitz am Spreebogen, the 2026 interim Bundespräsidialamt.
 *
 * Geometry source: OSM way/1535591727, projected from EPSG:4326 to the
 * viewer's EPSG:25833 origin (389500, 5820000). The 37-point outline is the
 * current built footprint: a bent bar with rounded turns and a Spree-facing
 * forecourt, not the 93 x 74 m capsule that earlier releases inferred from
 * its bounding box. Sauerbruch Hutton documents a concrete plinth, five
 * storeys of timber modules and a free-form timber-frame top storey.
 *
 * The OSM footprint is surveyed; the metre height remains extrapolated from
 * the documented level count. Facade colours are visual-reference cues only,
 * rendered as flat untextured paint. No internet photograph is distributed.
 */

export const INTERIM_OFFICE_FOOTPRINT_RING: readonly (readonly [
  number,
  number,
])[] = [
  [-276.65, -337.71],
  [-295.51, -322.81],
  [-298.7, -322.79],
  [-301.86, -323.92],
  [-302.99, -325.29],
  [-305.22, -329.2],
  [-305.05, -332.37],
  [-303.04, -335.9],
  [-290.78, -345.38],
  [-292.31, -347.61],
  [-288.64, -350.73],
  [-286.72, -360.9],
  [-327.67, -370.43],
  [-327.08, -373.51],
  [-338.6, -375.82],
  [-341.87, -377.16],
  [-344.37, -379.35],
  [-346.06, -382.23],
  [-346.76, -385.48],
  [-346.41, -388.79],
  [-345.03, -391.82],
  [-342.77, -394.26],
  [-339.85, -395.88],
  [-336.38, -396.51],
  [-332.9, -395.95],
  [-274.62, -381.84],
  [-270.74, -379.6],
  [-267.71, -377.22],
  [-261.42, -369.63],
  [-256.89, -364.33],
  [-254.19, -359.94],
  [-253.86, -355.36],
  [-256.1, -351.7],
  [-260.07, -348.25],
  [-265.49, -347.29],
  [-269.79, -343.82],
  [-275.79, -339.53],
] as const;

export const INTERIM_OFFICE_FOOTPRINT = {
  centreX: -296.13,
  centreZ: -366.46,
  depthM: 73.72,
  widthM: 92.9,
} as const;

/** Retained for consumers of the old API; the true outline is not rectangular. */
export const INTERIM_OFFICE_ROTATION_DEGREES = 0;
export const INTERIM_OFFICE_SUPPRESSION_MARGIN_M = 20;
export const INTERIM_OFFICE_SUPPRESSION_OVERLAP_FRACTION = 0.3;

const PLINTH_HEIGHT_M = 4.6;
const STOREY_HEIGHT_M = 3.5;
const UPPER_STOREYS = 5;
const ATTIC_HEIGHT_M = 4.2;
const PARAPET_HEIGHT_M = 0.65;

const PLINTH = 0x8a8b87;
const GLAZING = 0x758891;
const FLOOR_BAND = 0xd5d2ca;
const ATTIC = 0x8b9290;
const PARAPET = 0xb7b4ac;
const FACADE_PANELS = [
  0xc5c4bd, 0xa6aaa8, 0xd4d1ca, 0x8d9696, 0xb7b3aa, 0xd0cdc4, 0x9fa5a3,
] as const;
const WINDOW = 0x647982;
const WINDOW_LIT = 0xf0c98b;
const MODULE_SPACING_M = 1.82;
const PANEL_WIDTH_M = 0.54;
const ROOF_Y_OFFSET_M =
  PLINTH_HEIGHT_M +
  STOREY_HEIGHT_M * UPPER_STOREYS +
  ATTIC_HEIGHT_M +
  PARAPET_HEIGHT_M;

/** Official presidential-standard proportions; physical display size estimated. */
export const PRESIDENTIAL_STANDARD_PROFILE = {
  eagleFacesPole: true,
  eaglePartCount: 19,
  flagSideM: 2.4,
  poleHeightM: 7.6,
  redBorderRatio: 1 / 12,
  roofPosition: [-271.0, -357.0] as const,
  sourceUrl: "https://www.gesetze-im-internet.de/flaggano_1996/i_.html",
} as const;

function scaledRing(scale: number): Array<[number, number]> {
  return INTERIM_OFFICE_FOOTPRINT_RING.map(([x, z]) => [
    INTERIM_OFFICE_FOOTPRINT.centreX +
      (x - INTERIM_OFFICE_FOOTPRINT.centreX) * scale,
    INTERIM_OFFICE_FOOTPRINT.centreZ +
      (z - INTERIM_OFFICE_FOOTPRINT.centreZ) * scale,
  ]);
}

function addFootprint(
  builder: Builder,
  color: number,
  ring: readonly (readonly [number, number])[],
  baseY: number,
  height: number,
  inked = true,
): void {
  const shape = new Shape();
  ring.forEach(([x, z], index) => {
    if (index === 0) {
      shape.moveTo(x, -z);
    } else {
      shape.lineTo(x, -z);
    }
  });
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 1,
    depth: height,
    steps: 1,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, baseY, 0);
  paintGeometry(geometry, color);
  builder.parts.push(geometry);
  if (inked) {
    builder.edges.push(
      new EdgesGeometry(geometry, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES),
    );
  }
}

function addBoundaryBox(
  builder: Builder,
  color: number,
  a: readonly [number, number],
  b: readonly [number, number],
  y: number,
  height: number,
  depth: number,
  inked = false,
): void {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const length = Math.hypot(dx, dz);
  if (length < 0.08) return;
  addBox(
    builder,
    color,
    (a[0] + b[0]) / 2,
    y,
    (a[1] + b[1]) / 2,
    length + 0.04,
    height,
    depth,
    -Math.atan2(dz, dx),
    inked,
  );
}

function addFacade(
  builder: Builder,
  ring: readonly (readonly [number, number])[],
  bodyBase: number,
): void {
  let moduleIndex = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const a = ring[index];
    const b = ring[(index + 1) % ring.length];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const length = Math.hypot(dx, dz);
    if (length < 0.08) continue;
    const rotation = -Math.atan2(dz, dx);
    const count = Math.max(1, Math.round(length / MODULE_SPACING_M));
    const tangentX = dx / length;
    const tangentZ = dz / length;
    for (let level = 0; level < UPPER_STOREYS; level += 1) {
      for (let step = 0; step < count; step += 1) {
        const t = (step + 0.5) / count;
        const shifted = moduleIndex + step + level * 3 + index * 2;
        const isWindow = shifted % 5 === 0 || shifted % 7 === 0;
        const centreX = a[0] + dx * t;
        const centreZ = a[1] + dz * t;
        const colour = isWindow
          ? shifted % 13 === 0
            ? WINDOW_LIT
            : WINDOW
          : FACADE_PANELS[(shifted * 5 + level) % FACADE_PANELS.length];
        const width = isWindow ? 0.78 : PANEL_WIDTH_M;
        addBox(
          builder,
          colour,
          centreX,
          bodyBase + level * STOREY_HEIGHT_M + STOREY_HEIGHT_M / 2,
          centreZ,
          width,
          STOREY_HEIGHT_M - 0.38,
          isWindow ? 0.5 : 0.62,
          rotation,
          false,
        );
        // A narrow shadow reveal makes the photographed staggered module
        // cadence legible without projecting an image onto the facade.
        if (!isWindow && shifted % 4 === 0) {
          addBox(
            builder,
            0x727a79,
            centreX + tangentX * 0.46,
            bodyBase + level * STOREY_HEIGHT_M + STOREY_HEIGHT_M / 2,
            centreZ + tangentZ * 0.46,
            0.12,
            STOREY_HEIGHT_M - 0.5,
            0.66,
            rotation,
            false,
          );
        }
      }
    }
    moduleIndex += count;
    for (let level = 1; level < UPPER_STOREYS; level += 1) {
      addBoundaryBox(
        builder,
        FLOOR_BAND,
        a,
        b,
        bodyBase + level * STOREY_HEIGHT_M,
        0.13,
        0.28,
      );
    }
  }
}

function addAtticFacade(
  builder: Builder,
  ring: readonly (readonly [number, number])[],
  atticBase: number,
): void {
  let moduleIndex = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const a = ring[index];
    const b = ring[(index + 1) % ring.length];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const length = Math.hypot(dx, dz);
    if (length < 0.08) continue;
    const rotation = -Math.atan2(dz, dx);
    const count = Math.max(1, Math.round(length / 2.05));
    for (let step = 0; step < count; step += 1) {
      const t = (step + 0.5) / count;
      const shifted = moduleIndex + step + index * 2;
      addBox(
        builder,
        shifted % 3 === 0
          ? WINDOW
          : FACADE_PANELS[(shifted * 3) % FACADE_PANELS.length],
        a[0] + dx * t,
        atticBase + ATTIC_HEIGHT_M / 2,
        a[1] + dz * t,
        shifted % 3 === 0 ? 0.78 : 0.56,
        ATTIC_HEIGHT_M - 0.52,
        0.52,
        rotation,
        false,
      );
    }
    moduleIndex += count;
  }
}

function createEagleShape(): Shape {
  const eagle = new Shape();
  eagle.moveTo(0.5, 0.05);
  eagle.lineTo(0.2, 0.18);
  eagle.lineTo(0.03, 0.48);
  eagle.lineTo(-0.15, 0.78);
  eagle.lineTo(-0.48, 0.58);
  eagle.lineTo(-0.9, 0.42);
  eagle.lineTo(-0.62, 0.18);
  eagle.lineTo(-0.96, 0.06);
  eagle.lineTo(-0.58, -0.1);
  eagle.lineTo(-0.82, -0.34);
  eagle.lineTo(-0.42, -0.28);
  eagle.lineTo(-0.56, -0.58);
  eagle.lineTo(-0.15, -0.42);
  eagle.lineTo(-0.08, -0.78);
  eagle.lineTo(0.12, -0.51);
  eagle.lineTo(0.34, -0.8);
  eagle.lineTo(0.38, -0.42);
  eagle.lineTo(0.78, -0.58);
  eagle.lineTo(0.64, -0.28);
  eagle.lineTo(1.02, -0.34);
  eagle.lineTo(0.76, -0.1);
  eagle.lineTo(1.12, 0.06);
  eagle.lineTo(0.78, 0.2);
  eagle.lineTo(1.05, 0.44);
  eagle.lineTo(0.62, 0.56);
  eagle.lineTo(0.3, 0.76);
  eagle.lineTo(0.16, 0.52);
  eagle.lineTo(0.26, 0.28);
  eagle.lineTo(0.56, 0.36);
  eagle.lineTo(0.72, 0.22);
  eagle.closePath();
  return eagle;
}

function createFlagBorderGeometry(
  flagSide: number,
  border: number,
): ShapeGeometry {
  const field = new Shape();
  field.moveTo(0, -flagSide / 2);
  field.lineTo(flagSide, -flagSide / 2);
  field.lineTo(flagSide, flagSide / 2);
  field.lineTo(0, flagSide / 2);
  field.closePath();

  const opening = new Path();
  opening.moveTo(border, -flagSide / 2 + border);
  opening.lineTo(border, flagSide / 2 - border);
  opening.lineTo(flagSide - border, flagSide / 2 - border);
  opening.lineTo(flagSide - border, -flagSide / 2 + border);
  opening.closePath();
  field.holes.push(opening);
  return new ShapeGeometry(field, 1);
}

function addPresidentialStandard(group: Group, roofY: number): void {
  const [poleX, poleZ] = PRESIDENTIAL_STANDARD_PROFILE.roofPosition;
  const poleHeight = PRESIDENTIAL_STANDARD_PROFILE.poleHeightM;
  const flagSide = PRESIDENTIAL_STANDARD_PROFILE.flagSideM;
  const poleMaterial = new MeshBasicMaterial({ color: 0x737978 });
  const pole = new Mesh(
    new CylinderGeometry(0.08, 0.12, poleHeight, 10),
    poleMaterial,
  );
  pole.name = "Amtssitz presidential standard flagpole";
  pole.position.set(poleX, roofY + poleHeight / 2, poleZ);
  group.add(pole);

  const flagCentreY = roofY + poleHeight - flagSide / 2 - 0.45;
  const makeFlagPart = (
    name: string,
    geometry: PlaneGeometry | ShapeGeometry,
    color: number,
    zOffset: number,
    amplitudeM = 0.14,
  ): Mesh => {
    const mesh = new Mesh(
      geometry,
      new MeshBasicMaterial({ color, side: DoubleSide }),
    );
    mesh.name = name;
    mesh.position.set(poleX, flagCentreY, poleZ + zOffset);
    mesh.rotation.y = -0.08;
    markWindFlag(mesh, flagSide, {
      amplitudeM,
      kind: "federal-president",
      phase: 0.56,
    });
    group.add(mesh);
    return mesh;
  };

  const border = flagSide * PRESIDENTIAL_STANDARD_PROFILE.redBorderRatio;
  const redField = createFlagBorderGeometry(flagSide, border);
  makeFlagPart(
    "Amtssitz presidential standard red border",
    redField,
    0xc8102e,
    0,
  );
  const goldSide = flagSide - border * 2;
  const goldField = new PlaneGeometry(goldSide, goldSide, 12, 10);
  goldField.translate(flagSide / 2, 0, 0.014);
  makeFlagPart(
    "Amtssitz presidential standard gold field",
    goldField,
    0xffcc21,
    0,
  );

  for (const [face, zOffset] of [
    ["front", 0.028],
    ["back", -0.028],
  ] as const) {
    const eagle = new ShapeGeometry(createEagleShape(), 4);
    // The Flag Order requires the eagle's head to face the flagpole. The
    // source outline is drawn looking right, so mirror it on the cloth.
    eagle.scale(-flagSide * 0.39, flagSide * 0.39, 1);
    eagle.translate(flagSide * 0.51, 0.02, 0);
    makeFlagPart(
      `Amtssitz presidential standard federal eagle ${face}`,
      eagle,
      0x111111,
      zOffset,
      0.12,
    );
  }

  const detailPoints: Array<[number, number, number]> = [
    [0.56, 0.34, 1.3],
    [0.62, 0.23, 0.72],
    [0.21, -0.55, 0.75],
    [0.29, -0.62, 0.72],
    [0.37, -0.57, 0.72],
    [0.44, -0.63, 0.72],
    [0.48, -0.53, 0.72],
    [0.58, -0.54, 0.75],
    [0.67, -0.61, 0.72],
    [0.76, -0.56, 0.72],
    [0.83, -0.63, 0.72],
    [0.9, -0.53, 0.72],
    [0.25, -0.43, 0.65],
    [0.45, -0.43, 0.65],
    [0.65, -0.43, 0.65],
    [0.85, -0.43, 0.65],
    [0.3, -0.72, 0.58],
    [0.47, -0.72, 0.58],
    [0.75, -0.72, 0.58],
  ];
  for (const [face, zOffset] of [
    ["front", 0.056],
    ["back", -0.056],
  ] as const) {
    const redParts = new InstancedMesh(
      new CircleGeometry(0.055, 8),
      new MeshBasicMaterial({ color: 0xc8102e, side: DoubleSide }),
      PRESIDENTIAL_STANDARD_PROFILE.eaglePartCount,
    );
    redParts.name = `Amtssitz presidential standard eagle red details ${face}`;
    const dummy = new Object3D();
    const transforms: Array<{
      position: [number, number, number];
      rotation: [number, number, number];
      scale: [number, number, number];
      xFromPoleM: number;
    }> = [];
    detailPoints.forEach(([xRatio, yRatio, scale], index) => {
      const x = poleX + (1 - xRatio) * flagSide;
      const y = flagCentreY + yRatio * flagSide * 0.55;
      const transform = {
        position: [x, y, poleZ + zOffset] as [number, number, number],
        rotation: [0, -0.08, 0] as [number, number, number],
        scale: [scale, index < 2 ? 0.72 : 1, 1] as [number, number, number],
        xFromPoleM: x - poleX,
      };
      dummy.position.set(...transform.position);
      dummy.rotation.set(...transform.rotation);
      dummy.scale.set(...transform.scale);
      dummy.updateMatrix();
      redParts.setMatrixAt(index, dummy.matrix);
      transforms.push(transform);
    });
    redParts.instanceMatrix.needsUpdate = true;
    markWindFlagInstances(redParts, transforms, flagSide, {
      amplitudeM: 0.12,
      kind: "federal-president",
      phase: 0.56,
    });
    group.add(redParts);
  }
}

function addRoofAntennae(group: Group, roofY: number): void {
  const positions: readonly (readonly [number, number, number])[] = [
    [-288.0, -342.4, 3.2],
    [-300.8, -331.6, 4.1],
    [-331.4, -380.2, 3.8],
    [-325.0, -390.2, 3.1],
  ];
  const surface = new MeshBasicMaterial({ color: 0x808684 });
  for (const [x, z, height] of positions) {
    const antenna = new Mesh(
      new CylinderGeometry(0.035, 0.055, height, 6),
      surface,
    );
    antenna.name = "Amtssitz slender roof antenna";
    antenna.position.set(x, roofY + height / 2, z);
    group.add(antenna);
  }
}

export function createSpreebogenOffice(ground: VoxelPayload): Group | null {
  const sample = worldGroundSampler(ground);
  const base = sample(
    INTERIM_OFFICE_FOOTPRINT.centreX,
    INTERIM_OFFICE_FOOTPRINT.centreZ,
  );
  if (base === null) return null;

  const builder = createBuilder();
  const bodyRing = scaledRing(0.985);
  const atticRing = scaledRing(0.86);
  const parapetRing = scaledRing(0.84);
  const bodyHeight = STOREY_HEIGHT_M * UPPER_STOREYS;
  const bodyBase = base + PLINTH_HEIGHT_M;
  const atticBase = bodyBase + bodyHeight;

  addFootprint(
    builder,
    PLINTH,
    INTERIM_OFFICE_FOOTPRINT_RING,
    base,
    PLINTH_HEIGHT_M,
  );
  addFootprint(builder, GLAZING, bodyRing, bodyBase, bodyHeight);
  addFacade(builder, bodyRing, bodyBase);
  addFootprint(builder, ATTIC, atticRing, atticBase, ATTIC_HEIGHT_M);
  addAtticFacade(builder, atticRing, atticBase);
  addFootprint(
    builder,
    PARAPET,
    parapetRing,
    atticBase + ATTIC_HEIGHT_M,
    PARAPET_HEIGHT_M,
    false,
  );

  // ExtrudeGeometry is non-indexed while BoxGeometry is indexed. The shared
  // batcher intentionally requires one representation for every part.
  for (let index = 0; index < builder.parts.length; index += 1) {
    const part = builder.parts[index];
    if (part.index) {
      builder.parts[index] = part.toNonIndexed();
      part.dispose();
    }
  }

  const group = finishDrawnGroup(builder, { name: "Amtssitz am Spreebogen" });
  if (group) {
    addPresidentialStandard(group, base + ROOF_Y_OFFSET_M);
    addRoofAntennae(group, base + ROOF_Y_OFFSET_M);
    group.userData.extrapolated = true;
    group.userData.geometrySource = "OpenStreetMap way/1535591727";
    group.userData.keepInMinecraft = true;
    group.userData.massing = "surveyed bent-bar footprint";
    group.userData.architectureSource =
      "https://www.sauerbruchhutton.de/de/project/bea";
    group.userData.presidentialStandardSource =
      PRESIDENTIAL_STANDARD_PROFILE.sourceUrl;
    group.userData.facadeCadence = "staggered five-storey modular grid";
  }
  return group;
}
