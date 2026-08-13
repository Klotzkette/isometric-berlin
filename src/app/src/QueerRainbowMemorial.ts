import {
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  EdgesGeometry,
  ExtrudeGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PointLight,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";

import {
  ARCHITECTURAL_EDGE_THRESHOLD_DEGREES,
  markArchitecturalAccentInk,
  markArchitecturalInk,
} from "./architecturalInk";

type InstanceTransform = {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
};

/**
 * The position comes from the owner's supplied place link and the ground from
 * the packaged official Berlin mesh. The tree and memorial arrangement are
 * reconstructed only from the supplied field views. Their dimensions are
 * deliberately labelled as display estimates rather than surveyed facts.
 */
export const QUEER_RAINBOW_MEMORIAL_PROFILE = {
  name: "Queer Rainbow Memorial Berlin",
  species: "mature broadleaf tree; species and dimensions unverified",
  sourceGroundYM: 4.057,
  renderedGroundYM: 4.479,
  worldM: [40.647, 4.479, 660.01] as const,
  treeHeightM: 23,
  crownRadiusM: 5,
  trunkRadiusM: 0.36,
  flowerCount: 132,
  candleCount: 30,
  messageCount: 24,
  smallFlagCount: 5,
  geometryStatus:
    "Owner-supplied field-view-bounded tree and memorial display approximation; tree dimensions and offering geometry are not surveyed",
  positionStatus:
    "Owner-supplied place at Ahornsteig; 4.057 m point sample retained while the display base follows the 4.479 m interpolated official-mesh terrain surface",
  sourceAttribution:
    "Owner-supplied field views · Geoportal Berlin ground (dl-de/zero-2-0)",
} as const;

const RAINBOW = [
  0xe34b54, 0xf18b3a, 0xf2cf4a, 0x4e9b63, 0x4b79bd, 0x7757a8,
] as const;
const FLOWERS = [
  0xf2c63d, 0xf5f0dc, 0xe96673, 0xd888b4, 0x775ca6, 0x4f83bd, 0xe38743,
  0xc43f51,
] as const;

function material(
  color: number,
  options: { metalness?: number; roughness?: number } = {},
): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color,
    flatShading: true,
    metalness: options.metalness ?? 0.02,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    roughness: options.roughness ?? 0.78,
  });
}

function nightEmitter(
  color: number,
  emissive: number,
  intensity: number,
): MeshStandardMaterial {
  const result = material(color, { roughness: 0.48 });
  result.userData.nightEmissive = emissive;
  result.userData.nightEmissiveIntensity = intensity;
  return result;
}

function addMesh<T extends BufferGeometry, M extends Material>(
  group: Group,
  name: string,
  geometry: T,
  meshMaterial: M,
  position: [number, number, number],
): Mesh<T, M> {
  const mesh = new Mesh(geometry, meshMaterial);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addInstances(
  group: Group,
  name: string,
  geometry: BufferGeometry,
  meshMaterial: Material,
  transforms: InstanceTransform[],
): InstancedMesh {
  const mesh = new InstancedMesh(geometry, meshMaterial, transforms.length);
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
  meshMaterial: MeshStandardMaterial,
): Mesh {
  const delta = end.clone().sub(start);
  const mesh = addMesh(
    group,
    name,
    new CylinderGeometry(radius, radius, delta.length(), 8),
    meshMaterial,
    start.clone().add(end).multiplyScalar(0.5).toArray(),
  );
  mesh.quaternion.setFromUnitVectors(
    new Vector3(0, 1, 0),
    delta.clone().normalize(),
  );
  return mesh;
}

function seeded(index: number, salt: number): number {
  const value = Math.sin((index + 17) * 37.117 + salt * 83.731) * 18_437.331;
  return value - Math.floor(value);
}

function heartGeometry(depth = 0.035): ExtrudeGeometry {
  const shape = new Shape();
  shape.moveTo(0, -0.96);
  shape.bezierCurveTo(-0.16, -0.7, -0.94, -0.25, -0.94, 0.35);
  shape.bezierCurveTo(-0.94, 1.05, -0.12, 1.2, 0, 0.62);
  shape.bezierCurveTo(0.12, 1.2, 0.94, 1.05, 0.94, 0.35);
  shape.bezierCurveTo(0.94, -0.25, 0.16, -0.7, 0, -0.96);
  const geometry = new ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 8,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function addTree(group: Group): void {
  const profile = QUEER_RAINBOW_MEMORIAL_PROFILE;
  const trunkHeight = profile.treeHeightM * 0.5;
  const bark = material(0x785d43, { roughness: 0.94 });
  const barkDark = material(0x594534, { roughness: 0.96 });
  const trunk = addMesh(
    group,
    "Queer Rainbow Memorial field-view-bounded broadleaf trunk",
    new CylinderGeometry(
      profile.trunkRadiusM * 0.82,
      profile.trunkRadiusM * 1.18,
      trunkHeight,
      12,
      3,
    ),
    bark,
    [0, trunkHeight / 2, 0],
  );
  trunk.userData.positionStatus = profile.positionStatus;

  const barkRidges: InstanceTransform[] = Array.from(
    { length: 9 },
    (_, index) => {
      const angle = (index / 9) * Math.PI * 2;
      const radius = profile.trunkRadiusM * 1.09;
      return {
        position: [
          Math.cos(angle) * radius,
          3.9 + seeded(index, 1) * 2.4,
          Math.sin(angle) * radius,
        ],
        rotation: [0, angle, (seeded(index, 2) - 0.5) * 0.06],
        scale: [0.55, 6.2 + seeded(index, 3) * 1.9, 0.42],
      };
    },
  );
  addInstances(
    group,
    "Queer Rainbow Memorial bark relief",
    new CylinderGeometry(0.018, 0.026, 1, 5),
    barkDark,
    barkRidges,
  );

  const branchAngles = [0.14, 1.5, 2.82, 4.08, 5.3];
  branchAngles.forEach((angle, index) => {
    const start = new Vector3(
      Math.cos(angle) * 0.08,
      8.7 + index * 0.32,
      Math.sin(angle) * 0.08,
    );
    const end = new Vector3(
      Math.cos(angle) * (2.1 + (index % 2) * 0.55),
      13.1 + (index % 3) * 0.7,
      Math.sin(angle) * (2.1 + (index % 2) * 0.55),
    );
    addSegment(
      group,
      `Queer Rainbow Memorial broadleaf branch ${index + 1}`,
      start,
      end,
      0.11 + (index % 2) * 0.025,
      bark,
    );
  });

  const crown = new Group();
  crown.name = "Queer Rainbow Memorial layered broadleaf crown";
  const foliage = [material(0x4e8d53), material(0x5d9a5b), material(0x397846)];
  const lobes = [
    [-2.25, 15.8, 0.2, 3.25, 2.7, 3.0],
    [2.15, 16.1, -0.15, 3.1, 2.8, 3.15],
    [-0.15, 17.2, -2.1, 3.35, 2.95, 3.0],
    [0.2, 17.35, 2.05, 3.25, 2.85, 3.05],
    [-1.45, 19.2, 0.1, 3.0, 3.15, 2.9],
    [1.5, 19.3, -0.1, 3.0, 3.1, 2.9],
    [0, 21.0, 0, 2.55, 2.0, 2.5],
  ] as const;
  lobes.forEach(([x, y, z, sx, sy, sz], index) => {
    const lobe = addMesh(
      crown,
      `Queer Rainbow Memorial broadleaf crown lobe ${index + 1}`,
      new IcosahedronGeometry(1, 2),
      foliage[index % foliage.length],
      [x, y, z],
    );
    lobe.scale.set(sx, sy, sz);
  });
  group.add(crown);

  const snow = new Group();
  snow.name = "Queer Rainbow Memorial snow crown caps";
  snow.userData.snowOnly = true;
  snow.userData.snowActive = false;
  snow.visible = false;
  const snowMaterial = material(0xf4f6f3, { roughness: 0.98 });
  lobes.slice(0, 6).forEach(([x, y, z, sx, sy, sz], index) => {
    const cap = addMesh(
      snow,
      `Queer Rainbow Memorial snow cap ${index + 1}`,
      new SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.8),
      snowMaterial,
      [x, y + sy * 0.82, z],
    );
    cap.scale.set(sx * 0.67, sy * 0.19, sz * 0.67);
  });
  group.add(snow);
}

function addHeartAndFabric(group: Group): void {
  const profile = QUEER_RAINBOW_MEMORIAL_PROFILE;
  const heart = new Group();
  heart.name = "Queer Rainbow Memorial six-colour heart";
  heart.position.set(0, 1.64, profile.trunkRadiusM * 1.18);
  RAINBOW.forEach((color, index) => {
    const scale = 0.37 - index * 0.046;
    const layer = addMesh(
      heart,
      `Queer Rainbow Memorial heart layer ${index + 1}`,
      heartGeometry(0.035),
      material(color, { roughness: 0.72 }),
      [0, 0, 0.035 + index * 0.011],
    );
    layer.scale.set(scale, scale, 1);
  });
  const outline = new LineSegments(
    new EdgesGeometry(
      heartGeometry(0.035),
      ARCHITECTURAL_EDGE_THRESHOLD_DEGREES,
    ),
    markArchitecturalAccentInk(
      new LineBasicMaterial({ color: 0x684958 }),
      0x684958,
      "silhouette",
    ),
  );
  outline.name = "Queer Rainbow Memorial heart ink line";
  outline.position.z = 0.034;
  outline.scale.setScalar(0.375);
  heart.add(outline);
  group.add(heart);

  const fabric = new Group();
  fabric.name = "Queer Rainbow Memorial rainbow fabric bands";
  RAINBOW.forEach((color, index) => {
    const band = addMesh(
      fabric,
      `Queer Rainbow Memorial trunk ribbon ${index + 1}`,
      new TorusGeometry(profile.trunkRadiusM * 1.13, 0.036, 5, 24, 5.2),
      material(color, { roughness: 0.76 }),
      [0, 1.02 + index * 0.075, 0],
    );
    band.rotation.x = Math.PI / 2;
    band.rotation.z = 0.42 + index * 0.16;
  });

  const hangingTransforms: InstanceTransform[] = [];
  for (let index = 0; index < 12; index += 1) {
    const side = index < 6 ? -1 : 1;
    const stripe = index % 6;
    hangingTransforms.push({
      position: [
        side * (profile.trunkRadiusM + 0.18),
        0.84 - stripe * 0.06,
        0.02,
      ],
      rotation: [0, side < 0 ? -0.22 : 0.22, side * 0.08],
      scale: [1, 0.82 - stripe * 0.018, 1],
    });
  }
  RAINBOW.forEach((color, stripe) => {
    addInstances(
      fabric,
      `Queer Rainbow Memorial hanging fabric stripe ${stripe + 1}`,
      new BoxGeometry(0.11, 0.68, 0.025),
      material(color),
      [hangingTransforms[stripe], hangingTransforms[stripe + 6]],
    );
  });
  group.add(fabric);
}

function addOfferings(group: Group): void {
  const profile = QUEER_RAINBOW_MEMORIAL_PROFILE;
  const detail = new Group();
  detail.name = "Queer Rainbow Memorial fine detail";

  const stems: InstanceTransform[] = [];
  const centres: InstanceTransform[] = [];
  const petalsByColour: InstanceTransform[][] = FLOWERS.map(() => []);
  for (let index = 0; index < profile.flowerCount; index += 1) {
    const angle = seeded(index, 10) * Math.PI * 2;
    const radius = 0.52 + Math.sqrt(seeded(index, 11)) * 2.32;
    const length = 0.34 + seeded(index, 12) * 0.68;
    const centreRadius = Math.max(0.34, radius - length * 0.45);
    stems.push({
      position: [
        Math.cos(angle) * centreRadius,
        0.055 + seeded(index, 13) * 0.035,
        Math.sin(angle) * centreRadius,
      ],
      rotation: [Math.PI / 2, angle, 0],
      scale: [1, length, 1],
    });
    const size = 0.7 + seeded(index, 14) * 0.65;
    const centre: [number, number, number] = [
      Math.cos(angle) * radius,
      0.15 + seeded(index, 15) * 0.07,
      Math.sin(angle) * radius,
    ];
    centres.push({
      position: centre,
      scale: [size, 0.72 + seeded(index, 16) * 0.35, size],
    });
    for (let petal = 0; petal < 5; petal += 1) {
      const petalAngle =
        (petal / 5) * Math.PI * 2 + seeded(index, 17) * Math.PI;
      petalsByColour[index % FLOWERS.length].push({
        position: [
          centre[0] + Math.cos(petalAngle) * 0.09 * size,
          centre[1] - 0.012,
          centre[2] + Math.sin(petalAngle) * 0.09 * size,
        ],
        rotation: [0, -petalAngle, 0],
        scale: [size, 0.32 + seeded(index, 18) * 0.14, size * 0.62],
      });
    }
  }
  addInstances(
    detail,
    "Queer Rainbow Memorial flower stems",
    new CylinderGeometry(0.014, 0.018, 1, 5),
    material(0x477642),
    stems,
  );
  petalsByColour.forEach((transforms, index) => {
    addInstances(
      detail,
      `Queer Rainbow Memorial flower petals ${index + 1}`,
      new SphereGeometry(0.082, 7, 5),
      material(FLOWERS[index], { roughness: 0.82 }),
      transforms,
    );
  });
  addInstances(
    detail,
    "Queer Rainbow Memorial flower centres",
    new SphereGeometry(0.055, 7, 5),
    material(0x8a6033, { roughness: 0.88 }),
    centres,
  );

  const candleBodies: InstanceTransform[][] = [[], [], []];
  const candleFlames: InstanceTransform[] = [];
  for (let index = 0; index < profile.candleCount; index += 1) {
    const angle = seeded(index, 21) * Math.PI * 2;
    const radius = 0.68 + seeded(index, 22) * 2.0;
    const height = 0.13 + seeded(index, 23) * 0.13;
    const position: [number, number, number] = [
      Math.cos(angle) * radius,
      height / 2 + 0.035,
      Math.sin(angle) * radius,
    ];
    candleBodies[index % candleBodies.length].push({
      position,
      scale: [0.82 + seeded(index, 24) * 0.35, height, 0.82],
    });
    candleFlames.push({
      position: [position[0], height + 0.075, position[2]],
      rotation: [0, angle, 0],
      scale: [1, 0.85 + seeded(index, 25) * 0.35, 1],
    });
  }
  [0xa9252d, 0xf2eee0, 0xcb6138].forEach((color, index) => {
    addInstances(
      detail,
      `Queer Rainbow Memorial candle bodies ${index + 1}`,
      new CylinderGeometry(0.038, 0.044, 1, 8),
      material(color, { roughness: 0.52 }),
      candleBodies[index],
    );
  });
  const flames = addInstances(
    detail,
    "Queer Rainbow Memorial candle flames",
    new ConeGeometry(0.027, 0.085, 7),
    nightEmitter(0xf5bd54, 0xff9e35, 2.2),
    candleFlames,
  );
  flames.userData.nightOnly = true;
  flames.visible = false;

  const candleLightPositions = [
    [-0.82, 0.42, 0.36],
    [0.84, 0.42, -0.31],
  ] as const;
  candleLightPositions.forEach((position, index) => {
    const glow = new PointLight(0xffad55, 9, 6.5, 1.8);
    glow.name = `Queer Rainbow Memorial candle pool light ${index + 1}`;
    glow.position.set(position[0], position[1], position[2]);
    glow.userData.nightOnly = true;
    glow.visible = false;
    detail.add(glow);
  });

  const messages: InstanceTransform[] = [];
  for (let index = 0; index < profile.messageCount; index += 1) {
    const angle = seeded(index, 31) * Math.PI * 2;
    const radius = 0.82 + seeded(index, 32) * 1.85;
    messages.push({
      position: [
        Math.cos(angle) * radius,
        0.045 + index * 0.0004,
        Math.sin(angle) * radius,
      ],
      rotation: [0, angle + (seeded(index, 33) - 0.5) * 0.9, 0],
      scale: [
        0.72 + seeded(index, 34) * 0.7,
        1,
        0.72 + seeded(index, 35) * 0.6,
      ],
    });
  }
  const cards = addInstances(
    detail,
    "Queer Rainbow Memorial cards and messages",
    new BoxGeometry(0.28, 0.018, 0.2),
    material(0xf1e9d8, { roughness: 0.9 }),
    messages,
  );
  cards.castShadow = false;

  const flagPoles: InstanceTransform[] = [];
  const flagStripes: InstanceTransform[][] = RAINBOW.map(() => []);
  for (let index = 0; index < profile.smallFlagCount; index += 1) {
    const angle = (index / profile.smallFlagCount) * Math.PI * 2 + 0.38;
    const radius = 1.25 + (index % 2) * 0.58;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    flagPoles.push({
      position: [x, 0.49, z],
      rotation: [0, angle, (index % 2 === 0 ? -1 : 1) * 0.08],
      scale: [1, 0.78 + (index % 3) * 0.08, 1],
    });
    RAINBOW.forEach((_color, stripe) => {
      flagStripes[stripe].push({
        position: [
          x + Math.cos(angle) * 0.17,
          0.65 - stripe * 0.045,
          z + Math.sin(angle) * 0.17,
        ],
        rotation: [0, -angle + Math.PI / 2, 0],
      });
    });
  }
  addInstances(
    detail,
    "Queer Rainbow Memorial small flag poles",
    new CylinderGeometry(0.012, 0.014, 1, 6),
    material(0x8a8b84, { metalness: 0.38, roughness: 0.42 }),
    flagPoles,
  );
  RAINBOW.forEach((color, stripe) => {
    addInstances(
      detail,
      `Queer Rainbow Memorial small pride flag stripe ${stripe + 1}`,
      new BoxGeometry(0.34, 0.045, 0.018),
      material(color),
      flagStripes[stripe],
    );
  });

  const detailInk = markArchitecturalInk(
    new LineBasicMaterial({
      color: 0x746d63,
      opacity: 0.62,
      transparent: true,
    }),
    "micro",
  );
  const offeringOutline = new LineSegments(
    new EdgesGeometry(new CylinderGeometry(2.82, 2.82, 0.022, 48), 28),
    detailInk,
  );
  offeringOutline.name = "Queer Rainbow Memorial offering perimeter ink";
  offeringOutline.position.y = 0.018;
  detail.add(offeringOutline);

  group.add(detail);
}

export function createQueerRainbowMemorial(): Group {
  const profile = QUEER_RAINBOW_MEMORIAL_PROFILE;
  const memorial = new Group();
  memorial.name = profile.name;
  memorial.position.set(...profile.worldM);
  memorial.rotation.y = -0.16;
  memorial.userData = {
    candleCount: profile.candleCount,
    flowerCount: profile.flowerCount,
    geometryStatus: profile.geometryStatus,
    positionStatus: profile.positionStatus,
    smallFlagCount: profile.smallFlagCount,
    sourceAttribution: profile.sourceAttribution,
    species: profile.species,
    messageCount: profile.messageCount,
  };
  addTree(memorial);
  addHeartAndFabric(memorial);
  addOfferings(memorial);
  return memorial;
}

export function setQueerRainbowMemorialSnow(
  root: Group,
  enabled: boolean,
): void {
  root.traverse((object) => {
    if (object.userData.snowOnly !== true) return;
    object.userData.snowActive = enabled;
    object.visible = enabled;
  });
}
