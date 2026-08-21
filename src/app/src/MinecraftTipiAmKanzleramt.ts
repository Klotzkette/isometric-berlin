import {
  BoxGeometry,
  Color,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  StaticDrawUsage,
  Vector3,
} from "three";

import {
  TIPI_AM_KANZLERAMT_PROFILE,
  TIPI_GROUND_Y,
  TIPI_ROTATION_Y,
  tipiMarqueeTransforms,
} from "./TipiAmKanzleramt";
import {
  MINECRAFT_ARCHITECTURAL_BLOCKS as BLOCK,
  MINECRAFT_PALETTE,
} from "./visual-modes/minecraft/palette";

type Point3 = readonly [number, number, number];

type LocalBlock = {
  color: number;
  cue: string;
  position: Point3;
  size: Point3;
};

const ANCHOR: Point3 = [
  TIPI_AM_KANZLERAMT_PROFILE.osmLandmarkWorldM[0],
  TIPI_GROUND_Y,
  TIPI_AM_KANZLERAMT_PROFILE.osmLandmarkWorldM[1],
];
const MAX_BLOCK_SPAN_M = 4;

function localToWorld(localX: number, localZ: number): [number, number] {
  const cosine = Math.cos(TIPI_ROTATION_Y);
  const sine = Math.sin(TIPI_ROTATION_Y);
  return [
    ANCHOR[0] + cosine * localX + sine * localZ,
    ANCHOR[2] - sine * localX + cosine * localZ,
  ];
}

function worldToLocal(worldX: number, worldZ: number): [number, number] {
  const cosine = Math.cos(TIPI_ROTATION_Y);
  const sine = Math.sin(TIPI_ROTATION_Y);
  const dx = worldX - ANCHOR[0];
  const dz = worldZ - ANCHOR[2];
  return [dx * cosine - dz * sine, dx * sine + dz * cosine];
}

function pushBlock(
  blocks: LocalBlock[],
  cue: string,
  position: Point3,
  size: Point3,
  color: number,
): void {
  blocks.push({ color, cue, position, size });
}

function pushSplitBox(
  blocks: LocalBlock[],
  cue: string,
  position: Point3,
  size: Point3,
  color: number,
): void {
  const segments = size.map((value) =>
    Math.max(1, Math.ceil(value / MAX_BLOCK_SPAN_M)),
  ) as [number, number, number];
  const childSize = size.map((value, axis) => value / segments[axis]) as [
    number,
    number,
    number,
  ];
  for (let xIndex = 0; xIndex < segments[0]; xIndex += 1) {
    for (let yIndex = 0; yIndex < segments[1]; yIndex += 1) {
      for (let zIndex = 0; zIndex < segments[2]; zIndex += 1) {
        pushBlock(
          blocks,
          cue,
          [
            position[0] - size[0] / 2 + childSize[0] * (xIndex + 0.5),
            position[1] - size[1] / 2 + childSize[1] * (yIndex + 0.5),
            position[2] - size[2] / 2 + childSize[2] * (zIndex + 0.5),
          ],
          childSize,
          color,
        );
      }
    }
  }
}

function addAuditorium(blocks: LocalBlock[]): void {
  for (let localX = -14; localX <= 14; localX += 4) {
    for (let localZ = -10; localZ <= 10; localZ += 4) {
      const radius = Math.sqrt((localX / 16) ** 2 + (localZ / 13) ** 2);
      if (radius > 1) continue;
      pushBlock(
        blocks,
        "TIPI coarse elliptical canvas wall",
        [localX, 1.8, localZ],
        [3.72, 3.6, 3.72],
        (Math.round(localX / 4) + Math.round(localZ / 4)) % 2 === 0
          ? 0xe8d1ae
          : BLOCK.quartzIvory,
      );
      const angle = Math.atan2(localZ / 13, localX / 16);
      const eightPeakWave = (Math.cos(angle * 8) + 1) * 0.72;
      const roofY = 4.3 + (1 - radius) * 6.0 + eightPeakWave;
      pushBlock(
        blocks,
        "TIPI stepped eight-peak block roof",
        [localX, Math.round(roofY * 2) / 2, localZ],
        [3.62, 2.1, 3.62],
        (Math.round(localX / 4) - Math.round(localZ / 4)) % 2 === 0
          ? BLOCK.marbleLight
          : BLOCK.silver,
      );
    }
  }
  for (let peak = 0; peak < 8; peak += 1) {
    const angle = (peak / 8) * Math.PI * 2;
    pushBlock(
      blocks,
      "TIPI eight explicit roof peak blocks",
      [Math.cos(angle) * 8.1, 12.2, Math.sin(angle) * 6.45],
      [2.4, 2.8, 2.4],
      peak % 2 === 0 ? BLOCK.marbleLight : BLOCK.silver,
    );
  }
}

function addEntrance(blocks: LocalBlock[]): void {
  pushSplitBox(
    blocks,
    "TIPI dark-timber entrance hall",
    [0, 2.1, 13.8],
    [35.5, 4.2, 4.6],
    0x704a2d,
  );
  for (const side of [-1, 1]) {
    for (let tier = 0; tier < 3; tier += 1) {
      pushSplitBox(
        blocks,
        "TIPI twin stepped entrance gables",
        [side * 10.35, 4.5 + tier * 1.25, 13.35],
        [10.8 - tier * 3.0, 1.1, 4.0],
        tier % 2 === 0 ? 0xc09a68 : 0x704a2d,
      );
    }
  }
  pushSplitBox(
    blocks,
    "TIPI raised central foyer block pavilion",
    [0, 6.0, 11.8],
    [10.2, 4.6, 5.3],
    0x704a2d,
  );
  pushSplitBox(
    blocks,
    "TIPI central flat canopy",
    [0, 8.5, 11.8],
    [11.1, 0.5, 6.2],
    0xc09a68,
  );
  for (let door = 0; door < 8; door += 1) {
    pushBlock(
      blocks,
      "TIPI eight teal entrance-door blocks",
      [-14.3 + door * 4.08, 1.8, 16.2],
      [2.75, 2.9, 0.5],
      BLOCK.tealGlass,
    );
  }
}

function addSidePavilions(blocks: LocalBlock[]): void {
  for (const side of [-1, 1]) {
    for (let tier = 0; tier < 4; tier += 1) {
      const width = 13.2 - tier * 2.7;
      pushSplitBox(
        blocks,
        "TIPI two stepped white side pavilions",
        [side * 18.1, 2.1 + tier * 2.25, 5.8],
        [width, 2.1, width * 0.82],
        tier % 2 === 0 ? BLOCK.marbleLight : BLOCK.silver,
      );
    }
    for (let tier = 0; tier < 3; tier += 1) {
      const width = 7.6 - tier * 2.0;
      pushSplitBox(
        blocks,
        "TIPI two smaller rear pavilion peaks",
        [side * 10.5, 1.8 + tier * 2.1, -10.2],
        [width, 1.9, width * 0.86],
        tier % 2 === 0 ? BLOCK.marbleLight : BLOCK.silver,
      );
    }
  }
}

function addOwnerMarquee(blocks: LocalBlock[]): void {
  pushSplitBox(
    blocks,
    "TIPI fictional owner-authored Pigor marquee backing",
    [0, 7.25, 16.05],
    [26.8, 4.35, 0.62],
    0x202923,
  );
  const title = tipiMarqueeTransforms(TIPI_AM_KANZLERAMT_PROFILE.marquee, {
    centerY: 8.35,
    spacing: 0.225,
  });
  for (const transform of title) {
    pushBlock(
      blocks,
      "TIPI fictional owner-authored PIGOR & EICHHORN gold letter blocks",
      [transform.position[0], transform.position[1], 16.42],
      [0.22, 0.22, 0.28],
      BLOCK.gold,
    );
  }
}

export function createMinecraftTipiAmKanzleramt(): InstancedMesh {
  const blocks: LocalBlock[] = [];
  addAuditorium(blocks);
  addSidePavilions(blocks);
  addEntrance(blocks);
  addOwnerMarquee(blocks);

  const material = new MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x2b3132,
    emissiveIntensity: 0.14,
    flatShading: true,
    metalness: 0,
    roughness: 0.93,
  });
  const mesh = new InstancedMesh(
    new BoxGeometry(1, 1, 1),
    material,
    blocks.length,
  );
  mesh.name = "Minecraft TIPI am Kanzleramt block signature";
  const matrix = new Matrix4();
  const scale = new Vector3();
  const color = new Color();
  blocks.forEach((block, index) => {
    const [worldX, worldZ] = localToWorld(block.position[0], block.position[2]);
    matrix.makeRotationY(TIPI_ROTATION_Y);
    matrix.scale(scale.fromArray(block.size));
    matrix.setPosition(worldX, ANCHOR[1] + block.position[1], worldZ);
    mesh.setMatrixAt(index, matrix);
    mesh.setColorAt(index, color.setHex(block.color));
  });
  mesh.instanceMatrix.setUsage(StaticDrawUsage);
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.setUsage(StaticDrawUsage);
    mesh.instanceColor.needsUpdate = true;
  }
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const cueCounts = Object.fromEntries(
    [...new Set(blocks.map(({ cue }) => cue))].map((cue) => [
      cue,
      blocks.filter((block) => block.cue === cue).length,
    ]),
  );
  mesh.userData = {
    blockCount: blocks.length,
    blockNative: true,
    collisionRole: "visual-replacement-over-source-voxel-collision",
    cueCounts,
    drawCallBudget: 1,
    landmarkId: "tipi-am-kanzleramt",
    marquee: TIPI_AM_KANZLERAMT_PROFILE.marquee,
    marqueeAlwaysVisible: true,
    marqueeFictional: true,
    marqueeIsOwnerAuthored: true,
    noTexture: true,
    sourceUrls: [...TIPI_AM_KANZLERAMT_PROFILE.sourceUrls],
  };
  return mesh;
}

/** Exact union of the authored tent, foyer and four pavilion footprints. */
export function isMinecraftTipiReplacementColumn(
  worldX: number,
  worldZ: number,
): boolean {
  const [localX, localZ] = worldToLocal(worldX, worldZ);
  const inMainEllipse = (localX / 16) ** 2 + (localZ / 13) ** 2 <= 1;
  const inEntrance = Math.abs(localX) <= 18 && localZ >= 11 && localZ <= 18.2;
  const inSidePavilion = [-18.1, 18.1].some(
    (centerX) =>
      ((localX - centerX) / 7.1) ** 2 + ((localZ - 5.8) / 5.9) ** 2 <= 1,
  );
  const inRearPavilion = [-10.5, 10.5].some(
    (centerX) =>
      ((localX - centerX) / 4.2) ** 2 + ((localZ + 10.2) / 3.7) ** 2 <= 1,
  );
  return inMainEllipse || inEntrance || inSidePavilion || inRearPavilion;
}

export function minecraftTipiPaletteIsClosed(): boolean {
  const palette = new Set<number>(MINECRAFT_PALETTE);
  const mesh = createMinecraftTipiAmKanzleramt();
  const color = new Color();
  for (let index = 0; index < mesh.count; index += 1) {
    mesh.getColorAt(index, color);
    if (!palette.has(color.getHex())) return false;
  }
  return true;
}
