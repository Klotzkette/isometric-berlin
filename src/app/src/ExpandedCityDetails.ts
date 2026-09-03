import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  EdgesGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  RingGeometry,
  Shape,
  SphereGeometry,
  SRGBColorSpace,
  type Texture,
  TorusGeometry,
  Vector3,
} from "three";

import { createLetteringTexture } from "./drawnLettering";
import { createSonyCenterSurroundings } from "./SonyCenterSurroundings";
import type { FocusCamera } from "./ArchitecturalLandmarks";
import { ARCHITECTURAL_EDGE_THRESHOLD_DEGREES } from "./architecturalInk";
import {
  AMANO_GRAND_CENTRAL_PROFILE,
  BERLIN_MODERN_PROFILE,
  EUROPACITY_PROFILE,
  HAMBURGER_BAHNHOF_PROFILE,
  KONRAD_ADENAUER_HAUS_PROFILE,
  KULTURFORUM_PROFILE,
  KOLLHOFF_TOWER_PROFILE,
  NEUE_NATIONALGALERIE_PROFILE,
  NORTHERN_CITY_PROFILE,
  POTSDAMER_DETAIL_PROFILE,
  RIECKHALLEN_PROFILE,
  ST_MATTHAEUS_PROFILE,
  TILLA_DURIEUX_PROFILE,
  WELT_BALLOON_PROFILE,
} from "./expandedCityProfiles";
import {
  type Builder,
  addBox,
  addCone,
  addCylinder,
  createBuilder,
  finishDrawnGroup,
  paintGeometry,
} from "./drawnKit";
import {
  BENDLERBLOCK_PROFILE,
  BENDLERBLOCK_RENDER_BUDGET,
  createBendlerblockDetails,
} from "./BendlerblockDetails";
import {
  createLeipzigerPlatzDetails,
  LEIPZIGER_PLATZ_ARCHITECTURE_PROFILE,
} from "./LeipzigerPlatzDetails";
import {
  createInvalidenfriedhofDetails,
  INVALIDENFRIEDHOF_DETAIL_PROFILE,
} from "./InvalidenfriedhofDetails";
import {
  MOABIT_PRISON_MEMORIAL_PROFILE,
  createMoabitPrisonMemorialPark,
  type MoabitPrisonMemorialDetailProfile,
} from "./MoabitPrisonMemorialPark";
import { WATER_TOP_Y } from "./MinecraftVoxelWorld";
import {
  CITY_WEST_PROFILE,
  CITY_WEST_SOURCE_URLS,
  createCityWestDetails,
} from "./CityWestDetails";
import {
  createSocialCourtDetails,
  SOCIAL_COURT_PROFILE,
  SOCIAL_COURT_RENDER_BUDGET,
} from "./SocialCourtDetails";
import {
  createPotsdamerPlatzPublicRealm,
  POTSDAMER_PUBLIC_REALM_PROFILE,
  POTSDAMER_PUBLIC_REALM_RENDER_BUDGET,
} from "./PotsdamerPlatzPublicRealm";

export type ExpandedLandmark = {
  name: string;
  world: [number, number, number];
};

export type ExpandedCityDetailsOptions = {
  detailProfile?: MoabitPrisonMemorialDetailProfile;
};

export {
  AMANO_GRAND_CENTRAL_PROFILE,
  BERLIN_MODERN_PROFILE,
  EUROPACITY_PROFILE,
  HAMBURGER_BAHNHOF_PROFILE,
  KONRAD_ADENAUER_HAUS_PROFILE,
  KULTURFORUM_PROFILE,
  KOLLHOFF_TOWER_PROFILE,
  NEUE_NATIONALGALERIE_PROFILE,
  NORTHERN_CITY_PROFILE,
  POTSDAMER_DETAIL_PROFILE,
  RIECKHALLEN_PROFILE,
  ST_MATTHAEUS_PROFILE,
  TILLA_DURIEUX_PROFILE,
  WELT_BALLOON_PROFILE,
} from "./expandedCityProfiles";
export {
  createLeipzigerPlatzDetails,
  LEIPZIGER_PLATZ_ARCHITECTURE_PROFILE,
  LEIPZIGER_PLATZ_PORTALS,
  leipzigerPlatzPortalAt,
} from "./LeipzigerPlatzDetails";
export {
  createInvalidenfriedhofDetails,
  INVALIDENFRIEDHOF_DETAIL_PROFILE,
} from "./InvalidenfriedhofDetails";
export {
  MOABIT_PRISON_MEMORIAL_PROFILE,
  MOABIT_PRISON_PARK_SOURCE_PROFILE,
  createMoabitPrisonMemorialPark,
} from "./MoabitPrisonMemorialPark";
export {
  CITY_WEST_PROFILE,
  CITY_WEST_RENDER_BUDGET,
  CITY_WEST_SOURCE_URLS,
  createCityWestDetails,
} from "./CityWestDetails";
export {
  createSocialCourtDetails,
  SOCIAL_COURT_PROFILE,
  SOCIAL_COURT_RENDER_BUDGET,
} from "./SocialCourtDetails";
export {
  createPotsdamerPlatzPublicRealm,
  POTSDAMER_PUBLIC_REALM_PROFILE,
  POTSDAMER_PUBLIC_REALM_RENDER_BUDGET,
} from "./PotsdamerPlatzPublicRealm";
export {
  BENDLERBLOCK_PROFILE,
  BENDLERBLOCK_RENDER_BUDGET,
  createBendlerblockDetails,
} from "./BendlerblockDetails";

const EXPANDED_FOCUS_PRESETS: Record<
  string,
  Omit<FocusCamera, "target_world">
> = {
  "Anhalter Bahnhof": {
    azimuth_degrees: 18,
    distance_m: 118,
    polar_degrees: 60,
    target_height_m: 10,
  },
  "Charlottenburger Tor": {
    azimuth_degrees: 78,
    distance_m: 112,
    polar_degrees: 60,
    target_height_m: 10,
  },
  "Berliner Philharmonie": {
    azimuth_degrees: 24,
    distance_m: 190,
    polar_degrees: 57,
    target_height_m: 16,
  },
  "DKB Campus Upbeat": {
    azimuth_degrees: 206,
    distance_m: 244,
    polar_degrees: 59,
    target_height_m: 38,
  },
  "Denkzeichen Georg Elser": {
    azimuth_degrees: 68,
    distance_m: 44,
    fov_degrees: 32,
    polar_degrees: 66,
    target_height_m: 8.8,
  },
  "Hamburger Bahnhof": {
    azimuth_degrees: 10,
    distance_m: 124,
    polar_degrees: 58,
    target_height_m: 11,
  },
  Gemäldegalerie: {
    azimuth_degrees: 26,
    distance_m: 232,
    polar_degrees: 58,
    target_height_m: 11,
  },
  "KPMG Europacity": {
    azimuth_degrees: 212,
    distance_m: 182,
    polar_degrees: 60,
    target_height_m: 35,
  },
  Kammermusiksaal: {
    azimuth_degrees: 32,
    distance_m: 164,
    polar_degrees: 56,
    target_height_m: 13,
  },
  "Kollhoff-Tower": {
    azimuth_degrees: 18,
    distance_m: 176,
    polar_degrees: 61,
    target_height_m: 48,
  },
  "Oggi's Gemüsekebab": {
    azimuth_degrees: 156,
    distance_m: 60,
    polar_degrees: 75,
    target_height_m: 2.5,
  },
  "Mall of Berlin": {
    azimuth_degrees: 180,
    distance_m: 176,
    polar_degrees: 61,
    target_height_m: 8,
  },
  Rieckhallen: {
    azimuth_degrees: 72,
    distance_m: 292,
    polar_degrees: 57,
    target_height_m: 8,
  },
  "Sozialgericht Berlin": {
    azimuth_degrees: 25.4,
    distance_m: 142,
    fov_degrees: 36,
    polar_degrees: 63,
    target_height_m: 9.2,
  },
  "Staatsbibliothek zu Berlin (Haus Potsdamer Straße)": {
    azimuth_degrees: 24,
    distance_m: 310,
    polar_degrees: 59,
    target_height_m: 20,
  },
  "Tilla-Durieux-Park": {
    azimuth_degrees: 28,
    distance_m: 178,
    polar_degrees: 62,
    target_height_m: 3.2,
  },
  "WELT Balloon": {
    azimuth_degrees: 34,
    distance_m: 218,
    polar_degrees: 68,
    target_height_m: 53,
  },
  "berlin modern — Museum des 20. Jahrhunderts": {
    azimuth_degrees: 160,
    distance_m: 188,
    polar_degrees: 58,
    target_height_m: 9,
  },
};

export function expandedCityFocusCamera(
  landmark: ExpandedLandmark,
): FocusCamera | null {
  const preset = EXPANDED_FOCUS_PRESETS[landmark.name];
  if (!preset) return null;
  const metricTargetByName: Record<string, readonly [number, number]> = {
    "Berliner Philharmonie": KULTURFORUM_PROFILE.philharmonie.centerWorldM,
    "DKB Campus Upbeat": EUROPACITY_PROFILE.upbeat.centerWorldM,
    Gemäldegalerie: KULTURFORUM_PROFILE.gemaldegalerie.centerWorldM,
    Kammermusiksaal: KULTURFORUM_PROFILE.kammermusiksaal.centerWorldM,
    "Staatsbibliothek zu Berlin (Haus Potsdamer Straße)":
      KULTURFORUM_PROFILE.staatsbibliothek.centerWorldM,
    "KPMG Europacity": EUROPACITY_PROFILE.einz.centerWorldM,
    "Sozialgericht Berlin": SOCIAL_COURT_PROFILE.frontCenterWorldM,
  };
  const metricTarget = metricTargetByName[landmark.name];
  const target_world: [number, number, number] = metricTarget
    ? [
        metricTarget[0],
        landmark.name === "Sozialgericht Berlin"
          ? SOCIAL_COURT_PROFILE.groundY
          : landmark.world[1],
        metricTarget[1],
      ]
    : landmark.name === "Oggi's Gemüsekebab"
      ? [landmark.world[0] + 4, landmark.world[1], landmark.world[2] + 2]
      : landmark.name === "Mall of Berlin"
        ? [landmark.world[0], landmark.world[1], landmark.world[2] - 48]
        : landmark.name === "Hamburger Bahnhof"
          ? [
              landmark.world[0] +
                HAMBURGER_BAHNHOF_PROFILE.facadeOffsetFromLandmarkM[0],
              landmark.world[1],
              landmark.world[2] +
                HAMBURGER_BAHNHOF_PROFILE.facadeOffsetFromLandmarkM[1],
            ]
          : landmark.world;
  return { ...preset, target_world };
}

export function funboxEntranceFocusCamera(): FocusCamera {
  const profile = NORTHERN_CITY_PROFILE.funbox;
  const entranceOffset = rotatedLocalOffset(0, 52, profile.rotationY);
  return {
    azimuth_degrees: 90,
    distance_m: 90,
    polar_degrees: 62,
    target_height_m: 3.5,
    target_world: [
      profile.centerWorldM[0] + entranceOffset[0],
      profile.groundY,
      profile.centerWorldM[1] + entranceOffset[1],
    ],
  };
}

const IVORY = 0xeee9dc;
const SANDSTONE = 0xd8c6a8;
const GOLD = 0xd4ab4e;
const BRICK = 0xa65d45;
const DARK_BRICK = 0x79463a;
const GLASS = 0xa7d1d8;
const DARK_FRAME = 0x29373a;
const PARK_GREEN = 0x9bc686;
const PARK_GREEN_BANK = 0x729d68;
const PARK_CUT_STEEL = 0x606764;
const SNOW_WHITE = 0xf2f1eb;
const BRONZE = 0x557e6d;
const HAMBURGER_STUCCO = 0xe7dfcf;
const HAMBURGER_CORNICE = 0xf4eddf;
const HAMBURGER_SAGE = 0x93a982;
const HAMBURGER_GLASS = 0x6b7f78;
const HAMBURGER_DOOR = 0x75513e;
const HAMBURGER_MULLION = 0x94775f;
const BERLIN_MODERN_MASONRY = 0xd9d0bc;
const BERLIN_MODERN_MASONRY_LIGHT = 0xeee8dc;
const BERLIN_MODERN_GLASS = 0x78979a;
const KULTURFORUM_STONE = 0xe7dfd1;
const KULTURFORUM_STONE_LIGHT = 0xf1ece2;
const KULTURFORUM_SHADOW = 0xa89b86;
const BERLIN_MODERN_ROOF = 0x354346;
const BERLIN_MODERN_PV_SEAM = 0x6d8587;
const AMANO_CLINKER = 0xd2cabd;
const AMANO_CLINKER_DARK = 0xaaa196;
const AMANO_GLASS = 0x86a9ab;
const EURO_GLASS = 0x789da4;
const EURO_GLASS_LIGHT = 0x94b6b8;
const EINZ_GLASS = 0x6f8991;
const EINZ_GLASS_LIGHT = 0x88a1a6;
const EURO_ALUMINIUM = 0xe2e0d7;
const EURO_ALUMINIUM_SHADOW = 0xb9bcb7;
const EURO_PLAZA_PAVING = 0xc9c8c0;
const EURO_PLAZA_PATH = 0xe3e0d7;
const EURO_PLAZA_GRAVEL = 0x9c9689;
const EURO_PLAZA_SOIL = 0x776557;
const CONSTRUCTION_RED = 0xc84038;
const CONSTRUCTION_WHITE = 0xf4f1e7;
const CONSTRUCTION_CONCRETE = 0xb9bab6;
const CONSTRUCTION_CONCRETE_LIGHT = 0xd8d8d2;
const CONSTRUCTION_HOARDING = 0x252d2d;
const CONSTRUCTION_STEEL = 0x59615f;
const CONSTRUCTION_TIMBER = 0x9d7b56;
const UPBEAT_GLASS = 0x7e999d;
const UPBEAT_GLASS_LIGHT = 0xa5b9b9;
const UPBEAT_GRID = 0xd8cdb5;
const UPBEAT_GRID_LIGHT = 0xeee5d3;
const UPBEAT_ROOF = 0xe5e2da;
const CEMETERY_GRASS = 0x789c6b;
const CEMETERY_PATH = 0xd4c9ae;
const CEMETERY_STONE = 0xa9a79f;
const CEMETERY_STONE_DARK = 0x747570;
const CEMETERY_BRICK = 0x9a624e;
const CEMETERY_MORTAR = 0xd2b09c;
const EURO_TERRACE_GREEN = 0x5f8e69;
const EURO_WINDOW_LIGHT = 0x91aaa7;
// The temporary inflatable park is colourful in reality, but the former
// primary-colour values overwhelmed every permanent building around it.
// These sun-faded textile tones preserve recognition without turning the
// Europacity edge into a saturated UI marker.
const FUNBOX_RED = 0xc95f55;
const FUNBOX_ORANGE = 0xd58a55;
const FUNBOX_YELLOW = 0xdcc66d;
const FUNBOX_GREEN = 0x6f9a72;
const FUNBOX_BLUE = 0x6789a8;
const FUNBOX_PURPLE = 0x88769e;
const FUNBOX_PINK = 0xc68198;

function transformGeometry(
  geometry: BufferGeometry,
  x: number,
  y: number,
  z: number,
  rotationY: number,
): void {
  geometry.applyMatrix4(new Matrix4().makeRotationY(rotationY));
  geometry.translate(x, y, z);
}

function addCustomGeometry(
  builder: Builder,
  geometry: BufferGeometry,
  color: number,
  inked = true,
  lamp = false,
): void {
  if (!geometry.index) {
    const count = geometry.getAttribute("position").count;
    geometry.setIndex(Array.from({ length: count }, (_, index) => index));
  }
  paintGeometry(geometry, color);
  (lamp ? builder.lamps : builder.parts).push(geometry);
  if (inked) {
    builder.edges.push(
      new EdgesGeometry(geometry, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES),
    );
  }
}

function addGabledRoof(
  builder: Builder,
  color: number,
  x: number,
  y: number,
  z: number,
  width: number,
  depth: number,
  rise: number,
  rotationY = 0,
): void {
  const hw = width / 2;
  const hd = depth / 2;
  const positions = new Float32Array([
    -hw,
    0,
    -hd,
    hw,
    0,
    -hd,
    0,
    rise,
    -hd,
    -hw,
    0,
    hd,
    0,
    rise,
    hd,
    hw,
    0,
    hd,
    -hw,
    0,
    -hd,
    0,
    rise,
    -hd,
    -hw,
    0,
    hd,
    -hw,
    0,
    hd,
    0,
    rise,
    -hd,
    0,
    rise,
    hd,
    hw,
    0,
    -hd,
    hw,
    0,
    hd,
    0,
    rise,
    -hd,
    hw,
    0,
    hd,
    0,
    rise,
    hd,
    0,
    rise,
    -hd,
    -hw,
    0,
    -hd,
    -hw,
    0,
    hd,
    hw,
    0,
    -hd,
    hw,
    0,
    -hd,
    -hw,
    0,
    hd,
    hw,
    0,
    hd,
  ]);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  transformGeometry(geometry, x, y, z, rotationY);
  addCustomGeometry(builder, geometry, color);
}

function rotatedLocalOffset(
  localX: number,
  localZ: number,
  rotationY: number,
): [number, number] {
  const cosine = Math.cos(rotationY);
  const sine = Math.sin(rotationY);
  return [localX * cosine + localZ * sine, -localX * sine + localZ * cosine];
}

function rotatedRectangleRing(
  center: readonly [number, number],
  width: number,
  depth: number,
  rotationY: number,
): [number, number][] {
  return [
    [-width / 2, -depth / 2],
    [width / 2, -depth / 2],
    [width / 2, depth / 2],
    [-width / 2, depth / 2],
  ].map(([localX, localZ]) => {
    const [offsetX, offsetZ] = rotatedLocalOffset(localX, localZ, rotationY);
    return [center[0] + offsetX, center[1] + offsetZ];
  });
}

function addLocalBox(
  builder: Builder,
  color: number,
  origin: Vector3,
  localX: number,
  centerY: number,
  localZ: number,
  width: number,
  height: number,
  depth: number,
  rotationY: number,
  inked = true,
): void {
  const [offsetX, offsetZ] = rotatedLocalOffset(localX, localZ, rotationY);
  addBox(
    builder,
    color,
    origin.x + offsetX,
    centerY,
    origin.z + offsetZ,
    width,
    height,
    depth,
    rotationY,
    inked,
  );
}

function addLocalLampBox(
  builder: Builder,
  color: number,
  origin: Vector3,
  localX: number,
  centerY: number,
  localZ: number,
  width: number,
  height: number,
  depth: number,
  rotationY: number,
): void {
  const geometry = new BoxGeometry(width, height, depth);
  geometry.applyMatrix4(new Matrix4().makeRotationY(rotationY));
  const [offsetX, offsetZ] = rotatedLocalOffset(localX, localZ, rotationY);
  geometry.translate(origin.x + offsetX, centerY, origin.z + offsetZ);
  addCustomGeometry(builder, geometry, color, false, true);
}

function addTiltedLocalBox(
  builder: Builder,
  color: number,
  origin: Vector3,
  localX: number,
  centerY: number,
  localZ: number,
  width: number,
  height: number,
  depth: number,
  rotationZ: number,
  rotationY: number,
  inked = false,
): void {
  const geometry = new BoxGeometry(width, height, depth);
  geometry.applyMatrix4(new Matrix4().makeRotationZ(rotationZ));
  geometry.applyMatrix4(new Matrix4().makeRotationY(rotationY));
  const [offsetX, offsetZ] = rotatedLocalOffset(localX, localZ, rotationY);
  geometry.translate(origin.x + offsetX, centerY, origin.z + offsetZ);
  addCustomGeometry(builder, geometry, color, inked);
}

type WorldRing = readonly (readonly [number, number])[];

function polygonPrismGeometry(
  ring: WorldRing,
  bottomY: number,
  height: number,
): BufferGeometry {
  const shape = new Shape();
  ring.forEach(([x, z], index) => {
    if (index === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  });
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 1,
    depth: height,
    steps: 1,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, bottomY, 0);
  geometry.computeVertexNormals();
  return geometry;
}

function addPolygonPrism(
  builder: Builder,
  color: number,
  ring: WorldRing,
  bottomY: number,
  height: number,
  inked = true,
): void {
  if (ring.length < 3 || height <= 0) return;
  addCustomGeometry(
    builder,
    polygonPrismGeometry(ring, bottomY, height),
    color,
    inked,
  );
}

function clipRingEast(ring: WorldRing, minimumX: number): [number, number][] {
  const clipped: [number, number][] = [];
  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const previous = ring[(index + ring.length - 1) % ring.length];
    const currentInside = current[0] >= minimumX;
    const previousInside = previous[0] >= minimumX;
    if (currentInside !== previousInside) {
      const fraction = (minimumX - previous[0]) / (current[0] - previous[0]);
      clipped.push([
        minimumX,
        previous[1] + (current[1] - previous[1]) * fraction,
      ]);
    }
    if (currentInside) clipped.push([current[0], current[1]]);
  }
  return clipped;
}

function addFacadeSegment(
  builder: Builder,
  color: number,
  start: readonly [number, number],
  end: readonly [number, number],
  centerY: number,
  height: number,
  depth = 0.22,
  lamp = false,
  inked = false,
): void {
  const deltaX = end[0] - start[0];
  const deltaZ = end[1] - start[1];
  const length = Math.hypot(deltaX, deltaZ);
  if (length < 0.08 || height <= 0) return;
  const geometry = new BoxGeometry(length + 0.08, height, depth);
  geometry.rotateY(-Math.atan2(deltaZ, deltaX));
  geometry.translate((start[0] + end[0]) / 2, centerY, (start[1] + end[1]) / 2);
  addCustomGeometry(builder, geometry, color, inked, lamp);
}

function addBeamBetween(
  builder: Builder,
  color: number,
  start: Vector3,
  end: Vector3,
  thickness: number,
  lamp = false,
): void {
  const direction = end.clone().sub(start);
  const length = direction.length();
  if (length < 0.08) return;
  const geometry = new BoxGeometry(thickness, length, thickness);
  geometry.applyQuaternion(
    new Quaternion().setFromUnitVectors(
      new Vector3(0, 1, 0),
      direction.normalize(),
    ),
  );
  geometry.translate(
    (start.x + end.x) / 2,
    (start.y + end.y) / 2,
    (start.z + end.z) / 2,
  );
  addCustomGeometry(builder, geometry, color, false, lamp);
}

function addTierFacadeGrid(
  builder: Builder,
  ring: WorldRing,
  bottomY: number,
  topY: number,
  floorCount: number,
  frameColor: number,
  bayPitchM = 2.7,
): void {
  const floorPitch = (topY - bottomY) / floorCount;
  for (let edgeIndex = 0; edgeIndex < ring.length; edgeIndex += 1) {
    const start = ring[edgeIndex];
    const end = ring[(edgeIndex + 1) % ring.length];
    const deltaX = end[0] - start[0];
    const deltaZ = end[1] - start[1];
    const length = Math.hypot(deltaX, deltaZ);
    if (length < 0.7) continue;
    for (let floor = 0; floor <= floorCount; floor += 1) {
      addFacadeSegment(
        builder,
        frameColor,
        start,
        end,
        bottomY + floorPitch * floor,
        0.14,
        0.3,
      );
    }
    const bayCount = Math.max(1, Math.round(length / bayPitchM));
    const rotationY = -Math.atan2(deltaZ, deltaX);
    for (let bay = 0; bay <= bayCount; bay += 1) {
      const fraction = bay / bayCount;
      const geometry = new BoxGeometry(0.16, topY - bottomY, 0.28);
      geometry.rotateY(rotationY);
      geometry.translate(
        start[0] + deltaX * fraction,
        (bottomY + topY) / 2,
        start[1] + deltaZ * fraction,
      );
      addCustomGeometry(builder, geometry, frameColor, false);
    }
    if (length < 4) continue;
    for (let floor = 0; floor < floorCount; floor += 1) {
      for (let bay = 0; bay < bayCount; bay += 1) {
        if ((edgeIndex * 7 + floor * 3 + bay * 5) % 11 > 2) continue;
        const startFraction = (bay + 0.12) / bayCount;
        const endFraction = (bay + 0.88) / bayCount;
        addFacadeSegment(
          builder,
          EURO_WINDOW_LIGHT,
          [
            start[0] + deltaX * startFraction,
            start[1] + deltaZ * startFraction,
          ],
          [start[0] + deltaX * endFraction, start[1] + deltaZ * endFraction],
          bottomY + floorPitch * (floor + 0.5),
          Math.max(0.5, floorPitch - 0.62),
          0.12,
          true,
        );
      }
    }
  }
}

function addEinzFacadeScreen(builder: Builder): void {
  const profile = EUROPACITY_PROFILE.einz;
  const origin = new Vector3(
    profile.centerWorldM[0],
    profile.groundY,
    profile.centerWorldM[1],
  );
  const floorPitch = profile.measuredHeightM / profile.floorCount;
  const [longBayCount, shortBayCount] = profile.facadeBayCounts;

  // The LoD2 shell remains the metric authority. A calm, fractionally larger
  // curtain-wall envelope masks the former decorative folds without changing
  // the surveyed footprint or 84 m crown. The published 1.35 m planning grid
  // resolves to 32 bays on the long face and 18 on the short face.
  addLocalBox(
    builder,
    EINZ_GLASS,
    origin,
    0,
    profile.groundY + profile.measuredHeightM / 2,
    0,
    profile.footprintLengthM + 0.28,
    profile.measuredHeightM,
    profile.footprintDepthM + 0.28,
    profile.rotationY,
  );
  for (const side of [-1, 1]) {
    for (let floor = 0; floor <= profile.floorCount; floor += 1) {
      const centerY = profile.groundY + floor * floorPitch;
      addLocalBox(
        builder,
        EURO_ALUMINIUM_SHADOW,
        origin,
        0,
        centerY,
        side * (profile.footprintDepthM / 2 + 0.18),
        profile.footprintLengthM + 0.5,
        0.13,
        0.3,
        profile.rotationY,
        false,
      );
      addLocalBox(
        builder,
        EURO_ALUMINIUM_SHADOW,
        origin,
        side * (profile.footprintLengthM / 2 + 0.18),
        centerY,
        0,
        0.3,
        0.13,
        profile.footprintDepthM + 0.5,
        profile.rotationY,
        false,
      );
    }
    for (let bay = 0; bay <= longBayCount; bay += 1) {
      const localX =
        -profile.footprintLengthM / 2 +
        (profile.footprintLengthM * bay) / longBayCount;
      const primaryFin = bay % profile.primaryFinEveryBays === 0;
      addLocalBox(
        builder,
        primaryFin ? EURO_ALUMINIUM_SHADOW : EURO_ALUMINIUM,
        origin,
        localX,
        profile.groundY + profile.measuredHeightM / 2,
        side * (profile.footprintDepthM / 2 + 0.18),
        primaryFin ? 0.24 : 0.12,
        profile.measuredHeightM - 0.14,
        primaryFin ? 0.36 : 0.18,
        profile.rotationY,
        false,
      );
    }
    for (let bay = 0; bay <= shortBayCount; bay += 1) {
      const localZ =
        -profile.footprintDepthM / 2 +
        (profile.footprintDepthM * bay) / shortBayCount;
      const primaryFin = bay % profile.primaryFinEveryBays === 0;
      addLocalBox(
        builder,
        primaryFin ? EURO_ALUMINIUM_SHADOW : EURO_ALUMINIUM,
        origin,
        side * (profile.footprintLengthM / 2 + 0.18),
        profile.groundY + profile.measuredHeightM / 2,
        localZ,
        primaryFin ? 0.36 : 0.18,
        profile.measuredHeightM - 0.2,
        primaryFin ? 0.24 : 0.16,
        profile.rotationY,
        false,
      );
    }
    for (let floor = 2; floor < profile.floorCount; floor += 1) {
      for (let bay = 0; bay < longBayCount; bay += 1) {
        if ((floor * 5 + bay * 3 + (side > 0 ? 1 : 4)) % 19 > 2) continue;
        addLocalLampBox(
          builder,
          EINZ_GLASS_LIGHT,
          origin,
          -profile.footprintLengthM / 2 +
            (profile.footprintLengthM * (bay + 0.5)) / longBayCount,
          profile.groundY + floorPitch * (floor + 0.5),
          side * (profile.footprintDepthM / 2 + 0.05),
          (profile.footprintLengthM / longBayCount) * 0.7,
          floorPitch - 0.7,
          0.1,
          profile.rotationY,
        );
      }
    }
  }

  // A flat, clean crown matches the completed tower and adds no height beyond
  // the official LoD2 maximum.
  addLocalBox(
    builder,
    EURO_ALUMINIUM_SHADOW,
    origin,
    0,
    profile.groundY + profile.measuredHeightM - 0.36,
    0,
    profile.footprintLengthM + 0.48,
    0.72,
    profile.footprintDepthM + 0.48,
    profile.rotationY,
  );

  // The street photograph resolves the double-height north entrance as a dark
  // glazed recess between a regular row of pale pilotis and a projecting lid.
  addLocalBox(
    builder,
    DARK_FRAME,
    origin,
    0,
    profile.groundY + floorPitch,
    -(profile.footprintDepthM / 2 + 0.22),
    profile.entranceCanopyWidthM - 0.9,
    floorPitch * 1.84,
    0.22,
    profile.rotationY,
    false,
  );
  for (let pier = 0; pier < 6; pier += 1) {
    const localX =
      -profile.entranceCanopyWidthM / 2 +
      (profile.entranceCanopyWidthM * pier) / 5;
    addLocalBox(
      builder,
      EURO_ALUMINIUM,
      origin,
      localX,
      profile.groundY + floorPitch,
      -(profile.footprintDepthM / 2 + 0.38),
      0.38,
      floorPitch * 2,
      0.46,
      profile.rotationY,
    );
  }
  for (const localX of [-2.05, 0, 2.05]) {
    addLocalBox(
      builder,
      EURO_ALUMINIUM_SHADOW,
      origin,
      localX,
      profile.groundY + floorPitch * 0.76,
      -(profile.footprintDepthM / 2 + 0.43),
      0.12,
      floorPitch * 1.42,
      0.16,
      profile.rotationY,
      false,
    );
  }
  addLocalBox(
    builder,
    EURO_ALUMINIUM,
    origin,
    0,
    profile.groundY + floorPitch * 2,
    -(profile.footprintDepthM / 2 + 1.22),
    profile.entranceCanopyWidthM,
    0.34,
    2.45,
    profile.rotationY,
  );

  // Six-storey base from the companion LoD2 part. This was previously absent
  // from the shipped payload and made the tower appear detached from its real
  // 4–6-storey urban block.
  const podium = profile.podium;
  const podiumOrigin = new Vector3(
    podium.centerWorldM[0],
    profile.groundY,
    podium.centerWorldM[1],
  );
  addLocalBox(
    builder,
    EURO_GLASS,
    podiumOrigin,
    0,
    profile.groundY + podium.measuredHeightM / 2,
    0,
    podium.footprintLengthM,
    podium.measuredHeightM,
    podium.footprintDepthM,
    profile.rotationY,
  );
  addTierFacadeGrid(
    builder,
    rotatedRectangleRing(
      podium.centerWorldM,
      podium.footprintLengthM,
      podium.footprintDepthM,
      profile.rotationY,
    ),
    profile.groundY,
    profile.groundY + podium.measuredHeightM,
    podium.floorCount,
    EURO_ALUMINIUM,
  );
  addLocalBox(
    builder,
    EURO_ALUMINIUM_SHADOW,
    podiumOrigin,
    0,
    profile.groundY + podium.measuredHeightM + 0.16,
    0,
    podium.footprintLengthM + 0.38,
    0.32,
    podium.footprintDepthM + 0.38,
    profile.rotationY,
  );
}

function addEuropaplatzNorth(builder: Builder): void {
  const profile = EUROPACITY_PROFILE.europaplatzNorth;
  const origin = new Vector3(
    profile.centerWorldM[0],
    profile.groundY,
    profile.centerWorldM[1],
  );
  const rotation = profile.rotationY;
  const at = (localX: number, localZ: number): [number, number] => {
    const [offsetX, offsetZ] = rotatedLocalOffset(localX, localZ, rotation);
    return [origin.x + offsetX, origin.z + offsetZ];
  };
  const localSphere = (
    color: number,
    localX: number,
    centerY: number,
    localZ: number,
    radius: number,
    lamp = false,
  ): void => {
    const geometry = new SphereGeometry(radius, 10, 7);
    const [x, z] = at(localX, localZ);
    geometry.translate(x, centerY, z);
    addCustomGeometry(builder, geometry, color, false, lamp);
  };

  // Current 2026 state: a broad temporary forecourt, not the still-unbuilt
  // permanent landscape proposal. Clear pale routes remain continuous while
  // two bounded gravel/soil work areas retain their red-white barriers.
  addLocalBox(
    builder,
    EURO_PLAZA_PAVING,
    origin,
    0,
    profile.groundY + 0.06,
    0,
    profile.footprintLengthM,
    0.12,
    profile.footprintDepthM,
    rotation,
    false,
  );
  for (const [localX, width] of [
    [-15, 12],
    [17, 9],
  ] as const) {
    addLocalBox(
      builder,
      EURO_PLAZA_PATH,
      origin,
      localX,
      profile.groundY + 0.14,
      0,
      width,
      0.12,
      profile.footprintDepthM - 2,
      rotation,
      false,
    );
  }

  const workZones = [
    [-34, 8, 28, 21, EURO_PLAZA_GRAVEL],
    [31, -7, 31, 18, EURO_PLAZA_SOIL],
  ] as const;
  for (const [localX, localZ, width, depth, color] of workZones) {
    addLocalBox(
      builder,
      color,
      origin,
      localX,
      profile.groundY + 0.2,
      localZ,
      width,
      0.18,
      depth,
      rotation,
      false,
    );
    const barrier = (
      alongX: boolean,
      offset: number,
      fixed: number,
      index: number,
    ): void => {
      addLocalBox(
        builder,
        index % 2 === 0 ? CONSTRUCTION_RED : CONSTRUCTION_WHITE,
        origin,
        alongX ? localX + offset : localX + fixed,
        profile.groundY + 0.78,
        alongX ? localZ + fixed : localZ + offset,
        alongX ? 2.35 : 0.24,
        1.05,
        alongX ? 0.24 : 2.35,
        rotation,
        false,
      );
    };
    let index = 0;
    for (let offset = -width / 2 + 1.2; offset < width / 2; offset += 2.45) {
      barrier(true, offset, -depth / 2 - 0.25, index++);
      barrier(true, offset, depth / 2 + 0.25, index++);
    }
    for (let offset = -depth / 2 + 1.2; offset < depth / 2; offset += 2.45) {
      barrier(false, offset, -width / 2 - 0.25, index++);
      barrier(false, offset, width / 2 + 0.25, index++);
    }
  }

  // Young rows from the owner's 2026 photographs: thin trunks and small,
  // airy crowns rather than mature Tiergarten blobs.
  let treeIndex = 0;
  for (const localZ of [-22, 23]) {
    for (let localX = -42; localX <= 42; localX += 14) {
      const stagger = treeIndex % 2 === 0 ? -0.7 : 0.7;
      addLocalBox(
        builder,
        0x6f5946,
        origin,
        localX,
        profile.groundY + 2.05,
        localZ + stagger,
        0.22,
        3.7,
        0.22,
        rotation,
        false,
      );
      localSphere(
        treeIndex % 3 === 0 ? 0x769b69 : 0x688f5e,
        localX,
        profile.groundY + 4.45,
        localZ + stagger,
        1.65,
      );
      treeIndex += 1;
    }
  }

  // Slender L-head luminaires and one warm globe reproduce the visible
  // Europaplatz furniture without introducing a heavy decorative layer.
  const lampPositions = [
    [-49, -8],
    [-33, -8],
    [-17, -8],
    [0, -8],
    [17, -8],
    [33, -8],
    [49, -8],
    [1, 22],
  ] as const;
  lampPositions.forEach(([localX, localZ], index) => {
    addLocalBox(
      builder,
      DARK_FRAME,
      origin,
      localX,
      profile.groundY + 2.45,
      localZ,
      0.16,
      4.65,
      0.16,
      rotation,
      false,
    );
    if (index === lampPositions.length - 1) {
      localSphere(0xffd89a, localX, profile.groundY + 4.85, localZ, 0.48, true);
    } else {
      addLocalLampBox(
        builder,
        0xffd89a,
        origin,
        localX + 0.55,
        profile.groundY + 4.75,
        localZ,
        1.2,
        0.16,
        0.28,
        rotation,
      );
    }
  });
}

function addLehrterCampusConstruction(builder: Builder): void {
  const profile = EUROPACITY_PROFILE.lehrterCampus;
  const footprint: WorldRing = profile.footprintWorldM;
  const groundY = profile.groundY;

  // The owner photograph records a construction site, not the published
  // finished office envelope. Keep the stable, observed ground-floor state:
  // slab, concrete frame, falsework, perimeter scaffold and dark hoarding.
  addPolygonPrism(
    builder,
    EURO_PLAZA_GRAVEL,
    footprint,
    groundY + 0.04,
    0.18,
    false,
  );
  addPolygonPrism(
    builder,
    CONSTRUCTION_CONCRETE,
    footprint,
    groundY + 0.22,
    0.32,
  );

  const deck: WorldRing = [
    [-271.8, -743.5],
    [-249.4, -742.7],
    [-246.7, -731.8],
    [-253.6, -699.2],
    [-264.2, -686.2],
    [-273.5, -692.3],
  ];
  addPolygonPrism(
    builder,
    CONSTRUCTION_CONCRETE_LIGHT,
    deck,
    groundY + profile.currentSlabTopM - 0.36,
    0.36,
  );

  const columnPositions = [
    [-269.6, -737.4],
    [-259.9, -737.1],
    [-250.7, -734.4],
    [-270.2, -722.5],
    [-260.5, -721.4],
    [-251.1, -717.8],
    [-270.3, -707.2],
    [-261, -705.1],
    [-253.8, -700.6],
    [-269.5, -694.4],
    [-262.6, -691.2],
  ] as const;
  for (const [x, z] of columnPositions) {
    addBox(
      builder,
      CONSTRUCTION_CONCRETE,
      x,
      groundY + profile.currentSlabTopM / 2,
      z,
      0.58,
      profile.currentSlabTopM,
      0.58,
      0,
      true,
    );
    for (const offset of [-0.17, 0.17]) {
      addBox(
        builder,
        CONSTRUCTION_STEEL,
        x + offset,
        groundY + profile.currentSlabTopM + 1.05,
        z,
        0.07,
        2.1,
        0.07,
        0,
        false,
      );
    }
  }

  // Dense falsework below the observed first raised slab. The August 2026
  // reference reads as a working deck supported by a regular forest of props,
  // not as an empty finished podium. Keep each prop separated from the slab to
  // avoid coplanar shimmer while the camera moves.
  const falseworkRows = [
    { z: -736.2, xStart: -268.4, xEnd: -251.5 },
    { z: -729.7, xStart: -269.2, xEnd: -250.2 },
    { z: -722.8, xStart: -269.7, xEnd: -251.1 },
    { z: -715.8, xStart: -269.8, xEnd: -252.4 },
    { z: -708.8, xStart: -269.6, xEnd: -254.0 },
    { z: -702.1, xStart: -269.1, xEnd: -255.6 },
    { z: -695.8, xStart: -267.5, xEnd: -258.2 },
  ] as const;
  const falseworkTopY = groundY + profile.currentSlabTopM - 0.58;
  for (const [rowIndex, row] of falseworkRows.entries()) {
    const span = row.xEnd - row.xStart;
    const propCount = Math.max(2, Math.floor(span / 2.55));
    for (let index = 0; index <= propCount; index += 1) {
      const x = row.xStart + (span * index) / propCount;
      addBox(
        builder,
        CONSTRUCTION_STEEL,
        x,
        (groundY + 0.62 + falseworkTopY) / 2,
        row.z,
        0.1,
        falseworkTopY - groundY - 0.62,
        0.1,
        0,
        false,
      );
      addBox(
        builder,
        CONSTRUCTION_TIMBER,
        x,
        falseworkTopY,
        row.z,
        0.2,
        0.16,
        2.5,
        0,
        false,
      );
    }
    addBox(
      builder,
      rowIndex % 2 === 0 ? CONSTRUCTION_TIMBER : CONSTRUCTION_STEEL,
      (row.xStart + row.xEnd) / 2,
      falseworkTopY + 0.13,
      row.z,
      span + 0.35,
      0.18,
      0.18,
      0,
      false,
    );
  }

  // Three incomplete upper-frame strips preserve the photographed construction
  // state: enough structure to read as an active build, never enough to imply
  // the published nine-storey final envelope already exists.
  const upperFrameRows = [
    { z: -735.1, xStart: -269.2, xEnd: -251.0 },
    { z: -724.8, xStart: -269.5, xEnd: -250.8 },
    { z: -714.6, xStart: -269.5, xEnd: -252.5 },
  ] as const;
  for (const row of upperFrameRows) {
    addBox(
      builder,
      CONSTRUCTION_CONCRETE,
      (row.xStart + row.xEnd) / 2,
      groundY + profile.currentSlabTopM + 2.55,
      row.z,
      row.xEnd - row.xStart,
      0.42,
      0.48,
      0,
      true,
    );
    for (let x = row.xStart + 0.8; x < row.xEnd; x += 4.6) {
      addBox(
        builder,
        CONSTRUCTION_CONCRETE,
        x,
        groundY + profile.currentSlabTopM + 1.35,
        row.z,
        0.44,
        2.7,
        0.44,
        0,
        true,
      );
    }
  }

  const scaffoldEdges = [
    [footprint[0], footprint[1]],
    [footprint[1], footprint[2]],
    [footprint[2], footprint[3]],
    [footprint[3], footprint[4]],
  ] as const;
  for (const [start, end] of scaffoldEdges) {
    const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
    const bayCount = Math.max(1, Math.ceil(length / 2.8));
    for (let bay = 0; bay <= bayCount; bay += 1) {
      const fraction = bay / bayCount;
      const x = start[0] + (end[0] - start[0]) * fraction;
      const z = start[1] + (end[1] - start[1]) * fraction;
      addBox(
        builder,
        CONSTRUCTION_STEEL,
        x,
        groundY + profile.currentScaffoldTopM / 2,
        z,
        0.11,
        profile.currentScaffoldTopM,
        0.11,
        0,
        false,
      );
      if (bay === bayCount) continue;
      const nextFraction = (bay + 1) / bayCount;
      const nextX = start[0] + (end[0] - start[0]) * nextFraction;
      const nextZ = start[1] + (end[1] - start[1]) * nextFraction;
      const lowY = groundY + 1.05 + (bay % 2 === 0 ? 0 : 2.6);
      const highY = lowY + (bay % 2 === 0 ? 2.6 : -2.6);
      addBeamBetween(
        builder,
        CONSTRUCTION_STEEL,
        new Vector3(x, lowY, z),
        new Vector3(nextX, highY, nextZ),
        0.08,
      );
    }
    for (let y = groundY + 1.05; y < groundY + 10.4; y += 2.55) {
      addFacadeSegment(builder, CONSTRUCTION_STEEL, start, end, y, 0.09, 0.1);
      // Narrow timber decks make the scaffold levels legible from the station
      // and tunnel-ramp approaches without turning the perimeter into a wall.
      addFacadeSegment(
        builder,
        CONSTRUCTION_TIMBER,
        start,
        end,
        y + 0.14,
        0.13,
        0.64,
      );
    }
  }

  // Street- and tunnel-facing black construction panels. A short opening is
  // retained at the south-west corner instead of sealing the site into a box.
  for (const edgeIndex of [0, 1, 2, 3]) {
    const start = footprint[edgeIndex];
    const end = footprint[(edgeIndex + 1) % footprint.length];
    addFacadeSegment(
      builder,
      CONSTRUCTION_HOARDING,
      start,
      end,
      groundY + 1.45,
      2.75,
      0.24,
    );
  }
  const northStart = footprint[0];
  const northEnd = footprint[1];
  const northLength = Math.hypot(
    northEnd[0] - northStart[0],
    northEnd[1] - northStart[1],
  );
  for (
    let distance = 1.1, stripe = 0;
    distance < northLength;
    distance += 2.2
  ) {
    const fraction = distance / northLength;
    const nextFraction = Math.min((distance + 1.95) / northLength, 1);
    addFacadeSegment(
      builder,
      stripe++ % 2 === 0 ? CONSTRUCTION_RED : CONSTRUCTION_WHITE,
      [
        northStart[0] + (northEnd[0] - northStart[0]) * fraction,
        northStart[1] + (northEnd[1] - northStart[1]) * fraction,
      ],
      [
        northStart[0] + (northEnd[0] - northStart[0]) * nextFraction,
        northStart[1] + (northEnd[1] - northStart[1]) * nextFraction,
      ],
      groundY + 1.05,
      0.42,
      0.28,
    );
  }

  // A static lattice tower crane fixes the skyline cue visible in the owner
  // reference without introducing animation or a transient vehicle snapshot.
  const crane = new Vector3(
    profile.craneWorldM[0],
    groundY,
    profile.craneWorldM[1],
  );
  const mastTopY = groundY + profile.craneMastHeightM;
  for (const offsetX of [-0.52, 0.52]) {
    for (const offsetZ of [-0.52, 0.52]) {
      addBox(
        builder,
        CONSTRUCTION_STEEL,
        crane.x + offsetX,
        groundY + profile.craneMastHeightM / 2,
        crane.z + offsetZ,
        0.16,
        profile.craneMastHeightM,
        0.16,
        0,
        false,
      );
    }
  }
  for (let y = groundY + 1.8; y < mastTopY; y += 2.35) {
    addBox(
      builder,
      CONSTRUCTION_STEEL,
      crane.x,
      y,
      crane.z - 0.52,
      1.18,
      0.1,
      0.12,
      0,
      false,
    );
    addBox(
      builder,
      CONSTRUCTION_STEEL,
      crane.x - 0.52,
      y,
      crane.z,
      0.12,
      0.1,
      1.18,
      0,
      false,
    );
  }
  const craneRotation = -0.36;
  const craneOrigin = new Vector3(crane.x, groundY, crane.z);
  addLocalBox(
    builder,
    CONSTRUCTION_STEEL,
    craneOrigin,
    12.5,
    mastTopY,
    0,
    49,
    0.58,
    0.58,
    craneRotation,
    false,
  );
  addLocalBox(
    builder,
    CONSTRUCTION_TIMBER,
    craneOrigin,
    -7.7,
    mastTopY - 0.75,
    0,
    5.5,
    1.15,
    1.1,
    craneRotation,
    true,
  );
  addLocalBox(
    builder,
    EURO_GLASS,
    craneOrigin,
    1.9,
    mastTopY - 1.05,
    0,
    3.2,
    1.9,
    2.2,
    craneRotation,
    true,
  );
  const [hookX, hookZ] = rotatedLocalOffset(31.5, 0, craneRotation);
  addBox(
    builder,
    CONSTRUCTION_STEEL,
    crane.x + hookX,
    mastTopY - 9.1,
    crane.z + hookZ,
    0.07,
    17.6,
    0.07,
    0,
    false,
  );
  addBox(
    builder,
    CONSTRUCTION_RED,
    crane.x + hookX,
    mastTopY - 18.05,
    crane.z + hookZ,
    0.65,
    0.55,
    0.4,
    0,
    true,
  );
  const beacon = new SphereGeometry(0.24, 8, 6);
  beacon.translate(crane.x, mastTopY + 0.4, crane.z);
  addCustomGeometry(builder, beacon, 0xe35a47, false, true);
}

function addFiftyHertzStructure(builder: Builder): void {
  const profile = EUROPACITY_PROFILE.fiftyHertz;
  const origin = new Vector3(
    profile.centerWorldM[0],
    profile.groundY,
    profile.centerWorldM[1],
  );
  const floorCount = profile.floorCount;
  const floorPitch = profile.measuredHeightM / floorCount;
  for (const side of [-1, 1]) {
    for (let floor = 0; floor <= floorCount; floor += 1) {
      addLocalBox(
        builder,
        EURO_ALUMINIUM_SHADOW,
        origin,
        0,
        profile.groundY + floorPitch * floor,
        side * (profile.footprintDepthM / 2 + 0.2),
        profile.footprintLengthM + 0.5,
        0.16,
        0.32,
        profile.rotationY,
        false,
      );
    }
    const bayCount = 4;
    const bayWidth = profile.footprintLengthM / bayCount;
    for (let firstFloor = 0; firstFloor < floorCount; firstFloor += 2) {
      const moduleFloors = Math.min(2, floorCount - firstFloor);
      const moduleHeight = floorPitch * moduleFloors;
      const braceLength = Math.hypot(bayWidth, moduleHeight);
      const braceAngle = Math.atan2(moduleHeight, bayWidth);
      for (let bay = 0; bay < bayCount; bay += 1) {
        const localX = -profile.footprintLengthM / 2 + bayWidth * (bay + 0.5);
        const centerY =
          profile.groundY + floorPitch * (firstFloor + moduleFloors / 2);
        for (const direction of [-1, 1]) {
          addTiltedLocalBox(
            builder,
            EURO_ALUMINIUM,
            origin,
            localX,
            centerY,
            side * (profile.footprintDepthM / 2 + 0.34),
            braceLength,
            0.3,
            0.24,
            direction * braceAngle,
            profile.rotationY,
          );
        }
      }
    }
    for (let floor = 1; floor < floorCount; floor += 1) {
      if (floor % 4 !== 1) continue;
      for (let bay = 0; bay < 8; bay += 1) {
        if ((floor + bay * 2 + (side > 0 ? 1 : 3)) % 5 > 1) continue;
        addLocalLampBox(
          builder,
          EURO_WINDOW_LIGHT,
          origin,
          -profile.footprintLengthM / 2 +
            (profile.footprintLengthM * (bay + 0.5)) / 8,
          profile.groundY + floorPitch * (floor + 0.5),
          side * (profile.footprintDepthM / 2 + 0.04),
          (profile.footprintLengthM / 8) * 0.7,
          floorPitch - 0.62,
          0.1,
          profile.rotationY,
        );
      }
    }
  }
}

function addUpbeatCampus(builder: Builder): void {
  const profile = EUROPACITY_PROFILE.upbeat;
  const fullRing = profile.footprintWorldM;
  const middleRing = clipRingEast(fullRing, profile.midTierEastClipWorldX);
  const towerRing = clipRingEast(fullRing, profile.towerTierEastClipWorldX);
  const baseTop = profile.groundY + profile.tierTopHeightsM[0];
  const middleTop = profile.groundY + profile.tierTopHeightsM[1];
  const towerTop = profile.groundY + profile.tierTopHeightsM[2];
  addPolygonPrism(
    builder,
    UPBEAT_GLASS,
    fullRing,
    profile.groundY,
    baseTop - profile.groundY,
  );
  addPolygonPrism(
    builder,
    UPBEAT_GLASS_LIGHT,
    middleRing,
    baseTop,
    middleTop - baseTop,
  );
  addPolygonPrism(
    builder,
    UPBEAT_GLASS,
    towerRing,
    middleTop,
    towerTop - middleTop,
  );
  addTierFacadeGrid(
    builder,
    fullRing,
    profile.groundY,
    baseTop,
    profile.storeyTiers[0],
    UPBEAT_GRID,
    profile.facadeBayPitchM,
  );
  addTierFacadeGrid(
    builder,
    middleRing,
    baseTop,
    middleTop,
    profile.storeyTiers[1] - profile.storeyTiers[0],
    UPBEAT_GRID_LIGHT,
    profile.facadeBayPitchM,
  );
  addTierFacadeGrid(
    builder,
    towerRing,
    middleTop,
    towerTop,
    profile.storeyTiers[2] - profile.storeyTiers[1],
    UPBEAT_GRID,
    profile.facadeBayPitchM,
  );
  for (const [ring, top] of [
    [fullRing, baseTop],
    [middleRing, middleTop],
    [towerRing, towerTop],
  ] as const) {
    addPolygonPrism(builder, UPBEAT_ROOF, ring, top, 0.28, false);
  }
  // Source-visible roof terraces: restrained planted strips and glass rails.
  for (const [x, y, z, width, depth] of [
    [-696, baseTop + 0.65, -1983, 22, 1.2],
    [-683, baseTop + 0.65, -1976, 15, 1.1],
    [-662, middleTop + 0.65, -1969, 12, 1.1],
  ] as const) {
    addBox(
      builder,
      EURO_TERRACE_GREEN,
      x,
      y,
      z,
      width,
      1.1,
      depth,
      -0.18,
      false,
    );
  }
  addBox(
    builder,
    EURO_ALUMINIUM,
    -621.2,
    profile.groundY + 3.2,
    -1957.1,
    8.8,
    0.3,
    3.2,
    -0.44,
  );
  // The completed building presents a transparent, double-height arrival
  // zone beneath the fine anodised-aluminium facade. This lobby and its
  // slender entrance fins replace the old generic brown podium reading.
  addBox(
    builder,
    0x536f74,
    -625.8,
    profile.groundY + 3.7,
    -1954.8,
    15.5,
    6.8,
    0.38,
    -0.44,
  );
  for (let fin = -5; fin <= 5; fin += 1) {
    addBox(
      builder,
      UPBEAT_GRID_LIGHT,
      -625.8 + fin * 1.25,
      profile.groundY + 3.7,
      -1955.05,
      0.12,
      6.9,
      0.26,
      -0.44,
      false,
    );
  }
}

function addWorldWallCourse(
  builder: Builder,
  points: readonly (readonly [number, number])[],
  centerY: number,
  height: number,
  thickness: number,
  color: number,
): void {
  for (let index = 0; index < points.length - 1; index += 1) {
    addFacadeSegment(
      builder,
      color,
      points[index],
      points[index + 1],
      centerY,
      height,
      thickness,
    );
  }
}

function addInvalidenfriedhof(builder: Builder): void {
  const profile = NORTHERN_CITY_PROFILE.invalidenfriedhof;
  const groundY = INVALIDENFRIEDHOF_DETAIL_PROFILE.walls.groundY;
  addPolygonPrism(
    builder,
    CEMETERY_GRASS,
    profile.cemeteryRingWorldM,
    groundY - 0.08,
    0.1,
    false,
  );

  // The principal compacted paths are traced from the committed OSM ways.
  const paths = [
    [
      [-24.26, -1408.74],
      [-9.97, -1416.66],
      [5.04, -1424.98],
      [16.62, -1431.4],
      [30.67, -1439.18],
      [45.06, -1447.16],
    ],
    [
      [83.97, -1470.4],
      [65.04, -1415.12],
      [31.18, -1392.49],
      [5.04, -1424.98],
      [-33.8, -1485.69],
      [-78.4, -1555.45],
    ],
    [
      [44.68, -1450.93],
      [26.7, -1483.56],
      [10.84, -1512.37],
      [-17.13, -1525.82],
    ],
  ] as const;
  for (const path of paths) {
    for (let index = 0; index < path.length - 1; index += 1) {
      addFacadeSegment(
        builder,
        CEMETERY_PATH,
        path[index],
        path[index + 1],
        groundY + 0.025,
        0.045,
        2.15,
      );
    }
  }

  const detailedGraveAnchors = Object.values(
    INVALIDENFRIEDHOF_DETAIL_PROFILE.graves,
  ).flatMap((grave) => [
    grave.sourcePointWorldM,
    ...("absorbedGenericSourcePointsWorldM" in grave
      ? grave.absorbedGenericSourcePointsWorldM
      : []),
  ]);
  for (let index = 0; index < profile.graveWorldM.length; index += 1) {
    const [x, z] = profile.graveWorldM[index];
    if (
      detailedGraveAnchors.some(
        (sourcePointWorldM) =>
          sourcePointWorldM[0] === x && sourcePointWorldM[1] === z,
      )
    ) {
      continue;
    }
    const height = 0.72 + (index % 5) * 0.16;
    const width = 0.52 + (index % 3) * 0.12;
    addBox(
      builder,
      index % 4 === 0 ? CEMETERY_STONE_DARK : CEMETERY_STONE,
      x,
      groundY + height / 2,
      z,
      width,
      height,
      0.24,
      ((index * 37) % 13) * 0.018 - 0.1,
    );
    addBox(
      builder,
      CEMETERY_STONE_DARK,
      x,
      groundY + height * 0.62,
      z - 0.13,
      width * 0.58,
      0.035,
      0.025,
      0,
      false,
    );
  }

  // Keep the retained structural backing below the authored dentil/coping
  // layers.  The detailed wall owns the visible 2.19--2.37 m red-brick crown
  // and its snow cap, while this body supports the white fields and mortar.
  const canalBackingHeight = 2.17;
  addWorldWallCourse(
    builder,
    profile.canalBrickWallWorldM,
    groundY + canalBackingHeight / 2,
    canalBackingHeight,
    0.46,
    CEMETERY_BRICK,
  );
  for (let course = 1; course < 8; course += 1) {
    addWorldWallCourse(
      builder,
      profile.canalBrickWallWorldM,
      groundY + course * 0.31,
      0.045,
      0.49,
      CEMETERY_MORTAR,
    );
  }
}

function addPankeMouthFishPass(builder: Builder): void {
  const y = WATER_TOP_Y;
  // The official side mouth enters from the east. A short alternating row of
  // low baffles makes the roughly two-metre fish-pass drop legible without
  // covering the OSM water polygon or inventing another north-going channel.
  const start = [-230.5, -2000.8] as const;
  const end = [-302.5, -1971.5] as const;
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const length = Math.hypot(dx, dz);
  const nx = -dz / length;
  const nz = dx / length;
  for (let index = 0; index < 9; index += 1) {
    const fraction = (index + 0.5) / 9;
    const centreX = start[0] + dx * fraction;
    const centreZ = start[1] + dz * fraction;
    const halfWidth = index % 2 === 0 ? 2.8 : 2.25;
    addFacadeSegment(
      builder,
      index % 2 === 0 ? 0xa5a59d : 0x888e8a,
      [centreX - nx * halfWidth, centreZ - nz * halfWidth],
      [centreX + nx * halfWidth, centreZ + nz * halfWidth],
      y + 0.04,
      0.28,
      0.44,
    );
  }
  // A sparse glint line documents the actual east-to-west flow while staying
  // physically clear of the transparent water plate, preventing z-fighting.
  for (const side of [-1, 1]) {
    addFacadeSegment(
      builder,
      0xd6ece9,
      [start[0] + nx * side * 1.25, start[1] + nz * side * 1.25],
      [end[0] + nx * side * 1.25, end[1] + nz * side * 1.25],
      y + 0.18,
      0.05,
      0.08,
    );
  }
}

function addKonradAdenauerHaus(builder: Builder): void {
  const profile = KONRAD_ADENAUER_HAUS_PROFILE;
  const ring = profile.footprintWorldM;
  const glassBodyTopY = profile.groundY + profile.eavesHeightM;

  // The glass panes stay open in the merged flat-shaded batch so the timber
  // body remains visible. The exact pointed OSM hull is carried by a warm
  // travertine plinth, a slim roof plate and the four-storey frame register.
  addPolygonPrism(
    builder,
    0xc9c0ad,
    ring,
    profile.groundY,
    profile.travertinePlinthHeightM,
  );
  addPolygonPrism(builder, 0xb8ced0, ring, glassBodyTopY - 0.18, 0.18);
  addTierFacadeGrid(
    builder,
    ring,
    profile.groundY,
    glassBodyTopY,
    profile.glassEnvelopeStoreys,
    0x59696b,
    2.35,
  );

  // The elliptical timber-clad inner body is the principal spatial motif. It
  // is deliberately inset from the exact hull, leaving the winter garden
  // visibly open instead of filling it with the former LoD2 concrete prism.
  const inner = new CylinderGeometry(1, 1, profile.innerBodyLowerHeightM, 48);
  inner.scale(profile.innerBodyLengthM / 2, 1, profile.innerBodyDepthM / 2);
  inner.rotateY(profile.innerBodyRotationY);
  inner.translate(
    profile.innerBodyCenterWorldM[0],
    profile.groundY + profile.innerBodyLowerHeightM / 2,
    profile.innerBodyCenterWorldM[1],
  );
  addCustomGeometry(builder, inner, 0xa88d69);

  // Continuous timber floor bands make the six-level organisation readable
  // through the transparent climate-buffer frame without fabricating doors
  // or party signage.
  for (let level = 1; level <= 4; level += 1) {
    const band = new TorusGeometry(16.8, 0.1, 5, 64);
    band.rotateX(Math.PI / 2);
    band.scale(1.48, 1, 0.86);
    band.rotateY(profile.innerBodyRotationY);
    band.translate(
      profile.innerBodyCenterWorldM[0],
      profile.groundY + level * 3.1,
      profile.innerBodyCenterWorldM[1],
    );
    addCustomGeometry(builder, band, 0x536163, false);
  }

  // Two successively smaller upper decks rise above the four-storey glass
  // eaves and taper like a ship's superstructure.
  for (const [storey, lengthM, depthM, offsetX, offsetZ, tone] of [
    [0, 45, 23.6, -0.55, -0.38, 0xd7d0be],
    [1, 39.6, 19.2, -1.05, -0.72, 0xc5c7c1],
  ] as const) {
    const upper = new CylinderGeometry(1, 1, 4, 48);
    upper.scale(lengthM / 2, 1, depthM / 2);
    upper.rotateY(profile.innerBodyRotationY);
    upper.translate(
      profile.innerBodyCenterWorldM[0] + offsetX,
      glassBodyTopY + 2 + storey * 4,
      profile.innerBodyCenterWorldM[1] + offsetZ,
    );
    addCustomGeometry(builder, upper, tone);

    const accent = new TorusGeometry(16.8, 0.11, 6, 64);
    accent.rotateX(Math.PI / 2);
    accent.scale(lengthM / 33.6, 1, depthM / 33.6);
    accent.rotateY(profile.innerBodyRotationY);
    accent.translate(
      profile.innerBodyCenterWorldM[0] + offsetX,
      glassBodyTopY + storey * 4 + 0.16,
      profile.innerBodyCenterWorldM[1] + offsetZ,
    );
    addCustomGeometry(builder, accent, 0x4e5b5c, false);
  }

  const roofRail = new TorusGeometry(16.8, 0.09, 5, 64);
  roofRail.rotateX(Math.PI / 2);
  roofRail.scale(1.15, 1, 0.55);
  roofRail.rotateY(profile.innerBodyRotationY);
  roofRail.translate(
    profile.innerBodyCenterWorldM[0] - 1.05,
    glassBodyTopY + 8.28,
    profile.innerBodyCenterWorldM[1] - 0.72,
  );
  addCustomGeometry(builder, roofRail, 0x4e5b5c, false);
}

function addGableRoofShell(
  builder: Builder,
  color: number,
  origin: Vector3,
  eaveY: number,
  width: number,
  depth: number,
  rise: number,
  rotationY: number,
): void {
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const positions = new Float32Array([
    -halfWidth,
    0,
    -halfDepth,
    -halfWidth,
    0,
    halfDepth,
    0,
    rise,
    -halfDepth,
    0,
    rise,
    -halfDepth,
    -halfWidth,
    0,
    halfDepth,
    0,
    rise,
    halfDepth,
    0,
    rise,
    -halfDepth,
    0,
    rise,
    halfDepth,
    halfWidth,
    0,
    -halfDepth,
    halfWidth,
    0,
    -halfDepth,
    0,
    rise,
    halfDepth,
    halfWidth,
    0,
    halfDepth,
  ]);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  transformGeometry(geometry, origin.x, eaveY, origin.z, rotationY);
  addCustomGeometry(builder, geometry, color);
}

function addGableFace(
  builder: Builder,
  color: number,
  origin: Vector3,
  eaveY: number,
  localZ: number,
  width: number,
  rise: number,
  rotationY: number,
  northFacing: boolean,
): void {
  const halfWidth = width / 2;
  const positions = northFacing
    ? new Float32Array([
        -halfWidth,
        0,
        localZ,
        0,
        rise,
        localZ,
        halfWidth,
        0,
        localZ,
      ])
    : new Float32Array([
        -halfWidth,
        0,
        localZ,
        halfWidth,
        0,
        localZ,
        0,
        rise,
        localZ,
      ]);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  transformGeometry(geometry, origin.x, eaveY, origin.z, rotationY);
  addCustomGeometry(builder, geometry, color);
}

function addArchedPanel(
  builder: Builder,
  color: number,
  frameColor: number,
  cx: number,
  baseY: number,
  cz: number,
  width: number,
  height: number,
  rotationY: number,
  lit = false,
): void {
  const radius = width / 2;
  const rectangularHeight = Math.max(0.2, height - radius);
  if (lit) {
    const panel = new BoxGeometry(width, rectangularHeight, 0.14);
    transformGeometry(panel, cx, baseY + rectangularHeight / 2, cz, rotationY);
    addCustomGeometry(builder, panel, color, false, true);
  } else {
    addBox(
      builder,
      color,
      cx,
      baseY + rectangularHeight / 2,
      cz,
      width,
      rectangularHeight,
      0.14,
      rotationY,
      false,
    );
  }
  const cap = new CircleGeometry(
    radius,
    Math.max(12, Math.round(width * 6)),
    0,
    Math.PI,
  );
  transformGeometry(cap, cx, baseY + rectangularHeight, cz, rotationY);
  addCustomGeometry(builder, cap, color, false, lit);

  const arch = new TorusGeometry(
    radius,
    Math.min(0.16, width * 0.055),
    4,
    Math.max(12, Math.round(width * 6)),
    Math.PI,
  );
  transformGeometry(arch, cx, baseY + rectangularHeight, cz + 0.01, rotationY);
  addCustomGeometry(builder, arch, frameColor, false);

  const axisX = Math.cos(rotationY);
  const axisZ = -Math.sin(rotationY);
  for (const side of [-1, 1]) {
    addBox(
      builder,
      frameColor,
      cx + axisX * side * radius,
      baseY + rectangularHeight / 2,
      cz + axisZ * side * radius,
      Math.min(0.18, width * 0.06),
      rectangularHeight,
      0.18,
      rotationY,
      false,
    );
  }
}

function addFacadeDisc(
  builder: Builder,
  color: number,
  frameColor: number,
  cx: number,
  cy: number,
  cz: number,
  radius: number,
  rotationY: number,
): void {
  const face = new CircleGeometry(radius, 28);
  transformGeometry(face, cx, cy, cz, rotationY);
  addCustomGeometry(builder, face, color, false);
  const ring = new TorusGeometry(radius, 0.12, 4, 28);
  transformGeometry(ring, cx, cy, cz + 0.01, rotationY);
  addCustomGeometry(builder, ring, frameColor, false);
}

function addRamp(
  builder: Builder,
  color: number,
  x: number,
  y: number,
  z: number,
  width: number,
  length: number,
  rise: number,
  rotationY: number,
): void {
  const hw = width / 2;
  const hl = length / 2;
  const positions = new Float32Array([
    -hw,
    0,
    -hl,
    hw,
    0,
    -hl,
    -hw,
    rise,
    hl,
    hw,
    0,
    -hl,
    hw,
    rise,
    hl,
    -hw,
    rise,
    hl,
    -hw,
    0,
    -hl,
    -hw,
    rise,
    hl,
    -hw,
    0,
    hl,
    -hw,
    0,
    hl,
    -hw,
    rise,
    hl,
    hw,
    0,
    hl,
    hw,
    0,
    hl,
    -hw,
    rise,
    hl,
    hw,
    rise,
    hl,
    hw,
    0,
    -hl,
    hw,
    0,
    hl,
    hw,
    rise,
    hl,
    -hw,
    0,
    -hl,
    -hw,
    0,
    hl,
    hw,
    0,
    -hl,
    hw,
    0,
    -hl,
    -hw,
    0,
    hl,
    hw,
    0,
    hl,
  ]);
  const geometry = new BufferGeometry();
  // Avoid a bespoke shader: the normal drawn-kit vertex-colour path keeps
  // this terrain wedge identical in Day, Night and the snow base scene.
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  transformGeometry(geometry, x, y, z, rotationY);
  addCustomGeometry(builder, geometry, color);
}

function anchor(
  byName: Map<string, ExpandedLandmark>,
  name: string,
): Vector3 | null {
  const landmark = byName.get(name);
  return landmark ? new Vector3(...landmark.world) : null;
}

function createLetterSign(
  text: string,
  width: number,
  height: number,
  position: Vector3,
  rotationY: number,
  fieldColor: string,
  letterColor: string,
): Mesh | null {
  const texture = createLetteringTexture({
    bandHeightM: height,
    bandWidthM: width,
    capHeightM: height * 0.58,
    fieldColor,
    letterColor,
    text,
    texelsPerMetre: 180,
  });
  const material = texture
    ? new MeshStandardMaterial({
        map: texture,
        roughness: 0.68,
        side: DoubleSide,
      })
    : new MeshBasicMaterial({ color: fieldColor, side: DoubleSide });
  if (material instanceof MeshStandardMaterial) {
    material.userData.nightEmissive = 0xffdca0;
    material.userData.nightEmissiveIntensity = 0.55;
  }
  const sign = new Mesh(new PlaneGeometry(width, height), material);
  sign.name = `${text} rooftop lettering`;
  sign.userData.lettering = text;
  sign.userData.fallbackWithoutCanvas = texture === null;
  sign.position.copy(position);
  sign.rotation.y = rotationY;
  return sign;
}

function addHamburgerBahnhof(
  builder: Builder,
  byName: Map<string, ExpandedLandmark>,
): void {
  const point = anchor(byName, "Hamburger Bahnhof");
  if (!point) return;
  const profile = HAMBURGER_BAHNHOF_PROFILE;
  const rotation = profile.facadeRotationY;
  const axis = profile.facadeAxis;
  const normal = profile.facadeNormal;
  const facadeX = point.x + profile.facadeOffsetFromLandmarkM[0];
  const facadeZ = point.z + profile.facadeOffsetFromLandmarkM[1];
  const groundY = point.y;
  const at = (u: number, outward: number): [number, number] => [
    facadeX + axis[0] * u + normal[0] * outward,
    facadeZ + axis[1] * u + normal[1] * outward,
  ];
  const facadeBox = (
    color: number,
    u: number,
    y: number,
    outward: number,
    width: number,
    height: number,
    depth: number,
    inked = true,
  ): void => {
    const [x, z] = at(u, outward);
    addBox(builder, color, x, y, z, width, height, depth, rotation, inked);
  };

  // The historic front is flat-roofed. These three thin facade-backed masses
  // sit on the LoD2 line; unlike the old generic block they do not cross the
  // Ehrenhof or float above it.
  facadeBox(HAMBURGER_STUCCO, 0, groundY + 10.35, -1.05, 23, 20.7, 2.1);
  for (const side of [-1, 1]) {
    facadeBox(
      HAMBURGER_STUCCO,
      side * 22.1,
      groundY + 7.8,
      -0.8,
      18.2,
      15.6,
      1.6,
    );
  }

  // The two LoD2 tower parts (26.15/26.37 m) are the reliable metric anchors.
  for (const towerU of profile.towerCentresM) {
    facadeBox(
      HAMBURGER_STUCCO,
      towerU,
      groundY + profile.towerHeightM / 2,
      -1.7,
      5.5,
      profile.towerHeightM,
      3.4,
    );
    facadeBox(
      HAMBURGER_CORNICE,
      towerU,
      groundY + profile.towerHeightM - 0.35,
      0.05,
      6.3,
      0.7,
      0.52,
    );
    for (const slotU of [-1.45, 0, 1.45]) {
      const [slotX, slotZ] = at(towerU + slotU, 0.18);
      addArchedPanel(
        builder,
        HAMBURGER_GLASS,
        HAMBURGER_CORNICE,
        slotX,
        groundY + 21.65,
        slotZ,
        1.05,
        3.2,
        rotation,
      );
    }
    const [poleX, poleZ] = at(towerU, -0.9);
    addCylinder(
      builder,
      0x5e655f,
      poleX,
      groundY + profile.towerHeightM + 3.25,
      poleZ,
      0.07,
      6.5,
      8,
    );
  }

  // Two large hall arches below six tall, sage-green upper arcades are the
  // defining front elevation seen from Invalidenstrasse.
  for (const u of [-4.45, 4.45]) {
    const [x, z] = at(u, 0.2);
    addArchedPanel(
      builder,
      HAMBURGER_GLASS,
      HAMBURGER_CORNICE,
      x,
      groundY + 5.25,
      z,
      7.45,
      7.55,
      rotation,
      true,
    );
    facadeBox(HAMBURGER_DOOR, u, groundY + 2.25, 0.28, 2.35, 4.5, 0.2);
    const lowerBase = groundY + 5.25;
    const lowerRadius = 7.45 / 2;
    const lowerSpring = lowerBase + 7.55 - lowerRadius;
    for (const mullionOffset of [-2.4, -1.2, 0, 1.2, 2.4]) {
      const archRise = Math.sqrt(
        Math.max(0, lowerRadius ** 2 - mullionOffset ** 2),
      );
      const top = lowerSpring + archRise - 0.16;
      facadeBox(
        HAMBURGER_MULLION,
        u + mullionOffset,
        (lowerBase + top) / 2,
        0.34,
        0.09,
        top - lowerBase,
        0.08,
        false,
      );
    }
    for (const height of [lowerBase + 1.55, lowerBase + 3.1]) {
      facadeBox(HAMBURGER_MULLION, u, height, 0.35, 7.1, 0.09, 0.08, false);
    }
  }
  for (const u of [-7.5, -4.5, -1.5, 1.5, 4.5, 7.5]) {
    const [x, z] = at(u, 0.22);
    addArchedPanel(
      builder,
      HAMBURGER_SAGE,
      HAMBURGER_CORNICE,
      x,
      groundY + 13.25,
      z,
      2.45,
      6.25,
      rotation,
      true,
    );
  }

  // Rosette and clock occupy the tower faces below the belfry openings.
  for (const [index, towerU] of profile.towerCentresM.entries()) {
    const [x, z] = at(towerU, 0.25);
    addFacadeDisc(
      builder,
      index === 0 ? HAMBURGER_GLASS : 0xb7c8bd,
      HAMBURGER_CORNICE,
      x,
      groundY + 18.8,
      z,
      1.22,
      rotation,
    );
  }

  // Cornice/string courses and a restrained window rhythm continue into the
  // two wings without inventing another roof volume.
  facadeBox(HAMBURGER_CORNICE, 0, groundY + 20.35, 0.08, 24.2, 0.7, 0.48);
  facadeBox(HAMBURGER_CORNICE, 0, groundY + 12.9, 0.12, 22.6, 0.42, 0.42);
  for (const side of [-1, 1]) {
    facadeBox(
      HAMBURGER_CORNICE,
      side * 22.1,
      groundY + 15.35,
      0.06,
      19.1,
      0.62,
      0.45,
    );
    for (const offset of [-5.6, 0, 5.6]) {
      facadeBox(
        HAMBURGER_GLASS,
        side * 22.1 + offset,
        groundY + 8.4,
        0.16,
        1.45,
        4.0,
        0.18,
        false,
      );
    }
  }
  for (let u = -29; u <= 29; u += 1.8) {
    facadeBox(
      HAMBURGER_CORNICE,
      u,
      groundY + (Math.abs(u) < 12 ? 19.9 : 14.9),
      0.28,
      0.62,
      0.42,
      0.38,
      false,
    );
  }

  // Entrance steps, axial path and the documented central rondel replace the
  // former 72 x 40 m rectangular paving sheet across the whole garden.
  for (let step = 0; step < 4; step += 1) {
    const [x, z] = at(0, 1.2 + step * 0.72);
    addBox(
      builder,
      0xc9c3b6,
      x,
      groundY + 0.1 + step * 0.1,
      z,
      19.5 - step * 0.7,
      0.2,
      0.86,
      rotation,
      step === 0,
    );
  }
  const [pathX, pathZ] = at(0, 28);
  addBox(
    builder,
    0xd2cec4,
    pathX,
    groundY + 0.07,
    pathZ,
    5.2,
    0.14,
    50,
    rotation,
    false,
  );
  const [rondelX, rondelZ] = at(0, 48);
  const rondel = new RingGeometry(7.2, 9.2, 40);
  rondel.rotateX(-Math.PI / 2);
  rondel.translate(rondelX, groundY + 0.15, rondelZ);
  addCustomGeometry(builder, rondel, 0xcac5ba, false);
}

function addRieckhallen(
  builder: Builder,
  byName: Map<string, ExpandedLandmark>,
): void {
  const point = anchor(byName, "Rieckhallen");
  if (!point) return;
  const profile = RIECKHALLEN_PROFILE;
  const centerX = point.x + profile.centerOffsetFromLandmarkM[0];
  const centerZ = point.z + profile.centerOffsetFromLandmarkM[1];
  const roofY = point.y + profile.measuredHeightM;
  const at = (across: number, along: number): [number, number] => [
    centerX + profile.crossAxis[0] * across + profile.longAxis[0] * along,
    centerZ + profile.crossAxis[1] * across + profile.longAxis[1] * along,
  ];

  // The protected freight building is one 281 m-long, low hall. Its LoD2
  // prism remains the metric body; this thin cap and three low roof bands
  // replace the former five invented high gables.
  addBox(
    builder,
    0xd8d8d1,
    centerX,
    roofY + 0.11,
    centerZ,
    profile.widthM - 0.2,
    0.22,
    profile.lengthM - 0.4,
    profile.rotationY,
    false,
  );
  for (const across of [-4.55, 0, 4.55]) {
    const [x, z] = at(across, 0);
    addBox(
      builder,
      0xc5cfcc,
      x,
      roofY + 0.34,
      z,
      2.15,
      0.42,
      profile.lengthM - 8,
      profile.rotationY,
      false,
    );
  }

  // Both long elevations keep the dark, vertically ribbed goods-shed skin
  // visible in the official monument photograph. The ribs are one merged draw
  // layer and do not alter the surveyed footprint or height.
  for (const side of [-1, 1]) {
    const across = side * (profile.widthM / 2 + 0.04);
    const [panelX, panelZ] = at(across, 0);
    addBox(
      builder,
      0x586b6f,
      panelX,
      point.y + 4.25,
      panelZ,
      0.16,
      7.8,
      profile.lengthM - 2,
      profile.rotationY,
      false,
    );
    for (
      let along = -profile.lengthM / 2 + 2.2;
      along < profile.lengthM / 2 - 2;
      along += 3.6
    ) {
      const [ribX, ribZ] = at(across + side * 0.08, along);
      addBox(
        builder,
        0x8c9b9d,
        ribX,
        point.y + 4.25,
        ribZ,
        0.12,
        7.65,
        0.18,
        profile.rotationY,
        false,
      );
    }
  }

  // Quiet panel seams explain the roof scale without creating another peak.
  for (
    let along = -profile.lengthM / 2 + 7;
    along < profile.lengthM / 2 - 7;
    along += 7
  ) {
    const [seamX, seamZ] = at(0, along);
    addBox(
      builder,
      0xaeb9b6,
      seamX,
      roofY + 0.245,
      seamZ,
      profile.widthM - 0.8,
      0.055,
      0.09,
      profile.rotationY,
      false,
    );
  }
}

function addBerlinModern(
  builder: Builder,
  byName: Map<string, ExpandedLandmark>,
): void {
  const point = anchor(byName, "berlin modern — Museum des 20. Jahrhunderts");
  if (!point) return;

  const profile = BERLIN_MODERN_PROFILE;
  const width = profile.footprintWidthM;
  const depth = profile.footprintLengthM;
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const rotation = profile.rotationY;
  const groundY = point.y;
  const eaveY = groundY + profile.bodyHeightM;

  // The previous placeholder had only a high floating roof. The published
  // 120 x 71 x 18 m planning envelope is now a continuous, grounded body.
  addLocalBox(
    builder,
    BERLIN_MODERN_MASONRY,
    point,
    0,
    groundY + profile.bodyHeightM / 2,
    0,
    width,
    profile.bodyHeightM,
    depth,
    rotation,
  );

  // Fine horizontal courses express the layered mineral masonry without
  // photographic textures or coplanar surfaces that could shimmer.
  for (let height = 1.1; height < profile.bodyHeightM; height += 1.1) {
    addLocalBox(
      builder,
      BERLIN_MODERN_MASONRY_LIGHT,
      point,
      0,
      groundY + height,
      -halfDepth - 0.11,
      width - 0.8,
      0.07,
      0.12,
      rotation,
      false,
    );
    addLocalBox(
      builder,
      BERLIN_MODERN_MASONRY_LIGHT,
      point,
      0,
      groundY + height,
      halfDepth + 0.11,
      width - 0.8,
      0.07,
      0.12,
      rotation,
      false,
    );
    for (const side of [-1, 1]) {
      addLocalBox(
        builder,
        BERLIN_MODERN_MASONRY_LIGHT,
        point,
        side * (halfWidth + 0.11),
        groundY + height,
        0,
        0.12,
        0.07,
        depth - 0.8,
        rotation,
        false,
      );
    }
  }

  addGableRoofShell(
    builder,
    BERLIN_MODERN_ROOF,
    point,
    eaveY,
    width,
    depth,
    profile.roofRiseM,
    rotation,
  );
  addGableFace(
    builder,
    BERLIN_MODERN_MASONRY_LIGHT,
    point,
    eaveY,
    -halfDepth,
    width,
    profile.roofRiseM,
    rotation,
    true,
  );
  addGableFace(
    builder,
    BERLIN_MODERN_MASONRY,
    point,
    eaveY,
    halfDepth,
    width,
    profile.roofRiseM,
    rotation,
    false,
  );

  // Broad transparent north entrance facing Scharounplatz, plus the smaller
  // south entrance. Both sit proud of the mineral wall to avoid z-fighting.
  addLocalLampBox(
    builder,
    BERLIN_MODERN_GLASS,
    point,
    0,
    groundY + 5.25,
    -halfDepth - 0.19,
    48,
    9.5,
    0.22,
    rotation,
  );
  addGableFace(
    builder,
    BERLIN_MODERN_GLASS,
    point,
    eaveY,
    -halfDepth - 0.2,
    48,
    profile.roofRiseM * (48 / width),
    rotation,
    true,
  );
  addLocalLampBox(
    builder,
    BERLIN_MODERN_GLASS,
    point,
    0,
    groundY + 4.1,
    halfDepth + 0.19,
    20,
    7.4,
    0.22,
    rotation,
  );

  // The east facade's upper glass band and transverse ground-level opening
  // are defining features in the published design views.
  addLocalLampBox(
    builder,
    BERLIN_MODERN_GLASS,
    point,
    halfWidth + 0.19,
    groundY + 8.7,
    -18,
    0.22,
    3.6,
    62,
    rotation,
  );
  addLocalLampBox(
    builder,
    BERLIN_MODERN_GLASS,
    point,
    halfWidth + 0.2,
    groundY + 2.55,
    21,
    0.24,
    4.6,
    22,
    rotation,
  );
  for (let localZ = 13; localZ <= 29; localZ += 4) {
    addLocalBox(
      builder,
      BERLIN_MODERN_MASONRY_LIGHT,
      point,
      halfWidth + 0.34,
      groundY + 2.55,
      localZ,
      0.24,
      4.5,
      0.18,
      rotation,
      false,
    );
  }
  addLocalLampBox(
    builder,
    BERLIN_MODERN_GLASS,
    point,
    -halfWidth - 0.19,
    groundY + 8.6,
    -22,
    0.22,
    3.4,
    44,
    rotation,
  );

  // A restrained mullion grid keeps the broad north facade legible in close
  // views while preserving the flat, inked illustration language.
  for (let localX = -22; localX <= 22; localX += 5.5) {
    addLocalBox(
      builder,
      BERLIN_MODERN_MASONRY_LIGHT,
      point,
      localX,
      groundY + 5.35,
      -halfDepth - 0.34,
      0.28,
      9.7,
      0.24,
      rotation,
      false,
    );
  }
  for (const height of [2.4, 5.2, 8]) {
    addLocalBox(
      builder,
      BERLIN_MODERN_MASONRY_LIGHT,
      point,
      0,
      groundY + height,
      -halfDepth - 0.34,
      48.2,
      0.22,
      0.24,
      rotation,
      false,
    );
  }

  const roofSlope = Math.atan2(profile.roofRiseM, halfWidth);
  const slopeLength = Math.hypot(halfWidth, profile.roofRiseM);
  for (const side of [-1, 1]) {
    const roofAngle = side > 0 ? -roofSlope : roofSlope;
    for (let distance = 4; distance < halfWidth - 1; distance += 5.25) {
      const localX = side * distance;
      const roofY =
        eaveY + profile.roofRiseM * (1 - distance / halfWidth) + 0.08;
      addTiltedLocalBox(
        builder,
        BERLIN_MODERN_PV_SEAM,
        point,
        localX,
        roofY,
        0,
        0.12,
        0.07,
        depth - 2,
        roofAngle,
        rotation,
      );
    }
    for (let localZ = -halfDepth + 8; localZ < halfDepth; localZ += 10) {
      addTiltedLocalBox(
        builder,
        BERLIN_MODERN_PV_SEAM,
        point,
        side * halfWidth * 0.5,
        eaveY + profile.roofRiseM * 0.5 + 0.08,
        localZ,
        slopeLength - 1,
        0.07,
        0.12,
        roofAngle,
        rotation,
      );
    }
  }

  // Light fascia and ridge members make the correct 18 m silhouette explicit.
  addLocalBox(
    builder,
    BERLIN_MODERN_MASONRY_LIGHT,
    point,
    0,
    eaveY + profile.roofRiseM + 0.12,
    0,
    0.42,
    0.28,
    depth + 0.5,
    rotation,
  );
  for (const side of [-1, 1]) {
    addTiltedLocalBox(
      builder,
      BERLIN_MODERN_MASONRY_LIGHT,
      point,
      side * halfWidth * 0.5,
      eaveY + profile.roofRiseM * 0.5,
      -halfDepth - 0.35,
      slopeLength,
      0.34,
      0.3,
      side > 0 ? -roofSlope : roofSlope,
      rotation,
    );
  }
  addLocalBox(
    builder,
    BERLIN_MODERN_MASONRY_LIGHT,
    point,
    0,
    groundY + profile.totalHeightM / 2,
    -halfDepth - 0.36,
    0.32,
    profile.totalHeightM,
    0.3,
    rotation,
    false,
  );
}

function addStMatthaeusChurch(
  builder: Builder,
  byName: Map<string, ExpandedLandmark>,
): void {
  const point = anchor(byName, "St. Matthäus-Kirche");
  if (!point) return;
  const profile = ST_MATTHAEUS_PROFILE;
  const rotation = profile.rotationY;
  const ground = point.y;

  // The LoD2 main part fixes the metric envelope. The official monument
  // record supplies the recognisable three-nave, striped Rundbogen facade.
  addLocalBox(
    builder,
    0xd9a77e,
    point,
    0,
    ground + 5.7,
    0,
    profile.footprintWidthM,
    11.4,
    profile.footprintLengthM,
    rotation,
  );
  for (const height of [1.2, 4.0, 6.9, 9.8]) {
    addLocalBox(
      builder,
      DARK_BRICK,
      point,
      0,
      ground + height,
      0,
      profile.footprintWidthM + 0.28,
      0.36,
      profile.footprintLengthM + 0.28,
      rotation,
      false,
    );
  }
  for (const localZ of [-12.5, -7.5, -2.5, 2.5, 7.5, 12.5]) {
    for (const side of [-1, 1]) {
      const [offsetX, offsetZ] = rotatedLocalOffset(
        side * (profile.footprintWidthM / 2 + 0.12),
        localZ,
        rotation,
      );
      const faceRotation = rotation + side * (Math.PI / 2);
      addArchedPanel(
        builder,
        0x547078,
        SANDSTONE,
        point.x + offsetX,
        ground + 1.7,
        point.z + offsetZ,
        1.45,
        3.35,
        faceRotation,
        true,
      );
      addArchedPanel(
        builder,
        0x66818a,
        SANDSTONE,
        point.x + offsetX,
        ground + 6.05,
        point.z + offsetZ,
        1.45,
        3.65,
        faceRotation,
        true,
      );
    }
  }
  for (const localX of [-7, 0, 7]) {
    const [offsetX, offsetZ] = rotatedLocalOffset(localX, 0, rotation);
    addGabledRoof(
      builder,
      0x876557,
      point.x + offsetX,
      ground + 11.35,
      point.z + offsetZ,
      6.55,
      profile.footprintLengthM + 0.8,
      5.15,
      rotation,
    );
  }

  // South-facing main and side apses. Full shallow drums overlap the nave;
  // only their source-backed semicircular outer halves remain visible.
  for (const [localX, radius, height] of [
    [0, 4.15, 10.2],
    [-7, 3.05, 7.8],
    [7, 3.05, 7.8],
  ] as const) {
    const [offsetX, offsetZ] = rotatedLocalOffset(localX, 16.0, rotation);
    addCylinder(
      builder,
      0xd9a77e,
      point.x + offsetX,
      ground + height / 2,
      point.z + offsetZ,
      radius,
      height,
      24,
    );
  }

  // The tower is a separate 41.65 m LoD2 part at the north end. Its arcade,
  // corner turrets, octagonal stage and copper spire follow the monument text.
  const [towerX, towerZ] = rotatedLocalOffset(0, -11.7, rotation);
  const tower = new Vector3(point.x + towerX, ground, point.z + towerZ);
  addLocalBox(
    builder,
    0xd3a078,
    tower,
    0,
    ground + 13.0,
    0,
    7.6,
    26,
    7.6,
    rotation,
  );
  for (const height of [5.2, 12.0, 18.8, 25.2]) {
    addLocalBox(
      builder,
      DARK_BRICK,
      tower,
      0,
      ground + height,
      0,
      8.05,
      0.42,
      8.05,
      rotation,
      false,
    );
  }
  addLocalBox(
    builder,
    SANDSTONE,
    tower,
    0,
    ground + 27.6,
    0,
    9.1,
    3.8,
    9.1,
    rotation,
  );
  for (const side of [-1, 1]) {
    for (const localX of [-2.2, 0, 2.2]) {
      const [offsetX, offsetZ] = rotatedLocalOffset(
        localX,
        side * 4.61,
        rotation,
      );
      addArchedPanel(
        builder,
        0x36454a,
        SANDSTONE,
        tower.x + offsetX,
        ground + 26.25,
        tower.z + offsetZ,
        1.15,
        2.45,
        rotation + (side < 0 ? Math.PI : 0),
      );
    }
  }
  addCylinder(
    builder,
    SANDSTONE,
    tower.x,
    ground + 31.2,
    tower.z,
    4.25,
    3.4,
    8,
  );
  for (const [localX, localZ] of [
    [-3.7, -3.7],
    [-3.7, 3.7],
    [3.7, -3.7],
    [3.7, 3.7],
  ] as const) {
    const [offsetX, offsetZ] = rotatedLocalOffset(localX, localZ, rotation);
    addCone(
      builder,
      0x789788,
      tower.x + offsetX,
      ground + 32.7,
      tower.z + offsetZ,
      0.75,
      3.2,
      8,
    );
  }
  addCone(builder, 0x789788, tower.x, ground + 36.8, tower.z, 4.35, 10.1, 8);
}

function addNeueNationalgalerie(
  builder: Builder,
  byName: Map<string, ExpandedLandmark>,
): void {
  const point = anchor(byName, "Neue Nationalgalerie");
  if (!point) return;
  const profile = NEUE_NATIONALGALERIE_PROFILE;
  const rotation = profile.rotationY;
  const ground = point.y;
  const glassHalf = profile.glassWidthM / 2;

  // Granite podium and strict square terrace, aligned to the LoD2 footprint.
  addLocalBox(
    builder,
    0xb8b4aa,
    point,
    0,
    ground + 0.35,
    0,
    91,
    0.7,
    91,
    rotation,
  );
  addLocalBox(
    builder,
    0x85888a,
    point,
    0,
    ground + 0.82,
    0,
    65.6,
    0.26,
    65.6,
    rotation,
    false,
  );
  addLocalBox(
    builder,
    0x303638,
    point,
    0,
    ground + 1.05,
    0,
    profile.glassWidthM,
    0.34,
    profile.glassWidthM,
    rotation,
    false,
  );

  // Recessed 50.4 m glass box: four thin facades rather than an opaque cube.
  for (const side of [-1, 1]) {
    addLocalLampBox(
      builder,
      0x86b9c3,
      point,
      0,
      ground + 4.7,
      side * glassHalf,
      profile.glassWidthM,
      7.1,
      0.18,
      rotation,
    );
    addLocalLampBox(
      builder,
      0x86b9c3,
      point,
      side * glassHalf,
      ground + 4.7,
      0,
      0.18,
      7.1,
      profile.glassWidthM,
      rotation,
    );
  }
  for (let offset = -glassHalf; offset <= glassHalf; offset += 3.6) {
    for (const side of [-1, 1]) {
      addLocalBox(
        builder,
        DARK_FRAME,
        point,
        offset,
        ground + 4.7,
        side * (glassHalf + 0.12),
        0.13,
        7.1,
        0.22,
        rotation,
        false,
      );
      addLocalBox(
        builder,
        DARK_FRAME,
        point,
        side * (glassHalf + 0.12),
        ground + 4.7,
        offset,
        0.22,
        7.1,
        0.13,
        rotation,
        false,
      );
    }
  }

  // Eight cruciform steel columns: two centred along each roof side.
  for (const along of [-14.4, 14.4]) {
    for (const side of [-1, 1]) {
      for (const [localX, localZ] of [
        [along, side * 28.8],
        [side * 28.8, along],
      ] as const) {
        addLocalBox(
          builder,
          DARK_FRAME,
          point,
          localX,
          ground + 4.7,
          localZ,
          0.62,
          7.2,
          1.45,
          rotation,
        );
        addLocalBox(
          builder,
          DARK_FRAME,
          point,
          localX,
          ground + 4.7,
          localZ,
          1.45,
          7.2,
          0.62,
          rotation,
          false,
        );
      }
    }
  }

  // Floating 64.8 m plate and its visible 3.6 m structural/coffer grid.
  addLocalBox(
    builder,
    0x252b2c,
    point,
    0,
    ground + 8.75,
    0,
    profile.roofWidthM,
    1.8,
    profile.roofWidthM,
    rotation,
  );
  for (let offset = -28.8; offset <= 28.8; offset += profile.roofGridM) {
    addLocalBox(
      builder,
      0x171b1c,
      point,
      offset,
      ground + 7.81,
      0,
      0.2,
      0.22,
      63.6,
      rotation,
      false,
    );
    addLocalBox(
      builder,
      0x171b1c,
      point,
      0,
      ground + 7.81,
      offset,
      63.6,
      0.22,
      0.2,
      rotation,
      false,
    );
  }

  // Broad entrance steps sit in the same site grid; no rotated substitute roof.
  for (let step = 0; step < 6; step += 1) {
    addLocalBox(
      builder,
      0xb8b4aa,
      point,
      0,
      ground + 0.12 + step * 0.11,
      45.5 - step * 1.15,
      30,
      0.22,
      2.4,
      rotation,
      false,
    );
  }
}

function fixedWorldPoint(world: readonly [number, number]): Vector3 {
  return new Vector3(world[0], 8, world[1]);
}

function addKulturforumMuseums(builder: Builder): void {
  const galleryProfile = KULTURFORUM_PROFILE.gemaldegalerie;
  const gallery = fixedWorldPoint(galleryProfile.centerWorldM);
  const galleryRotation = galleryProfile.rotationY;
  // The gallery's two long courtyard wings and connecting heads follow the
  // full named LoD2 envelope rather than the entrance POI used by navigation.
  for (const localZ of [-31, 31]) {
    addLocalBox(
      builder,
      KULTURFORUM_STONE,
      gallery,
      0,
      gallery.y + 9.2,
      localZ,
      129,
      18.4,
      27,
      galleryRotation,
    );
    addLocalBox(
      builder,
      KULTURFORUM_STONE_LIGHT,
      gallery,
      0,
      gallery.y + 18.7,
      localZ,
      131,
      0.8,
      29,
      galleryRotation,
    );
  }
  for (const localX of [-55, 55]) {
    addLocalBox(
      builder,
      0xddd3c1,
      gallery,
      localX,
      gallery.y + 8.7,
      0,
      21,
      17.4,
      42,
      galleryRotation,
    );
  }
  // Shallow roof lights and pale stone expansion joints preserve the calm,
  // low museum profile while making the two long roof bars legible up close.
  for (let localX = -57; localX <= 57; localX += 9.5) {
    for (const localZ of [-31, 31]) {
      addLocalBox(
        builder,
        localX % 19 === 0 ? 0x91aaab : KULTURFORUM_SHADOW,
        gallery,
        localX,
        gallery.y + 19.22,
        localZ,
        0.34,
        0.24,
        23.6,
        galleryRotation,
        false,
      );
    }
  }
  // Calm, repeated stone bays and recessed dark glazing make the long facade
  // read as the 1998 museum instead of one anonymous cream block.
  for (let localX = -57; localX <= 57; localX += 6) {
    for (const localZ of [-44.7, 44.7]) {
      addLocalLampBox(
        builder,
        0x78999a,
        gallery,
        localX,
        gallery.y + 10.2,
        localZ,
        3.5,
        4.9,
        0.18,
        galleryRotation,
      );
      addLocalBox(
        builder,
        0xc7baa3,
        gallery,
        localX,
        gallery.y + 13.1,
        localZ + Math.sign(localZ) * 0.12,
        0.18,
        10.8,
        0.2,
        galleryRotation,
        false,
      );
    }
  }
  for (let localZ = -15; localZ <= 15; localZ += 6) {
    for (const localX of [-65.7, 65.7]) {
      addLocalBox(
        builder,
        0x78999a,
        gallery,
        localX,
        gallery.y + 10.2,
        localZ,
        0.18,
        4.9,
        3.5,
        galleryRotation,
        false,
      );
    }
  }

  const copperProfile = KULTURFORUM_PROFILE.kunstbibliothek;
  const copper = fixedWorldPoint(copperProfile.centerWorldM);
  addLocalBox(
    builder,
    KULTURFORUM_STONE,
    copper,
    0,
    copper.y + 8.5,
    0,
    59,
    17,
    58,
    copperProfile.rotationY,
  );
  addLocalBox(
    builder,
    KULTURFORUM_STONE_LIGHT,
    copper,
    0,
    copper.y + 17.4,
    0,
    61,
    0.7,
    60,
    copperProfile.rotationY,
  );
  for (const localZ of [-18, -6, 6, 18]) {
    addLocalBox(
      builder,
      0x9aafb0,
      copper,
      0,
      copper.y + 17.92,
      localZ,
      46,
      0.32,
      1.1,
      copperProfile.rotationY,
      false,
    );
  }
  for (let localX = -24; localX <= 24; localX += 8) {
    addLocalLampBox(
      builder,
      0x6d8c8d,
      copper,
      localX,
      copper.y + 8.6,
      -29.2,
      4.9,
      6.2,
      0.18,
      copperProfile.rotationY,
    );
  }

  const craftProfile = KULTURFORUM_PROFILE.kunstgewerbemuseum;
  const craft = fixedWorldPoint(craftProfile.centerWorldM);
  // Gutbrod's museum steps down toward the Piazzetta in angular terraces.
  for (const [localX, localZ, width, depth, height] of [
    [-17, 12, 43, 56, 18.8],
    [22, -8, 31, 49, 15.2],
    [8, 25, 56, 20, 11.4],
  ] as const) {
    addLocalBox(
      builder,
      0xd9cfbd,
      craft,
      localX,
      craft.y + height / 2,
      localZ,
      width,
      height,
      depth,
      craftProfile.rotationY,
    );
    addLocalBox(
      builder,
      KULTURFORUM_STONE_LIGHT,
      craft,
      localX,
      craft.y + height + 0.25,
      localZ,
      width + 0.7,
      0.5,
      depth + 0.7,
      craftProfile.rotationY,
    );
  }
  for (let index = -3; index <= 3; index += 1) {
    addLocalLampBox(
      builder,
      0x708c8e,
      craft,
      index * 7.2,
      craft.y + 7.2,
      -33,
      4.4,
      5.8,
      0.2,
      craftProfile.rotationY,
    );
  }
  for (const level of [4.2, 9.4, 14.6]) {
    addLocalBox(
      builder,
      KULTURFORUM_SHADOW,
      craft,
      -17,
      craft.y + level,
      -16.2,
      42,
      0.18,
      0.22,
      craftProfile.rotationY,
      false,
    );
  }

  const piazzettaProfile = KULTURFORUM_PROFILE.piazzetta;
  const piazzetta = fixedWorldPoint(piazzettaProfile.centerWorldM);
  addRamp(
    builder,
    0xe2d9ca,
    piazzetta.x,
    piazzetta.y + 0.08,
    piazzetta.z,
    piazzettaProfile.widthM,
    piazzettaProfile.lengthM,
    piazzettaProfile.riseM,
    piazzettaProfile.rotationY,
  );
  for (let localZ = -32; localZ <= 32; localZ += 8) {
    const [offsetX, offsetZ] = rotatedLocalOffset(
      0,
      localZ,
      piazzettaProfile.rotationY,
    );
    const progress =
      (localZ + piazzettaProfile.lengthM / 2) / piazzettaProfile.lengthM;
    addBox(
      builder,
      0xb9ad99,
      piazzetta.x + offsetX,
      piazzetta.y + 0.18 + progress * piazzettaProfile.riseM,
      piazzetta.z + offsetZ,
      piazzettaProfile.widthM - 1.2,
      0.12,
      0.28,
      piazzettaProfile.rotationY,
      false,
    );
  }
}

function addKulturforumConcertBuildings(builder: Builder): void {
  const philProfile = KULTURFORUM_PROFILE.philharmonie;
  const phil = fixedWorldPoint(philProfile.centerWorldM);
  for (let index = -5; index <= 5; index += 1) {
    addLocalLampBox(
      builder,
      0x506b6d,
      phil,
      index * 7.2,
      phil.y + 7.7,
      -35.2,
      4.3,
      5.1,
      0.18,
      philProfile.rotationY,
    );
  }
  for (let bay = 0; bay <= philProfile.facadeBayCount; bay += 1) {
    addLocalBox(
      builder,
      0xb99142,
      phil,
      -39.6 + (79.2 * bay) / philProfile.facadeBayCount,
      phil.y + 8.2,
      -35.35,
      0.22,
      11.8,
      0.24,
      philProfile.rotationY,
      false,
    );
  }
  for (let band = 0; band < philProfile.facadeBandCount; band += 1) {
    addLocalBox(
      builder,
      band === philProfile.facadeBandCount - 1 ? 0xe0bd61 : 0xc79b43,
      phil,
      0,
      phil.y + 3.2 + band * 3.35,
      -35.42,
      82.8,
      band === philProfile.facadeBandCount - 1 ? 0.34 : 0.17,
      0.26,
      philProfile.rotationY,
      false,
    );
  }
  // A short, rising gold register follows the faceted lower crown without
  // replacing the seven-part LoD2 roof or its existing radial seam pass.
  for (
    let cue = 0;
    cue < philProfile.roofFacetCueCount;
    cue += 1
  ) {
    const localX = -34 + (68 * cue) / (philProfile.roofFacetCueCount - 1);
    addLocalBox(
      builder,
      cue % 2 === 0 ? 0xd7ab4d : 0xb78c3e,
      phil,
      localX,
      phil.y + 19.1 + (cue % 3) * 0.75,
      -31.5 + Math.abs(cue - 4) * 0.42,
      5.8,
      0.22,
      0.36,
      philProfile.rotationY,
      false,
    );
  }

  const chamberProfile = KULTURFORUM_PROFILE.kammermusiksaal;
  const chamber = fixedWorldPoint(chamberProfile.centerWorldM);
  for (let index = -4; index <= 4; index += 1) {
    addLocalLampBox(
      builder,
      0x536d6f,
      chamber,
      index * 7,
      chamber.y + 7.5,
      30.7,
      4.2,
      5,
      0.18,
      chamberProfile.rotationY,
    );
  }
  for (let bay = 0; bay <= chamberProfile.facadeBayCount; bay += 1) {
    addLocalBox(
      builder,
      0xb58d3e,
      chamber,
      -28 + (56 * bay) / chamberProfile.facadeBayCount,
      chamber.y + 8.1,
      30.82,
      0.21,
      11.2,
      0.24,
      chamberProfile.rotationY,
      false,
    );
  }
  for (let band = 0; band < chamberProfile.facadeBandCount; band += 1) {
    addLocalBox(
      builder,
      band === chamberProfile.facadeBandCount - 1 ? 0xdfbd67 : 0xc49a49,
      chamber,
      0,
      chamber.y + 3.25 + band * 3.2,
      30.9,
      60.8,
      band === chamberProfile.facadeBandCount - 1 ? 0.34 : 0.17,
      0.25,
      chamberProfile.rotationY,
      false,
    );
  }
  for (
    let cue = 0;
    cue < chamberProfile.roofFacetCueCount;
    cue += 1
  ) {
    const localX = -24 + (48 * cue) / (chamberProfile.roofFacetCueCount - 1);
    addLocalBox(
      builder,
      cue % 2 === 0 ? 0xd6ae59 : 0xb88e43,
      chamber,
      localX,
      chamber.y + 18.1 + (cue % 2) * 0.8,
      27.8 - Math.abs(cue - 3) * 0.32,
      5.4,
      0.22,
      0.34,
      chamberProfile.rotationY,
      false,
    );
  }
}

function addKulturforumLibrary(builder: Builder): void {
  const profile = KULTURFORUM_PROFILE.staatsbibliothek;
  const library = fixedWorldPoint(profile.centerWorldM);
  // The 56-part LoD2 shell carries Scharoun's surveyed terraces. Keep this
  // supplement to documented facade and roof motifs so a second block mass
  // cannot intersect the authoritative geometry.
  for (let localZ = -119; localZ <= 87; localZ += 11.5) {
    addLocalLampBox(
      builder,
      0x59787a,
      library,
      -77,
      library.y + 9.2,
      localZ,
      0.2,
      4.2,
      7.1,
      profile.rotationY,
    );
  }
  // Ship-like portholes and roof-light pyramids are documented Scharoun
  // motifs; they break up the long gold envelope without invented textures.
  for (const localZ of [-92, -68, -44, -20, 4, 28, 52]) {
    const [offsetX, offsetZ] = rotatedLocalOffset(
      -77.2,
      localZ,
      profile.rotationY,
    );
    addFacadeDisc(
      builder,
      0x789496,
      0x4d6264,
      library.x + offsetX,
      library.y + 14.8,
      library.z + offsetZ,
      1.15,
      profile.rotationY + Math.PI / 2,
    );
  }
  for (const [localX, localZ, roofY] of [
    [-38, -94, 19.5],
    [8, -42, 23.5],
    [-19, 12, 27.5],
    [24, 62, 32.2],
  ] as const) {
    const [offsetX, offsetZ] = rotatedLocalOffset(
      localX,
      localZ,
      profile.rotationY,
    );
    addCone(
      builder,
      GLASS,
      library.x + offsetX,
      library.y + roofY,
      library.z + offsetZ,
      3.4,
      4.6,
      4,
    );
  }
}

function addKulturforum(
  builder: Builder,
  byName: Map<string, ExpandedLandmark>,
): void {
  if (
    byName.has("Gemäldegalerie") ||
    byName.has("Berliner Philharmonie") ||
    byName.has("Kammermusiksaal") ||
    byName.has("Staatsbibliothek zu Berlin (Haus Potsdamer Straße)")
  ) {
    addKulturforumMuseums(builder);
    addKulturforumConcertBuildings(builder);
    addKulturforumLibrary(builder);
  }
  addBerlinModern(builder, byName);
  addStMatthaeusChurch(builder, byName);
  addNeueNationalgalerie(builder, byName);
  const archer = anchor(byName, "Der Bogenschütze (Henry Moore)");
  if (archer) {
    const torus = new TorusGeometry(4.2, 0.7, 8, 24, Math.PI * 1.35);
    torus.rotateX(Math.PI / 2);
    torus.rotateZ(-0.42);
    torus.translate(archer.x, archer.y + 4.8, archer.z);
    addCustomGeometry(builder, torus, BRONZE);
  }
}

function addPotsdamerUndergroundStation(builder: Builder): void {
  const profile = POTSDAMER_DETAIL_PROFILE;
  const station = fixedWorldPoint(profile.potsdamerStationWorldM);
  const rotation = -0.035;
  // A legible cutaway below grade: S-Bahn and regional platforms flank the
  // shared distribution passage. It is intentionally schematic and remains
  // hidden by the city plate from a normal surface view.
  for (const localX of [-18, -6, 6, 18]) {
    addLocalBox(
      builder,
      0x313a3d,
      station,
      localX,
      -2.4,
      0,
      2.3,
      0.45,
      164,
      rotation,
      false,
    );
  }
  for (const localX of [-12, 0, 12]) {
    addLocalBox(
      builder,
      0xd0c4aa,
      station,
      localX,
      -2.05,
      0,
      6.4,
      0.7,
      151,
      rotation,
    );
  }
  addLocalBox(builder, 0xb7aa90, station, 0, 1.1, 4, 51, 0.8, 10, rotation);
}

function addPotsdamerEntranceHalls(
  builder: Builder,
  byName: Map<string, ExpandedLandmark>,
): void {
  if (!byName.has("Mall of Berlin")) return;
  const profile = POTSDAMER_DETAIL_PROFILE.stationEntranceHalls;

  for (const hall of profile.halls) {
    const origin = new Vector3(
      hall.centerWorldM[0],
      hall.groundY,
      hall.centerWorldM[1],
    );
    const [width, depth] = hall.footprintSizeM;
    const halfWidth = width / 2;
    const halfDepth = depth / 2;
    const topY = hall.groundY + hall.officialHeightM;
    const fasciaHeight = 0.82;
    const frameStroke = 0.34;
    const glazedHeight = hall.officialHeightM - fasciaHeight - 0.34;
    const glazedCenterY = hall.groundY + glazedHeight / 2 + 0.17;
    const frontSide = hall.frontSide;
    const backSide = -frontSide;

    // The two halls keep their exact LoD2 plan and top height. Their bodies
    // remain visibly hollow: three thin glass planes, an open entrance front
    // and a welded steel grid replace the former pair of tiny solid canopies.
    addPolygonPrism(
      builder,
      GLASS,
      hall.footprintRingWorldM,
      topY - 0.12,
      0.12,
      false,
    );
    addLocalBox(
      builder,
      GLASS,
      origin,
      0,
      glazedCenterY,
      backSide * (halfDepth - 0.09),
      width - frameStroke * 2,
      glazedHeight,
      0.12,
      hall.rotationY,
      false,
    );
    for (const side of [-1, 1]) {
      addLocalBox(
        builder,
        GLASS,
        origin,
        side * (halfWidth - 0.09),
        glazedCenterY,
        0,
        0.12,
        glazedHeight,
        depth - frameStroke * 2,
        hall.rotationY,
        false,
      );
    }

    // Perimeter frame and corner columns stay wholly inside the official
    // source footprint instead of adding another unmeasured outer shell.
    for (const side of [-1, 1]) {
      addLocalBox(
        builder,
        DARK_FRAME,
        origin,
        0,
        topY - fasciaHeight / 2,
        side * (halfDepth - frameStroke / 2),
        width,
        fasciaHeight,
        frameStroke,
        hall.rotationY,
      );
      addLocalBox(
        builder,
        DARK_FRAME,
        origin,
        side * (halfWidth - frameStroke / 2),
        topY - fasciaHeight / 2,
        0,
        frameStroke,
        fasciaHeight,
        depth,
        hall.rotationY,
      );
      for (const depthSide of [-1, 1]) {
        addLocalBox(
          builder,
          DARK_FRAME,
          origin,
          side * (halfWidth - frameStroke / 2),
          hall.groundY + hall.officialHeightM / 2,
          depthSide * (halfDepth - frameStroke / 2),
          frameStroke,
          hall.officialHeightM,
          frameStroke,
          hall.rotationY,
        );
      }
    }

    // Roof carrier grid: ten bays across and six in depth, matching the
    // repeated welded hollow-box rhythm visible in the architect/Commons
    // references while remaining explicitly presentation geometry.
    for (let bay = 1; bay < profile.roofBayCountAcross; bay += 1) {
      addLocalBox(
        builder,
        DARK_FRAME,
        origin,
        -halfWidth + (width * bay) / profile.roofBayCountAcross,
        topY - 0.18,
        0,
        0.16,
        0.26,
        depth - frameStroke * 2,
        hall.rotationY,
        false,
      );
    }
    for (let bay = 1; bay < profile.roofBayCountDepth; bay += 1) {
      addLocalBox(
        builder,
        DARK_FRAME,
        origin,
        0,
        topY - 0.18,
        -halfDepth + (depth * bay) / profile.roofBayCountDepth,
        width - frameStroke * 2,
        0.26,
        0.16,
        hall.rotationY,
        false,
      );
    }

    // Three rows of glass wall panels and slender mullions. The front stays
    // open; the side walls receive the characteristic diagonal steel braces.
    for (let row = 1; row < profile.wallPanelRows; row += 1) {
      const y = hall.groundY + (glazedHeight * row) / profile.wallPanelRows;
      addLocalBox(
        builder,
        DARK_FRAME,
        origin,
        0,
        y,
        backSide * (halfDepth - 0.14),
        width - frameStroke,
        0.13,
        0.16,
        hall.rotationY,
        false,
      );
      for (const side of [-1, 1]) {
        addLocalBox(
          builder,
          DARK_FRAME,
          origin,
          side * (halfWidth - 0.14),
          y,
          0,
          0.16,
          0.13,
          depth - frameStroke,
          hall.rotationY,
          false,
        );
      }
    }
    for (let bay = 1; bay < profile.roofBayCountAcross; bay += 1) {
      addLocalBox(
        builder,
        DARK_FRAME,
        origin,
        -halfWidth + (width * bay) / profile.roofBayCountAcross,
        glazedCenterY,
        backSide * (halfDepth - 0.14),
        0.13,
        glazedHeight,
        0.16,
        hall.rotationY,
        false,
      );
    }
    for (const side of [-1, 1]) {
      for (let bay = 1; bay < profile.roofBayCountDepth; bay += 1) {
        addLocalBox(
          builder,
          DARK_FRAME,
          origin,
          side * (halfWidth - 0.14),
          glazedCenterY,
          -halfDepth + (depth * bay) / profile.roofBayCountDepth,
          0.16,
          glazedHeight,
          0.13,
          hall.rotationY,
          false,
        );
      }
    }
    const localPoint = (localX: number, y: number, localZ: number): Vector3 => {
      const [offsetX, offsetZ] = rotatedLocalOffset(
        localX,
        localZ,
        hall.rotationY,
      );
      return new Vector3(origin.x + offsetX, y, origin.z + offsetZ);
    };
    for (const side of [-1, 1]) {
      for (let bay = 0; bay < profile.roofBayCountDepth; bay += 2) {
        const z0 = -halfDepth + (depth * bay) / profile.roofBayCountDepth;
        const z1 =
          -halfDepth +
          (depth * Math.min(profile.roofBayCountDepth, bay + 2)) /
            profile.roofBayCountDepth;
        addBeamBetween(
          builder,
          DARK_FRAME,
          localPoint(side * (halfWidth - 0.17), hall.groundY + 0.3, z0 + 0.2),
          localPoint(
            side * (halfWidth - 0.17),
            topY - fasciaHeight - 0.2,
            z1 - 0.2,
          ),
          0.12,
        );
        addBeamBetween(
          builder,
          DARK_FRAME,
          localPoint(
            side * (halfWidth - 0.17),
            topY - fasciaHeight - 0.2,
            z0 + 0.2,
          ),
          localPoint(side * (halfWidth - 0.17), hall.groundY + 0.3, z1 - 0.2),
          0.12,
        );
      }
    }

    // Two stair/escalator banks descend from each hall's mapped entrance
    // edge. The below-grade run is diagrammatic and does not change the LoD2
    // footprint or claim an as-built underground survey.
    addLocalBox(
      builder,
      0x30383a,
      origin,
      0,
      hall.groundY + 0.035,
      frontSide * (halfDepth - 6.8),
      16.4,
      0.07,
      11.4,
      hall.rotationY,
      false,
    );
    for (const bankX of [-5.0, 5.0]) {
      for (let step = 0; step < 11; step += 1) {
        addLocalBox(
          builder,
          0xbdb9ae,
          origin,
          bankX,
          hall.groundY + 0.16 - step * 0.14,
          frontSide * (halfDepth - 1.8 - step * 0.84),
          4.4,
          0.16,
          0.88,
          hall.rotationY,
          false,
        );
      }
      for (const railSide of [-1, 1]) {
        addBeamBetween(
          builder,
          0x7c8587,
          localPoint(
            bankX + railSide * 2.05,
            hall.groundY + 1.05,
            frontSide * (halfDepth - 1.45),
          ),
          localPoint(
            bankX + railSide * 2.05,
            hall.groundY - 0.9,
            frontSide * (halfDepth - 10.7),
          ),
          0.11,
        );
      }
    }
  }
}

function addPotsdamerEntranceHallLettering(
  group: Group,
  byName: Map<string, ExpandedLandmark>,
): void {
  if (!byName.has("Mall of Berlin")) return;
  const profile = POTSDAMER_DETAIL_PROFILE.stationEntranceHalls;
  for (const hall of profile.halls) {
    const [width, depth] = hall.footprintSizeM;
    const [offsetX, offsetZ] = rotatedLocalOffset(
      0,
      hall.frontSide * (depth / 2 - 0.03),
      hall.rotationY,
    );
    const sign = createLetterSign(
      "BAHNHOF POTSDAMER PLATZ",
      width - 1.1,
      0.74,
      new Vector3(
        hall.centerWorldM[0] + offsetX,
        hall.groundY + hall.officialHeightM - 0.43,
        hall.centerWorldM[1] + offsetZ,
      ),
      hall.rotationY + (hall.frontSide < 0 ? Math.PI : 0),
      "#4f5759",
      "#f1eee6",
    );
    if (!sign) continue;
    sign.name = `Potsdamer Platz ${hall.key} hall fascia lettering`;
    sign.userData.sourceBuildingId = hall.sourceBuildingId;
    group.add(sign);
  }
}

function addBahnTowerFacade(builder: Builder): void {
  const profile = POTSDAMER_DETAIL_PROFILE.bahnTower;
  const arc = profile.facadeArcWorldM;
  const facadeBottomY = profile.groundY + 4.8;
  const facadeTopY = profile.groundY + 90.5;

  // The tower shell is already the three exact LoD2 parts. These belts and
  // mullions follow a coarsened subset of the measured curved outer ring, so
  // the 103 m glass blade reads at distance without adding a second tower.
  for (let band = 0; band < profile.facadeBandCount; band += 1) {
    const amount = band / (profile.facadeBandCount - 1);
    const y = facadeBottomY + amount * (facadeTopY - facadeBottomY);
    for (let index = 0; index < arc.length - 1; index += 1) {
      addFacadeSegment(
        builder,
        band === profile.facadeBandCount - 1 ? 0x9bb1b3 : 0x52676c,
        arc[index],
        arc[index + 1],
        y,
        band === profile.facadeBandCount - 1 ? 0.36 : 0.16,
        0.2,
      );
    }
  }
  for (let index = 0; index < arc.length; index += 1) {
    const previous = arc[Math.max(0, index - 1)];
    const next = arc[Math.min(arc.length - 1, index + 1)];
    const rotationY = -Math.atan2(next[1] - previous[1], next[0] - previous[0]);
    addBox(
      builder,
      index % 2 === 0 ? 0x42575c : 0x637b7f,
      arc[index][0],
      (facadeBottomY + facadeTopY) / 2,
      arc[index][1],
      0.18,
      facadeTopY - facadeBottomY,
      0.2,
      rotationY,
      false,
    );
  }
}

function addPotsdamerWilhelmDetails(
  builder: Builder,
  byName: Map<string, ExpandedLandmark>,
): void {
  if (!byName.has("Mall of Berlin")) return;
  addPotsdamerUndergroundStation(builder);
  addBahnTowerFacade(builder);
  const profile = POTSDAMER_DETAIL_PROFILE;

  const spielbank = fixedWorldPoint(profile.spielbankWorldM);
  addBox(
    builder,
    0x382a28,
    spielbank.x,
    spielbank.y + 4.6,
    spielbank.z - 0.8,
    21,
    8.7,
    0.28,
    -0.03,
    false,
  );
  addBox(
    builder,
    0xc14e45,
    spielbank.x,
    spielbank.y + 8.9,
    spielbank.z - 1.2,
    22,
    0.65,
    2.8,
    -0.03,
  );

  const czech = fixedWorldPoint(profile.czechEmbassyWorldM);
  addLocalBox(
    builder,
    0xb28d61,
    czech,
    0,
    czech.y + 11.8,
    0,
    48,
    23.6,
    45,
    0.29,
  );
  addLocalBox(
    builder,
    0x4f6668,
    czech,
    0,
    czech.y + 13,
    -22.8,
    42,
    9.4,
    0.22,
    0.29,
  );
  for (let bay = -4; bay <= 4; bay += 1) {
    addLocalLampBox(
      builder,
      0x8eb3b4,
      czech,
      bay * 4.5,
      czech.y + 13,
      -23,
      2.8,
      6.8,
      0.16,
      0.29,
    );
  }
  addLocalBox(
    builder,
    0xd4b77e,
    czech,
    0,
    czech.y + 24.2,
    0,
    50.5,
    0.8,
    47.5,
    0.29,
  );

  const northKorea = fixedWorldPoint(profile.northKoreanEmbassyWorldM);
  addLocalBox(
    builder,
    0xd5d0c1,
    northKorea,
    0,
    northKorea.y + 7.4,
    0,
    36,
    14.8,
    23,
    0.12,
  );
  addGabledRoof(
    builder,
    0x6f7772,
    northKorea.x,
    northKorea.y + 14.7,
    northKorea.z,
    37,
    24,
    4.8,
    0.12,
  );
  for (let bay = -3; bay <= 3; bay += 1) {
    addLocalLampBox(
      builder,
      0x718b8b,
      northKorea,
      bay * 4.2,
      northKorea.y + 8.4,
      -11.7,
      2.2,
      3.1,
      0.16,
      0.12,
    );
  }

  const dessauer = fixedWorldPoint(profile.alterDessauerWorldM);
  addBox(
    builder,
    SANDSTONE,
    dessauer.x,
    dessauer.y + 1.25,
    dessauer.z,
    4.2,
    2.5,
    4.2,
  );
  addCylinder(
    builder,
    BRONZE,
    dessauer.x,
    dessauer.y + 4.4,
    dessauer.z,
    0.72,
    4.2,
    10,
  );
  addCone(
    builder,
    BRONZE,
    dessauer.x,
    dessauer.y + 7.1,
    dessauer.z,
    1.05,
    1.8,
    10,
  );
}

type TillaLawnProfile =
  | typeof TILLA_DURIEUX_PROFILE.northLawn
  | typeof TILLA_DURIEUX_PROFILE.southLawn;

function addTillaLawnLobe(builder: Builder, profile: TillaLawnProfile): void {
  const westEnd = profile.endWestWorldM;
  const eastEnd = profile.endEastWorldM;
  const eastCourt = profile.centerEastWorldM;
  const westCourt = profile.centerWestWorldM;
  const groundY = TILLA_DURIEUX_PROFILE.groundY;
  const lerpPoint = (
    a: readonly [number, number],
    b: readonly [number, number],
    amount: number,
  ): readonly [number, number] => [
    a[0] + (b[0] - a[0]) * amount,
    a[1] + (b[1] - a[1]) * amount,
  ];
  type Point3 = readonly [number, number, number];
  const lawnTopTriangles: number[] = [];
  const lawnBankTriangles: number[] = [];
  const courtCutTriangles: number[] = [];
  const triangle = (
    target: number[],
    a: readonly [number, number, number],
    b: readonly [number, number, number],
    c: readonly [number, number, number],
  ): void => {
    target.push(...a, ...b, ...c);
  };
  const upwardTriangle = (
    target: number[],
    a: readonly [number, number, number],
    b: readonly [number, number, number],
    c: readonly [number, number, number],
  ): void => {
    const normalY =
      (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    if (normalY < 0) {
      triangle(target, a, c, b);
      return;
    }
    triangle(target, a, b, c);
  };

  const stationCount = 33;
  const firstRiseAmount = 1 / (stationCount - 1);
  const stations: Array<readonly [Point3, Point3, Point3, Point3]> = [];
  for (let index = 0; index < stationCount; index += 1) {
    const amount = index / (stationCount - 1);
    const longitudinalAmount = Math.max(
      0,
      (amount - firstRiseAmount) / (1 - firstRiseAmount),
    );
    const eased =
      longitudinalAmount * longitudinalAmount * (3 - 2 * longitudinalAmount);
    const west = lerpPoint(westEnd, westCourt, amount);
    const east = lerpPoint(eastEnd, eastCourt, amount);
    const toeY = groundY - TILLA_DURIEUX_PROFILE.terrainBuryM;
    // Both mapped boundaries are the foot of the bank. The broad middle is a
    // single cross-falling lawn plane, never a second slab laid on top. A short
    // rise inside the outer end avoids an artificial vertical cut face.
    const endRise = Math.min(1, amount * (stationCount - 1));
    const westHeight =
      profile.endHeightsM.west * (1 - eased) +
      profile.courtHeightsM.west * eased;
    const eastHeight =
      profile.endHeightsM.east * (1 - eased) +
      profile.courtHeightsM.east * eased;
    const westShoulderY =
      toeY + (westHeight + TILLA_DURIEUX_PROFILE.terrainBuryM) * endRise;
    const eastShoulderY =
      toeY + (eastHeight + TILLA_DURIEUX_PROFILE.terrainBuryM) * endRise;
    const westShoulder = lerpPoint(west, east, 0.1);
    const eastShoulder = lerpPoint(west, east, 0.9);
    stations.push([
      [west[0], toeY, west[1]],
      [westShoulder[0], westShoulderY, westShoulder[1]],
      [eastShoulder[0], eastShoulderY, eastShoulder[1]],
      [east[0], toeY, east[1]],
    ]);
  }

  const appendStrip = (
    target: number[],
    firstAcross: number,
    secondAcross: number,
  ): void => {
    for (let index = 0; index < stations.length - 1; index += 1) {
      const current = stations[index];
      const next = stations[index + 1];
      upwardTriangle(
        target,
        current[firstAcross],
        current[secondAcross],
        next[secondAcross],
      );
      upwardTriangle(
        target,
        current[firstAcross],
        next[secondAcross],
        next[firstAcross],
      );
    }
  };
  const highSideIsWest = profile.endHeightsM.west > profile.endHeightsM.east;
  appendStrip(highSideIsWest ? lawnBankTriangles : lawnTopTriangles, 0, 1);
  appendStrip(lawnTopTriangles, 1, 2);
  appendStrip(highSideIsWest ? lawnTopTriangles : lawnBankTriangles, 2, 3);

  const courtStation = stations.at(-1)!;
  const cutBottomY = groundY - TILLA_DURIEUX_PROFILE.terrainBuryM;
  for (let across = 0; across < courtStation.length - 1; across += 1) {
    const first = courtStation[across];
    const second = courtStation[across + 1];
    const firstBottom: Point3 = [first[0], cutBottomY, first[2]];
    const secondBottom: Point3 = [second[0], cutBottomY, second[2]];
    triangle(courtCutTriangles, first, second, secondBottom);
    triangle(courtCutTriangles, first, secondBottom, firstBottom);
  }

  const addSurface = (positions: number[], color: number): void => {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(new Float32Array(positions), 3),
    );
    geometry.computeVertexNormals();
    addCustomGeometry(builder, geometry, color, false);
  };
  // Two flat greens make the landform legible without reintroducing shaded
  // boxes: the broad turf plane stays light while only its actual 35-degree
  // drop receives the darker bank tone. Both are one continuous triangulated
  // footprint and meet exactly, so there is no stacked or coplanar geometry.
  addSurface(lawnTopTriangles, PARK_GREEN);
  addSurface(lawnBankTriangles, PARK_GREEN_BANK);
  addSurface(courtCutTriangles, PARK_CUT_STEEL);

  // Only the outside silhouette is inked. Triangulation and the two shoulder
  // seams are technical details and must not read as rectangles on the lawn.
  const inkPositions: number[] = [];
  const inkPoint = ([x, y, z]: Point3): Point3 => [x, y + 0.045, z];
  for (let index = 0; index < stations.length - 1; index += 1) {
    for (const across of [0, 3]) {
      inkPositions.push(
        ...inkPoint(stations[index][across]),
        ...inkPoint(stations[index + 1][across]),
      );
    }
  }
  inkPositions.push(
    ...inkPoint(stations[0][0]),
    ...inkPoint(stations[0][3]),
    ...inkPoint(stations.at(-1)![0]),
    ...inkPoint(stations.at(-1)![3]),
  );
  const inkGeometry = new BufferGeometry();
  inkGeometry.setAttribute(
    "position",
    new Float32BufferAttribute(new Float32Array(inkPositions), 3),
  );
  builder.edges.push(inkGeometry);
}

function addTillaDurieuxPark(
  builder: Builder,
  byName: Map<string, ExpandedLandmark>,
): void {
  if (!byName.has("Tilla-Durieux-Park")) return;

  addTillaLawnLobe(builder, TILLA_DURIEUX_PROFILE.northLawn);
  addTillaLawnLobe(builder, TILLA_DURIEUX_PROFILE.southLawn);

  const [courtX, courtZ] = TILLA_DURIEUX_PROFILE.centralCourtWorldM;
  addBox(
    builder,
    0xb8b4aa,
    courtX,
    TILLA_DURIEUX_PROFILE.groundY + 0.22,
    courtZ,
    TILLA_DURIEUX_PROFILE.centralCourtWidthM,
    0.16,
    TILLA_DURIEUX_PROFILE.centralCourtLengthM,
    -0.365,
    false,
  );
  for (let index = 0; index < TILLA_DURIEUX_PROFILE.seesawCount; index += 1) {
    const localZ = (index - 2) * 2.65;
    const [offsetX, offsetZ] = rotatedLocalOffset(0, localZ, -0.365);
    addBox(
      builder,
      0x747b7b,
      courtX + offsetX,
      TILLA_DURIEUX_PROFILE.groundY + 0.48,
      courtZ + offsetZ,
      TILLA_DURIEUX_PROFILE.seesawLengthM,
      0.18,
      0.22,
      -0.365,
    );
    addBox(
      builder,
      0x626967,
      courtX + offsetX,
      TILLA_DURIEUX_PROFILE.groundY + 0.28,
      courtZ + offsetZ,
      0.42,
      0.4,
      0.52,
      -0.365,
    );
  }
}

function addAnhalterBahnhof(
  builder: Builder,
  byName: Map<string, ExpandedLandmark>,
): void {
  const point = anchor(byName, "Anhalter Bahnhof");
  if (!point) return;
  addBox(builder, BRICK, point.x, point.y + 10, point.z, 35, 20, 7, 0.02);
  addBox(
    builder,
    DARK_BRICK,
    point.x,
    point.y + 18.5,
    point.z,
    39,
    2.2,
    8,
    0.02,
  );
  for (const x of [-12, -6, 0, 6, 12]) {
    addBox(
      builder,
      0x342e29,
      point.x + x,
      point.y + 8.2,
      point.z + 3.7,
      3.2,
      10.5,
      0.7,
      0.02,
    );
  }
  addGabledRoof(
    builder,
    BRICK,
    point.x,
    point.y + 20,
    point.z,
    35,
    9,
    6.5,
    0.02,
  );
}

function addCharlottenburgerTor(
  builder: Builder,
  byName: Map<string, ExpandedLandmark>,
): void {
  const point = anchor(byName, "Charlottenburger Tor");
  if (!point) return;
  for (const side of [-1, 1]) {
    addBox(
      builder,
      SANDSTONE,
      point.x + side * 19,
      point.y + 10,
      point.z,
      8,
      20,
      8,
      0.12,
    );
    addBox(
      builder,
      IVORY,
      point.x + side * 19,
      point.y + 20.8,
      point.z,
      10,
      2.2,
      10,
      0.12,
    );
    addCone(
      builder,
      BRONZE,
      point.x + side * 19,
      point.y + 24.3,
      point.z,
      2.5,
      5,
      12,
    );
  }
}

function createWeltBalloonEnvelopeTexture(): Texture | null {
  if (typeof document === "undefined") return null;
  const word = createLetteringTexture({
    bandHeightM: 5.65,
    bandWidthM: 17.8,
    capHeightM: 3.05,
    fieldColor: "#fbfbf7",
    letterColor: "#111416",
    text: "WELT",
    texelsPerMetre: 90,
  });
  if (!word) return null;

  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const context = canvas.getContext("2d");
  if (!context) {
    word.dispose();
    return null;
  }

  // White technical fabric, with the restrained diamond seam net visible in
  // the reference photographs. Keeping the net inside a mipmapped texture
  // avoids thousands of sub-pixel cable meshes shimmering at skyline scale.
  // The owner explicitly selected the white presentation livery; the current
  // globe photography is therefore recorded as a reference, not copied.
  context.fillStyle = "#f7f7f2";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(151, 158, 158, 0.28)";
  context.lineWidth = 1.2;
  for (let x = -canvas.height; x < canvas.width + canvas.height; x += 42) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x + 290, canvas.height);
    context.stroke();
    context.beginPath();
    context.moveTo(x + 290, 0);
    context.lineTo(x, canvas.height);
    context.stroke();
  }
  context.strokeStyle = "rgba(114, 121, 122, 0.34)";
  for (let x = 0; x <= canvas.width; x += 128) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, canvas.height);
    context.stroke();
  }

  const bandTop = 426;
  const bandHeight = 172;
  context.fillStyle = "#fbfbf7";
  context.fillRect(0, bandTop, canvas.width, bandHeight);
  context.strokeStyle = "#222628";
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(0, bandTop);
  context.lineTo(canvas.width, bandTop);
  context.moveTo(0, bandTop + bandHeight);
  context.lineTo(canvas.width, bandTop + bandHeight);
  context.stroke();

  const source = word.image as CanvasImageSource;
  const quarter = canvas.width / WELT_BALLOON_PROFILE.repeatedWordCount;
  for (
    let index = 0;
    index < WELT_BALLOON_PROFILE.repeatedWordCount;
    index += 1
  ) {
    context.drawImage(
      source,
      index * quarter + 12,
      bandTop + 8,
      quarter - 24,
      bandHeight - 16,
    );
  }
  word.dispose();

  const texture = new CanvasTexture(canvas);
  texture.anisotropy = 8;
  texture.generateMipmaps = true;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createWeltBalloon(
  byName: Map<string, ExpandedLandmark>,
): Group | null {
  const point = anchor(byName, "WELT Balloon");
  if (!point) return null;
  const profile = WELT_BALLOON_PROFILE;
  const radius = profile.envelopeDiameterM / 2;
  const envelopeCenterY = point.y + profile.envelopeCenterAboveGroundM;
  const bottomY = envelopeCenterY + radius - profile.totalHeightM;
  const gondolaCenterY = bottomY + 1.25;
  const gondolaTopY = gondolaCenterY + 1.2;
  const group = new Group();
  group.name = "WELT Balloon FK-5500/STU";
  group.userData.profile = profile;

  const texture = createWeltBalloonEnvelopeTexture();
  const envelopeGeometry = new SphereGeometry(radius, 64, 40);
  const dayMaterial = texture
    ? new MeshBasicMaterial({ map: texture })
    : new MeshBasicMaterial({ color: 0xf7f7f2 });
  const nightMaterial = texture
    ? new MeshStandardMaterial({
        emissiveMap: texture,
        map: texture,
        roughness: 0.72,
      })
    : new MeshStandardMaterial({ color: 0xf7f7f2, roughness: 0.72 });
  nightMaterial.userData.nightEmissive = 0xf4f1e8;
  nightMaterial.userData.nightEmissiveIntensity = 0.52;
  const envelope = new Mesh(envelopeGeometry, dayMaterial);
  envelope.name = "WELT Balloon white envelope with curved black lettering";
  envelope.position.set(point.x, envelopeCenterY, point.z);
  envelope.userData.dayMaterial = dayMaterial;
  envelope.userData.nightMaterial = nightMaterial;
  envelope.userData.lettering = "WELT";
  envelope.userData.letteringColor = 0x111416;
  envelope.userData.livery = "white technical fabric with black lettering";
  envelope.userData.fallbackWithoutCanvas = texture === null;
  group.add(envelope);

  const builder = createBuilder();
  const cableColor = 0x737b7c;
  const gondolaBlue = 0x243b55;
  const gondolaSteel = 0xc9cdd0;

  // Twenty-four suspension lines fan from the lower envelope into the real
  // 5.90 m ring gondola. Their 6 cm display stroke is explicitly wider than
  // the published 22 mm tether so the rig remains stable at skyline zoom.
  const suspensionY = envelopeCenterY - radius * 0.72;
  const suspensionRadius = Math.sqrt(
    radius * radius - (suspensionY - envelopeCenterY) ** 2,
  );
  for (let index = 0; index < 24; index += 1) {
    const angle = (index / 24) * Math.PI * 2;
    addBeamBetween(
      builder,
      cableColor,
      new Vector3(
        point.x + Math.cos(angle) * suspensionRadius,
        suspensionY,
        point.z + Math.sin(angle) * suspensionRadius,
      ),
      new Vector3(
        point.x + Math.cos(angle) * (profile.gondolaDiameterM / 2 - 0.12),
        gondolaTopY,
        point.z + Math.sin(angle) * (profile.gondolaDiameterM / 2 - 0.12),
      ),
      profile.displayCableStrokeM,
    );
  }

  const gondolaFloor = new CylinderGeometry(
    profile.gondolaDiameterM / 2,
    profile.gondolaDiameterM / 2,
    0.28,
    32,
  );
  gondolaFloor.translate(point.x, bottomY + 0.2, point.z);
  addCustomGeometry(builder, gondolaFloor, gondolaBlue, false);
  const fascia = new CylinderGeometry(
    profile.gondolaDiameterM / 2,
    profile.gondolaDiameterM / 2,
    0.58,
    32,
    1,
    true,
  );
  fascia.translate(point.x, bottomY + 0.62, point.z);
  addCustomGeometry(builder, fascia, gondolaBlue, false);
  for (const ringY of [bottomY + 0.88, gondolaTopY]) {
    const rail = new TorusGeometry(
      profile.gondolaDiameterM / 2 - 0.1,
      0.1,
      8,
      48,
    );
    rail.rotateX(Math.PI / 2);
    rail.translate(point.x, ringY, point.z);
    addCustomGeometry(builder, rail, gondolaSteel, false);
  }
  for (let index = 0; index < 16; index += 1) {
    const angle = (index / 16) * Math.PI * 2;
    addCylinder(
      builder,
      gondolaSteel,
      point.x + Math.cos(angle) * (profile.gondolaDiameterM / 2 - 0.12),
      (bottomY + 0.88 + gondolaTopY) / 2,
      point.z + Math.sin(angle) * (profile.gondolaDiameterM / 2 - 0.12),
      0.055,
      gondolaTopY - (bottomY + 0.88),
      8,
    );
  }
  addCylinder(
    builder,
    DARK_FRAME,
    point.x,
    (point.y + 0.8 + bottomY) / 2,
    point.z,
    profile.displayCableStrokeM,
    bottomY - point.y - 0.8,
    8,
  );

  // Circular boarding pad, protected winch and horizontal cable drum make the
  // object read as a tethered aircraft rather than an unsupported ornament.
  const pad = new CircleGeometry(6.5, 40);
  pad.rotateX(-Math.PI / 2);
  pad.translate(point.x, point.y + 0.05, point.z);
  addCustomGeometry(builder, pad, 0xc9c8c0, false);
  addBox(
    builder,
    0x4d5556,
    point.x + 2.5,
    point.y + 0.72,
    point.z + 1.7,
    3.2,
    1.35,
    2.2,
    0.12,
  );
  const drum = new CylinderGeometry(0.7, 0.7, 1.65, 16);
  drum.rotateZ(Math.PI / 2);
  drum.translate(point.x + 2.5, point.y + 0.78, point.z + 1.7);
  addCustomGeometry(builder, drum, 0x252b2d, false);
  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2;
    addCylinder(
      builder,
      0x8a8e8b,
      point.x + Math.cos(angle) * 6.2,
      point.y + 0.55,
      point.z + Math.sin(angle) * 6.2,
      0.08,
      1.1,
      8,
    );
  }
  const mechanics = finishDrawnGroup(builder, {
    name: "WELT Balloon gondola cable net and ground winch",
  });
  if (mechanics) group.add(mechanics);
  return group;
}

function addCivicAccents(
  builder: Builder,
  byName: Map<string, ExpandedLandmark>,
): void {
  const spanish = anchor(byName, "Spanische Botschaft");
  if (spanish) {
    addBox(
      builder,
      SANDSTONE,
      spanish.x,
      spanish.y + 9.5,
      spanish.z + 14,
      46,
      1.2,
      1.1,
      0.12,
    );
    addBox(
      builder,
      0x9e2928,
      spanish.x - 2,
      spanish.y + 15.5,
      spanish.z + 14,
      8,
      1.1,
      1.3,
      0.12,
    );
  }
  const cafe = anchor(byName, "Café am Neuen See");
  if (cafe) {
    for (let index = 0; index < 7; index += 1) {
      addBox(
        builder,
        index % 2 ? 0xb84335 : 0xe1d39b,
        cafe.x + 38 + index * 5,
        cafe.y + 0.45,
        cafe.z - 18 + (index % 3) * 5,
        3.8,
        0.55,
        1.2,
        0.35 + index * 0.1,
      );
    }
  }
}

function addAmanoGrandCentral(
  builder: Builder,
  byName: Map<string, ExpandedLandmark>,
): void {
  // The canonical scene always carries the adjacent Hamburger-Bahnhof anchor;
  // isolated unit-test/model calls do not need a detached AMANO at world origin.
  if (!byName.has("Hamburger Bahnhof")) return;
  const profile = AMANO_GRAND_CENTRAL_PROFILE;
  const origin = new Vector3(
    profile.centerWorldM[0],
    profile.groundY,
    profile.centerWorldM[1],
  );
  const rotation = profile.rotationY;
  const halfDepth = profile.footprintDepthM / 2;
  const halfLength = profile.footprintLengthM / 2;

  // Thin source-described facade overlays preserve the LoD2 body beneath.
  for (const side of [-1, 1]) {
    addLocalBox(
      builder,
      AMANO_CLINKER,
      origin,
      0,
      profile.groundY + 12.2,
      side * (halfDepth + 0.06),
      profile.footprintLengthM,
      17.2,
      0.16,
      rotation,
    );
    addLocalBox(
      builder,
      AMANO_GLASS,
      origin,
      0,
      profile.groundY + profile.glazedGroundFloorHeightM / 2,
      side * (halfDepth + 0.15),
      profile.footprintLengthM - 1.2,
      profile.glazedGroundFloorHeightM,
      0.16,
      rotation,
      false,
    );
    for (let bay = 0; bay < profile.windowBaysLongFacade; bay += 1) {
      for (let floor = 0; floor < 5; floor += 1) {
        const pitch =
          (profile.footprintLengthM - 3.2) / profile.windowBaysLongFacade;
        const stagger = floor % 2 === 0 ? 0.36 : -0.36;
        const localX =
          -profile.footprintLengthM / 2 + 1.6 + (bay + 0.5) * pitch + stagger;
        if (Math.abs(localX) > halfLength - 1) continue;
        addLocalBox(
          builder,
          AMANO_GLASS,
          origin,
          localX,
          profile.groundY + 5.25 + floor * 3.25,
          side * (halfDepth + 0.16),
          1.72,
          2.28,
          0.12,
          rotation,
          false,
        );
      }
    }
    for (let floor = 0; floor <= 5; floor += 1) {
      addLocalBox(
        builder,
        AMANO_CLINKER_DARK,
        origin,
        0,
        profile.groundY + 3.82 + floor * 3.25,
        side * (halfDepth + 0.22),
        profile.footprintLengthM,
        0.12,
        0.1,
        rotation,
        false,
      );
    }
  }

  // Short facades retain the same staggered full-height openings.
  for (const side of [-1, 1]) {
    addLocalBox(
      builder,
      AMANO_CLINKER,
      origin,
      side * (halfLength + 0.06),
      profile.groundY + 12.2,
      0,
      0.16,
      17.2,
      profile.footprintDepthM,
      rotation,
    );
    addLocalBox(
      builder,
      AMANO_GLASS,
      origin,
      side * (halfLength + 0.15),
      profile.groundY + profile.glazedGroundFloorHeightM / 2,
      0,
      0.16,
      profile.glazedGroundFloorHeightM,
      profile.footprintDepthM - 1.2,
      rotation,
      false,
    );
    for (let floor = 0; floor < 5; floor += 1) {
      for (let bay = 0; bay < 6; bay += 1) {
        addLocalBox(
          builder,
          AMANO_GLASS,
          origin,
          side * (halfLength + 0.16),
          profile.groundY + 5.25 + floor * 3.25,
          -halfDepth + 2.5 + bay * 4.1 + (floor % 2 ? 0.25 : -0.25),
          0.12,
          2.38,
          1.45,
          rotation,
          false,
        );
      }
    }
  }

  // More glass and less clinker in the setback sky-bar storey.
  addLocalBox(
    builder,
    AMANO_GLASS,
    origin,
    0,
    profile.groundY + 24.7,
    0,
    35.6,
    4.8,
    19.2,
    rotation,
  );
  for (const side of [-1, 1]) {
    addLocalBox(
      builder,
      DARK_FRAME,
      origin,
      side * 17.55,
      profile.groundY + 24.7,
      0,
      0.16,
      4.8,
      19.2,
      rotation,
      false,
    );
  }
  addLocalBox(
    builder,
    AMANO_CLINKER_DARK,
    origin,
    0,
    profile.groundY + profile.officialHeightM - 0.35,
    0,
    37.2,
    0.7,
    20.8,
    rotation,
  );
  for (let index = -8; index <= 8; index += 1) {
    addLocalBox(
      builder,
      DARK_FRAME,
      origin,
      index * 2.05,
      profile.groundY + 24.7,
      halfDepth - 3.25,
      0.12,
      4.8,
      0.22,
      rotation,
      false,
    );
  }
}

function addEuropacityCompanyBuildings(
  builder: Builder,
  byName: Map<string, ExpandedLandmark>,
): void {
  const kpmg = anchor(byName, "KPMG Europacity");
  const dkb = anchor(byName, "DKB Campus Upbeat");
  if (!kpmg && !dkb) return;
  if (kpmg) {
    addEinzFacadeScreen(builder);
    addEuropaplatzNorth(builder);
    addLehrterCampusConstruction(builder);
  }
  addFiftyHertzStructure(builder);
  if (dkb) addUpbeatCampus(builder);
}

function addFunboxPark(
  builder: Builder,
  byName: Map<string, ExpandedLandmark>,
): void {
  if (!byName.has("Oggi's Gemüsekebab")) return;
  const profile = NORTHERN_CITY_PROFILE.funbox;
  const origin = new Vector3(
    profile.centerWorldM[0],
    profile.groundY,
    profile.centerWorldM[1],
  );
  const rotation = profile.rotationY;
  const at = (localX: number, localZ: number): [number, number] => {
    const [offsetX, offsetZ] = rotatedLocalOffset(localX, localZ, rotation);
    return [origin.x + offsetX, origin.z + offsetZ];
  };
  const localCylinder = (
    color: number,
    localX: number,
    centerY: number,
    localZ: number,
    radius: number,
    height: number,
    segments = 12,
  ): void => {
    const [x, z] = at(localX, localZ);
    addCylinder(builder, color, x, centerY, z, radius, height, segments);
  };
  const localCone = (
    color: number,
    localX: number,
    centerY: number,
    localZ: number,
    radius: number,
    height: number,
  ): void => {
    const [x, z] = at(localX, localZ);
    addCone(builder, color, x, centerY, z, radius, height, 12);
  };
  const localInflatedShape = (
    color: number,
    localX: number,
    centerY: number,
    localZ: number,
    scaleX: number,
    scaleY: number,
    scaleZ: number,
    lamp = false,
  ): void => {
    const shape = new SphereGeometry(1, 12, 7);
    shape.scale(scaleX, scaleY, scaleZ);
    const [x, z] = at(localX, localZ);
    transformGeometry(shape, x, centerY, z, rotation);
    addCustomGeometry(builder, shape, color, false, lamp);
  };

  const zoneColors = [
    FUNBOX_RED,
    FUNBOX_ORANGE,
    FUNBOX_BLUE,
    FUNBOX_GREEN,
    FUNBOX_PURPLE,
    FUNBOX_YELLOW,
    FUNBOX_RED,
    FUNBOX_BLUE,
    FUNBOX_GREEN,
    FUNBOX_ORANGE,
  ] as const;
  const zoneDepth = profile.footprintLengthM / profile.sourceZoneCount;
  for (let zone = 0; zone < profile.sourceZoneCount; zone += 1) {
    const localZ = -profile.footprintLengthM / 2 + zoneDepth * (zone + 0.5);
    addLocalBox(
      builder,
      zoneColors[zone],
      origin,
      0,
      profile.groundY + 0.28,
      localZ,
      profile.footprintWidthM - 2.4,
      0.56,
      zoneDepth - 0.18,
      rotation,
      false,
    );
    // Closely spaced inflated ribs keep the broad pad recognisable from above
    // without introducing a texture or copying the supplied photographs.
    for (let rib = -3; rib <= 3; rib += 1) {
      addLocalBox(
        builder,
        zoneColors[(zone + 2) % zoneColors.length],
        origin,
        0,
        profile.groundY + 0.62,
        localZ + rib * 1.12,
        profile.footprintWidthM - 4.2,
        0.18,
        0.26,
        rotation,
        false,
      );
    }
  }

  // Inflated perimeter tubes and coloured corner cushions define the full
  // 4,000 m² event footprint while retaining the narrow north/south layout.
  for (const side of [-1, 1]) {
    addLocalBox(
      builder,
      side < 0 ? FUNBOX_BLUE : FUNBOX_GREEN,
      origin,
      side * (profile.footprintWidthM / 2 - 0.7),
      profile.groundY + 1.05,
      0,
      1.4,
      1.65,
      profile.footprintLengthM,
      rotation,
    );
  }
  for (const side of [-1, 1]) {
    if (side > 0) {
      for (const [localX, width, color] of [
        [-15.5, 13, FUNBOX_YELLOW],
        [15.5, 13, FUNBOX_RED],
      ] as const) {
        addLocalBox(
          builder,
          color,
          origin,
          localX,
          profile.groundY + 1.05,
          profile.footprintLengthM / 2 - 0.7,
          width,
          1.65,
          1.4,
          rotation,
        );
      }
      continue;
    }
    addLocalBox(
      builder,
      FUNBOX_YELLOW,
      origin,
      0,
      profile.groundY + 1.05,
      side * (profile.footprintLengthM / 2 - 0.7),
      profile.footprintWidthM,
      1.65,
      1.4,
      rotation,
    );
  }
  for (const [localX, localZ, color] of [
    [-21.3, -47.3, FUNBOX_BLUE],
    [21.3, -47.3, FUNBOX_GREEN],
    [-21.3, 47.3, FUNBOX_YELLOW],
    [21.3, 47.3, FUNBOX_RED],
  ] as const) {
    localInflatedShape(
      color,
      localX,
      profile.groundY + 1.15,
      localZ,
      1.55,
      1.15,
      1.55,
    );
  }

  // The five-metre slide is the tallest published attraction. Parallel green
  // and yellow lanes reproduce its observed reading without photo textures.
  const [slideX, slideZ] = at(-10.5, -30.5);
  addRamp(
    builder,
    FUNBOX_GREEN,
    slideX,
    profile.groundY + 0.62,
    slideZ,
    14,
    22,
    5,
    rotation,
  );
  for (const localX of [-5.3, 0, 5.3]) {
    const [railX, railZ] = at(-10.5 + localX, -30.5);
    addRamp(
      builder,
      FUNBOX_YELLOW,
      railX,
      profile.groundY + 0.76,
      railZ,
      0.64,
      22.2,
      5.05,
      rotation,
    );
  }
  addLocalBox(
    builder,
    FUNBOX_BLUE,
    origin,
    -10.5,
    profile.groundY + 3.3,
    -42,
    15.5,
    5.4,
    4.4,
    rotation,
  );

  // Castle-like inflatable turrets, circular challenge and obstacle forest.
  for (const [localX, localZ, shaft, roof] of [
    [-17, -42, FUNBOX_GREEN, FUNBOX_YELLOW],
    [15.5, -39, FUNBOX_BLUE, FUNBOX_RED],
    [-17.5, 20, FUNBOX_PURPLE, FUNBOX_YELLOW],
    [16, 13, FUNBOX_GREEN, FUNBOX_RED],
    [15, 37, FUNBOX_BLUE, FUNBOX_YELLOW],
  ] as const) {
    localCylinder(shaft, localX, profile.groundY + 3.4, localZ, 2.35, 5.8);
    localInflatedShape(
      FUNBOX_RED,
      localX,
      profile.groundY + 4.2,
      localZ,
      2.5,
      0.7,
      2.5,
    );
    localCone(roof, localX, profile.groundY + 7.5, localZ, 2.5, 3.0);
  }
  const [ringX, ringZ] = at(-8, -5);
  const challengeRing = new TorusGeometry(5.2, 1.15, 8, 24);
  challengeRing.rotateX(Math.PI / 2);
  challengeRing.rotateY(rotation);
  challengeRing.translate(ringX, profile.groundY + 1.25, ringZ);
  addCustomGeometry(builder, challengeRing, FUNBOX_YELLOW, false);
  localInflatedShape(
    FUNBOX_GREEN,
    -8,
    profile.groundY + 1.2,
    -5,
    2.2,
    0.8,
    2.2,
  );
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 5; column += 1) {
      const colors = [FUNBOX_RED, FUNBOX_BLUE, FUNBOX_YELLOW] as const;
      localCylinder(
        colors[(row + column) % colors.length],
        -12 + column * 5.8,
        profile.groundY + 2.0,
        6 + row * 5.2,
        0.82,
        3.0,
        10,
      );
    }
  }
  for (const [localX, localZ, color, scaleX, scaleY, scaleZ] of [
    [5, -15, FUNBOX_PINK, 4.4, 2.4, 4.0],
    [13, -9, FUNBOX_ORANGE, 3.2, 2.0, 3.6],
    [-13, 33, FUNBOX_GREEN, 3.8, 2.2, 3.1],
  ] as const) {
    localInflatedShape(
      color,
      localX,
      profile.groundY + scaleY,
      localZ,
      scaleX,
      scaleY,
      scaleZ,
    );
  }

  // The Heidestrasse street view shows a low green inflated reception dome,
  // illustrated hoarding, a narrow gate and a separate pale ticket container.
  // These untextured primitives reproduce that hierarchy without copying the
  // supplied photograph or moving the source-constrained event footprint.
  localInflatedShape(
    FUNBOX_GREEN,
    -5.6,
    profile.groundY + profile.entranceDomeHeightM / 2,
    43.1,
    profile.entranceDomeWidthM / 2,
    profile.entranceDomeHeightM / 2,
    7.1,
  );
  for (const localX of [-9.4, -2.1]) {
    addLocalBox(
      builder,
      DARK_FRAME,
      origin,
      localX,
      profile.groundY + 4.75,
      49.72,
      3.65,
      1.8,
      0.16,
      rotation,
      false,
    );
  }
  const hoardingColors = [
    IVORY,
    FUNBOX_PINK,
    FUNBOX_PURPLE,
    IVORY,
    FUNBOX_PINK,
    FUNBOX_BLUE,
  ] as const;
  for (let panel = 0; panel < profile.entranceHoardingPanelCount; panel += 1) {
    const localX = -19.05 + panel * 3.35;
    addLocalBox(
      builder,
      hoardingColors[panel],
      origin,
      localX,
      profile.groundY + 1.45,
      52.25,
      3.18,
      2.9,
      0.3,
      rotation,
    );
    localInflatedShape(
      zoneColors[(panel + 4) % zoneColors.length],
      localX,
      profile.groundY + 1.55,
      52.43,
      0.42,
      0.58,
      0.12,
    );
  }
  for (const localX of [2.2, 6.5]) {
    addLocalBox(
      builder,
      DARK_FRAME,
      origin,
      localX,
      profile.groundY + 1.75,
      52.4,
      0.3,
      3.5,
      0.3,
      rotation,
    );
  }
  addLocalBox(
    builder,
    FUNBOX_PINK,
    origin,
    4.35,
    profile.groundY + 3.44,
    52.4,
    4.75,
    0.36,
    0.72,
    rotation,
  );
  addLocalBox(
    builder,
    IVORY,
    origin,
    13,
    profile.groundY + 1.72,
    53.25,
    8.2,
    3.44,
    4.6,
    rotation,
  );
  addLocalBox(
    builder,
    FUNBOX_PURPLE,
    origin,
    13,
    profile.groundY + 2.2,
    55.62,
    5.2,
    1.45,
    0.18,
    rotation,
    false,
  );
  addLocalBox(
    builder,
    DARK_FRAME,
    origin,
    13,
    profile.groundY + 2.14,
    55.74,
    3.9,
    1.12,
    0.12,
    rotation,
    false,
  );
  addLocalBox(
    builder,
    IVORY,
    origin,
    13,
    profile.groundY + 3.64,
    53.25,
    8.7,
    0.4,
    5.05,
    rotation,
  );
  addLocalBox(
    builder,
    FUNBOX_PINK,
    origin,
    13,
    profile.groundY + 1.34,
    56.02,
    5.4,
    0.22,
    0.72,
    rotation,
  );
  for (const side of [-1, 1]) {
    for (let localZ = -38; localZ <= 38; localZ += 12.5) {
      localInflatedShape(
        FUNBOX_YELLOW,
        side * 20.6,
        profile.groundY + 3.2,
        localZ,
        0.24,
        0.24,
        0.24,
        true,
      );
    }
  }
}

function addRooftopSigns(
  group: Group,
  byName: Map<string, ExpandedLandmark>,
): void {
  const hamburger = anchor(byName, "Hamburger Bahnhof");
  if (hamburger) {
    const profile = HAMBURGER_BAHNHOF_PROFILE;
    const facadeX =
      hamburger.x +
      profile.facadeOffsetFromLandmarkM[0] +
      profile.facadeNormal[0] * 0.42;
    const facadeZ =
      hamburger.z +
      profile.facadeOffsetFromLandmarkM[1] +
      profile.facadeNormal[1] * 0.42;
    const sign = createLetterSign(
      "VERKEHRS UND BAUMUSEUM",
      8.6,
      0.72,
      new Vector3(facadeX, hamburger.y + 13.0, facadeZ),
      profile.facadeRotationY,
      "#e7dfcf",
      "#766c5f",
    );
    if (sign) {
      sign.name = "Hamburger Bahnhof facade inscription";
      group.add(sign);
    }
  }
  if (byName.has("Hamburger Bahnhof")) {
    const amano = AMANO_GRAND_CENTRAL_PROFILE;
    const [amanoOffsetX, amanoOffsetZ] = rotatedLocalOffset(
      0,
      amano.footprintDepthM / 2 + 0.24,
      amano.rotationY,
    );
    const amanoSign = createLetterSign(
      "AMANO GRAND CENTRAL",
      15.5,
      1.35,
      new Vector3(
        amano.centerWorldM[0] + amanoOffsetX,
        amano.groundY + 20.7,
        amano.centerWorldM[1] + amanoOffsetZ,
      ),
      amano.rotationY,
      "#c5bbab",
      "#3f3c38",
    );
    if (amanoSign) {
      amanoSign.name = "AMANO Grand Central facade lettering";
      group.add(amanoSign);
    }
  }
  const kpmg = anchor(byName, "KPMG Europacity");
  if (kpmg) {
    const profile = EUROPACITY_PROFILE.einz;
    const [frontOffsetX, frontOffsetZ] = rotatedLocalOffset(
      -13.4,
      -(profile.footprintDepthM / 2 + 0.42),
      profile.rotationY,
    );
    const frontSign = createLetterSign(
      "KPMG",
      5.7,
      1.35,
      new Vector3(
        profile.centerWorldM[0] + frontOffsetX,
        profile.groundY + profile.measuredHeightM - 4.15,
        profile.centerWorldM[1] + frontOffsetZ,
      ),
      profile.rotationY + Math.PI,
      "#627b83",
      "#f4f1e7",
    );
    if (frontSign) {
      frontSign.name = "KPMG rooftop lettering";
      group.add(frontSign);
    }
    const [sideOffsetX, sideOffsetZ] = rotatedLocalOffset(
      profile.footprintLengthM / 2 + 0.42,
      -5.7,
      profile.rotationY,
    );
    const sideSign = createLetterSign(
      "KPMG",
      5.7,
      1.35,
      new Vector3(
        profile.centerWorldM[0] + sideOffsetX,
        profile.groundY + profile.measuredHeightM - 4.15,
        profile.centerWorldM[1] + sideOffsetZ,
      ),
      profile.rotationY + Math.PI / 2,
      "#627b83",
      "#f4f1e7",
    );
    if (sideSign) {
      sideSign.name = "KPMG side lettering";
      group.add(sideSign);
    }
  }
  const dkb = anchor(byName, "DKB Campus Upbeat");
  if (dkb) {
    const profile = EUROPACITY_PROFILE.upbeat;
    const sign = createLetterSign(
      "DKB",
      17,
      4.6,
      new Vector3(-636.87, profile.groundY + profile.heightM - 5.8, -1945.96),
      2.828,
      "#f2f6f6",
      "#1479b8",
    );
    if (sign) group.add(sign);
  }
  if (byName.has("Oggi's Gemüsekebab")) {
    const profile = NORTHERN_CITY_PROFILE.funbox;
    const origin = new Vector3(
      profile.centerWorldM[0],
      profile.groundY,
      profile.centerWorldM[1],
    );
    const funOffset = rotatedLocalOffset(-8.15, 50.28, profile.rotationY);
    const fun = createLetterSign(
      "FUN",
      4.1,
      1.3,
      new Vector3(
        origin.x + funOffset[0],
        profile.groundY + 5.4,
        origin.z + funOffset[1],
      ),
      profile.rotationY,
      "#6f9a72",
      "#d68ca6",
    );
    if (fun) {
      fun.name = "FUNBOX.COM entrance dome FUN lettering";
      group.add(fun);
    }
    const boxOffset = rotatedLocalOffset(-2.75, 50.28, profile.rotationY);
    const box = createLetterSign(
      "BOX.COM",
      6.4,
      1.25,
      new Vector3(
        origin.x + boxOffset[0],
        profile.groundY + 5.35,
        origin.z + boxOffset[1],
      ),
      profile.rotationY,
      "#6f9a72",
      "#ead878",
    );
    if (box) {
      box.name = "FUNBOX.COM entrance dome BOX.COM lettering";
      group.add(box);
    }
    const kioskOffset = rotatedLocalOffset(13, 55.83, profile.rotationY);
    const tickets = createLetterSign(
      "TICKETS",
      4.8,
      0.74,
      new Vector3(
        origin.x + kioskOffset[0],
        profile.groundY + 2.15,
        origin.z + kioskOffset[1],
      ),
      profile.rotationY,
      "#2b3535",
      "#f3eadb",
    );
    if (tickets) {
      tickets.name = "FUNBOX ticket kiosk lettering";
      group.add(tickets);
    }
  }
  if (!byName.has("Mall of Berlin")) return;
  const spielbank = createLetterSign(
    "SPIELBANK BERLIN",
    15,
    1.7,
    new Vector3(
      POTSDAMER_DETAIL_PROFILE.spielbankWorldM[0],
      15.6,
      POTSDAMER_DETAIL_PROFILE.spielbankWorldM[1] - 0.6,
    ),
    -0.03,
    "#3b2724",
    "#f2c36e",
  );
  if (spielbank) {
    spielbank.name = "Spielbank Berlin facade lettering";
    group.add(spielbank);
  }
}

export function createExpandedCityDetails(
  landmarks: ExpandedLandmark[],
  options: ExpandedCityDetailsOptions = {},
): Group {
  const group = new Group();
  group.name = "Task-10 expanded city recognition details";
  group.userData.geometryStatus =
    "Open-data-positioned recognition details; LoD2 remains the metric building anchor; Upbeat uses its current OSM outline and published tier heights";
  const byName = new Map(
    landmarks.map((landmark) => [landmark.name, landmark]),
  );
  group.userData.berlinModern = BERLIN_MODERN_PROFILE;
  group.userData.amanoGrandCentral = AMANO_GRAND_CENTRAL_PROFILE;
  group.userData.bendlerblock = BENDLERBLOCK_PROFILE;
  group.userData.bendlerblockRenderBudget = BENDLERBLOCK_RENDER_BUDGET;
  group.userData.europacity = EUROPACITY_PROFILE;
  group.userData.hamburgerBahnhof = HAMBURGER_BAHNHOF_PROFILE;
  group.userData.kulturforum = KULTURFORUM_PROFILE;
  group.userData.kollhoffTower = KOLLHOFF_TOWER_PROFILE;
  group.userData.konradAdenauerHaus = KONRAD_ADENAUER_HAUS_PROFILE;
  group.userData.moabitPrisonPark = MOABIT_PRISON_MEMORIAL_PROFILE;
  group.userData.neueNationalgalerie = NEUE_NATIONALGALERIE_PROFILE;
  group.userData.northernCity = NORTHERN_CITY_PROFILE;
  group.userData.invalidenfriedhofDetails = INVALIDENFRIEDHOF_DETAIL_PROFILE;
  group.userData.potsdamerDetails = POTSDAMER_DETAIL_PROFILE;
  group.userData.potsdamerPublicRealm = POTSDAMER_PUBLIC_REALM_PROFILE;
  group.userData.leipzigerPlatzArchitecture =
    LEIPZIGER_PLATZ_ARCHITECTURE_PROFILE;
  group.userData.rieckhallen = RIECKHALLEN_PROFILE;
  group.userData.stMatthaeus = ST_MATTHAEUS_PROFILE;
  group.userData.socialCourt = SOCIAL_COURT_PROFILE;
  group.userData.tillaDurieux = TILLA_DURIEUX_PROFILE;
  group.userData.weltBalloon = WELT_BALLOON_PROFILE;
  group.userData.cityWest = CITY_WEST_PROFILE;
  group.userData.sourceUrls = [
    ...SOCIAL_COURT_PROFILE.sourceUrls,
    ...BENDLERBLOCK_PROFILE.sources,
    "https://tchobanvoss.de/de/projects/hotels-am-hauptbahnhof",
    "https://www.berlin.de/tourismus/parks-und-gaerten/4216129-1740419-geschichtspark-zellengefaengnis-moabit.html",
    "https://www.berlin.de/kunst-und-kultur-mitte/geschichte/erinnerungskultur/gedenktafel-datenbank/id-2459_zellengefaengnis-erlaeuterung.pdf",
    "https://www.smb.museum/museen-einrichtungen/kulturforum/museumsgebaeude-sammlungen/ueberblick/",
    "https://staatsbibliothek-berlin.de/die-staatsbibliothek/die-gebaeude/potsdamer-strasse/baugeschichte",
    "https://www.berliner-philharmoniker.de/ueber-uns/philharmonie/kammermusiksaal/der-bau-des-kammermusiksaals/",
    "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050277",
    ...POTSDAMER_DETAIL_PROFILE.georgElser.sourceUrls,
    ...POTSDAMER_DETAIL_PROFILE.stationEntranceHalls.sources,
    ...POTSDAMER_DETAIL_PROFILE.bahnTower.sources,
    ...POTSDAMER_PUBLIC_REALM_PROFILE.sourceUrls,
    ...LEIPZIGER_PLATZ_ARCHITECTURE_PROFILE.mall.sources,
    ...LEIPZIGER_PLATZ_ARCHITECTURE_PROFILE.canada.sources,
    ...LEIPZIGER_PLATZ_ARCHITECTURE_PROFILE.taylorWessing.sources,
    ...LEIPZIGER_PLATZ_ARCHITECTURE_PROFILE.magentaMitte.sources,
    ...MOABIT_PRISON_MEMORIAL_PROFILE.sources,
    ...NORTHERN_CITY_PROFILE.funbox.sources,
    ...INVALIDENFRIEDHOF_DETAIL_PROFILE.walls.sourceUrls,
    ...INVALIDENFRIEDHOF_DETAIL_PROFILE.augusteViktoriaBell.sourceUrls,
    ...INVALIDENFRIEDHOF_DETAIL_PROFILE.litfinWatchtower.sourceUrls,
    NORTHERN_CITY_PROFILE.pankeMouth.sourceUrl,
    ...KONRAD_ADENAUER_HAUS_PROFILE.sources,
    ...EUROPACITY_PROFILE.sources,
    ...TILLA_DURIEUX_PROFILE.sources,
    ...WELT_BALLOON_PROFILE.sources,
    ...CITY_WEST_SOURCE_URLS,
  ];
  const builder = createBuilder();
  addHamburgerBahnhof(builder, byName);
  addRieckhallen(builder, byName);
  addKulturforum(builder, byName);
  addPotsdamerWilhelmDetails(builder, byName);
  addAnhalterBahnhof(builder, byName);
  addCharlottenburgerTor(builder, byName);
  addCivicAccents(builder, byName);
  addAmanoGrandCentral(builder, byName);
  addEuropacityCompanyBuildings(builder, byName);
  addFunboxPark(builder, byName);
  const bodies = finishDrawnGroup(builder, {
    lampEmissive: 0xffd69b,
    lampEmissiveIntensity: 0.65,
    name: "Expanded architecture and public-realm details",
  });
  if (bodies) group.add(bodies);
  group.add(createBendlerblockDetails(options.detailProfile ?? "full"));
  if (byName.has(SOCIAL_COURT_PROFILE.name)) {
    group.add(createSocialCourtDetails(options.detailProfile ?? "full"));
  }
  if (byName.has("Mall of Berlin")) {
    group.add(createLeipzigerPlatzDetails());
    group.add(createPotsdamerPlatzPublicRealm(options.detailProfile ?? "full"));
    group.add(createSonyCenterSurroundings());
  }

  const potsdamerHallBuilder = createBuilder();
  addPotsdamerEntranceHalls(potsdamerHallBuilder, byName);
  const potsdamerHalls = finishDrawnGroup(potsdamerHallBuilder, {
    name: "Potsdamer Platz station entrance halls",
  });
  if (potsdamerHalls) {
    potsdamerHalls.userData = POTSDAMER_DETAIL_PROFILE.stationEntranceHalls;
    group.add(potsdamerHalls);
  }
  addPotsdamerEntranceHallLettering(group, byName);

  if (byName.has(MOABIT_PRISON_MEMORIAL_PROFILE.name)) {
    group.add(createMoabitPrisonMemorialPark(options.detailProfile ?? "full"));
  }

  // Keep the terrain sculpture independently inspectable. It still costs one
  // merged body draw and one ink draw, but can now be QA-bounded without the
  // kilometre-wide expanded-city batch masking a misplaced lawn edge.
  const tillaBuilder = createBuilder();
  addTillaDurieuxPark(tillaBuilder, byName);
  const tilla = finishDrawnGroup(tillaBuilder, {
    name: "Tilla-Durieux-Park lawn sculpture",
  });
  if (tilla) {
    const lawn = tilla.getObjectByName(
      "Tilla-Durieux-Park lawn sculpture bodies",
    ) as Mesh | undefined;
    if (lawn) {
      const dayMaterial = lawn.userData.dayMaterial as MeshBasicMaterial;
      const nightMaterial = lawn.userData.nightMaterial as MeshStandardMaterial;
      dayMaterial.side = DoubleSide;
      nightMaterial.side = DoubleSide;
      // A stable polygon offset keeps the two exactly adjoining turf tones
      // from alternating at their shared boundary as the camera moves.
      for (const material of [dayMaterial, nightMaterial]) {
        material.polygonOffset = true;
        material.polygonOffsetFactor = -2;
        material.polygonOffsetUnits = -2;
      }
    }
    group.add(tilla);
  }

  const weltBalloon = createWeltBalloon(byName);
  if (weltBalloon) group.add(weltBalloon);

  // The cemetery is a surveyed place in its own right rather than an accent
  // attached to one of the optional recognition landmarks. Keeping it in a
  // separate batch also prevents its kilometre-distant geometry from
  // polluting local landmark bounds and culling decisions.
  const invalidenfriedhofBuilder = createBuilder();
  addInvalidenfriedhof(invalidenfriedhofBuilder);
  const invalidenfriedhof = finishDrawnGroup(invalidenfriedhofBuilder, {
    name: "Invalidenfriedhof surveyed walls and graves",
  });
  if (invalidenfriedhof) group.add(invalidenfriedhof);
  group.add(createInvalidenfriedhofDetails());

  const pankeMouthBuilder = createBuilder();
  addPankeMouthFishPass(pankeMouthBuilder);
  const pankeMouth = finishDrawnGroup(pankeMouthBuilder, {
    name: "Panke mouth fish-pass details",
  });
  if (pankeMouth) {
    pankeMouth.userData = NORTHERN_CITY_PROFILE.pankeMouth;
    group.add(pankeMouth);
  }

  const konradAdenauerBuilder = createBuilder();
  addKonradAdenauerHaus(konradAdenauerBuilder);
  const konradAdenauerHaus = finishDrawnGroup(konradAdenauerBuilder, {
    lampEmissive: 0xffd89a,
    lampEmissiveIntensity: 0.45,
    name: "Konrad-Adenauer-Haus glass envelope",
  });
  if (konradAdenauerHaus) {
    konradAdenauerHaus.userData = KONRAD_ADENAUER_HAUS_PROFILE;
    group.add(konradAdenauerHaus);
  }

  group.add(createCityWestDetails(options.detailProfile ?? "full"));

  addRooftopSigns(group, byName);
  // Tiny warm markers for snow-plough salt and balloon fittings only; this is
  // not a selection marker layer and therefore never brings back the old dots.
  group.userData.palette = { ivory: IVORY, snow: SNOW_WHITE, glass: GLASS };
  return group;
}
