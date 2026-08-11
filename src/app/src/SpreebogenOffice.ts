import { EdgesGeometry, ExtrudeGeometry, Shape } from "three";
import type { Group } from "three";

import { ARCHITECTURAL_EDGE_THRESHOLD_DEGREES } from "./architecturalInk";
import {
  addBox,
  createBuilder,
  finishDrawnGroup,
  paintGeometry,
  type Builder,
} from "./drawnKit";
import { type VoxelPayload, worldGroundSampler } from "./MinecraftVoxelWorld";

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

const PLINTH = 0x71685e;
const GLAZING = 0x829ba5;
const FLOOR_BAND = 0xe4ddd1;
const ATTIC = 0xd8c4ad;
const PARAPET = 0xbba087;
const FINS = [
  0xb2382d, 0x3d638a, 0xe0ad25, 0x91989a, 0x77503a, 0x85333c, 0x4f7761,
] as const;
const FIN_WIDTH_M = 0.52;
const FIN_SPACING_M = 1.85;

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
  bodyHeight: number,
): void {
  let finIndex = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const a = ring[index];
    const b = ring[(index + 1) % ring.length];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const length = Math.hypot(dx, dz);
    if (length < 0.08) continue;
    const rotation = -Math.atan2(dz, dx);
    const count = Math.max(1, Math.round(length / FIN_SPACING_M));
    for (let step = 0; step < count; step += 1) {
      const t = (step + 0.5) / count;
      addBox(
        builder,
        FINS[(finIndex * 3 + index * 2) % FINS.length],
        a[0] + dx * t,
        bodyBase + bodyHeight / 2,
        a[1] + dz * t,
        FIN_WIDTH_M,
        bodyHeight,
        0.48,
        rotation,
        false,
      );
      finIndex += 1;
    }
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
  addFacade(builder, bodyRing, bodyBase, bodyHeight);
  addFootprint(builder, ATTIC, atticRing, atticBase, ATTIC_HEIGHT_M);
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
    group.userData.extrapolated = true;
    group.userData.geometrySource = "OpenStreetMap way/1535591727";
    group.userData.keepInMinecraft = true;
    group.userData.massing = "surveyed bent-bar footprint";
  }
  return group;
}
