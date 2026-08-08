import type { Group } from "three";

import {
  addBox,
  addPartialCylinder,
  createBuilder,
  finishDrawnGroup,
} from "./drawnKit";
import { type VoxelPayload, worldGroundSampler } from "./MinecraftVoxelWorld";

/**
 * "Amtssitz am Spreebogen", the interim seat of the Bundespräsidialamt,
 * drawn from the owner's own site photographs (six frames shot from
 * Elisabeth-Abegg-Straße and Wilhelmstraße/Bundeswehrkrankenhaus side,
 * summer + winter 2024/25 construction states) rather than the plan
 * rendering alone. The plan rendering matches the photos: this is not a
 * guess from a single artist's-impression frame.
 *
 * Built 2023–2026 by Sauerbruch Hutton for the BImA while Schloss
 * Bellevue is refurbished, occupied on 10 July 2026, and mapped in OSM as
 * `way/1535591727` (`building=civic`, `name=Amtssitz am Spreebogen`,
 * `start_date=2026`, `description=Ersatzbau für das Bundespräsidialamt`)
 * on Elisabeth-Abegg-Straße 2. It postdates the Berlin LoD2 release, so
 * there is no surveyed solid for it at all — only the OSM outline.
 *
 * What the photos show, and what v0.52.x's model got wrong: this is not a
 * square block. It is a long bar with fully rounded (pill-shaped) short
 * ends — a stretched capsule in plan, not a rectangle with chamfered
 * corners — about seven storeys tall. The facade is the building's one
 * unmistakable feature: narrow vertical cladding fins in many colours
 * (red, blue, yellow, grey, brown) mixed irregularly rather than banded,
 * running the full height between ribbon windows at every floor. As of
 * the reference photos the building is still under construction: full
 * scaffolding wraps every elevation and at least one tower crane oversails
 * the site, both of which this file adds as light staffage since the user
 * asked for them (nice-to-have, not load-bearing for the shape check).
 *
 * What is documented: a 93 × 74 m footprint (2776 m²) at wx −296 / wz −367,
 * a concrete plinth carrying five storeys of prefabricated solid-timber
 * modules, a sixth timber-frame storey with the state rooms, a flat roof,
 * fully rounded short ends and a facade of vertical multicoloured fins
 * with ribbon windows between them. Seven levels in all.
 *
 * What is NOT documented: the height in metres. Nobody published one, and
 * there is no LoD2 coverage to measure. The storey heights below are the
 * ordinary German office figures, and the group is flagged extrapolated
 * because of it — the mass is derived from a level count plus the site
 * photographs, not a metric survey.
 */

/** OSM bbox of way/1535591727, in viewer world metres. */
export const INTERIM_OFFICE_FOOTPRINT = {
  centreX: -296.2,
  centreZ: -366.5,
  depthM: 73.7,
  widthM: 92.9,
} as const;
/** The long axis of the block runs roughly east-west along Alt-Moabit. */
export const INTERIM_OFFICE_ROTATION_DEGREES = 0;
const ROTATION = (INTERIM_OFFICE_ROTATION_DEGREES * Math.PI) / 180;
/**
 * LoD2 predates the 2026 building. Its former-site prism sits slightly west
 * of the OSM outline, so the suppression envelope uses the same deliberately
 * conservative clearance as other hand-built recognition models. It is still
 * a footprint-overlap test, not a brittle LoD2 id list.
 */
export const INTERIM_OFFICE_SUPPRESSION_MARGIN_M = 20;
export const INTERIM_OFFICE_SUPPRESSION_OVERLAP_FRACTION = 0.3;

/** `building:min_level=1` over `building:levels=7`: plinth plus six. */
const PLINTH_HEIGHT_M = 4.6;
const STOREY_HEIGHT_M = 3.5;
const UPPER_STOREYS = 5;
const ATTIC_HEIGHT_M = 4.2;
const PARAPET_HEIGHT_M = 0.7;

/** Prefabricated ceramic/fibre-cement plinth cladding, seen dark in photos. */
const PLINTH = 0x746a5e;
const ATTIC = 0xd9c3aa;
const PARAPET = 0xb59a80;
const FENCE = 0x8a7259;
/** Ribbon-window glazing between the fins, one band per upper storey. */
const GLAZING = 0x8fa3ab;
/**
 * The fins photograph as a busy, irregular mix — reds, blues, a mustard
 * yellow, cool greys and warm browns side by side with no repeating band.
 * Kept as flat tones per the drawn-kit contract; the mix (not a gradient
 * or a regular stripe) is what the photos actually show.
 */
const FINS = [
  0xa8342a, // brick red
  0x3d5a7a, // steel blue
  0xc9a227, // mustard yellow
  0x8a8f92, // cool grey
  0x6b4a35, // warm brown
  0x7a2f33, // oxblood
  0x4a6b57, // muted green-grey (a few panels read cooler than the rest)
] as const;
const FIN_WIDTH_M = 0.6;
const FIN_SPACING_M = 1.9;

/**
 * The pill's rounded end caps are true semicircles matching the
 * footprint's short axis: radius = depthM / 2 (see `straightLength`
 * below). `CAP_SEGMENTS` only controls tessellation smoothness.
 */
const CAP_SEGMENTS = 20;
/** Inset of the set-back attic storey's rounded caps from the body's. */
const ATTIC_RADIUS_INSET_M = 2.5;

/** Construction-site staffage: cranes and perimeter fencing (nice-to-have). */
const CRANE_MAST = 0x8a1f1f;
const CRANE_ARM = 0xc9a227;
const SCAFFOLD_INK = 0x9aa0a4;

export function createSpreebogenOffice(ground: VoxelPayload): Group | null {
  const sample = worldGroundSampler(ground);
  const base = sample(
    INTERIM_OFFICE_FOOTPRINT.centreX,
    INTERIM_OFFICE_FOOTPRINT.centreZ,
  );
  if (base === null) {
    return null;
  }
  const builder = createBuilder();
  const {
    centreX: cx,
    centreZ: cz,
    depthM: depth,
    widthM: width,
  } = INTERIM_OFFICE_FOOTPRINT;
  const bodyHeight = STOREY_HEIGHT_M * UPPER_STOREYS;
  const bodyBase = base + PLINTH_HEIGHT_M;
  const atticBase = bodyBase + bodyHeight;
  // The straight run between the two rounded caps. Each cap is a true
  // semicircle of radius `depth / 2` (see the `addPartialCylinder` calls
  // below, which all draw the caps at that radius) wrapping the short
  // axis, so the two caps together consume exactly `depth` of the
  // footprint's long axis — not an independent, undersized constant.
  // (v0.53.0 subtracted a stale 12.5 m `CAP_RADIUS_M` here while the caps
  // themselves were already drawn at the correct `depth / 2` ≈ 36.85 m,
  // so the assembled body came out ~142 m wide instead of the OSM 92.9 m
  // and swallowed the neighbouring Zollpackhof/tower massing.)
  const straightLength = width - depth;

  // Plinth: same pill outline as the body, just squat. Modelled as a
  // straight box plus two rounded caps rather than one rounded-rect
  // extrusion, matching the flat-box vocabulary the rest of the drawn kit
  // uses (see addBox/addPartialCylinder in drawnKit.ts).
  addBox(
    builder, PLINTH,
    cx, base + PLINTH_HEIGHT_M / 2, cz,
    straightLength, PLINTH_HEIGHT_M, depth,
    ROTATION,
  );
  for (const side of [-1, 1]) {
    addPartialCylinder(
      builder, PLINTH,
      cx + (side * straightLength) / 2, base + PLINTH_HEIGHT_M / 2, cz,
      depth / 2, PLINTH_HEIGHT_M, CAP_SEGMENTS,
      side < 0 ? Math.PI / 2 : -Math.PI / 2, Math.PI,
      0,
    );
  }

  // Body: the pill proper. The straight run's long faces carry the fin
  // facade (added below); the rounded caps get their own wedge of fins so
  // the striping continues around the curve instead of stopping dead at
  // the tangent point, matching the photographed wraparound cladding.
  addBox(
    builder, GLAZING,
    cx, bodyBase + bodyHeight / 2, cz,
    straightLength, bodyHeight, depth,
    ROTATION,
  );
  for (const side of [-1, 1]) {
    addPartialCylinder(
      builder, GLAZING,
      cx + (side * straightLength) / 2, bodyBase + bodyHeight / 2, cz,
      depth / 2, bodyHeight, CAP_SEGMENTS,
      side < 0 ? Math.PI / 2 : -Math.PI / 2, Math.PI,
      0,
    );
  }

  // The state-room storey is set back on the roof, the way the
  // photographs and plan rendering both show it. Kept as a simple
  // rounded-rect (box + half-cylinder caps) at reduced radius/width.
  const atticStraight = straightLength - 5.0;
  const atticDepth = depth - 5.0;
  const atticRadius = atticDepth / 2 - ATTIC_RADIUS_INSET_M;
  addBox(
    builder, ATTIC,
    cx, atticBase + ATTIC_HEIGHT_M / 2, cz,
    atticStraight, ATTIC_HEIGHT_M, atticDepth,
    ROTATION,
  );
  for (const side of [-1, 1]) {
    addPartialCylinder(
      builder, ATTIC,
      cx + (side * atticStraight) / 2, atticBase + ATTIC_HEIGHT_M / 2, cz,
      atticRadius, ATTIC_HEIGHT_M, CAP_SEGMENTS,
      side < 0 ? Math.PI / 2 : -Math.PI / 2, Math.PI,
      0,
    );
  }
  addBox(
    builder, PARAPET,
    cx, atticBase + ATTIC_HEIGHT_M + PARAPET_HEIGHT_M / 2, cz,
    atticStraight - 0.8, PARAPET_HEIGHT_M, atticDepth - 0.8,
    ROTATION,
    false,
  );

  // Vertical fins on the two long, straight elevations: the building's
  // one unmistakable feature. Colours cycle irregularly (a 7-colour set
  // against a spacing that does not divide it evenly) so no run reads as
  // a repeating stripe, matching the photographed mix.
  const finRun = straightLength - 3.0;
  const finCount = Math.max(1, Math.floor(finRun / FIN_SPACING_M));
  for (let index = 0; index < finCount; index += 1) {
    const x = cx - (finCount - 1) * (FIN_SPACING_M / 2) + index * FIN_SPACING_M;
    const colour = FINS[(index * 3 + 1) % FINS.length];
    for (const side of [-1, 1]) {
      addBox(
        builder, colour,
        x, bodyBase + bodyHeight / 2, cz + (side * depth) / 2,
        FIN_WIDTH_M, bodyHeight, 0.5,
        ROTATION,
        false,
      );
    }
  }
  // Fins continue around the rounded caps in narrower radial wedges, so
  // the coloured cladding wraps the curve instead of stopping at the
  // tangent — the photographed building has no bare curved end.
  const capFinCount = 9;
  for (const side of [-1, 1]) {
    const capCentreX = cx + (side * straightLength) / 2;
    // Standard polar sweep (x = r cos theta, z = r sin theta) around the
    // cap centre, restricted to the half of the drum facing away from the
    // straight run: theta in [90°, 270°] for the left cap (outward is -x),
    // the mirrored [-90°, 90°] for the right cap. Using the same theta as
    // the fin's own Y rotation keeps each box tangential to the curve.
    const thetaStart = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    const thetaEnd = side < 0 ? (3 * Math.PI) / 2 : Math.PI / 2;
    for (let index = 0; index < capFinCount; index += 1) {
      const t = (index + 0.5) / capFinCount;
      const theta = thetaStart + t * (thetaEnd - thetaStart);
      const fx = capCentreX + Math.cos(theta) * (depth / 2 + 0.05);
      const fz = cz + Math.sin(theta) * (depth / 2 + 0.05);
      const colour = FINS[(index * 2 + (side < 0 ? 0 : 4)) % FINS.length];
      addBox(
        builder, colour,
        fx, bodyBase + bodyHeight / 2, fz,
        0.55, bodyHeight, FIN_WIDTH_M,
        theta,
        false,
      );
    }
  }

  // Storey-height horizontal ribbon-window seams, read as thin ink bands
  // between the fins on the two straight elevations.
  for (let level = 1; level < UPPER_STOREYS; level += 1) {
    const y = bodyBase + level * STOREY_HEIGHT_M;
    for (const side of [-1, 1]) {
      addBox(
        builder, GLAZING,
        cx, y, cz + (side * depth) / 2,
        straightLength, 0.12, 0.15,
        ROTATION,
      );
    }
  }

  // The brown metal fence that closes the site at ground level.
  for (const side of [-1, 1]) {
    addBox(
      builder, FENCE,
      cx, base + 1.1, cz + (side * (depth + 9)) / 2,
      width + 8, 2.2, 0.3,
      ROTATION,
    );
    addBox(
      builder, FENCE,
      cx + (side * (width + 8)) / 2, base + 1.1, cz,
      0.3, 2.2, depth + 9,
      ROTATION,
    );
  }

  // Light scaffold hinting: a thin frame skin over the two long faces,
  // just enough to read as "still under construction" without hiding the
  // facade colours the user asked to see. Nice-to-have per the brief.
  for (const side of [-1, 1]) {
    addBox(
      builder, SCAFFOLD_INK,
      cx, bodyBase + bodyHeight + 0.4, cz + (side * (depth + 1.2)) / 2,
      straightLength + 4, 0.15, 0.15,
      ROTATION,
      false,
    );
  }

  const group = finishDrawnGroup(builder, { name: "Amtssitz am Spreebogen" });
  if (group) {
    // Footprint from OSM; the height is inferred from `building:levels=7`.
    group.userData.extrapolated = true;
    // Construction-site staffage: two simple tower cranes with slewing
    // jibs, echoing the two cranes visible across the reference photos.
    // Nice-to-have per the brief, and kept in its own sub-group/mesh (not
    // merged into "… bodies") so the building's own footprint/height
    // bounds — what the tests pin against the OSM survey — stay exactly
    // the drawn massing, not the taller, off-centre crane jibs.
    const cranes = createConstructionCranes(base, cx, cz, straightLength, depth, bodyHeight);
    if (cranes) {
      group.add(cranes);
    }
  }
  return group;
}

function createConstructionCranes(
  base: number,
  cx: number,
  cz: number,
  straightLength: number,
  depth: number,
  bodyHeight: number,
): Group | null {
  const craneBuilder = createBuilder();
  const craneHeight = bodyHeight + ATTIC_HEIGHT_M + 22;
  const cranePositions: Array<{ armLength: number; x: number; z: number }> = [
    { armLength: 34, x: cx - straightLength / 2 - 6, z: cz - depth / 2 - 10 },
    { armLength: 28, x: cx + straightLength / 2 + 8, z: cz + depth / 2 + 6 },
  ];
  for (const crane of cranePositions) {
    addBox(
      craneBuilder, CRANE_MAST,
      crane.x, base + craneHeight / 2, crane.z,
      1.1, craneHeight, 1.1,
    );
    addBox(
      craneBuilder, CRANE_ARM,
      crane.x + crane.armLength / 2, base + craneHeight, crane.z,
      crane.armLength, 0.6, 0.6,
    );
    addBox(
      craneBuilder, CRANE_ARM,
      crane.x - crane.armLength * 0.28, base + craneHeight, crane.z,
      crane.armLength * 0.56, 0.6, 0.6,
    );
  }
  return finishDrawnGroup(craneBuilder, {
    name: "Amtssitz am Spreebogen site cranes",
  });
}
