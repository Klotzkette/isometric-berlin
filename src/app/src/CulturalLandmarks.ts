import {
  BoxGeometry,
  BufferGeometry,
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  LatheGeometry,
  Material,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PointLight,
  SphereGeometry,
  Vector2,
  Vector3,
} from "three";

export type CulturalLandmark = {
  name: string;
  world: [number, number, number];
};

export type CulturalFocusCamera = {
  azimuth_degrees: number;
  distance_m: number;
  polar_degrees: number;
  target_height_m: number;
  target_world: [number, number, number];
};

type InstanceTransform = {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
};

const TIPI_NAME = "TIPI am Kanzleramt";
const CARILLON_NAME = "Carillon im Tiergarten";
const SPREEBOGEN_NAME = "Spreebogen";
const TIPI_GROUND_Y = 3.98;
const CARILLON_GROUND_Y = 3.778;
const BOAT_WORLD: [number, number, number] = [-259.21, 1.249, -219.53];

function modelMaterial(
  color: number,
  options: {
    metalness?: number;
    opacity?: number;
    roughness?: number;
  } = {},
): MeshStandardMaterial {
  const opacity = options.opacity ?? 1;
  return new MeshStandardMaterial({
    color,
    flatShading: true,
    metalness: options.metalness ?? 0.04,
    opacity,
    polygonOffset: true,
    polygonOffsetFactor: -1.1,
    polygonOffsetUnits: -1.1,
    roughness: options.roughness ?? 0.72,
    side: DoubleSide,
    transparent: opacity < 1,
  });
}

function nightEmitter<T extends MeshStandardMaterial>(
  material: T,
  color: number,
  intensity: number,
): T {
  material.userData.nightEmissive = color;
  material.userData.nightEmissiveIntensity = intensity;
  return material;
}

function addMesh<T extends BufferGeometry, M extends Material>(
  group: Group,
  name: string,
  geometry: T,
  material: M,
  position: [number, number, number],
): Mesh<T, M> {
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addBox(
  group: Group,
  name: string,
  size: [number, number, number],
  position: [number, number, number],
  material: MeshStandardMaterial,
): Mesh {
  return addMesh(group, name, new BoxGeometry(...size), material, position);
}

function addInstances(
  group: Group,
  name: string,
  geometry: BufferGeometry,
  material: Material,
  transforms: InstanceTransform[],
): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, transforms.length);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const dummy = new Object3D();
  transforms.forEach((transform, index) => {
    dummy.position.set(...transform.position);
    dummy.rotation.set(...(transform.rotation ?? [0, 0, 0]));
    dummy.scale.set(...(transform.scale ?? [1, 1, 1]));
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  group.add(mesh);
  return mesh;
}

function addSegment(
  group: Group,
  name: string,
  start: Vector3,
  end: Vector3,
  radius: number,
  material: MeshStandardMaterial,
): Mesh {
  const delta = end.clone().sub(start);
  const mesh = addMesh(
    group,
    name,
    new CylinderGeometry(radius, radius, delta.length(), 8),
    material,
    start.clone().add(end).multiplyScalar(0.5).toArray(),
  );
  mesh.quaternion.setFromUnitVectors(
    new Vector3(0, 1, 0),
    delta.normalize(),
  );
  return mesh;
}

const DOT_GLYPHS: Record<string, string[]> = {
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01110"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  N: ["10001", "11001", "11001", "10101", "10011", "10011", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
};

function marqueeTransforms(text: string): InstanceTransform[] {
  const spacing = 0.245;
  const glyphAdvance = spacing * 6;
  const width = text.length * glyphAdvance - spacing;
  const transforms: InstanceTransform[] = [];
  for (let characterIndex = 0; characterIndex < text.length; characterIndex += 1) {
    const glyph = DOT_GLYPHS[text[characterIndex]];
    if (!glyph) {
      continue;
    }
    for (let row = 0; row < glyph.length; row += 1) {
      for (let column = 0; column < glyph[row].length; column += 1) {
        if (glyph[row][column] !== "1") {
          continue;
        }
        transforms.push({
          position: [
            -width / 2 + characterIndex * glyphAdvance + column * spacing,
            8.3 + (3 - row) * spacing,
            14.86,
          ],
        });
      }
    }
  }
  return transforms;
}

function createTipi(anchor: CulturalLandmark): Group {
  const group = new Group();
  group.name = "Granular TIPI am Kanzleramt show tent";
  group.position.set(anchor.world[0], TIPI_GROUND_Y, anchor.world[2]);
  group.rotation.y = MathUtils.degToRad(8);
  group.userData = {
    ellipseLengthM: 32,
    ellipseWidthM: 26,
    geometryStatus:
      "Official 32 x 26 m venue footprint with a recognition model over the official mesh",
    marquee: "PIGOR & EICHHORN",
    sourceUrls: [
      "https://www.tipi-am-kanzleramt.de/de/theater/tipi-am-kanzleramt.html",
      "https://www.tipi-am-kanzleramt.de/_Resources/Persistent/0/1/3/9/0139b75bd22d148179852011cf066a1968138877/TIPI_Technikinfo_07_2024.pdf",
    ],
  };

  const canvas = nightEmitter(
    modelMaterial(0xe8e4d8, { roughness: 0.9 }),
    0xffb56f,
    0.62,
  );
  const canvasShade = nightEmitter(
    modelMaterial(0xc7c1b6, { roughness: 0.92 }),
    0xd94f8c,
    0.48,
  );
  const redFront = nightEmitter(
    modelMaterial(0x7f2f35, { roughness: 0.74 }),
    0xd84555,
    0.72,
  );
  const timber = modelMaterial(0x76533b, { roughness: 0.86 });
  const darkBoard = modelMaterial(0x271b1b, { roughness: 0.66 });

  const skirt = addMesh(
    group,
    "TIPI elliptical canvas skirt",
    new CylinderGeometry(15.6, 15.6, 3.2, 32, 1, true),
    canvas,
    [0, 1.6, 0],
  );
  skirt.scale.set(16 / 15.6, 1, 13 / 15.6);
  const roof = addMesh(
    group,
    "TIPI main peaked canvas roof",
    new CylinderGeometry(0.72, 15.6, 15.2, 32, 1, true),
    canvas,
    [0, 10.8, 0],
  );
  roof.scale.set(16 / 15.6, 1, 13 / 15.6);

  const ribMaterial = modelMaterial(0x67594a, { roughness: 0.68 });
  for (let index = 0; index < 20; index += 1) {
    const angle = (index / 20) * Math.PI * 2;
    addSegment(
      group,
      `TIPI structural radial rib ${index + 1}`,
      new Vector3(0, 18.32, 0),
      new Vector3(Math.cos(angle) * 16, 3.18, Math.sin(angle) * 13),
      0.055,
      ribMaterial,
    );
  }

  for (const side of [-1, 1]) {
    const sideTent = addMesh(
      group,
      `TIPI side peaked foyer ${side}`,
      new ConeGeometry(7.2, 9.8, 20, 1, true),
      side < 0 ? canvasShade : canvas,
      [side * 12.8, 4.9, 7.8],
    );
    sideTent.scale.z = 0.78;
  }

  addBox(
    group,
    "TIPI red entrance facade",
    [23.5, 5.8, 1.1],
    [0, 2.9, 13.7],
    redFront,
  );
  for (const x of [-7.8, -2.6, 2.6, 7.8]) {
    addBox(
      group,
      "TIPI timber entrance door",
      [3.5, 4.5, 0.36],
      [x, 2.25, 14.34],
      timber,
    );
  }
  addBox(
    group,
    "TIPI PIGOR & EICHHORN marquee board",
    [25.4, 3.25, 0.44],
    [0, 8.3, 14.62],
    darkBoard,
  );
  addInstances(
    group,
    "TIPI PIGOR & EICHHORN golden marquee bulbs",
    new SphereGeometry(0.078, 8, 6),
    nightEmitter(
      modelMaterial(0x8a681d, { metalness: 0.42, roughness: 0.28 }),
      0xffbd3d,
      5.4,
    ),
    marqueeTransforms("PIGOR & EICHHORN"),
  );

  const stringBulbs: InstanceTransform[] = [];
  for (let rib = 0; rib < 20; rib += 1) {
    const angle = (rib / 20) * Math.PI * 2;
    for (let step = 0; step <= 10; step += 1) {
      const t = step / 10;
      const radius = 12.95 * (1 - t) + 0.72 * t;
      stringBulbs.push({
        position: [
          Math.cos(angle) * radius * (16 / 13),
          3.25 + t * 15.1,
          Math.sin(angle) * radius,
        ],
      });
    }
  }
  addInstances(
    group,
    "TIPI warm canvas-rib string bulbs",
    new SphereGeometry(0.085, 7, 5),
    nightEmitter(modelMaterial(0x8d7443), 0xffd27a, 4.1),
    stringBulbs,
  );

  const washColors = [0xff477e, 0x47d7ff, 0xa967ff, 0xffb13b];
  washColors.forEach((color, index) => {
    const angle = MathUtils.degToRad(-42 + index * 28);
    const wash = addMesh(
      group,
      `TIPI colourful night uplight ${index + 1}`,
      new ConeGeometry(2.25, 7.5, 16, 1, true),
      nightEmitter(
        modelMaterial(0x343434, { opacity: 0.12, roughness: 0.5 }),
        color,
        3.2,
      ),
      [Math.sin(angle) * 11.8, 3.75, Math.cos(angle) * 11.8],
    );
    wash.rotation.z = Math.sin(angle) * 0.13;
    wash.userData.nightOnly = true;
    wash.visible = false;
    const light = new PointLight(color, 24, 42, 1.45);
    light.name = `TIPI colourful concert light ${index + 1}`;
    light.position.set(
      Math.sin(angle) * 9.8,
      4.2,
      Math.cos(angle) * 9.8,
    );
    light.visible = false;
    light.userData.nightOnly = true;
    group.add(light);
  });

  return group;
}

function bellGeometry(): LatheGeometry {
  return new LatheGeometry(
    [
      new Vector2(0.1, 0.82),
      new Vector2(0.34, 0.7),
      new Vector2(0.43, 0.18),
      new Vector2(0.58, -0.08),
      new Vector2(0.12, -0.16),
    ],
    12,
  );
}

function createCarillon(anchor: CulturalLandmark): Group {
  const group = new Group();
  group.name = "Granular 42 m Carillon im Tiergarten";
  group.position.set(anchor.world[0], CARILLON_GROUND_Y, anchor.world[2]);
  group.userData = {
    bellCount: 68,
    geometryStatus: "Published dimensions with recognition geometry",
    heightM: 42,
    sourceUrl: "https://www.berlin.de/kultur-und-tickets/tipps/pfingsten/4877500-3383646-pfingstcarillon-internationales-carillon.html",
  };

  const granite = modelMaterial(0x25272a, { metalness: 0.16, roughness: 0.48 });
  const graniteEdge = modelMaterial(0x3b3d40, { metalness: 0.14, roughness: 0.42 });
  const bronze = modelMaterial(0x9b652d, { metalness: 0.72, roughness: 0.3 });
  const roof = modelMaterial(0x9d7b36, { metalness: 0.64, roughness: 0.34 });
  const cabinGlass = nightEmitter(
    modelMaterial(0x28383d, { metalness: 0.22, opacity: 0.58, roughness: 0.24 }),
    0xffc66d,
    1.5,
  );

  for (const x of [-2.9, 2.9]) {
    for (const z of [-2.9, 2.9]) {
      addBox(
        group,
        "Carillon black-granite tower shaft",
        [2.25, 41.2, 2.25],
        [x, 20.6, z],
        granite,
      );
    }
  }
  for (const y of [8, 16, 24, 28.5, 34.5, 39.3]) {
    addBox(
      group,
      "Carillon granite horizontal joint east-west",
      [8.2, 0.34, 0.52],
      [0, y, 0],
      graniteEdge,
    );
    addBox(
      group,
      "Carillon granite horizontal joint north-south",
      [0.52, 0.34, 8.2],
      [0, y, 0],
      graniteEdge,
    );
  }
  addBox(
    group,
    "Carillon overhanging brass-toned roof",
    [9.8, 0.8, 9.8],
    [0, 41.6, 0],
    roof,
  );
  addBox(
    group,
    "Carillon player cabin at 33 m",
    [4.8, 2.6, 4.8],
    [0, 33, 0],
    cabinGlass,
  );

  const bells: InstanceTransform[] = [];
  const clappers: InstanceTransform[] = [];
  for (let index = 0; index < 68; index += 1) {
    const face = index % 4;
    const slot = Math.floor(index / 4);
    const row = Math.floor(slot / 4);
    const column = slot % 4;
    const y = 29.1 + row * 2.28;
    const offset = (column - 1.5) * 1.18;
    const scale = Math.max(0.46, 1.05 - row * 0.12);
    const position: [number, number, number] =
      face === 0
        ? [offset, y, 3.45]
        : face === 1
          ? [-offset, y, -3.45]
          : face === 2
            ? [3.45, y, offset]
            : [-3.45, y, -offset];
    bells.push({ position, scale: [scale, scale, scale] });
    clappers.push({
      position: [position[0], position[1] - scale * 0.43, position[2]],
      scale: [scale, scale, scale],
    });
  }
  addInstances(
    group,
    "Carillon 68 bronze bells",
    bellGeometry(),
    bronze,
    bells,
  );
  addInstances(
    group,
    "Carillon 68 bell clappers",
    new SphereGeometry(0.12, 8, 6),
    modelMaterial(0x4e3827, { metalness: 0.62, roughness: 0.36 }),
    clappers,
  );

  for (const x of [-3.6, 3.6]) {
    for (const z of [-3.6, 3.6]) {
      addMesh(
        group,
        "Carillon warm base uplight",
        new CylinderGeometry(0.22, 0.3, 0.34, 10),
        nightEmitter(modelMaterial(0x554224), 0xffc86b, 3.8),
        [x, 0.17, z],
      );
    }
  }
  return group;
}

function shipHullGeometry(length: number, width: number, height: number): BufferGeometry {
  const sections = [
    { halfWidth: width * 0.46, z: -length / 2 },
    { halfWidth: width / 2, z: length * 0.27 },
    { halfWidth: width * 0.08, z: length / 2 },
  ];
  const positions: number[] = [];
  for (const section of sections) {
    positions.push(
      -section.halfWidth * 0.72,
      0,
      section.z,
      section.halfWidth * 0.72,
      0,
      section.z,
      -section.halfWidth,
      height,
      section.z,
      section.halfWidth,
      height,
      section.z,
    );
  }
  const indices: number[] = [];
  for (let section = 0; section < sections.length - 1; section += 1) {
    const start = section * 4;
    const end = (section + 1) * 4;
    indices.push(
      start, start + 1, end + 1, start, end + 1, end,
      start + 2, end + 3, start + 3, start + 2, end + 2, end + 3,
      start, end, end + 2, start, end + 2, start + 2,
      start + 1, start + 3, end + 3, start + 1, end + 3, end + 1,
    );
  }
  indices.push(0, 2, 3, 0, 3, 1, 8, 9, 11, 8, 11, 10);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function createExcursionSteamer(): Group {
  const group = new Group();
  group.name = "Berlin Spree excursion steamer with occupied upper deck";
  group.position.set(...BOAT_WORLD);
  group.position.y -= 0.72;
  group.rotation.y = MathUtils.degToRad(-22);
  group.userData = {
    geometryStatus: "Typical Berlin excursion-boat display model",
    passengerCount: 10,
    sourceUrl: "https://www.berlin.de/tourismus/dampferfahrten/ausflugsfahrten/",
  };

  const hull = modelMaterial(0x244f62, { metalness: 0.26, roughness: 0.5 });
  const white = modelMaterial(0xe8ece8, { roughness: 0.72 });
  const deck = modelMaterial(0xb98a58, { roughness: 0.88 });
  const glass = nightEmitter(
    modelMaterial(0x1f4654, { metalness: 0.26, opacity: 0.72, roughness: 0.22 }),
    0xffd28c,
    0.82,
  );
  const rail = modelMaterial(0xc5d0cf, { metalness: 0.72, roughness: 0.26 });
  const chimney = modelMaterial(0x253037, { metalness: 0.46, roughness: 0.4 });

  addMesh(
    group,
    "Spree steamer pointed displacement hull",
    shipHullGeometry(31.6, 5.72, 2.05),
    hull,
    [0, 0, 0],
  );
  addBox(group, "Spree steamer main deck", [5.55, 0.24, 26], [0, 2.12, -1], deck);
  addBox(group, "Spree steamer lower saloon", [4.9, 2.35, 20], [0, 3.28, -1.5], white);
  addBox(group, "Spree steamer open upper deck", [5.2, 0.22, 20.5], [0, 4.58, -1], deck);
  addBox(group, "Spree steamer wheelhouse", [4.2, 2.2, 4.8], [0, 5.72, 7.2], white);

  const windows: InstanceTransform[] = [];
  for (const side of [-1, 1]) {
    for (let index = 0; index < 10; index += 1) {
      windows.push({
        position: [side * 2.49, 3.42, -9.1 + index * 1.7],
      });
    }
  }
  addInstances(
    group,
    "Spree steamer saloon windows",
    new BoxGeometry(0.1, 0.82, 1.18),
    glass,
    windows,
  );

  addMesh(
    group,
    "Spree steamer smokestack",
    new CylinderGeometry(0.34, 0.42, 2.7, 12),
    chimney,
    [0, 5.92, -7.2],
  );
  const steam = modelMaterial(0xe6eceb, { opacity: 0.48, roughness: 1 });
  for (let index = 0; index < 3; index += 1) {
    addMesh(
      group,
      `Spree steamer steam puff ${index + 1}`,
      new SphereGeometry(0.48 + index * 0.18, 10, 7),
      steam,
      [index * 0.25, 7.6 + index * 0.7, -7.2 - index * 0.18],
    );
  }

  for (const x of [-2.45, 2.45]) {
    addSegment(
      group,
      "Spree steamer upper-deck handrail",
      new Vector3(x, 5.34, -11),
      new Vector3(x, 5.34, 9),
      0.045,
      rail,
    );
    for (let z = -11; z <= 9; z += 2) {
      addSegment(
        group,
        "Spree steamer handrail stanchion",
        new Vector3(x, 4.67, z),
        new Vector3(x, 5.34, z),
        0.035,
        rail,
      );
    }
  }

  const chairSeats: InstanceTransform[] = [];
  const chairBacks: InstanceTransform[] = [];
  const passengers: InstanceTransform[] = [];
  const heads: InstanceTransform[] = [];
  const greenDrinks: InstanceTransform[] = [];
  const redDrinks: InstanceTransform[] = [];
  for (let index = 0; index < 10; index += 1) {
    const x = index % 2 === 0 ? -1.45 : 1.45;
    const z = -7.6 + Math.floor(index / 2) * 3.25;
    chairSeats.push({ position: [x, 4.94, z], rotation: [-0.08, 0, 0] });
    chairBacks.push({ position: [x, 5.35, z - 0.42], rotation: [-0.42, 0, 0] });
    passengers.push({ position: [x, 5.48, z + 0.02], scale: [1, 0.78, 1] });
    heads.push({ position: [x, 6.05, z - 0.06] });
    (index % 2 === 0 ? greenDrinks : redDrinks).push({
      position: [x + (x < 0 ? 0.36 : -0.36), 5.3, z + 0.28],
    });
  }
  const chairMaterial = modelMaterial(0xe6d5a8, { roughness: 0.82 });
  addInstances(
    group,
    "Spree steamer ten deck-chair seats",
    new BoxGeometry(0.72, 0.1, 0.86),
    chairMaterial,
    chairSeats,
  );
  addInstances(
    group,
    "Spree steamer ten deck-chair backs",
    new BoxGeometry(0.72, 0.1, 0.92),
    chairMaterial,
    chairBacks,
  );
  addInstances(
    group,
    "Spree steamer seated passengers",
    new CapsuleGeometry(0.2, 0.48, 4, 8),
    modelMaterial(0x9b4f66, { roughness: 0.8 }),
    passengers,
  );
  addInstances(
    group,
    "Spree steamer passenger heads",
    new SphereGeometry(0.18, 9, 7),
    modelMaterial(0xd5a57c, { roughness: 0.88 }),
    heads,
  );
  addInstances(
    group,
    "Spree steamer green Berliner Weisse glasses",
    new CylinderGeometry(0.11, 0.075, 0.27, 9),
    modelMaterial(0x70b653, { opacity: 0.82, roughness: 0.28 }),
    greenDrinks,
  );
  addInstances(
    group,
    "Spree steamer red Berliner Weisse glasses",
    new CylinderGeometry(0.11, 0.075, 0.27, 9),
    modelMaterial(0xd84f58, { opacity: 0.82, roughness: 0.28 }),
    redDrinks,
  );
  return group;
}

export function createCulturalLandmarks(landmarks: CulturalLandmark[]): Group {
  const group = new Group();
  group.name = "Cultural venues, Carillon and Spree excursion detail";
  const byName = new Map(landmarks.map((landmark) => [landmark.name, landmark]));
  const tipi = byName.get(TIPI_NAME);
  const carillon = byName.get(CARILLON_NAME);
  if (tipi) {
    group.add(createTipi(tipi));
  }
  if (carillon) {
    group.add(createCarillon(carillon));
  }
  group.add(createExcursionSteamer());
  return group;
}

export function culturalFocusCamera(name: string): CulturalFocusCamera | null {
  if (name === TIPI_NAME) {
    return {
      azimuth_degrees: 34,
      distance_m: 74,
      polar_degrees: 61,
      target_height_m: 8.6,
      target_world: [-297.284, TIPI_GROUND_Y, 52.502],
    };
  }
  if (name === CARILLON_NAME) {
    return {
      azimuth_degrees: 42,
      distance_m: 88,
      polar_degrees: 66,
      target_height_m: 20,
      target_world: [-326.839, CARILLON_GROUND_Y, 140.633],
    };
  }
  if (name === SPREEBOGEN_NAME) {
    return {
      azimuth_degrees: 35,
      distance_m: 105,
      polar_degrees: 58,
      target_height_m: 4.5,
      target_world: BOAT_WORLD,
    };
  }
  return null;
}
