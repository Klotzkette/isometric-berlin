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
import { TIPI_SITE_PARTS, isTipiSourceReplacementAt, tipiSiteEnvelope, tipiSitePartContains } from "./tipiSiteProfile";
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
  rotationY?: number;
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
  pushSplitBox(blocks, "TIPI central flat canopy", [0, 4.3, 15], [35.5, 0.4, 3], 0xc09a68);
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

function addSourcePavilions(blocks: LocalBlock[]): void {
  for (const part of TIPI_SITE_PARTS) {
    if (part.role === "auditorium") continue;
    const xs = part.ringDm.map(([x]) => x / 10), zs = part.ringDm.map(([, z]) => z / 10);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
    const { eaves, peak } = tipiSiteEnvelope(part);
    const nx = Math.ceil((maxX - minX) / 1.5), nz = Math.ceil((maxZ - minZ) / 1.5);
    const dx = (maxX - minX) / nx, dz = (maxZ - minZ) / nz;
    for (let ix = 0; ix < nx; ix++) for (let iz = 0; iz < nz; iz++) {
      const x = minX + (ix + 0.5) * dx, z = minZ + (iz + 0.5) * dz;
      if (!tipiSitePartContains(part, x, z)) continue;
      const [lx, lz] = worldToLocal(x, z);
      const wall = ix === 0 || iz === 0 || ix === nx - 1 || iz === nz - 1;
      const radius = Math.max(Math.abs(x - (minX + maxX) / 2) / ((maxX - minX) / 2), Math.abs(z - (minZ + maxZ) / 2) / ((maxZ - minZ) / 2));
      const y = eaves + (peak - eaves) * Math.pow(1 - radius, 1.8);
      if (wall) {
        // Split taller turret walls into the same <=4m closed palette blocks.
        const heights = Math.ceil(eaves / MAX_BLOCK_SPAN_M);
        for (let level = 0; level < heights; level++) blocks.push({
          cue: "TIPI source-bound low pavilion walls", position: [lx, part.groundY - ANCHOR[1] + (level + 0.5) * eaves / heights, lz],
          size: [dx * 0.96, eaves / heights, dz * 0.96], color: part.role === "turret" || part.role === "foyer" ? 0x704a2d : BLOCK.quartzIvory,
          rotationY: -TIPI_ROTATION_Y,
        });
      }
      blocks.push({cue: "TIPI source-bound stepped canvas roofs", position: [lx, part.groundY - ANCHOR[1] + y, lz], size: [dx, 0.65, dz], color: (ix + iz) % 2 ? BLOCK.marbleLight : BLOCK.silver, rotationY: -TIPI_ROTATION_Y});
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
  addSourcePavilions(blocks);
  const front: LocalBlock[] = [];
  addEntrance(front);
  addOwnerMarquee(front);
  for (const block of front) {
    const [x, z] = worldToLocal(ANCHOR[0] - block.position[0], 28 - block.position[2]);
    blocks.push({ ...block, position: [x, block.position[1], z], rotationY: Math.PI - TIPI_ROTATION_Y });
  }

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
    matrix.makeRotationY(TIPI_ROTATION_Y + (block.rotationY ?? 0));
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
    sourcePrismIds: TIPI_SITE_PARTS.map((part) => part.prismId),
    sourceUrls: [...TIPI_AM_KANZLERAMT_PROFILE.sourceUrls],
  };
  return mesh;
}

/** Exact mapped TIPI parts; preserve the two real containers and all neighbours. */
export function isMinecraftTipiReplacementColumn(worldX: number, worldZ: number): boolean {
  return isTipiSourceReplacementAt(worldX, worldZ);
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
