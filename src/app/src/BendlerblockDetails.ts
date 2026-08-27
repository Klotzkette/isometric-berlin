import { Group } from "three";

import {
  type Builder,
  addBox,
  addCylinder,
  createBuilder,
  finishDrawnGroup,
} from "./drawnKit";

export type BendlerblockDetailProfile = "full" | "mobile";

type Point2 = readonly [number, number];

/**
 * Source-bound recognition register for the Bendlerblock.
 *
 * Berlin LoD2 remains the complete building shell. This layer only restores
 * the five-storey stone/window cadence, the museum portal and the memorial
 * courtyard signatures which disappear in a generic facade pass.
 */
export const BENDLERBLOCK_PROFILE = {
  name: "Bendlerblock recognition details",
  osmBuildingRelationId: "7903504",
  osmMinistryRelationId: "13461930",
  lod2ParentBuildingId: "DEBE00YY2Bq0001i",
  eastWing: {
    sourcePartId: "DEBE3DThmdWef52O",
    officialHeightM: 27.903,
    floorCount: 5,
    footprintRingWorldM: [
      [-605.452, 1228.834],
      [-603.765, 1223.108],
      [-600.999, 1213.714],
      [-598.727, 1205.998],
      [-583.816, 1210.441],
      [-588.842, 1227.502],
      [-590.527, 1233.227],
      [-594.94, 1248.211],
      [-609.546, 1243.891],
      [-609.858, 1243.799],
      [-607.913, 1237.193],
    ] as const,
    museumNodeId: "73696610",
    museumNodeWorldM: [-602.468, 1242.595] as const,
    portalRotationY: 2.854,
  },
  memorialCourt: {
    bronzeMemorialNodeId: "7197479254",
    bronzeMemorialWorldM: [-641.563, 1214.09] as const,
    courtRotationY: -0.282,
    memorialPlaqueNodeId: "595339119",
    memorialPlaqueWorldM: [-628.542, 1231.243] as const,
    presentationEnvelopeM: [18, 28] as const,
  },
  groundY: 5.25,
  geometryStatus:
    "Berlin LoD2 east-wing ring and OSM memorial anchors with bounded procedural facade and courtyard recognition detail; not a component survey",
  sources: [
    "https://daten.berlin.de/datensaetze/3d-gebaeudemodelle-lod2-berlin",
    "https://www.openstreetmap.org/relation/7903504",
    "https://www.openstreetmap.org/node/73696610",
    "https://www.openstreetmap.org/node/7197479254",
    "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050300",
    "https://www.gdw-berlin.de/gedenkstaette-deutscher-widerstand/ort-der-erinnerung",
    "https://www.gdw-berlin.de/ort-der-erinnerung/1945-bis-heute",
  ] as const,
} as const;

export const BENDLERBLOCK_RENDER_BUDGET = {
  maxDrawables: 2,
  maxRenderedVertices: 18_000,
  maxStoredVertices: 9_000,
} as const;

const STONE = 0xc8c1b3;
const LIGHT_STONE = 0xe4ded1;
const WINDOW = 0x52676b;
const DARK_METAL = 0x363d3e;
const BRONZE = 0x527363;
const COURT_PAVING = 0xaaa79e;

function segmentBox(
  builder: Builder,
  color: number,
  start: Point2,
  end: Point2,
  centerY: number,
  height: number,
  depth = 0.2,
  inked = false,
): void {
  const deltaX = end[0] - start[0];
  const deltaZ = end[1] - start[1];
  const length = Math.hypot(deltaX, deltaZ);
  if (length < 0.25) return;
  addBox(
    builder,
    color,
    (start[0] + end[0]) / 2,
    centerY,
    (start[1] + end[1]) / 2,
    length + 0.04,
    height,
    depth,
    -Math.atan2(deltaZ, deltaX),
    inked,
  );
}

function localOffset(
  localX: number,
  localZ: number,
  rotationY: number,
): readonly [number, number] {
  const cosine = Math.cos(rotationY);
  const sine = Math.sin(rotationY);
  return [localX * cosine + localZ * sine, -localX * sine + localZ * cosine];
}

function localBox(
  builder: Builder,
  color: number,
  center: Point2,
  localX: number,
  centerY: number,
  localZ: number,
  width: number,
  height: number,
  depth: number,
  rotationY: number,
  inked = true,
): void {
  const [offsetX, offsetZ] = localOffset(localX, localZ, rotationY);
  addBox(
    builder,
    color,
    center[0] + offsetX,
    centerY,
    center[1] + offsetZ,
    width,
    height,
    depth,
    rotationY,
    inked,
  );
}

function addEastWingFacade(
  builder: Builder,
  detailProfile: BendlerblockDetailProfile,
): void {
  const profile = BENDLERBLOCK_PROFILE;
  const ring = profile.eastWing.footprintRingWorldM;
  const facadeBottomY = profile.groundY + 3.2;
  const facadeTopY = profile.groundY + 22.4;
  const floorPitch = (facadeTopY - facadeBottomY) / profile.eastWing.floorCount;
  const bayPitch = detailProfile === "full" ? 2.75 : 4.5;

  for (let edgeIndex = 0; edgeIndex < ring.length; edgeIndex += 1) {
    const start = ring[edgeIndex];
    const end = ring[(edgeIndex + 1) % ring.length];
    const deltaX = end[0] - start[0];
    const deltaZ = end[1] - start[1];
    const length = Math.hypot(deltaX, deltaZ);
    if (length < 3.2) continue;

    for (let floor = 0; floor <= profile.eastWing.floorCount; floor += 1) {
      segmentBox(
        builder,
        floor === profile.eastWing.floorCount ? LIGHT_STONE : STONE,
        start,
        end,
        facadeBottomY + floor * floorPitch,
        floor === profile.eastWing.floorCount ? 0.34 : 0.16,
        0.24,
      );
    }

    const bayCount = Math.max(1, Math.round(length / bayPitch));
    for (let bay = 0; bay <= bayCount; bay += 1) {
      const amount = bay / bayCount;
      addBox(
        builder,
        STONE,
        start[0] + deltaX * amount,
        (facadeBottomY + facadeTopY) / 2,
        start[1] + deltaZ * amount,
        0.15,
        facadeTopY - facadeBottomY,
        0.2,
        -Math.atan2(deltaZ, deltaX),
        false,
      );
    }

    for (let floor = 0; floor < profile.eastWing.floorCount; floor += 1) {
      const windowY = facadeBottomY + (floor + 0.5) * floorPitch;
      for (let bay = 0; bay < bayCount; bay += 1) {
        if (detailProfile === "mobile" && (bay + floor) % 2 !== 0) continue;
        const first = (bay + 0.18) / bayCount;
        const second = (bay + 0.82) / bayCount;
        segmentBox(
          builder,
          WINDOW,
          [start[0] + deltaX * first, start[1] + deltaZ * first],
          [start[0] + deltaX * second, start[1] + deltaZ * second],
          windowY,
          Math.max(0.7, floorPitch - 1.1),
          0.13,
        );
      }
    }
  }

  const portal = profile.eastWing.museumNodeWorldM;
  const rotation = profile.eastWing.portalRotationY;
  localBox(
    builder,
    DARK_METAL,
    portal,
    0,
    profile.groundY + 2.65,
    0,
    4.3,
    5.3,
    0.28,
    rotation,
  );
  for (const side of [-1, 1]) {
    localBox(
      builder,
      LIGHT_STONE,
      portal,
      side * 2.35,
      profile.groundY + 2.75,
      0,
      0.45,
      5.8,
      0.42,
      rotation,
    );
  }
  localBox(
    builder,
    LIGHT_STONE,
    portal,
    0,
    profile.groundY + 5.6,
    0,
    5.1,
    0.48,
    0.42,
    rotation,
  );
}

function addMemorialCourt(builder: Builder): void {
  const profile = BENDLERBLOCK_PROFILE;
  const court = profile.memorialCourt;
  const center: Point2 = court.bronzeMemorialWorldM;
  const [width, depth] = court.presentationEnvelopeM;

  localBox(
    builder,
    COURT_PAVING,
    center,
    0,
    profile.groundY + 0.035,
    1.8,
    width,
    0.07,
    depth,
    court.courtRotationY,
    false,
  );

  // Richard Scheibe's bound figure: a deliberately granular, image-free
  // silhouette that remains legible without claiming a scan of the artwork.
  addBox(
    builder,
    DARK_METAL,
    center[0],
    profile.groundY + 0.16,
    center[1],
    1.45,
    0.32,
    1.0,
    court.courtRotationY,
  );
  for (const side of [-1, 1]) {
    const [offsetX, offsetZ] = localOffset(
      side * 0.24,
      0,
      court.courtRotationY,
    );
    addCylinder(
      builder,
      BRONZE,
      center[0] + offsetX,
      profile.groundY + 1.05,
      center[1] + offsetZ,
      0.12,
      1.65,
      8,
    );
  }
  addCylinder(
    builder,
    BRONZE,
    center[0],
    profile.groundY + 2.05,
    center[1],
    0.34,
    0.65,
    8,
  );
  localBox(
    builder,
    BRONZE,
    center,
    0,
    profile.groundY + 2.2,
    -0.22,
    0.95,
    0.16,
    0.18,
    court.courtRotationY,
    false,
  );
  addCylinder(
    builder,
    BRONZE,
    center[0],
    profile.groundY + 2.62,
    center[1],
    0.22,
    0.4,
    8,
  );

  // Erich Reusch's two long ground sculptures are kept low and traversable.
  for (const [localX, localZ, length] of [
    [-4.4, 5.2, 8.4],
    [4.1, 7.7, 7.2],
  ] as const) {
    localBox(
      builder,
      DARK_METAL,
      center,
      localX,
      profile.groundY + 0.16,
      localZ,
      0.42,
      0.25,
      length,
      court.courtRotationY,
      false,
    );
  }

  // The OSM memorial plaque anchor gets a plain plate only. No copyrighted
  // wall text or quotation is reproduced.
  localBox(
    builder,
    DARK_METAL,
    court.memorialPlaqueWorldM,
    0,
    profile.groundY + 1.4,
    0,
    2.8,
    2.2,
    0.2,
    court.courtRotationY,
  );
  localBox(
    builder,
    LIGHT_STONE,
    court.memorialPlaqueWorldM,
    0,
    profile.groundY + 1.45,
    -0.12,
    2.1,
    0.1,
    0.08,
    court.courtRotationY,
    false,
  );
}

export function addBendlerblockDetails(
  builder: Builder,
  detailProfile: BendlerblockDetailProfile = "full",
): void {
  addEastWingFacade(builder, detailProfile);
  addMemorialCourt(builder);
}

export function createBendlerblockDetails(
  detailProfile: BendlerblockDetailProfile = "full",
): Group {
  const builder = createBuilder();
  addBendlerblockDetails(builder, detailProfile);
  const group = finishDrawnGroup(builder, {
    name: BENDLERBLOCK_PROFILE.name,
  });
  if (!group) throw new Error("Bendlerblock detail group is empty");
  group.userData = {
    ...BENDLERBLOCK_PROFILE,
    detailProfile,
    keepInMinecraft: false,
  };
  return group;
}
