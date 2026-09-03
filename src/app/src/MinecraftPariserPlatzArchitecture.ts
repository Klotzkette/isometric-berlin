import {
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from "three";

import {
  PARISER_PLATZ_ARCHITECTURE_PROFILE,
  PARISER_PLATZ_ARCHITECTURE_GROUP_NAME,
} from "./PariserPlatzArchitecture";
import { MINECRAFT_ARCHITECTURAL_BLOCKS as BLOCK } from "./visual-modes/minecraft/palette";

/**
 * Block-native recognition layer for the five civic buildings on Pariser
 * Platz. The surveyed voxel masses remain in place; this single instanced
 * batch gives them readable Minecraft signatures without leaking the smooth
 * Day/Night facade overlay into Minecraft mode.
 */

export const MINECRAFT_PARISER_PLATZ_GROUP_NAME =
  "Minecraft Pariser Platz civic architecture";
export const MINECRAFT_PARISER_PLATZ_MESH_NAME =
  "Voxel Pariser Platz civic architecture signatures";

type BuildingProfile = {
  facadeCenterWorldM: readonly [number, number, number];
  rotationYRad: number;
  outwardSign: number;
};

type Block = {
  color: number;
  position: readonly [number, number, number];
  rotationY: number;
  size: readonly [number, number, number];
};

const PALE = BLOCK.quartzIvory;
const STONE = BLOCK.limestone;
const CONCRETE = BLOCK.marbleShadow;
const DARK = BLOCK.deepRecess;
const GLASS = BLOCK.tealGlass;
const LIT_GLASS = BLOCK.gold;
const STEEL = BLOCK.iron;
const COPPER = BLOCK.oxidisedCopper;

function pushBlock(
  blocks: Block[],
  profile: BuildingProfile,
  color: number,
  localU: number,
  centerAboveGround: number,
  localDepth: number,
  size: readonly [number, number, number],
  rotationOffsetY = 0,
): void {
  const cosine = Math.cos(profile.rotationYRad);
  const sine = Math.sin(profile.rotationYRad);
  const depth = localDepth * profile.outwardSign;
  blocks.push({
    color,
    position: [
      profile.facadeCenterWorldM[0] + localU * cosine + depth * sine,
      profile.facadeCenterWorldM[1] + centerAboveGround,
      profile.facadeCenterWorldM[2] - localU * sine + depth * cosine,
    ],
    rotationY: profile.rotationYRad + rotationOffsetY,
    size,
  });
}

function addMaxLiebermannSignature(blocks: Block[]): void {
  const profile =
    PARISER_PLATZ_ARCHITECTURE_PROFILE.buildings.maxLiebermannHaus;
  for (let column = 0; column < 14; column += 1) {
    const u = -13 + column * 2;
    pushBlock(blocks, profile, PALE, u, 0.7, 0.72, [1.82, 1.3, 0.72]);
    pushBlock(blocks, profile, STONE, u, 17.8, 0.68, [1.92, 0.8, 0.78]);
  }
  for (let floor = 0; floor < 3; floor += 1) {
    for (let bay = 0; bay < 8; bay += 1) {
      const lit = (floor + bay * 2) % 9 === 3;
      pushBlock(
        blocks,
        profile,
        lit ? LIT_GLASS : DARK,
        -11.4 + bay * 3.25,
        2.6 + floor * 4.45,
        0.95,
        [1.5, floor === 0 ? 2.8 : 3.2, 0.62],
      );
    }
  }
  for (const u of [-12, -8, -4, 0, 4, 8, 12]) {
    pushBlock(blocks, profile, PALE, u, 18.9, 0.55, [1.8, 1.4, 0.78]);
  }
  // One projecting two-block balcony is enough to distinguish the current
  // Kleihues reconstruction next to the Gate without smoothing its facade.
  pushBlock(blocks, profile, STEEL, 1.7, 8.6, 1.35, [4, 0.5, 1.5]);
  pushBlock(blocks, profile, STEEL, 0.3, 9.3, 1.55, [0.35, 1.5, 0.35]);
  pushBlock(blocks, profile, STEEL, 1.7, 9.3, 1.55, [0.35, 1.5, 0.35]);
  pushBlock(blocks, profile, STEEL, 3.1, 9.3, 1.55, [0.35, 1.5, 0.35]);
}

function addFrenchEmbassySignature(blocks: Block[]): void {
  const profile = PARISER_PLATZ_ARCHITECTURE_PROFILE.buildings.frenchEmbassy;
  for (let column = 0; column < 26; column += 1) {
    const u = -25 + column * 2;
    pushBlock(
      blocks,
      profile,
      column % 3 === 0 ? CONCRETE : STONE,
      u,
      1.1,
      0.92,
      [1.82, 2, 0.72],
    );
  }
  // Six-metre covered Rue de France, represented as a true three-block void
  // register rather than a realistic smooth entry portal.
  for (const u of [-4.25, -2.25, -0.25]) {
    for (const y of [3, 5, 7]) {
      pushBlock(blocks, profile, DARK, u, y, 1.08, [1.82, 1.82, 0.72]);
    }
  }
  for (const u of [-22.7, -17, -11.3, 5, 10.7, 16.4, 22.1]) {
    for (const y of [7, 9, 11]) {
      pushBlock(blocks, profile, GLASS, u, y, 0.98, [2.9, 1.82, 0.66]);
    }
  }
  for (let bay = 0; bay < 12; bay += 1) {
    pushBlock(
      blocks,
      profile,
      bay % 5 === 2 ? LIT_GLASS : DARK,
      -23.8 + bay * 4.3,
      15.1,
      0.96,
      [2.9, 2.4, 0.66],
    );
  }
  for (let column = 0; column < 13; column += 1) {
    pushBlock(
      blocks,
      profile,
      PALE,
      -24 + column * 4,
      19.25,
      0.7,
      [3.7, 0.72, 0.82],
    );
  }
  for (const u of [-7, 2]) {
    pushBlock(blocks, profile, STEEL, u, 6.1, 1.8, [0.35, 3.2, 0.35]);
  }
  [BLOCK.lapis, PALE, BLOCK.red].forEach((color, stripe) => {
    pushBlock(
      blocks,
      profile,
      color,
      -6.7 + stripe * 0.5,
      6.6,
      1.8,
      [0.5, 1.15, 0.35],
    );
  });
  pushBlock(blocks, profile, BLOCK.lapis, 2.85, 6.6, 1.8, [1.5, 1.15, 0.35]);
  pushBlock(blocks, profile, BLOCK.gold, 2.85, 6.6, 2.05, [0.35, 0.35, 0.35]);
}

function addUsEmbassySignature(blocks: Block[]): void {
  const profile = PARISER_PLATZ_ARCHITECTURE_PROFILE.buildings.usEmbassy;
  for (let floor = 0; floor < 4; floor += 1) {
    for (let bay = 0; bay < 6; bay += 1) {
      pushBlock(
        blocks,
        profile,
        (floor * 3 + bay) % 7 === 2 ? LIT_GLASS : DARK,
        -17 + bay * 4.8,
        3 + floor * 4.35,
        0.98,
        [2.9, 2.4, 0.68],
      );
    }
  }
  for (const y of [0.7, 5.1, 9.45, 13.8, 18.15, 20.7]) {
    for (let column = 0; column < 10; column += 1) {
      pushBlock(
        blocks,
        profile,
        STONE,
        -18 + column * 4,
        y,
        0.84,
        [3.72, 0.65, 0.8],
      );
    }
  }
  // Stepped blocks form the documented cylindrical niche and arched canopy.
  const nicheU = 12.65;
  for (const [offset, outward, height] of [
    [-4, 0.8, 10],
    [-2, 1.7, 10.5],
    [0, 2.2, 11],
    [2, 1.7, 10.5],
    [4, 0.8, 10],
  ] as const) {
    for (let course = 1; course < height * 2; course += 2) {
      pushBlock(
        blocks,
        profile,
        STONE,
        nicheU + offset,
        course,
        outward,
        [1.82, 1.82, 1.82],
      );
    }
  }
  for (const u of [10.65, 12.65, 14.65]) {
    pushBlock(blocks, profile, GLASS, u, 3.7, 2.75, [1.6, 6.2, 0.72]);
  }
  for (let step = -3; step <= 3; step += 1) {
    pushBlock(
      blocks,
      profile,
      GLASS,
      nicheU + step * 1.25,
      7.7 + (3 - Math.abs(step)) * 0.45,
      3.6,
      [1.2, 0.65, 2.4],
    );
  }
  // Four glowing cubic bays make the rooftop State Room a block crown.
  for (const u of [-1.5, 1, 3.5, 6]) {
    pushBlock(blocks, profile, LIT_GLASS, u, 23.2, -3.5, [2, 3, 3.8]);
  }
}

function addAkademieSignature(blocks: Block[]): void {
  const profile =
    PARISER_PLATZ_ARCHITECTURE_PROFILE.buildings.akademieDerKuenste;
  for (let floor = 0; floor < 5; floor += 1) {
    for (let bay = 0; bay < 9; bay += 1) {
      pushBlock(
        blocks,
        profile,
        floor === 4 ? COPPER : (bay + floor * 2) % 8 === 3 ? LIT_GLASS : GLASS,
        -15.85 + bay * 3.96,
        2 + floor * 3.72,
        0.86,
        [3.45, 3.05, 0.7],
      );
    }
  }
  for (let column = 0; column <= 9; column += 1) {
    for (let course = 1; course < 20; course += 2) {
      pushBlock(
        blocks,
        profile,
        STEEL,
        -17.8 + column * 3.96,
        course,
        1.18,
        [0.42, 1.82, 0.42],
      );
    }
  }
  for (const y of [0.65, 4.3, 8, 11.7, 15.4, 19.1]) {
    for (let column = 0; column < 9; column += 1) {
      pushBlock(
        blocks,
        profile,
        STEEL,
        -15.84 + column * 3.96,
        y,
        1.18,
        [3.72, 0.42, 0.42],
      );
    }
  }
  // A white block staircase zigzags behind the cyan curtain wall. Horizontal
  // block steps replace the smooth diagonal used in the surface modes.
  for (const direction of [-1, 1]) {
    for (let flight = 0; flight < 4; flight += 1) {
      const reverse = flight % 2 === 1;
      for (let step = 0; step < 4; step += 1) {
        const localStep = reverse ? 3 - step : step;
        pushBlock(
          blocks,
          profile,
          PALE,
          direction * 6 + (localStep - 1.5) * 1.65,
          2.5 + flight * 3.72 + step * 0.72,
          1.45,
          [1.55, 0.55, 0.72],
        );
      }
    }
  }
  for (let column = 0; column < 9; column += 1) {
    pushBlock(
      blocks,
      profile,
      COPPER,
      -16 + column * 4,
      20.35,
      -1.5,
      [3.7, 0.6, 4.2],
    );
  }
  for (const u of [-4.6, -2.3, 0, 2.3, 4.6]) {
    pushBlock(blocks, profile, GLASS, u, 1.85, 1.8, [2.1, 3.25, 0.4]);
  }
  for (const u of [-4.6, 0, 4.6]) {
    pushBlock(blocks, profile, STEEL, u, 3.85, 1.85, [4.5, 0.4, 1.2]);
  }
}

function addEuropeanHouseSignature(blocks: Block[]): void {
  const profile = PARISER_PLATZ_ARCHITECTURE_PROFILE.buildings.europeanHouse;
  const frontages = [
    { frame: profile, bays: 7, pitch: 2.95, width: profile.facadeWidthM },
    {
      frame: {
        facadeCenterWorldM: profile.westReturn.centerWorldM,
        rotationYRad: profile.westReturn.rotationYRad,
        outwardSign: 1,
      },
      bays: 4,
      pitch: 3.2,
      width: profile.westReturn.widthM,
    },
  ];
  for (const { frame, bays, pitch, width } of frontages) {
    for (let floor = 0; floor < 7; floor += 1) {
      const y = floor === 0 ? 2.3 : 6.4 + (floor - 1) * 3.35;
      for (let bay = 0; bay < bays; bay += 1) {
        const u = (bay - (bays - 1) / 2) * pitch;
        pushBlock(blocks, frame, floor === 0 ? GLASS : DARK, u, y, 0.95, [
          1.8,
          floor === 0 ? 3.9 : 2.55,
          0.5,
        ]);
        if (floor > 0 && floor < 5 && (bay + floor) % 3 === 0) {
          pushBlock(
            blocks,
            frame,
            BLOCK.lapis,
            u,
            y + 1.22,
            1.15,
            [2, 0.4, 0.9],
          );
        }
      }
    }
    const segments = Math.ceil(width / 5.5);
    for (const y of [4.8, 11.5, 18.2, 26.2]) {
      for (let segment = 0; segment < segments; segment += 1) {
        pushBlock(
          blocks,
          frame,
          PALE,
          ((segment + 0.5) * width) / segments - width / 2,
          y,
          0.75,
          [width / segments, 0.4, 0.55],
        );
      }
    }
  }
  for (let course = 0; course < 3; course += 1) {
    for (const u of [-8.4, -4.2, 0, 4.2, 8.4]) {
      pushBlock(
        blocks,
        profile,
        COPPER,
        u,
        27.5 + course * 2.5,
        -course * 1.1,
        [4.15, 2.3, 0.65],
      );
    }
  }
  for (const u of [-7.5, -3.75, 0, 3.75, 7.5]) {
    pushBlock(blocks, profile, PALE, u, 28.8, 0.1, [1.7, 2, 0.6]);
    pushBlock(blocks, profile, DARK, u, 28.8, 0.55, [1.05, 1.4, 0.35]);
  }
  pushBlock(blocks, profile, STEEL, 4.6, 6, 1.6, [0.35, 3.2, 0.35]);
  pushBlock(blocks, profile, BLOCK.lapis, 5.45, 6.5, 1.6, [1.5, 1.1, 0.35]);
  pushBlock(blocks, profile, BLOCK.gold, 5.45, 6.5, 1.85, [0.35, 0.35, 0.35]);
}

export function createMinecraftPariserPlatzArchitecture(): Group {
  const blocks: Block[] = [];
  addMaxLiebermannSignature(blocks);
  addFrenchEmbassySignature(blocks);
  addUsEmbassySignature(blocks);
  addAkademieSignature(blocks);
  addEuropeanHouseSignature(blocks);

  const geometry = new BoxGeometry(1, 1, 1);
  const material = new MeshStandardMaterial({
    flatShading: true,
    metalness: 0,
    roughness: 1,
    vertexColors: true,
  });
  const mesh = new InstancedMesh(geometry, material, blocks.length);
  mesh.name = MINECRAFT_PARISER_PLATZ_MESH_NAME;
  const matrix = new Matrix4();
  const position = new Vector3();
  const scale = new Vector3();
  const rotation = new Quaternion();
  const upAxis = new Vector3(0, 1, 0);
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    position.set(...block.position);
    scale.set(...block.size);
    rotation.setFromAxisAngle(upAxis, block.rotationY);
    matrix.compose(position, rotation, scale);
    mesh.setMatrixAt(index, matrix);
    mesh.setColorAt(index, new Color(block.color));
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.userData = {
    blockNative: true,
    drawCallBudget: 1,
    genericSourceMassRetained: true,
    instanceCount: blocks.length,
    maxBlockSpanM: 6.2,
    sourceSurfaceModule: PARISER_PLATZ_ARCHITECTURE_GROUP_NAME,
    textureFree: true,
  };

  const group = new Group();
  group.name = MINECRAFT_PARISER_PLATZ_GROUP_NAME;
  group.userData = {
    buildingCount: 5,
    drawCallBudget: 1,
    geometryStatus:
      "block signatures aligned to the same LoD2 front edges as the surface facades",
    genericSourceMassRetained: true,
    instanceBudget: 760,
    sourceProfile: PARISER_PLATZ_ARCHITECTURE_PROFILE,
  };
  group.add(mesh);
  return group;
}
