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
import {
  BERLIN_MODERN_PROFILE,
  HAMBURGER_BAHNHOF_PROFILE,
  RIECKHALLEN_PROFILE,
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
  BERLIN_MODERN_PROFILE,
  HAMBURGER_BAHNHOF_PROFILE,
  RIECKHALLEN_PROFILE,
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
  "KPMG Europacity": {
    azimuth_degrees: 12,
    distance_m: 122,
    polar_degrees: 62,
    target_height_m: 18,
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
  const target_world: [number, number, number] =
    landmark.name === "Hamburger Bahnhof"
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
const BERLIN_MODERN_ROOF = 0x354346;
const BERLIN_MODERN_PV_SEAM = 0x6d8587;

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
    builder.edges.push(new EdgesGeometry(geometry, 24));
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

function addKulturforum(
  builder: Builder,
  byName: Map<string, ExpandedLandmark>,
): void {
  const phil = anchor(byName, "Berliner Philharmonie");
  if (phil) {
    for (const [dx, dz, width, depth, rise] of [
      [-28, -5, 49, 44, 13],
      [17, 8, 54, 51, 17],
      [4, -28, 42, 34, 11],
    ] as const) {
      addGabledRoof(
        builder,
        GOLD,
        phil.x + dx,
        phil.y + 24,
        phil.z + dz,
        width,
        depth,
        rise,
        -0.24,
      );
    }
  }
  const chamber = anchor(byName, "Kammermusiksaal");
  if (chamber) {
    addGabledRoof(
      builder,
      0xcaa34c,
      chamber.x,
      chamber.y + 18,
      chamber.z,
      68,
      58,
      16,
      0.22,
    );
    addBox(
      builder,
      0x8d6e38,
      chamber.x,
      chamber.y + 12,
      chamber.z + 30,
      52,
      2,
      1.2,
      0.22,
    );
  }
  const library = anchor(
    byName,
    "Staatsbibliothek zu Berlin (Haus Potsdamer Straße)",
  );
  if (library) {
    for (let index = -3; index <= 3; index += 1) {
      addBox(
        builder,
        0xcca849,
        library.x + index * 22,
        library.y + 19,
        library.z - 28,
        18,
        4,
        3,
        -0.07,
      );
    }
  }
  addBerlinModern(builder, byName);
  const national = anchor(byName, "Neue Nationalgalerie");
  if (national) {
    addBox(
      builder,
      0x252b2c,
      national.x,
      national.y + 9.1,
      national.z,
      66,
      1.4,
      66,
      0,
    );
    for (const x of [-29, 29]) {
      for (const z of [-29, 29]) {
        addBox(
          builder,
          DARK_FRAME,
          national.x + x,
          national.y + 5,
          national.z + z,
          0.8,
          8,
          0.8,
        );
      }
    }
  }
  const archer = anchor(byName, "Der Bogenschütze (Henry Moore)");
  if (archer) {
    const torus = new TorusGeometry(4.2, 0.7, 8, 24, Math.PI * 1.35);
    torus.rotateX(Math.PI / 2);
    torus.rotateZ(-0.42);
    torus.translate(archer.x, archer.y + 4.8, archer.z);
    addCustomGeometry(builder, torus, BRONZE);
  }
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
  const kollhoff = anchor(byName, "Kollhoff-Tower");
  if (kollhoff) {
    for (let level = 0; level < 7; level += 1) {
      const size = 29 - level * 2.5;
      addBox(
        builder,
        level % 2 ? BRICK : DARK_BRICK,
        kollhoff.x,
        kollhoff.y + 45 + level * 4.1,
        kollhoff.z,
        size,
        1.1,
        size,
        -0.06,
      );
    }
  }
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
  group.userData.hamburgerBahnhof = HAMBURGER_BAHNHOF_PROFILE;
  group.userData.rieckhallen = RIECKHALLEN_PROFILE;
  const builder = createBuilder();
  addHamburgerBahnhof(builder, byName);
  addRieckhallen(builder, byName);
  addSocialCourt(builder, byName);
  addKulturforum(builder, byName);
  addTillaDurieuxPark(builder, byName);
  addAnhalterBahnhof(builder, byName);
  addCharlottenburgerTor(builder, byName);
  addWeltBalloon(builder, byName);
  addCivicAccents(builder, byName);
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
