import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Material,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
} from "three";
import { createLetteringTexture } from "./drawnLettering";

type WorldXZ = readonly [number, number];

export type StarbucksFacadeProfile = Readonly<{
  key: "west" | "south";
  sourceStartWorldM: WorldXZ;
  sourceEndWorldM: WorldXZ;
  directionWorld: WorldXZ;
  outwardNormalWorld: WorldXZ;
  rotationYRadians: number;
  localAlongSign: -1 | 1;
  storefrontLengthM: number;
}>;

export type StarbucksPariserPlatzProfile = Readonly<{
  name: "Starbucks Pariser Platz";
  osmNodeId: "66917229";
  lod2BuildingId: "K00005Hq";
  fullLod2BuildingId: "DEBE01YYK00005Hq";
  wgs84: Readonly<{ longitude: number; latitude: number }>;
  poiEpsg25833M: WorldXZ;
  poiWorldM: readonly [number, number, number];
  groundY: number;
  southwestCornerEpsg25833M: WorldXZ;
  southwestCornerWorldM: WorldXZ;
  facades: Readonly<{
    west: StarbucksFacadeProfile;
    south: StarbucksFacadeProfile;
  }>;
}>;

/**
 * Source-bound tenant profile for the corner shop at Pariser Platz 4a.
 *
 * The POI is OSM node 66917229. The two source axes are vertices of Berlin's
 * LoD2 building K00005Hq, converted with the viewer origin 389500 E / 5820000 N.
 * The tenant lengths are deliberately shorter, photo-bounded spans along those
 * real edges; the overlay never invents a second building volume.
 */
export const STARBUCKS_PARISER_PLATZ_PROFILE: StarbucksPariserPlatzProfile = {
  name: "Starbucks Pariser Platz",
  osmNodeId: "66917229",
  lod2BuildingId: "K00005Hq",
  fullLod2BuildingId: "DEBE01YYK00005Hq",
  wgs84: {
    longitude: 13.3797732,
    latitude: 52.5167295,
  },
  poiEpsg25833M: [390059.573409725, 5819746.529008882],
  poiWorldM: [559.5734097249806, 4.95, 253.47099111787975],
  groundY: 4.95,
  southwestCornerEpsg25833M: [390051.552, 5819740.76],
  southwestCornerWorldM: [551.552, 259.24],
  facades: {
    west: {
      key: "west",
      sourceStartWorldM: [551.552, 259.24],
      sourceEndWorldM: [550.123, 242.808],
      directionWorld: [-0.08663746501986311, -0.996239905672791],
      outwardNormalWorld: [-0.996239905672791, 0.08663746501986311],
      rotationYRadians: -1.4840501098435204,
      localAlongSign: -1,
      storefrontLengthM: 13,
    },
    south: {
      key: "south",
      sourceStartWorldM: [551.552, 259.24],
      sourceEndWorldM: [576.089, 257.151],
      directionWorld: [0.9963954516513699, -0.08482985281410553],
      outwardNormalWorld: [0.08482985281410553, 0.9963954516513699],
      rotationYRadians: 0.0849319244334032,
      localAlongSign: 1,
      storefrontLengthM: 12,
    },
  },
};

type InstanceTransform = Readonly<{
  position: readonly [number, number, number];
  rotationY?: number;
  scale: readonly [number, number, number];
}>;

const OVERLAY_OFFSET_M = 0.13;
const GLASS_BOTTOM_M = 0.16;
const GLASS_HEIGHT_M = 3.55;
const SIGN_HEIGHT_M = 0.72;
const SIGN_WIDTH_M = 5.8;
const SNOW_CAPS_NAME = "Starbucks snow caps";

function addInstances(
  group: Group,
  name: string,
  geometry: BoxGeometry | CylinderGeometry,
  material: Material,
  transforms: readonly InstanceTransform[],
): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, transforms.length);
  const transform = new Object3D();
  transforms.forEach((instance, index) => {
    transform.position.set(...instance.position);
    transform.rotation.set(0, instance.rotationY ?? 0, 0);
    transform.scale.set(...instance.scale);
    transform.updateMatrix();
    mesh.setMatrixAt(index, transform.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function facadeWorldPoint(
  facade: StarbucksFacadeProfile,
  distanceAlongM: number,
  distanceOutwardM: number,
): [number, number] {
  return [
    facade.sourceStartWorldM[0] +
      facade.directionWorld[0] * distanceAlongM +
      facade.outwardNormalWorld[0] * distanceOutwardM,
    facade.sourceStartWorldM[1] +
      facade.directionWorld[1] * distanceAlongM +
      facade.outwardNormalWorld[1] * distanceOutwardM,
  ];
}

function createFacadeOverlay(
  facade: StarbucksFacadeProfile,
  frameMaterial: MeshStandardMaterial,
  glassMaterial: MeshPhysicalMaterial,
  letteringMaterial: MeshStandardMaterial,
): Group {
  const group = new Group();
  group.name = `Starbucks ${facade.key} source-bound facade overlay`;
  group.position.set(
    facade.sourceStartWorldM[0] +
      facade.outwardNormalWorld[0] * OVERLAY_OFFSET_M,
    STARBUCKS_PARISER_PLATZ_PROFILE.groundY,
    facade.sourceStartWorldM[1] +
      facade.outwardNormalWorld[1] * OVERLAY_OFFSET_M,
  );
  group.rotation.y = facade.rotationYRadians;
  group.userData = {
    facade: facade.key,
    sourceAxisStartWorldM: [...facade.sourceStartWorldM],
    sourceAxisEndWorldM: [...facade.sourceEndWorldM],
    storefrontLengthM: facade.storefrontLengthM,
    overlayDepthM: 0.14,
    sourceBound: true,
  };

  const marginM = 0.48;
  const centreMullionM = 0.16;
  const bayWidthM =
    (facade.storefrontLengthM - marginM * 2 - centreMullionM) / 2;
  const localX = (distanceM: number) => facade.localAlongSign * distanceM;
  const firstBayCentreM = marginM + bayWidthM / 2;
  const secondBayCentreM =
    marginM + bayWidthM + centreMullionM + bayWidthM / 2;

  const glass = addInstances(
    group,
    `Starbucks ${facade.key} large dark glass fields`,
    new BoxGeometry(1, 1, 1),
    glassMaterial,
    [firstBayCentreM, secondBayCentreM].map((distanceM) => ({
      position: [
        localX(distanceM),
        GLASS_BOTTOM_M + GLASS_HEIGHT_M / 2,
        0,
      ],
      scale: [bayWidthM, GLASS_HEIGHT_M, 0.11],
    })),
  );
  glass.userData.facade = facade.key;
  glass.userData.overlayDepthM = 0.11;

  const openingWidthM = facade.storefrontLengthM - marginM * 2;
  const verticalDistancesM = [
    marginM,
    facade.storefrontLengthM / 2,
    facade.storefrontLengthM - marginM,
  ];
  const frameTransforms: InstanceTransform[] = verticalDistancesM.map(
    (distanceM) => ({
      position: [
        localX(distanceM),
        GLASS_BOTTOM_M + GLASS_HEIGHT_M / 2,
        0.075,
      ],
      scale: [0.14, GLASS_HEIGHT_M + 0.12, 0.12],
    }),
  );
  frameTransforms.push(
    {
      position: [
        localX(facade.storefrontLengthM / 2),
        GLASS_BOTTOM_M,
        0.075,
      ],
      scale: [openingWidthM, 0.14, 0.12],
    },
    {
      position: [
        localX(facade.storefrontLengthM / 2),
        GLASS_BOTTOM_M + GLASS_HEIGHT_M,
        0.075,
      ],
      scale: [openingWidthM, 0.16, 0.12],
    },
  );
  const frames = addInstances(
    group,
    `Starbucks ${facade.key} slim dark mullions and rails`,
    new BoxGeometry(1, 1, 1),
    frameMaterial,
    frameTransforms,
  );
  frames.userData.facade = facade.key;

  const wordmark = new Mesh(
    new BoxGeometry(SIGN_WIDTH_M, SIGN_HEIGHT_M, 0.045),
    letteringMaterial,
  );
  wordmark.name = `Starbucks ${facade.key} direct STARBUCKS wordmark`;
  wordmark.position.set(
    localX(facade.storefrontLengthM / 2),
    GLASS_BOTTOM_M + GLASS_HEIGHT_M + 0.55,
    0.09,
  );
  wordmark.castShadow = true;
  wordmark.receiveShadow = true;
  wordmark.userData = {
    facade: facade.key,
    lettering: "STARBUCKS",
    signStyle: "direct-grey-metal-lettering-no-fascia",
    sharedCodeGeneratedTexture: true,
  };
  group.add(wordmark);
  return group;
}

function createPatio(
  darkMaterial: MeshStandardMaterial,
  planterMaterial: MeshStandardMaterial,
): Group {
  const group = new Group();
  group.name = "Starbucks compact freestanding pavement furniture";
  group.userData.collisionPolicy =
    "compact visual staffage; does not replace the LoD2 building collider";
  const west = STARBUCKS_PARISER_PLATZ_PROFILE.facades.west;
  const south = STARBUCKS_PARISER_PLATZ_PROFILE.facades.south;
  const placements = [
    { facade: west, distanceAlongM: 3.2, distanceOutwardM: 2.05 },
    { facade: west, distanceAlongM: 8.8, distanceOutwardM: 2.05 },
    { facade: south, distanceAlongM: 3.6, distanceOutwardM: 2.1 },
    { facade: south, distanceAlongM: 8.8, distanceOutwardM: 2.1 },
  ].map((placement) => ({
    ...placement,
    world: facadeWorldPoint(
      placement.facade,
      placement.distanceAlongM,
      placement.distanceOutwardM,
    ),
  }));
  const groundY = STARBUCKS_PARISER_PLATZ_PROFILE.groundY;

  const canopies = addInstances(
    group,
    "Starbucks four black freestanding umbrella canopies",
    new CylinderGeometry(1.15, 1.48, 0.16, 8),
    darkMaterial,
    placements.map(({ world }) => ({
      position: [world[0], groundY + 2.55, world[1]],
      scale: [1, 1, 1],
    })),
  );
  canopies.userData.freestanding = true;

  addInstances(
    group,
    "Starbucks umbrella poles",
    new CylinderGeometry(0.045, 0.045, 2.45, 8),
    darkMaterial,
    placements.map(({ world }) => ({
      position: [world[0], groundY + 1.28, world[1]],
      scale: [1, 1, 1],
    })),
  );
  addInstances(
    group,
    "Starbucks compact round pavement tables",
    new CylinderGeometry(0.42, 0.42, 0.08, 12),
    darkMaterial,
    placements.map(({ world }) => ({
      position: [world[0], groundY + 0.76, world[1]],
      scale: [1, 1, 1],
    })),
  );
  addInstances(
    group,
    "Starbucks compact table stems",
    new CylinderGeometry(0.055, 0.055, 0.72, 8),
    darkMaterial,
    placements.map(({ world }) => ({
      position: [world[0], groundY + 0.38, world[1]],
      scale: [1, 1, 1],
    })),
  );

  const seats: InstanceTransform[] = [];
  for (const placement of placements) {
    const { facade, world } = placement;
    for (const side of [-1, 1]) {
      seats.push({
        position: [
          world[0] + facade.directionWorld[0] * side * 0.72,
          groundY + 0.48,
          world[1] + facade.directionWorld[1] * side * 0.72,
        ],
        rotationY: facade.rotationYRadians,
        scale: [0.46, 0.08, 0.42],
      });
    }
  }
  addInstances(
    group,
    "Starbucks compact dark pavement chairs",
    new BoxGeometry(1, 1, 1),
    darkMaterial,
    seats,
  );

  const planterPlacements = [
    facadeWorldPoint(west, 0.9, 2.65),
    facadeWorldPoint(west, 11.9, 2.65),
    facadeWorldPoint(south, 1, 2.7),
    facadeWorldPoint(south, 10.9, 2.7),
  ];
  addInstances(
    group,
    "Starbucks compact stone planters",
    new BoxGeometry(1, 1, 1),
    planterMaterial,
    planterPlacements.map((world) => ({
      position: [world[0], groundY + 0.34, world[1]],
      scale: [0.72, 0.68, 0.72],
    })),
  );

  const snowCaps = addInstances(
    group,
    SNOW_CAPS_NAME,
    new CylinderGeometry(1.16, 1.49, 0.055, 8),
    new MeshStandardMaterial({
      color: 0xf4f7fa,
      flatShading: true,
      roughness: 0.96,
    }),
    placements.map(({ world }) => ({
      position: [world[0], groundY + 2.665, world[1]],
      scale: [1, 1, 1],
    })),
  );
  snowCaps.visible = false;
  snowCaps.userData.snowCap = true;
  return group;
}

/** Build the thin, source-aligned Starbucks shopfront and its pavement patio. */
export function createStarbucksPariserPlatz(): Group {
  const group = new Group();
  group.name = STARBUCKS_PARISER_PLATZ_PROFILE.name;
  group.userData = {
    geometryStatus:
      "source-bound overlays on the west and south LoD2 K00005Hq edges; tenant spans are photo-bounded",
    sourceBound: true,
    osmNodeId: STARBUCKS_PARISER_PLATZ_PROFILE.osmNodeId,
    lod2BuildingId: STARBUCKS_PARISER_PLATZ_PROFILE.lod2BuildingId,
    poiWorldM: [...STARBUCKS_PARISER_PLATZ_PROFILE.poiWorldM],
    southwestCornerWorldM: [
      ...STARBUCKS_PARISER_PLATZ_PROFILE.southwestCornerWorldM,
    ],
    sourceAttribution: [
      "OpenStreetMap contributors: node 66917229",
      "Berlin LoD2 building K00005Hq: west and south source edges",
    ],
    modelPolicy:
      "thin facade overlays only; no green fascia, attached awning or duplicate building wall",
  };

  const frameMaterial = new MeshStandardMaterial({
    color: 0x252826,
    flatShading: true,
    metalness: 0.38,
    roughness: 0.52,
  });
  const glassMaterial = new MeshPhysicalMaterial({
    color: 0x1a2427,
    metalness: 0.08,
    opacity: 0.72,
    roughness: 0.16,
    transparent: true,
  });
  glassMaterial.userData.nightEmissive = 0xffcf9c;
  glassMaterial.userData.nightEmissiveIntensity = 0.62;

  // Exactly one deterministic, code-generated texture is shared by both
  // direct grey wordmarks. Its limestone field disappears into the real wall.
  const sharedLetteringTexture = createLetteringTexture({
    bandHeightM: SIGN_HEIGHT_M,
    bandWidthM: SIGN_WIDTH_M,
    capHeightM: 0.39,
    fieldColor: "#ddd8cc",
    letterColor: "#666862",
    text: "STARBUCKS",
    texelsPerMetre: 220,
  });
  const letteringMaterial = new MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.78,
  });
  if (sharedLetteringTexture) {
    letteringMaterial.map = sharedLetteringTexture;
    letteringMaterial.needsUpdate = true;
  }
  letteringMaterial.userData.sharedCodeGeneratedTexture = true;
  letteringMaterial.userData.nightEmissive = 0x9a9c96;
  letteringMaterial.userData.nightEmissiveIntensity = 0.12;

  group.add(
    createFacadeOverlay(
      STARBUCKS_PARISER_PLATZ_PROFILE.facades.west,
      frameMaterial,
      glassMaterial,
      letteringMaterial,
    ),
    createFacadeOverlay(
      STARBUCKS_PARISER_PLATZ_PROFILE.facades.south,
      frameMaterial,
      glassMaterial,
      letteringMaterial,
    ),
  );

  const darkPatioMaterial = new MeshStandardMaterial({
    color: 0x171a18,
    flatShading: true,
    metalness: 0.25,
    roughness: 0.66,
  });
  const planterMaterial = new MeshStandardMaterial({
    color: 0xaaa497,
    flatShading: true,
    roughness: 0.9,
  });
  group.add(createPatio(darkPatioMaterial, planterMaterial));
  return group;
}

/** Toggle the authored snow caps without coupling this module to the viewer. */
export function setStarbucksPariserPlatzSnow(
  root: Group,
  enabled: boolean,
): void {
  const snowCaps = root.getObjectByName(SNOW_CAPS_NAME);
  if (snowCaps) snowCaps.visible = enabled;
}
