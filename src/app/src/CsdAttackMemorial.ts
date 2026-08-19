import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  TorusGeometry,
  Vector3,
} from "three";

/** Exact source identity for the newly installed Ahornsteig ensemble. */
export const CSD_ATTACK_MEMORIAL_OSM_KEY = "node/14076715427";

/**
 * OSM fixes the ensemble anchor; Bezirksamt Mitte fixes the species, guard and
 * rainbow bench. Every local dimension and the changing offerings are current
 * field-view bounds, not survey measurements. The supplied/press images are
 * reference-only and are never bundled or projected as textures.
 */
export const CSD_ATTACK_MEMORIAL_PROFILE = {
  name: "Gedenkstelle CSD-Attentat vom 25.7.2026",
  publicLabel: "CSD-Gedenkstelle am Ahornsteig",
  osmKey: CSD_ATTACK_MEMORIAL_OSM_KEY,
  wgs84: [13.3699797, 52.5124509] as const,
  worldM: [-115.6634, 3.3105, 714.3809] as const,
  startDate: "2026-08-06",
  rotationY: 0.6632251157578453,
  species: "Französischer Ahorn (Acer monspessulanum)",
  treeHeightM: 5.3,
  crownDiameterM: 2.6,
  trunkDiameterM: 0.12,
  plantingPitSizeM: 1.55,
  guardDiameterM: 1.5,
  guardHeightM: 2.1,
  guardRodCount: 14,
  benchOffsetLocalM: [0, 8.6] as const,
  benchWidthM: 2.05,
  benchHeightM: 0.82,
  staticPrideFlagCount: 3,
  wreathCount: 2,
  cardCount: 8,
  // Two disjoint quiet islands protect the tree/guard and bench while the
  // mapped 2.4 m Ahornsteig between them remains publicly walkable.
  treeProtectionRadiusM: 1.75,
  benchProtectionRadiusM: 1.55,
  geometryStatus:
    "OSM-source-bound procedural display model; local dimensions, bench arrangement and changing offerings are current field-view-bounded, non-surveyed estimates",
  positionStatus:
    "Exact OSM node/14076715427 ensemble anchor on the continuous packaged Tiergarten ground; bench offset is photo-bounded, not surveyed",
  officialSource:
    "https://www.berlin.de/ba-mitte/aktuelles/pressemitteilungen/2026/pressemitteilung.1699951.php",
  currentSource:
    "https://www.berlin.de/aktuelles/10556192-958090-ahornbaum-und-regenbogenbank-erinnern-an.html",
  reportSource:
    "https://www.rbb24.de/panorama/beitrag/2026/08/berlin-anschlag-csd-baumpflanzung-gedenkort.html",
  osmSource: "https://www.openstreetmap.org/node/14076715427",
  visualReferenceStatus:
    "Owner-supplied and press field views are reference-only; no photograph, personal text, portrait or texture is redistributed",
} as const;

type Transform = {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  color?: number;
};

const RAINBOW = [
  0xd9454d, 0xee8737, 0xf2c94c, 0x4b9b61, 0x377ec0, 0x8b4ca8,
] as const;
const LEAF_COLORS = [0x477c43, 0x5f934b, 0x739f53, 0x3f7140] as const;
const CARD_COLORS = [0xf4ead3, 0xe5d7c4, 0xd6e3e1, 0xf0d8df] as const;
const WREATH_FLOWER_COLORS = [0xf0cf54, 0xe96273, 0xf3ede1, 0x7658a6] as const;

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
    roughness: options.roughness ?? 0.8,
  });
}

function addMesh<T extends BufferGeometry, M extends Material>(
  parent: Group,
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
  parent.add(mesh);
  return mesh;
}

function addInstances(
  parent: Group,
  name: string,
  geometry: BufferGeometry,
  meshMaterial: Material,
  transforms: readonly Transform[],
): InstancedMesh {
  const mesh = new InstancedMesh(geometry, meshMaterial, transforms.length);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const dummy = new Object3D();
  for (let index = 0; index < transforms.length; index += 1) {
    const transform = transforms[index];
    dummy.position.set(...transform.position);
    dummy.rotation.set(...(transform.rotation ?? [0, 0, 0]));
    dummy.scale.set(...(transform.scale ?? [1, 1, 1]));
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    if (transform.color !== undefined) {
      mesh.setColorAt(index, new Color(transform.color));
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  parent.add(mesh);
  return mesh;
}

function addSegmentInstances(
  parent: Group,
  name: string,
  segments: ReadonlyArray<{
    start: [number, number, number];
    end: [number, number, number];
    radius: number;
  }>,
  meshMaterial: Material,
): InstancedMesh {
  const geometry = new CylinderGeometry(1, 1, 1, 7, 1, false);
  const mesh = new InstancedMesh(geometry, meshMaterial, segments.length);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const dummy = new Object3D();
  const up = new Vector3(0, 1, 0);
  const start = new Vector3();
  const end = new Vector3();
  const delta = new Vector3();
  const quaternion = new Quaternion();
  segments.forEach((segment, index) => {
    start.set(...segment.start);
    end.set(...segment.end);
    delta.copy(end).sub(start);
    quaternion.setFromUnitVectors(up, delta.clone().normalize());
    dummy.position.copy(start).add(end).multiplyScalar(0.5);
    dummy.quaternion.copy(quaternion);
    dummy.scale.set(segment.radius, delta.length(), segment.radius);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  parent.add(mesh);
  return mesh;
}

function deterministic(index: number, salt: number): number {
  const value = Math.sin((index + 11) * 41.731 + salt * 17.137) * 14_382.731;
  return value - Math.floor(value);
}

function addPlantingAndMaple(root: Group): void {
  const profile = CSD_ATTACK_MEMORIAL_PROFILE;
  addMesh(
    root,
    "CSD attack memorial square planting-pit soil",
    new BoxGeometry(profile.plantingPitSizeM, 0.12, profile.plantingPitSizeM),
    material(0x38291e, { roughness: 0.98 }),
    [0, 0.06, 0],
  );
  const rimTransforms: Transform[] = [
    { position: [0, 0.1, -0.805], scale: [1.68, 0.1, 0.07] },
    { position: [0, 0.1, 0.805], scale: [1.68, 0.1, 0.07] },
    { position: [-0.805, 0.1, 0], scale: [0.07, 0.1, 1.54] },
    { position: [0.805, 0.1, 0], scale: [0.07, 0.1, 1.54] },
  ];
  addInstances(
    root,
    "CSD attack memorial planting-pit rim",
    new BoxGeometry(1, 1, 1),
    material(0xaaa28f, { roughness: 0.88 }),
    rimTransforms,
  );

  addMesh(
    root,
    "CSD attack memorial young French maple trunk",
    new CylinderGeometry(0.052, 0.068, 3.25, 9, 3),
    material(0x7a6854, { roughness: 0.94 }),
    [0, 1.735, 0],
  );
  addMesh(
    root,
    "CSD attack memorial pale trunk protection wrap",
    new CylinderGeometry(0.064, 0.076, 2.72, 10, 5),
    material(0xe7e2d4, { roughness: 0.91 }),
    [0, 1.48, 0],
  );

  addSegmentInstances(
    root,
    "CSD attack memorial young maple branches",
    [
      { start: [0, 2.8, 0], end: [-0.54, 3.72, -0.18], radius: 0.045 },
      { start: [0, 2.92, 0], end: [0.58, 3.86, 0.22], radius: 0.043 },
      { start: [0, 3.02, 0], end: [-0.22, 4.25, 0.48], radius: 0.037 },
      { start: [0, 3.12, 0], end: [0.25, 4.57, -0.4], radius: 0.034 },
      { start: [-0.35, 3.43, -0.12], end: [-0.9, 4.08, -0.35], radius: 0.027 },
      { start: [0.35, 3.52, 0.14], end: [0.9, 4.2, 0.34], radius: 0.027 },
    ],
    material(0x6d5b49, { roughness: 0.95 }),
  );

  const leaves: Transform[] = Array.from({ length: 19 }, (_, index) => {
    const angle = index * 2.399963229728653;
    const radial = 0.14 + deterministic(index, 1) * 0.48;
    const y = 3.35 + deterministic(index, 2) * 1.42;
    return {
      position: [
        Math.cos(angle) * radial,
        y,
        Math.sin(angle) * radial * 0.85,
      ],
      rotation: [
        deterministic(index, 3) * 0.55,
        angle,
        deterministic(index, 4) * 0.42,
      ],
      scale: [
        0.25 + deterministic(index, 5) * 0.12,
        0.22 + deterministic(index, 6) * 0.12,
        0.24 + deterministic(index, 7) * 0.12,
      ],
      color: LEAF_COLORS[index % LEAF_COLORS.length],
    };
  });
  addInstances(
    root,
    "CSD attack memorial young French maple leaves",
    new IcosahedronGeometry(1, 1),
    material(0xffffff, { roughness: 0.93 }),
    leaves,
  );
}

function addRoundGuard(root: Group): void {
  const profile = CSD_ATTACK_MEMORIAL_PROFILE;
  const steel = material(0x343b3c, { metalness: 0.48, roughness: 0.55 });
  addMesh(
    root,
    "CSD attack memorial round metal guard lower collar",
    new CylinderGeometry(0.75, 0.78, 0.38, 32, 1, true),
    steel,
    [0, 0.31, 0],
  );
  const rods: Transform[] = Array.from(
    { length: profile.guardRodCount },
    (_, index) => {
      const angle = (index / profile.guardRodCount) * Math.PI * 2;
      const bottomRadius = 0.72;
      const topRadius = 0.56;
      const y = 1.21;
      const lean = Math.atan2(bottomRadius - topRadius, 1.78);
      return {
        position: [
          Math.cos(angle) * (bottomRadius + topRadius) * 0.5,
          y,
          Math.sin(angle) * (bottomRadius + topRadius) * 0.5,
        ],
        rotation: [Math.sin(angle) * lean, angle, -Math.cos(angle) * lean],
        scale: [0.045, 1.78, 0.07],
      };
    },
  );
  addInstances(
    root,
    "CSD attack memorial round metal guard vertical rods",
    new BoxGeometry(1, 1, 1),
    steel,
    rods,
  );
  addInstances(
    root,
    "CSD attack memorial round metal guard rings",
    new TorusGeometry(0.75, 0.026, 6, 36),
    steel,
    [
      { position: [0, 0.53, 0], rotation: [Math.PI / 2, 0, 0] },
      {
        position: [0, 1.08, 0],
        rotation: [Math.PI / 2, 0, 0],
        scale: [0.88, 0.88, 0.88],
      },
      {
        position: [0, 1.82, 0],
        rotation: [Math.PI / 2, 0, 0],
        scale: [0.74, 0.74, 0.74],
      },
    ],
  );
}

function addStaticOfferings(root: Group): void {
  const detail = new Group();
  detail.name = "CSD attack memorial fine detail";
  detail.userData.staticOfferings = true;
  detail.userData.motionPolicy = "static in every mode including Schwellenraum";

  const flagTransforms: Transform[] = [];
  const flagAngles = [-0.75, 0.28, 1.8];
  flagAngles.forEach((angle, flagIndex) => {
    const radius = 0.69;
    for (let stripe = 0; stripe < RAINBOW.length; stripe += 1) {
      const outward = 0.045;
      flagTransforms.push({
        position: [
          Math.cos(angle) * (radius + outward),
          1.64 - stripe * 0.055 - flagIndex * 0.035,
          Math.sin(angle) * (radius + outward),
        ],
        rotation: [0, -angle + Math.PI / 2, flagIndex === 1 ? 0.08 : -0.05],
        scale: [0.36, 0.052, 0.018],
        color: RAINBOW[stripe],
      });
    }
  });
  const flagMesh = addInstances(
    detail,
    "CSD attack memorial static Pride flag stripes",
    new BoxGeometry(1, 1, 1),
    material(0xffffff, { roughness: 0.74 }),
    flagTransforms,
  );
  flagMesh.userData.staticInSchwellenraum = true;
  flagMesh.userData.flagKind = "static-pride-offering";

  const wreaths = addInstances(
    detail,
    "CSD attack memorial hanging wreaths",
    new TorusGeometry(0.25, 0.055, 7, 18),
    material(0x557b43, { roughness: 0.92 }),
    [
      { position: [-0.51, 1.15, 0.43], rotation: [0, -0.88, 0.08] },
      {
        position: [0.57, 1.03, -0.34],
        rotation: [0, 2.18, -0.12],
        scale: [0.86, 1.08, 0.86],
      },
    ],
  );
  wreaths.userData.staticInSchwellenraum = true;

  const blossoms: Transform[] = Array.from({ length: 20 }, (_, index) => {
    const wreathIndex = index % 2;
    const angle = (Math.floor(index / 2) / 10) * Math.PI * 2;
    const center = wreathIndex === 0 ? [-0.51, 1.15, 0.43] : [0.57, 1.03, -0.34];
    return {
      position: [
        center[0] + Math.cos(angle) * 0.25,
        center[1] + Math.sin(angle) * 0.25,
        center[2] + (wreathIndex === 0 ? 0.025 : -0.025),
      ],
      scale: [0.055, 0.055, 0.055],
      color: WREATH_FLOWER_COLORS[index % WREATH_FLOWER_COLORS.length],
    };
  });
  addInstances(
    detail,
    "CSD attack memorial wreath flowers",
    new IcosahedronGeometry(1, 0),
    material(0xffffff, { roughness: 0.88 }),
    blossoms,
  );

  const cards: Transform[] = Array.from(
    { length: CSD_ATTACK_MEMORIAL_PROFILE.cardCount },
    (_, index) => {
      const angle = -1.55 + index * 0.44;
      return {
        position: [
          Math.cos(angle) * 0.705,
          0.72 + (index % 3) * 0.17,
          Math.sin(angle) * 0.705,
        ],
        rotation: [0, -angle + Math.PI / 2, (index % 2 ? 1 : -1) * 0.08],
        scale: [0.16 + (index % 2) * 0.045, 0.21, 0.012],
        color: CARD_COLORS[index % CARD_COLORS.length],
      };
    },
  );
  addInstances(
    detail,
    "CSD attack memorial unlettered cards",
    new BoxGeometry(1, 1, 1),
    material(0xffffff, { roughness: 0.9 }),
    cards,
  );
  root.add(detail);
}

function addRainbowBench(root: Group): void {
  const profile = CSD_ATTACK_MEMORIAL_PROFILE;
  const [benchX, benchZ] = profile.benchOffsetLocalM;
  const slats: Transform[] = [];
  RAINBOW.forEach((color, index) => {
    slats.push({
      position: [benchX, 0.795 - index * 0.055, benchZ + 0.19],
      rotation: [-0.08, 0, 0],
      scale: [profile.benchWidthM, 0.052, 0.075],
      color,
    });
    slats.push({
      position: [benchX, 0.47, benchZ + 0.12 - index * 0.07],
      scale: [profile.benchWidthM, 0.045, 0.067],
      color,
    });
  });
  addInstances(
    root,
    "CSD attack memorial rainbow bench slats",
    new BoxGeometry(1, 1, 1),
    material(0xffffff, { roughness: 0.73 }),
    slats,
  );

  const frame = material(0x344652, { metalness: 0.42, roughness: 0.58 });
  addInstances(
    root,
    "CSD attack memorial rainbow bench metal frame",
    new BoxGeometry(1, 1, 1),
    frame,
    [
      { position: [-0.73, 0.23, benchZ], scale: [0.075, 0.46, 0.075] },
      { position: [0.73, 0.23, benchZ], scale: [0.075, 0.46, 0.075] },
      { position: [-0.73, 0.54, benchZ + 0.22], scale: [0.065, 0.56, 0.065] },
      { position: [0.73, 0.54, benchZ + 0.22], scale: [0.065, 0.56, 0.065] },
      { position: [0, 0.4, benchZ - 0.05], scale: [1.86, 0.06, 0.06] },
    ],
  );
}

function addSnow(root: Group): void {
  const snow = new Group();
  snow.name = "CSD attack memorial snow caps";
  snow.userData.snowOnly = true;
  snow.userData.snowActive = false;
  snow.visible = false;
  const snowMaterial = material(0xe9f1f3, { roughness: 0.98 });
  addInstances(
    snow,
    "CSD attack memorial young maple crown snow",
    new IcosahedronGeometry(1, 1),
    snowMaterial,
    [
      { position: [-0.58, 4.5, -0.15], scale: [0.48, 0.1, 0.34] },
      { position: [0.18, 4.84, -0.22], scale: [0.58, 0.11, 0.38] },
      { position: [0.66, 4.44, 0.27], scale: [0.4, 0.09, 0.3] },
    ],
  );
  addInstances(
    snow,
    "CSD attack memorial bench and guard snow",
    new BoxGeometry(1, 1, 1),
    snowMaterial,
    [
      { position: [0, 0.8435, 8.79], scale: [2.08, 0.045, 0.075] },
      { position: [0, 0.51, 8.545], scale: [2.08, 0.035, 0.417] },
    ],
  );
  addMesh(
    snow,
    "CSD attack memorial guard upper-ring snow",
    new TorusGeometry(0.555, 0.045, 6, 36, Math.PI),
    snowMaterial,
    [0, 1.84, 0],
  ).rotation.x = Math.PI / 2;
  root.add(snow);
}

export function createCsdAttackMemorial(): Group {
  const profile = CSD_ATTACK_MEMORIAL_PROFILE;
  const root = new Group();
  root.name = profile.name;
  root.position.set(...profile.worldM);
  root.rotation.y = profile.rotationY;
  root.userData = {
    cardCount: profile.cardCount,
    geometryStatus: profile.geometryStatus,
    guardRodCount: profile.guardRodCount,
    memorialStatus:
      "newly established memorial place; not represented as a final permanent monument",
    osmKey: profile.osmKey,
    positionStatus: profile.positionStatus,
    schwellenraumGeschuetzt: true,
    sourceAttribution:
      "OpenStreetMap contributors · Bezirksamt Mitte · Berlin.de · rbb24 (reference-only)",
    species: profile.species,
    startDate: profile.startDate,
    staticFlags: true,
    staticPrideFlagCount: profile.staticPrideFlagCount,
    visualReferenceStatus: profile.visualReferenceStatus,
    wreathCount: profile.wreathCount,
  };
  addPlantingAndMaple(root);
  addRoundGuard(root);
  addStaticOfferings(root);
  addRainbowBench(root);
  addSnow(root);
  return root;
}

export function setCsdAttackMemorialSnow(
  root: Object3D,
  enabled: boolean,
): void {
  root.traverse((object) => {
    if (object.userData.snowOnly !== true) return;
    object.userData.snowActive = enabled;
    object.visible = enabled;
  });
}

function worldToMemorialLocal(
  x: number,
  z: number,
): readonly [number, number] {
  const profile = CSD_ATTACK_MEMORIAL_PROFILE;
  const dx = x - profile.worldM[0];
  const dz = z - profile.worldM[2];
  const cosine = Math.cos(profile.rotationY);
  const sine = Math.sin(profile.rotationY);
  return [cosine * dx - sine * dz, sine * dx + cosine * dz];
}

/** Exact static solids for the tree/guard, leafy crown and rainbow bench. */
export function csdAttackMemorialSolidAt(
  x: number,
  y: number,
  z: number,
  radius = 0,
): boolean {
  if (![x, y, z, radius].every(Number.isFinite)) return false;
  const profile = CSD_ATTACK_MEMORIAL_PROFILE;
  const [localX, localZ] = worldToMemorialLocal(x, z);
  const localY = y - profile.worldM[1];
  const bodyRadius = Math.max(0, radius);

  const guardRadius = profile.guardDiameterM / 2 + bodyRadius;
  if (
    localY >= -bodyRadius &&
    localY <= profile.guardHeightM + bodyRadius &&
    localX * localX + localZ * localZ <= guardRadius * guardRadius
  ) {
    return true;
  }

  const crownCenterY = 4.18;
  const crownRadiusX = profile.crownDiameterM / 2 + bodyRadius;
  const crownRadiusY = 1.15 + bodyRadius;
  const crownRadiusZ = 1.08 + bodyRadius;
  if (
    ((localX / crownRadiusX) ** 2 +
      ((localY - crownCenterY) / crownRadiusY) ** 2 +
      (localZ / crownRadiusZ) ** 2 <=
      1)
  ) {
    return true;
  }

  const [benchX, benchZ] = profile.benchOffsetLocalM;
  return (
    Math.abs(localX - benchX) <= profile.benchWidthM / 2 + bodyRadius &&
    Math.abs(localZ - benchZ) <= 0.42 + bodyRadius &&
    localY >= -bodyRadius &&
    localY <= profile.benchHeightM + bodyRadius
  );
}
