import {
  BufferGeometry,
  DoubleSide,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";

import { createLetteringTexture } from "./drawnLettering";
import type { FocusCamera } from "./ArchitecturalLandmarks";
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
    azimuth_degrees: 8,
    distance_m: 150,
    polar_degrees: 58,
    target_height_m: 10,
  },
  "KPMG Europacity": {
    azimuth_degrees: 12,
    distance_m: 122,
    polar_degrees: 62,
    target_height_m: 18,
  },
  Rieckhallen: {
    azimuth_degrees: 72,
    distance_m: 190,
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
    azimuth_degrees: 28,
    distance_m: 158,
    polar_degrees: 58,
    target_height_m: 13,
  },
};

export function expandedCityFocusCamera(
  landmark: ExpandedLandmark,
): FocusCamera | null {
  const preset = EXPANDED_FOCUS_PRESETS[landmark.name];
  return preset ? { ...preset, target_world: landmark.world } : null;
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
): void {
  if (!geometry.index) {
    const count = geometry.getAttribute("position").count;
    geometry.setIndex(Array.from({ length: count }, (_, index) => index));
  }
  paintGeometry(geometry, color);
  builder.parts.push(geometry);
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
  const y = point.y + 15.5;
  addBox(builder, IVORY, point.x, y, point.z + 44, 46, 12, 7, -0.04);
  for (const offset of [-16, -8, 0, 8, 16]) {
    addCylinder(
      builder,
      SANDSTONE,
      point.x + offset,
      point.y + 10.2,
      point.z + 48,
      0.72,
      10,
      12,
    );
  }
  addGabledRoof(
    builder,
    SANDSTONE,
    point.x,
    point.y + 21.5,
    point.z + 43,
    51,
    16,
    8,
    -0.04,
  );
  // Forecourt paving and the two restrained tree rows absent from the old crop.
  addBox(
    builder,
    0xd9d5ca,
    point.x,
    point.y + 0.1,
    point.z + 77,
    72,
    0.2,
    40,
    -0.04,
    false,
  );
}

function addRieckhallen(
  builder: Builder,
  byName: Map<string, ExpandedLandmark>,
): void {
  const point = anchor(byName, "Rieckhallen");
  if (!point) return;
  for (let index = -2; index <= 2; index += 1) {
    addGabledRoof(
      builder,
      0xc8c4ba,
      point.x + index * 17,
      point.y + 10.5,
      point.z,
      15,
      76,
      5.4,
      0.08,
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
  const modern = anchor(byName, "berlin modern — Museum des 20. Jahrhunderts");
  if (modern) {
    addGabledRoof(
      builder,
      0xb59b76,
      modern.x,
      modern.y + 20,
      modern.z,
      88,
      72,
      20,
      0.02,
    );
    addBox(
      builder,
      DARK_FRAME,
      modern.x,
      modern.y + 10,
      modern.z + 36,
      42,
      8,
      1.2,
      0.02,
    );
  }
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
