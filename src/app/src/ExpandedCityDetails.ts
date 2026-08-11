import {
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  DoubleSide,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";

import { createLetteringTexture } from "./drawnLettering";
import type { FocusCamera } from "./ArchitecturalLandmarks";
import { ARCHITECTURAL_EDGE_THRESHOLD_DEGREES } from "./architecturalInk";
import {
  AMANO_GRAND_CENTRAL_PROFILE,
  BERLIN_MODERN_PROFILE,
  HAMBURGER_BAHNHOF_PROFILE,
  KULTURFORUM_PROFILE,
  KOLLHOFF_TOWER_PROFILE,
  MOABIT_PRISON_PARK_PROFILE,
  NEUE_NATIONALGALERIE_PROFILE,
  NORTHERN_CITY_PROFILE,
  POTSDAMER_DETAIL_PROFILE,
  RIECKHALLEN_PROFILE,
  ST_MATTHAEUS_PROFILE,
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

export type ExpandedLandmark = {
  name: string;
  world: [number, number, number];
};

export {
  AMANO_GRAND_CENTRAL_PROFILE,
  BERLIN_MODERN_PROFILE,
  HAMBURGER_BAHNHOF_PROFILE,
  KULTURFORUM_PROFILE,
  KOLLHOFF_TOWER_PROFILE,
  MOABIT_PRISON_PARK_PROFILE,
  NEUE_NATIONALGALERIE_PROFILE,
  NORTHERN_CITY_PROFILE,
  POTSDAMER_DETAIL_PROFILE,
  RIECKHALLEN_PROFILE,
  ST_MATTHAEUS_PROFILE,
} from "./expandedCityProfiles";

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
    azimuth_degrees: 18,
    distance_m: 232,
    polar_degrees: 64,
    target_height_m: 32,
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
    azimuth_degrees: 12,
    distance_m: 122,
    polar_degrees: 62,
    target_height_m: 18,
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
    azimuth_degrees: 25,
    distance_m: 118,
    polar_degrees: 58,
    target_height_m: 9,
  },
  "Staatsbibliothek zu Berlin (Haus Potsdamer Straße)": {
    azimuth_degrees: 24,
    distance_m: 310,
    polar_degrees: 59,
    target_height_m: 20,
  },
  "Tilla-Durieux-Park": {
    azimuth_degrees: 28,
    distance_m: 150,
    polar_degrees: 48,
    target_height_m: 2,
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
    Gemäldegalerie: KULTURFORUM_PROFILE.gemaldegalerie.centerWorldM,
    Kammermusiksaal: KULTURFORUM_PROFILE.kammermusiksaal.centerWorldM,
    "Staatsbibliothek zu Berlin (Haus Potsdamer Straße)":
      KULTURFORUM_PROFILE.staatsbibliothek.centerWorldM,
  };
  const metricTarget = metricTargetByName[landmark.name];
  const target_world: [number, number, number] = metricTarget
    ? [metricTarget[0], landmark.world[1], metricTarget[1]]
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

const IVORY = 0xeee9dc;
const SANDSTONE = 0xd8c6a8;
const GOLD = 0xd4ab4e;
const BRICK = 0xa65d45;
const DARK_BRICK = 0x79463a;
const GLASS = 0xa7d1d8;
const DARK_FRAME = 0x29373a;
const PARK_GREEN = 0x72aa68;
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
const PRISON_BRICK = 0x9d634f;
const PRISON_MORTAR = 0xd8b7a1;
const BLOOD_BEECH = 0x665d49;

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

function addSocialCourt(
  builder: Builder,
  byName: Map<string, ExpandedLandmark>,
): void {
  const point = anchor(byName, "Sozialgericht Berlin");
  if (!point) return;
  // Neo-Renaissance rhythm on the retained LoD2 body: cornices, central
  // risalit and triangular roof, not a modern replacement box.
  addBox(
    builder,
    SANDSTONE,
    point.x,
    point.y + 8,
    point.z + 22,
    46,
    1,
    1,
    -0.1,
  );
  addBox(
    builder,
    SANDSTONE,
    point.x,
    point.y + 14.4,
    point.z + 22,
    48,
    1.1,
    1,
    -0.1,
  );
  addBox(
    builder,
    IVORY,
    point.x,
    point.y + 11,
    point.z + 21.5,
    12,
    15,
    2.5,
    -0.1,
  );
  addGabledRoof(
    builder,
    DARK_BRICK,
    point.x,
    point.y + 17,
    point.z + 10,
    50,
    31,
    8,
    -0.1,
  );
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
  for (const localX of [-18, 18]) {
    addRamp(
      builder,
      0xb6aa94,
      station.x + localX,
      -1.6,
      station.z - 34,
      5.2,
      31,
      8.9,
      rotation,
    );
    addLocalBox(
      builder,
      DARK_FRAME,
      station,
      localX,
      station.y + 1.15,
      -48,
      8.4,
      2.3,
      4.8,
      rotation,
    );
    addLocalBox(
      builder,
      GLASS,
      station,
      localX,
      station.y + 3.25,
      -48,
      9.4,
      0.28,
      5.8,
      rotation,
    );
  }
}

function addPotsdamerWilhelmDetails(
  builder: Builder,
  byName: Map<string, ExpandedLandmark>,
): void {
  if (!byName.has("Mall of Berlin")) return;
  addPotsdamerUndergroundStation(builder);
  const profile = POTSDAMER_DETAIL_PROFILE;

  const mall = anchor(byName, "Mall of Berlin");
  if (mall) {
    // Two deep-looking pedestrian passages and their restrained stone arcade
    // identify the Leipziger-Platz block without pretending to subtract the
    // openings from the authoritative LoD2 shell.
    const facadeZ = mall.z + profile.mallSouthFacadeOffsetM;
    for (const localX of [-25, 25]) {
      addBox(
        builder,
        0x718b8b,
        mall.x + localX,
        mall.y + 5.2,
        facadeZ,
        13,
        9.8,
        0.35,
        -0.04,
        false,
      );
      for (const mullionX of [-4.2, 0, 4.2]) {
        addBox(
          builder,
          DARK_FRAME,
          mall.x + localX + mullionX,
          mall.y + 5.2,
          facadeZ - 0.22,
          0.18,
          9.1,
          0.18,
          -0.04,
          false,
        );
      }
      addBox(
        builder,
        0xb4c4bd,
        mall.x + localX,
        mall.y + 5.1,
        facadeZ - 0.24,
        12.5,
        0.18,
        0.18,
        -0.04,
        false,
      );
      for (const columnX of [-6.9, 6.9]) {
        addBox(
          builder,
          SANDSTONE,
          mall.x + localX + columnX,
          mall.y + 5.4,
          facadeZ - 0.4,
          1.15,
          10.8,
          1.15,
          -0.04,
        );
      }
      addBox(
        builder,
        IVORY,
        mall.x + localX,
        mall.y + 10.7,
        facadeZ - 0.4,
        15.2,
        1.2,
        1.35,
        -0.04,
      );
    }
  }

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

  const hessen = fixedWorldPoint(profile.hessenRepresentationWorldM);
  addLocalBox(
    builder,
    0xded7c8,
    hessen,
    0,
    hessen.y + 10.6,
    0,
    38,
    21.2,
    35,
    -0.079,
  );
  // The steel-and-glass conference volume visibly cantilevers over the garden.
  addLocalBox(
    builder,
    0x596f73,
    hessen,
    -10.5,
    hessen.y + 15.8,
    -19.2,
    24,
    8.8,
    13.5,
    -0.079,
  );
  for (let bay = -3; bay <= 3; bay += 1) {
    addLocalLampBox(
      builder,
      0x91b7ba,
      hessen,
      bay * 4.7,
      hessen.y + 9.8,
      -17.7,
      3,
      5.4,
      0.18,
      -0.079,
    );
  }

  const taylor = fixedWorldPoint(profile.taylorWessingWorldM);
  for (let floor = 0; floor < 6; floor += 1) {
    for (let bay = -4; bay <= 4; bay += 1) {
      addLocalLampBox(
        builder,
        0x6f979c,
        taylor,
        bay * 4.2,
        taylor.y + 4.2 + floor * 3.35,
        -15.1,
        2.5,
        2.15,
        0.18,
        -0.075,
      );
    }
  }

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

  const elser = fixedWorldPoint(profile.georgElserWorldM);
  // The memorial is a tall illuminated steel contour, not a conventional
  // statue. Closely spaced segments keep the line readable at isometric scale.
  for (const [dx, dy, angle, length] of [
    [0, 2.2, -0.08, 4.4],
    [-0.7, 5.6, 0.28, 3.6],
    [0.1, 8.7, -0.34, 3.3],
    [0.9, 11.8, 0.19, 3.4],
    [0.2, 14.8, -0.22, 3.2],
  ] as const) {
    addTiltedLocalBox(
      builder,
      0xe7c477,
      elser,
      dx,
      elser.y + dy,
      0,
      0.22,
      length,
      0.22,
      angle,
      0,
      false,
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

function addTillaDurieuxPark(
  builder: Builder,
  byName: Map<string, ExpandedLandmark>,
): void {
  const point = anchor(byName, "Tilla-Durieux-Park");
  if (!point) return;
  addRamp(
    builder,
    PARK_GREEN,
    point.x,
    point.y + 0.15,
    point.z,
    42,
    170,
    4.6,
    -0.22,
  );
  addRamp(
    builder,
    0x86b878,
    point.x + 39,
    point.y + 0.15,
    point.z - 8,
    37,
    154,
    3.7,
    -0.22,
  );
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

function addWeltBalloon(
  builder: Builder,
  byName: Map<string, ExpandedLandmark>,
): void {
  const point = anchor(byName, "WELT Balloon");
  if (!point) return;
  const balloon = new SphereGeometry(13.5, 24, 16);
  balloon.scale(1, 0.82, 1);
  balloon.translate(point.x, point.y + 91, point.z);
  addCustomGeometry(builder, balloon, 0xe8ddd0);
  addCylinder(builder, DARK_FRAME, point.x, point.y + 42, point.z, 0.22, 77, 8);
  addBox(builder, 0xd8b644, point.x, point.y + 75.2, point.z, 4.2, 2.1, 4.2);
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

function addMoabitPrisonPark(
  builder: Builder,
  byName: Map<string, ExpandedLandmark>,
): void {
  if (!byName.has("Geschichtspark Ehemaliges Zellengefängnis Moabit")) return;
  const profile = MOABIT_PRISON_PARK_PROFILE;
  const origin = new Vector3(
    profile.centerWorldM[0],
    profile.groundY,
    profile.centerWorldM[1],
  );
  const rotation = profile.rotationY;

  const wallSegment = (
    localX: number,
    localZ: number,
    length: number,
    alongX: boolean,
  ): void => {
    addLocalBox(
      builder,
      PRISON_BRICK,
      origin,
      localX,
      profile.groundY + profile.preservedWallHeightM / 2,
      localZ,
      alongX ? length : 0.82,
      profile.preservedWallHeightM,
      alongX ? 0.82 : length,
      rotation,
    );
    for (let course = 1; course < 10; course += 1) {
      addLocalBox(
        builder,
        PRISON_MORTAR,
        origin,
        localX,
        profile.groundY + course * 0.5,
        localZ,
        alongX ? length + 0.03 : 0.87,
        0.035,
        alongX ? 0.87 : length + 0.03,
        rotation,
        false,
      );
    }
  };

  // Three preserved five-metre wall sides, each interrupted by a documented
  // present-day entrance rather than falsely closing the park as a box.
  wallSegment(-55, -74, 82, true);
  wallSegment(57, -74, 78, true);
  wallSegment(-94, -35, 70, false);
  wallSegment(-94, 49, 82, false);
  wallSegment(-48, 78, 84, true);
  wallSegment(55, 78, 70, true);

  // Central observation area: open concrete cube inside the circular place.
  const panopticon = new RingGeometry(10.4, 10.95, 42);
  panopticon.rotateX(-Math.PI / 2);
  const [panX, panZ] = rotatedLocalOffset(-6, 1, rotation);
  panopticon.translate(
    origin.x + panX,
    profile.groundY + 0.11,
    origin.z + panZ,
  );
  addCustomGeometry(builder, panopticon, 0xc6c2b8, false);
  for (const [x, z] of [
    [-10, -3],
    [-2, -3],
    [-10, 5],
    [-2, 5],
  ] as const) {
    addLocalBox(
      builder,
      0xaba9a2,
      origin,
      x,
      profile.groundY + 1.8,
      z,
      0.65,
      3.6,
      0.65,
      rotation,
    );
  }
  addLocalBox(
    builder,
    0xaba9a2,
    origin,
    -6,
    profile.groundY + 3.35,
    1,
    8.7,
    0.55,
    8.7,
    rotation,
  );

  // Four former wings: three depressed/rising lawns and wing A as two clipped
  // blood-beech hedges with a single walk-in cell at original scale.
  for (const angle of [-0.78, 0.2, 1.18]) {
    const localX = -6 + Math.cos(angle) * 38;
    const localZ = 1 + Math.sin(angle) * 38;
    addLocalBox(
      builder,
      0x86ad72,
      origin,
      localX,
      profile.groundY + 0.14,
      localZ,
      68,
      0.28,
      11,
      rotation + angle,
      false,
    );
  }
  for (const side of [-1, 1]) {
    addLocalBox(
      builder,
      BLOOD_BEECH,
      origin,
      31,
      profile.groundY + 1.15,
      1 + side * 3.4,
      67,
      2.3,
      1.25,
      rotation,
    );
  }
  // One cell: 2.4 x 4.5 m interior, open at the path end.
  addLocalBox(
    builder,
    0xbbb8af,
    origin,
    59,
    profile.groundY + 1.45,
    -1.4,
    4.5,
    2.9,
    0.28,
    rotation,
  );
  addLocalBox(
    builder,
    0xbbb8af,
    origin,
    59,
    profile.groundY + 1.45,
    3.4,
    4.5,
    2.9,
    0.28,
    rotation,
  );
  addLocalBox(
    builder,
    0xbbb8af,
    origin,
    61.1,
    profile.groundY + 1.45,
    1,
    0.28,
    2.9,
    5.1,
    rotation,
  );

  // Three circular exercise yards, each a separate concrete trace.
  for (const [localX, localZ, radius] of [
    [-48, 34, 12],
    [-17, 49, 10],
    [18, 51, 8],
  ] as const) {
    const ring = new RingGeometry(radius - 0.32, radius + 0.32, 36);
    ring.rotateX(-Math.PI / 2);
    const [offsetX, offsetZ] = rotatedLocalOffset(localX, localZ, rotation);
    ring.translate(
      origin.x + offsetX,
      profile.groundY + 0.13,
      origin.z + offsetZ,
    );
    addCustomGeometry(builder, ring, 0xb8b4aa, false);
  }
  // The clipped blood-beech rectangle marks the former administration block.
  for (const [localX, localZ, width, depth] of [
    [-48, -35, 42, 1.4],
    [-48, -55, 42, 1.4],
    [-69, -45, 1.4, 20],
    [-27, -45, 1.4, 20],
  ] as const) {
    addLocalBox(
      builder,
      BLOOD_BEECH,
      origin,
      localX,
      profile.groundY + 1.0,
      localZ,
      width,
      2,
      depth,
      rotation,
    );
  }
}

function addEuropacityCompanyBuildings(
  builder: Builder,
  byName: Map<string, ExpandedLandmark>,
): void {
  const kpmg = anchor(byName, "KPMG Europacity");
  if (kpmg) {
    addBox(builder, IVORY, kpmg.x, kpmg.y + 7, kpmg.z, 72, 14, 48, 0.05);
    addBox(
      builder,
      0xe5e0d4,
      kpmg.x - 17,
      kpmg.y + 23,
      kpmg.z,
      34,
      32,
      42,
      0.05,
    );
    addBox(
      builder,
      SANDSTONE,
      kpmg.x + 22,
      kpmg.y + 18,
      kpmg.z - 2,
      36,
      22,
      38,
      0.05,
    );
    for (const level of [12, 17.5, 23, 28.5, 34]) {
      addBox(
        builder,
        GLASS,
        kpmg.x - 17,
        kpmg.y + level,
        kpmg.z + 21.3,
        30,
        1.8,
        0.5,
        0.05,
      );
    }
  }
  const dkb = anchor(byName, "DKB Campus Upbeat");
  if (dkb) {
    // The future DKB campus is not yet part of the authoritative LoD2 cut.
    // These stepped volumes are a labelled project approximation at the OSM
    // site anchor, kept separate from the metric inventory in buildings.gpkg.
    addBox(builder, IVORY, dkb.x, dkb.y + 7, dkb.z, 112, 14, 64, -0.18);
    addBox(
      builder,
      0xe4dfd3,
      dkb.x - 35,
      dkb.y + 36,
      dkb.z - 3,
      34,
      58,
      44,
      -0.18,
    );
    addBox(
      builder,
      0xeee9dc,
      dkb.x + 4,
      dkb.y + 40,
      dkb.z + 1,
      38,
      66,
      48,
      -0.18,
    );
    addBox(
      builder,
      SANDSTONE,
      dkb.x + 43,
      dkb.y + 30,
      dkb.z - 5,
      32,
      46,
      40,
      -0.18,
    );
    const towerBands = [
      { x: dkb.x - 35, z: dkb.z + 19.35, width: 30, top: 64 },
      { x: dkb.x + 4, z: dkb.z + 25.35, width: 34, top: 72 },
      { x: dkb.x + 43, z: dkb.z + 15.35, width: 28, top: 52 },
    ];
    for (const tower of towerBands) {
      for (let level = 14; level < tower.top; level += 5.5) {
        addBox(
          builder,
          GLASS,
          tower.x,
          dkb.y + level,
          tower.z,
          tower.width,
          1.75,
          0.5,
          -0.18,
        );
      }
      for (const offset of [-0.34, -0.17, 0, 0.17, 0.34]) {
        addBox(
          builder,
          DARK_FRAME,
          tower.x + tower.width * offset,
          dkb.y + (tower.top + 10) / 2,
          tower.z + 0.31,
          0.3,
          tower.top - 10,
          0.26,
          -0.18,
        );
      }
    }
    addBox(
      builder,
      IVORY,
      dkb.x - 35,
      dkb.y + 65.2,
      dkb.z - 3,
      36,
      1.4,
      46,
      -0.18,
    );
    addBox(
      builder,
      IVORY,
      dkb.x + 4,
      dkb.y + 73.2,
      dkb.z + 1,
      40,
      1.4,
      50,
      -0.18,
    );
    addBox(
      builder,
      SANDSTONE,
      dkb.x + 43,
      dkb.y + 53.2,
      dkb.z - 5,
      34,
      1.4,
      42,
      -0.18,
    );
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
    const sign = createLetterSign(
      "KPMG",
      14,
      3.8,
      new Vector3(kpmg.x, kpmg.y + 35, kpmg.z + 17),
      0.05,
      "#edf2f3",
      "#245ca8",
    );
    if (sign) group.add(sign);
  }
  const dkb = anchor(byName, "DKB Campus Upbeat");
  if (dkb) {
    const sign = createLetterSign(
      "DKB",
      17,
      4.6,
      new Vector3(dkb.x + 4, dkb.y + 70, dkb.z + 25.72),
      -0.18,
      "#f2f6f6",
      "#1479b8",
    );
    if (sign) group.add(sign);
  }
  const welt = anchor(byName, "WELT Balloon");
  if (welt) {
    const sign = createLetterSign(
      "WELT",
      16,
      4.8,
      new Vector3(welt.x, welt.y + 91, welt.z + 13.25),
      0,
      "#b6382f",
      "#fff7ec",
    );
    if (sign) group.add(sign);
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
  const taylor = createLetterSign(
    "TAYLOR WESSING",
    14,
    1.45,
    new Vector3(
      POTSDAMER_DETAIL_PROFILE.taylorWessingWorldM[0],
      29.2,
      POTSDAMER_DETAIL_PROFILE.taylorWessingWorldM[1] - 15.4,
    ),
    -0.075,
    "#e8e4da",
    "#29596b",
  );
  if (taylor) {
    taylor.name = "Taylor Wessing facade lettering";
    group.add(taylor);
  }
}

export function createExpandedCityDetails(
  landmarks: ExpandedLandmark[],
): Group {
  const group = new Group();
  group.name = "Task-10 expanded city recognition details";
  group.userData.geometryStatus =
    "Open-data-positioned recognition details; LoD2 remains the metric building anchor; future-project massing is explicitly approximate";
  const byName = new Map(
    landmarks.map((landmark) => [landmark.name, landmark]),
  );
  group.userData.berlinModern = BERLIN_MODERN_PROFILE;
  group.userData.amanoGrandCentral = AMANO_GRAND_CENTRAL_PROFILE;
  group.userData.hamburgerBahnhof = HAMBURGER_BAHNHOF_PROFILE;
  group.userData.kulturforum = KULTURFORUM_PROFILE;
  group.userData.kollhoffTower = KOLLHOFF_TOWER_PROFILE;
  group.userData.moabitPrisonPark = MOABIT_PRISON_PARK_PROFILE;
  group.userData.neueNationalgalerie = NEUE_NATIONALGALERIE_PROFILE;
  group.userData.potsdamerDetails = POTSDAMER_DETAIL_PROFILE;
  group.userData.rieckhallen = RIECKHALLEN_PROFILE;
  group.userData.stMatthaeus = ST_MATTHAEUS_PROFILE;
  group.userData.sourceUrls = [
    "https://tchobanvoss.de/de/projects/hotels-am-hauptbahnhof",
    "https://www.berlin.de/tourismus/parks-und-gaerten/4216129-1740419-geschichtspark-zellengefaengnis-moabit.html",
    "https://www.berlin.de/kunst-und-kultur-mitte/geschichte/erinnerungskultur/gedenktafel-datenbank/id-2459_zellengefaengnis-erlaeuterung.pdf",
    "https://www.smb.museum/museen-einrichtungen/kulturforum/museumsgebaeude-sammlungen/ueberblick/",
    "https://staatsbibliothek-berlin.de/die-staatsbibliothek/die-gebaeude/potsdamer-strasse/baugeschichte",
    "https://www.berliner-philharmoniker.de/ueber-uns/philharmonie/kammermusiksaal/der-bau-des-kammermusiksaals/",
    "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050277",
  ];
  const builder = createBuilder();
  addHamburgerBahnhof(builder, byName);
  addRieckhallen(builder, byName);
  addSocialCourt(builder, byName);
  addKulturforum(builder, byName);
  addPotsdamerWilhelmDetails(builder, byName);
  addTillaDurieuxPark(builder, byName);
  addAnhalterBahnhof(builder, byName);
  addCharlottenburgerTor(builder, byName);
  addWeltBalloon(builder, byName);
  addCivicAccents(builder, byName);
  addAmanoGrandCentral(builder, byName);
  addMoabitPrisonPark(builder, byName);
  addEuropacityCompanyBuildings(builder, byName);
  const bodies = finishDrawnGroup(builder, {
    lampEmissive: 0xffd69b,
    lampEmissiveIntensity: 0.65,
    name: "Expanded architecture and public-realm details",
  });
  if (bodies) group.add(bodies);
  addRooftopSigns(group, byName);
  // Tiny warm markers for snow-plough salt and balloon fittings only; this is
  // not a selection marker layer and therefore never brings back the old dots.
  group.userData.palette = { ivory: IVORY, snow: SNOW_WHITE, glass: GLASS };
  return group;
}
