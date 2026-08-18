import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
} from "three";

import {
  type Builder,
  createBuilder,
  finishDrawnGroup,
  paintGeometry,
} from "./drawnKit";
import { WATER_TOP_Y } from "./MinecraftVoxelWorld";
import {
  REAL_SPREE_VESSEL_PROFILES,
  REEDEREI_RIEDEL_FLEET_SOURCE,
  SPREE_VESSEL_GEOMETRY_STATUS,
  type SpreeVesselProfile,
} from "./SpreeVesselProfiles";

/**
 * Static, source-bound Berlin passenger vessels.
 *
 * Reederei Riedel publishes each vessel's length, beam, draught, build year
 * and type. Those three envelope dimensions are exact here. The restrained
 * superstructures express only the published "salon" / "panorama" typology;
 * they are not presented as general-arrangement surveys. Display positions
 * follow committed OSM waterway centre lines and are explicitly not AIS.
 */

const HULL_WHITE = 0xf1efe8;
const DECK = 0xd7d0c0;
const CABIN = 0xe9e5da;
const ROOF = 0xbfc4c0;
const WINDOW_BLUE = 0x315c6a;
const RAIL = 0x687174;
const NAV_RED = 0xd94945;
const NAV_GREEN = 0x4ea56d;
const WAKE = 0xc9edf0;

type Frame = {
  at: (along: number, across: number) => [number, number];
  rotation: number;
};

function frame(profile: SpreeVesselProfile): Frame {
  const [hx, hz] = profile.heading;
  // Three's +Y rotation maps local +X toward world -Z, hence the minus.
  const rotation = -Math.atan2(hz, hx);
  return {
    at: (along, across) => [
      profile.displayPositionWorldM[0] + hx * along - hz * across,
      profile.displayPositionWorldM[1] + hz * along + hx * across,
    ],
    rotation,
  };
}

function box(
  builder: Builder,
  color: number,
  f: Frame,
  along: number,
  y: number,
  across: number,
  sx: number,
  sy: number,
  sz: number,
  inked = true,
): void {
  const geometry = new BoxGeometry(sx, sy, sz);
  geometry.rotateY(f.rotation);
  const [cx, cz] = f.at(along, across);
  geometry.translate(cx, y, cz);
  paintGeometry(geometry, color);
  builder.parts.push(geometry);
  if (inked) builder.edges.push(new EdgesGeometry(geometry, 24));
}

function navLamp(
  builder: Builder,
  f: Frame,
  color: number,
  along: number,
  y: number,
  across: number,
): void {
  const geometry = new CylinderGeometry(0.11, 0.11, 0.28, 8);
  const [cx, cz] = f.at(along, across);
  geometry.translate(cx, y, cz);
  paintGeometry(geometry, color);
  builder.lamps.push(geometry);
}

/** A connected polygonal waterline inside the exact published envelope. */
function exactEnvelopeHull(
  builder: Builder,
  profile: SpreeVesselProfile,
  water: number,
): void {
  const length = profile.lengthM;
  const beam = profile.beamM;
  // Symmetric port/starboard taper: pointed bow, restrained transom stern.
  const outline: ReadonlyArray<readonly [number, number]> = [
    [-length / 2, -beam * 0.32],
    [-length * 0.44, -beam / 2],
    [length * 0.3, -beam / 2],
    [length / 2, 0],
    [length * 0.3, beam / 2],
    [-length * 0.44, beam / 2],
    [-length / 2, beam * 0.32],
  ];
  const freeboard = profile.type === "salon" ? 0.9 : 0.78;
  const bottom = water - profile.draughtM;
  const top = water + freeboard;
  const positions: number[] = [];
  for (const y of [bottom, top]) {
    for (const [along, across] of outline) positions.push(along, y, across);
  }
  const count = outline.length;
  const indices: number[] = [];
  for (let index = 1; index < count - 1; index += 1) {
    indices.push(0, index + 1, index);
    indices.push(count, count + index, count + index + 1);
  }
  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    indices.push(index, next, count + next, index, count + next, count + index);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const f = frame(profile);
  geometry.rotateY(f.rotation);
  geometry.translate(
    profile.displayPositionWorldM[0],
    0,
    profile.displayPositionWorldM[1],
  );
  paintGeometry(geometry, HULL_WHITE);
  builder.parts.push(geometry);
  builder.edges.push(new EdgesGeometry(geometry, 24));
}

function addSideWindows(
  builder: Builder,
  f: Frame,
  profile: SpreeVesselProfile,
  water: number,
  cabinLength: number,
  cabinY: number,
): void {
  const panes = profile.type === "panorama" ? 9 : 12;
  const spacing = cabinLength / panes;
  const paneLength = spacing * 0.68;
  for (let index = 0; index < panes; index += 1) {
    const along = -cabinLength / 2 + spacing * (index + 0.5);
    for (const side of [-1, 1]) {
      box(
        builder,
        WINDOW_BLUE,
        f,
        along,
        cabinY,
        side * (profile.beamM / 2 - 0.43),
        paneLength,
        profile.type === "panorama" ? 1.02 : 0.86,
        0.08,
        false,
      );
    }
  }
  for (const side of [-1, 1]) {
    navLamp(
      builder,
      f,
      side < 0 ? NAV_RED : NAV_GREEN,
      profile.lengthM / 2 - profile.lengthM * 0.08,
      water + 1.45,
      side * (profile.beamM / 2 - 0.22),
    );
  }
}

function buildPassengerVessel(
  builder: Builder,
  profile: SpreeVesselProfile,
  water: number,
): void {
  const f = frame(profile);
  exactEnvelopeHull(builder, profile, water);
  const cabinLength =
    profile.lengthM * (profile.type === "salon" ? 0.68 : 0.64);
  const cabinHeight = profile.type === "salon" ? 2.45 : 2.2;
  const cabinY = water + 0.72 + cabinHeight / 2;
  box(
    builder,
    DECK,
    f,
    -profile.lengthM * 0.025,
    water + 0.7,
    0,
    profile.lengthM * 0.87,
    0.12,
    profile.beamM * 0.91,
  );
  box(
    builder,
    CABIN,
    f,
    -profile.lengthM * 0.05,
    cabinY,
    0,
    cabinLength,
    cabinHeight,
    profile.beamM - 0.78,
  );
  box(
    builder,
    ROOF,
    f,
    -profile.lengthM * 0.05,
    water + 0.74 + cabinHeight,
    0,
    cabinLength + 0.55,
    0.18,
    profile.beamM - 0.42,
  );
  addSideWindows(builder, f, profile, water, cabinLength, cabinY + 0.18);

  // Published type cues only: panorama roof glazing or a second salon band.
  if (profile.type === "panorama") {
    box(
      builder,
      WINDOW_BLUE,
      f,
      -profile.lengthM * 0.02,
      water + cabinHeight + 0.9,
      0,
      cabinLength * 0.62,
      0.68,
      profile.beamM * 0.52,
      false,
    );
  } else {
    box(
      builder,
      CABIN,
      f,
      -profile.lengthM * 0.11,
      water + cabinHeight + 1.12,
      0,
      cabinLength * 0.54,
      1.7,
      profile.beamM - 1.15,
    );
    box(
      builder,
      WINDOW_BLUE,
      f,
      -profile.lengthM * 0.11,
      water + cabinHeight + 1.18,
      0,
      cabinLength * 0.48,
      0.78,
      profile.beamM - 1.05,
      false,
    );
  }

  // Sparse stanchions are a recognition cue, not a fixture survey.
  const stations = Math.max(4, Math.floor(profile.lengthM / 5));
  for (let index = 0; index <= stations; index += 1) {
    const along =
      -profile.lengthM * 0.39 + (profile.lengthM * 0.78 * index) / stations;
    for (const side of [-1, 1]) {
      box(
        builder,
        RAIL,
        f,
        along,
        water + 1.18,
        side * (profile.beamM / 2 - 0.2),
        0.07,
        0.72,
        0.07,
        false,
      );
    }
  }
  for (const side of [-1, 1]) {
    box(
      builder,
      RAIL,
      f,
      0,
      water + 1.54,
      side * (profile.beamM / 2 - 0.2),
      profile.lengthM * 0.78,
      0.07,
      0.07,
      false,
    );
  }
}

function wakeRibbon(
  builder: Builder,
  profile: SpreeVesselProfile,
  water: number,
  side: -1 | 1,
): void {
  const f = frame(profile);
  const length = profile.lengthM * 0.34;
  const geometry = new BoxGeometry(length, 0.025, 0.12);
  geometry.rotateY(f.rotation - side * 0.24);
  const [cx, cz] = f.at(-profile.lengthM * 0.61, side * profile.beamM * 0.31);
  geometry.translate(cx, water + 0.055, cz);
  paintGeometry(geometry, WAKE);
  builder.parts.push(geometry);
}

export function createVessels(waterTopY: number = WATER_TOP_Y): Group {
  const builder = createBuilder();
  for (const profile of REAL_SPREE_VESSEL_PROFILES) {
    buildPassengerVessel(builder, profile, waterTopY);
  }
  const group =
    finishDrawnGroup(builder, {
      name: "vessel",
      lampEmissive: 0xf3e8c5,
      lampEmissiveIntensity: 0.6,
    }) ?? new Group();

  const wakeBuilder = createBuilder();
  for (const profile of REAL_SPREE_VESSEL_PROFILES) {
    wakeRibbon(wakeBuilder, profile, waterTopY, -1);
    wakeRibbon(wakeBuilder, profile, waterTopY, 1);
  }
  const wakes = finishDrawnGroup(wakeBuilder, {
    name: "vessel wake ribbons",
  });
  if (wakes) {
    wakes.userData.hiddenInSchwellenraum = true;
    wakes.userData.staticAntiFlicker = true;
    wakes.userData.staticAllModes = true;
    group.add(wakes);
  }

  group.userData.extrapolated = false;
  group.userData.sourceBound = true;
  group.userData.properNamesVerified = true;
  group.userData.properNameRendered = false;
  group.userData.placementObserved = false;
  group.userData.staticAllModes = true;
  group.userData.staticAntiFlicker = true;
  group.userData.primarySource = REEDEREI_RIEDEL_FLEET_SOURCE;
  group.userData.geometryStatus = SPREE_VESSEL_GEOMETRY_STATUS;
  group.userData.vessels = REAL_SPREE_VESSEL_PROFILES.map((profile) => ({
    beamM: profile.beamM,
    buildYear: profile.buildYear,
    displayPositionWorldM: [...profile.displayPositionWorldM],
    draughtM: profile.draughtM,
    lengthM: profile.lengthM,
    name: profile.name,
    type: profile.type,
  }));
  group.traverse((object) => {
    object.userData.staticAllModes = true;
    object.userData.staticAntiFlicker = true;
  });
  return group;
}
