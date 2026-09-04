import {
  BoxGeometry,
  Color,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
} from "three";

import {
  forEachVoxelTreeBlock,
  minecraftVoxelTreeRetained,
  type VoxelPayload,
  worldGroundSampler,
} from "./MinecraftVoxelWorld";
import { isHolocaustMinecraftProtectedAt } from "./holocaustField";

export const CREEPER_COUNT = 6;
export const SKELETON_COUNT = 5;
export const ZOMBIE_COUNT = 9;

export type MinecraftMobDetailProfile = "full" | "mobile";

/**
 * The fuller desktop cast and the still-reduced touch cast share one instanced
 * draw call, so the added population does not add render-state changes.
 */
export const MINECRAFT_MOB_BUDGETS = Object.freeze({
  full: Object.freeze({
    creeper: CREEPER_COUNT,
    skeleton: SKELETON_COUNT,
    zombie: ZOMBIE_COUNT,
  }),
  mobile: Object.freeze({ creeper: 4, skeleton: 3, zombie: 7 }),
});

type MobKind = "creeper" | "skeleton" | "zombie";
type PartMotion = "arm-left" | "arm-right" | "leg-left" | "leg-right" | "still";

type MobPart = {
  color: number;
  legLift: boolean;
  local: readonly [number, number, number];
  localScaled: readonly [number, number, number];
  mobIndex: number;
  motion: PartMotion;
  size: readonly [number, number, number];
  sizeScaled: readonly [number, number, number];
  swingDirection: -1 | 0 | 1;
};

type MobState = {
  heading: number;
  kind: MobKind;
  phase: number;
  speedMps: number;
  turnClock: number;
  x: number;
  z: number;
};

export type MinecraftMobField = {
  creeperCount: number;
  groundAt: (x: number, z: number) => number | null;
  group: Group;
  isWalkable: (x: number, z: number) => boolean;
  matrixHelper: Object3D;
  mesh: InstancedMesh;
  mobCosHeading: Float64Array;
  mobGround: Float64Array;
  mobs: MobState[];
  mobSinHeading: Float64Array;
  mobSinPhase: Float64Array;
  parts: MobPart[];
  skeletonCount: number;
  zombieCount: number;
};

const CREEPER_GREEN = 0x4f9c45;
const CREEPER_LIGHT = 0x6cba50;
const CREEPER_DARK = 0x346b36;
const ZOMBIE_GREEN = 0x74a85c;
const ZOMBIE_SHIRT = 0x4b92a3;
const ZOMBIE_SHIRT_LIGHT = 0x72c5d2;
const ZOMBIE_TROUSERS = 0x334b72;
const SKELETON_BONE = 0xd9d8c8;
const SKELETON_LIGHT = 0xf0eee0;
const SKELETON_SHADOW = 0xa7a797;
const SKELETON_BOW = 0x76502f;
const FACE_DARK = 0x18251b;
// The voxel world uses 4 m blocks; a strict 1.8 m person disappears below
// one half-cell and behind every crown. One-block-high staffage stays legible
// while remaining far below buildings and monuments.
const MOB_DISPLAY_SCALE = 2.2;

const DESIRED_SPAWNS: ReadonlyArray<{
  heading: number;
  kind: MobKind;
  x: number;
  z: number;
}> = [
  { heading: 0.3, kind: "creeper", x: 180, z: 130 },
  { heading: 2.1, kind: "creeper", x: 80, z: 220 },
  { heading: 4.4, kind: "creeper", x: -130, z: 520 },
  { heading: 5.3, kind: "creeper", x: -420, z: 550 },
  { heading: 1.8, kind: "creeper", x: 520, z: 600 },
  { heading: 3.7, kind: "creeper", x: -620, z: 260 },
  { heading: 1.2, kind: "zombie", x: 245, z: 230 },
  { heading: 3.5, kind: "zombie", x: 360, z: 180 },
  { heading: 5.1, kind: "zombie", x: -260, z: 100 },
  { heading: 0.8, kind: "zombie", x: -500, z: 340 },
  { heading: 2.2, kind: "zombie", x: -120, z: 410 },
  { heading: 4.7, kind: "zombie", x: 470, z: 300 },
  { heading: 0.5, kind: "zombie", x: 610, z: 210 },
  { heading: 2.9, kind: "zombie", x: 220, z: 590 },
  { heading: 5.8, kind: "zombie", x: -610, z: 460 },
  { heading: 2.7, kind: "skeleton", x: -40, z: 670 },
  { heading: 5.6, kind: "skeleton", x: 510, z: 460 },
  { heading: 4.1, kind: "skeleton", x: -330, z: 620 },
  { heading: 1.4, kind: "skeleton", x: 340, z: 640 },
  { heading: 3.3, kind: "skeleton", x: -580, z: 180 },
];

function cellIndex(payload: VoxelPayload, x: number, z: number): number | null {
  const xOffset = Math.floor(x / payload.cell_m) - payload.grid.min_x_idx;
  const zOffset = Math.floor(z / payload.cell_m) - payload.grid.min_z_idx;
  if (
    xOffset < 0 ||
    zOffset < 0 ||
    xOffset >= payload.grid.cols ||
    zOffset >= payload.grid.rows
  ) {
    return null;
  }
  return zOffset * payload.grid.cols + xOffset;
}

function buildWalkableGrid(
  payload: VoxelPayload,
  detailProfile: MinecraftMobDetailProfile,
): {
  ground: Uint8Array;
  trees: Uint8Array;
} {
  const walkable = new Uint8Array(payload.grid.cols * payload.grid.rows);
  payload.ground_rows.forEach((row, zOffset) => {
    for (const [xStart, run, classId] of row) {
      if (payload.classes[classId] !== "grass") {
        continue;
      }
      walkable.fill(
        1,
        zOffset * payload.grid.cols + xStart,
        zOffset * payload.grid.cols + xStart + run,
      );
    }
  });
  if (payload.building_rows) {
    payload.building_rows.forEach((row, zOffset) => {
      if (zOffset >= payload.grid.rows) {
        return;
      }
      const rowStart = zOffset * payload.grid.cols;
      for (const [xOffset, runLength] of row) {
        const start = Math.max(0, xOffset);
        const end = Math.min(payload.grid.cols, xOffset + runLength);
        if (end > start) {
          walkable.fill(0, rowStart + start, rowStart + end);
        }
      }
    });
  } else {
    for (const [xIndex, zIndex] of payload.buildings ?? []) {
      const xOffset = xIndex - payload.grid.min_x_idx;
      const zOffset = zIndex - payload.grid.min_z_idx;
      if (
        xOffset >= 0 &&
        zOffset >= 0 &&
        xOffset < payload.grid.cols &&
        zOffset < payload.grid.rows
      ) {
        walkable[zOffset * payload.grid.cols + xOffset] = 0;
      }
    }
  }
  const treeCells = new Uint8Array(payload.grid.cols * payload.grid.rows);
  forEachVoxelTreeBlock(payload, (xIndex, zIndex) => {
    if (!minecraftVoxelTreeRetained(xIndex, zIndex, detailProfile)) return;
    const xOffset = xIndex - payload.grid.min_x_idx;
    const zOffset = zIndex - payload.grid.min_z_idx;
    if (
      xOffset >= 0 &&
      zOffset >= 0 &&
      xOffset < payload.grid.cols &&
      zOffset < payload.grid.rows
    ) {
      treeCells[zOffset * payload.grid.cols + xOffset] = 1;
    }
  });
  return { ground: walkable, trees: treeCells };
}

export function nearestMinecraftWalkable(
  payload: VoxelPayload,
  isWalkable: (x: number, z: number) => boolean,
  targetX: number,
  targetZ: number,
): readonly [number, number] | null {
  const cell = payload.cell_m;
  const centerX = (Math.floor(targetX / cell) + 0.5) * cell;
  const centerZ = (Math.floor(targetZ / cell) + 0.5) * cell;
  if (isWalkable(centerX, centerZ)) {
    return [centerX, centerZ];
  }
  for (let radius = 1; radius <= 24; radius += 1) {
    for (let dz = -radius; dz <= radius; dz += 1) {
      for (const dx of [-radius, radius]) {
        const x = centerX + dx * cell;
        const z = centerZ + dz * cell;
        if (isWalkable(x, z)) {
          return [x, z];
        }
      }
    }
    for (let dx = -radius + 1; dx < radius; dx += 1) {
      for (const dz of [-radius, radius]) {
        const x = centerX + dx * cell;
        const z = centerZ + dz * cell;
        if (isWalkable(x, z)) {
          return [x, z];
        }
      }
    }
  }
  // Never fall back to the requested point: it may be a building, tree or
  // protected memorial cell. Omitting one decorative mob is safer than
  // spawning it in an invalid place when a reduced payload has no park cell.
  return null;
}

function mobPart(
  mobIndex: number,
  color: number,
  local: readonly [number, number, number],
  size: readonly [number, number, number],
  motion: PartMotion = "still",
): MobPart {
  const swingDirection =
    motion === "leg-left" || motion === "arm-right"
      ? 1
      : motion === "leg-right" || motion === "arm-left"
        ? -1
        : 0;
  return {
    color,
    legLift: motion === "leg-left" || motion === "leg-right",
    local,
    localScaled: [
      local[0] * MOB_DISPLAY_SCALE,
      local[1] * MOB_DISPLAY_SCALE,
      local[2] * MOB_DISPLAY_SCALE,
    ],
    mobIndex,
    motion,
    size,
    sizeScaled: [
      size[0] * MOB_DISPLAY_SCALE,
      size[1] * MOB_DISPLAY_SCALE,
      size[2] * MOB_DISPLAY_SCALE,
    ],
    swingDirection,
  };
}

function creeperParts(mobIndex: number): MobPart[] {
  return [
    mobPart(mobIndex, CREEPER_LIGHT, [0, 1.72, 0], [0.76, 0.76, 0.76]),
    mobPart(mobIndex, CREEPER_GREEN, [0, 0.95, 0], [0.62, 0.84, 0.42]),
    mobPart(
      mobIndex,
      CREEPER_GREEN,
      [-0.2, 0.31, 0.16],
      [0.25, 0.62, 0.25],
      "leg-left",
    ),
    mobPart(
      mobIndex,
      CREEPER_GREEN,
      [0.2, 0.31, 0.16],
      [0.25, 0.62, 0.25],
      "leg-right",
    ),
    mobPart(
      mobIndex,
      CREEPER_GREEN,
      [-0.2, 0.31, -0.16],
      [0.25, 0.62, 0.25],
      "leg-right",
    ),
    mobPart(
      mobIndex,
      CREEPER_GREEN,
      [0.2, 0.31, -0.16],
      [0.25, 0.62, 0.25],
      "leg-left",
    ),
    mobPart(mobIndex, FACE_DARK, [-0.18, 1.84, 0.39], [0.13, 0.13, 0.045]),
    mobPart(mobIndex, FACE_DARK, [0.18, 1.84, 0.39], [0.13, 0.13, 0.045]),
    mobPart(mobIndex, FACE_DARK, [0, 1.59, 0.39], [0.2, 0.24, 0.045]),
    mobPart(mobIndex, CREEPER_DARK, [-0.27, 1.52, 0.4], [0.12, 0.16, 0.04]),
    mobPart(mobIndex, CREEPER_DARK, [0.32, 1.14, 0.23], [0.05, 0.18, 0.16]),
  ];
}

function zombieParts(mobIndex: number): MobPart[] {
  return [
    mobPart(mobIndex, ZOMBIE_GREEN, [0, 1.74, 0], [0.7, 0.7, 0.7]),
    mobPart(mobIndex, ZOMBIE_SHIRT, [0, 1.02, 0], [0.72, 0.76, 0.38]),
    mobPart(
      mobIndex,
      ZOMBIE_GREEN,
      [-0.5, 1.02, 0.13],
      [0.24, 0.82, 0.24],
      "arm-left",
    ),
    mobPart(
      mobIndex,
      ZOMBIE_GREEN,
      [0.5, 1.02, 0.13],
      [0.24, 0.82, 0.24],
      "arm-right",
    ),
    mobPart(
      mobIndex,
      ZOMBIE_TROUSERS,
      [-0.2, 0.35, 0],
      [0.29, 0.7, 0.29],
      "leg-left",
    ),
    mobPart(
      mobIndex,
      ZOMBIE_TROUSERS,
      [0.2, 0.35, 0],
      [0.29, 0.7, 0.29],
      "leg-right",
    ),
    mobPart(mobIndex, FACE_DARK, [-0.16, 1.85, 0.36], [0.11, 0.1, 0.04]),
    mobPart(mobIndex, FACE_DARK, [0.16, 1.85, 0.36], [0.11, 0.1, 0.04]),
    mobPart(mobIndex, FACE_DARK, [0, 1.62, 0.36], [0.22, 0.07, 0.04]),
    mobPart(mobIndex, ZOMBIE_SHIRT_LIGHT, [0, 1.3, 0.2], [0.34, 0.1, 0.04]),
    mobPart(mobIndex, FACE_DARK, [0, 0.68, 0.2], [0.68, 0.09, 0.04]),
  ];
}

function skeletonParts(mobIndex: number): MobPart[] {
  return [
    mobPart(mobIndex, SKELETON_LIGHT, [0, 1.75, 0], [0.64, 0.64, 0.64]),
    mobPart(mobIndex, SKELETON_BONE, [0, 1.08, 0], [0.18, 0.72, 0.18]),
    mobPart(mobIndex, SKELETON_BONE, [0, 1.36, 0], [0.7, 0.12, 0.2]),
    mobPart(mobIndex, SKELETON_BONE, [0, 1.15, 0], [0.62, 0.1, 0.18]),
    mobPart(mobIndex, SKELETON_BONE, [0, 0.94, 0], [0.54, 0.1, 0.16]),
    mobPart(mobIndex, SKELETON_SHADOW, [0, 0.7, 0], [0.48, 0.18, 0.22]),
    mobPart(
      mobIndex,
      SKELETON_BONE,
      [-0.43, 1.05, 0.04],
      [0.16, 0.82, 0.16],
      "arm-left",
    ),
    mobPart(
      mobIndex,
      SKELETON_BONE,
      [0.43, 1.05, 0.04],
      [0.16, 0.82, 0.16],
      "arm-right",
    ),
    mobPart(
      mobIndex,
      SKELETON_BONE,
      [-0.17, 0.34, 0],
      [0.16, 0.7, 0.16],
      "leg-left",
    ),
    mobPart(
      mobIndex,
      SKELETON_BONE,
      [0.17, 0.34, 0],
      [0.16, 0.7, 0.16],
      "leg-right",
    ),
    mobPart(mobIndex, FACE_DARK, [-0.15, 1.84, 0.33], [0.12, 0.12, 0.04]),
    mobPart(mobIndex, FACE_DARK, [0.15, 1.84, 0.33], [0.12, 0.12, 0.04]),
    mobPart(mobIndex, FACE_DARK, [0, 1.66, 0.33], [0.1, 0.08, 0.04]),
    mobPart(mobIndex, SKELETON_BOW, [0.68, 1.06, 0], [0.09, 0.92, 0.09]),
    mobPart(mobIndex, SKELETON_BOW, [0.57, 1.49, 0], [0.28, 0.08, 0.08]),
    mobPart(mobIndex, SKELETON_BOW, [0.57, 0.63, 0], [0.28, 0.08, 0.08]),
  ];
}

export function createMinecraftMobs(
  payload: VoxelPayload,
  castShadows: boolean,
  detailProfile: MinecraftMobDetailProfile = "full",
): MinecraftMobField {
  const walkability = buildWalkableGrid(payload, detailProfile);
  const isWalkable = (x: number, z: number): boolean => {
    if (isHolocaustMinecraftProtectedAt(x, z)) {
      return false;
    }
    const index = cellIndex(payload, x, z);
    if (index === null || walkability.ground[index] !== 1) {
      return false;
    }
    // Voxel crowns overhang their source cell. Keep an 8 m clearing around
    // every official tree so figures remain visible rather than walking
    // inside trunks and leaf cubes. The compact occupancy grid makes this
    // cheaper than expanding all 23k tree cells during mode startup.
    const centerX = index % payload.grid.cols;
    const centerZ = Math.floor(index / payload.grid.cols);
    for (let dz = -2; dz <= 2; dz += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        const xOffset = centerX + dx;
        const zOffset = centerZ + dz;
        if (
          xOffset >= 0 &&
          zOffset >= 0 &&
          xOffset < payload.grid.cols &&
          zOffset < payload.grid.rows &&
          walkability.trees[zOffset * payload.grid.cols + xOffset] === 1
        ) {
          return false;
        }
      }
    }
    return true;
  };
  const budget = MINECRAFT_MOB_BUDGETS[detailProfile];
  const acceptedByKind: Record<MobKind, number> = {
    creeper: 0,
    skeleton: 0,
    zombie: 0,
  };
  const requestedSpawns = DESIRED_SPAWNS.filter((spawn) => {
    if (acceptedByKind[spawn.kind] >= budget[spawn.kind]) {
      return false;
    }
    acceptedByKind[spawn.kind] += 1;
    return true;
  });
  const mobs = requestedSpawns.flatMap((spawn, index): MobState[] => {
    const position = nearestMinecraftWalkable(
      payload,
      isWalkable,
      spawn.x,
      spawn.z,
    );
    if (!position) {
      return [];
    }
    const [x, z] = position;
    return [{
      heading: spawn.heading,
      kind: spawn.kind,
      phase: index * 0.83,
      speedMps:
        spawn.kind === "creeper"
          ? 0.72
          : spawn.kind === "skeleton"
            ? 0.64
            : 0.58,
      turnClock: 1.4 + index * 0.31,
      x,
      z,
    }];
  });
  const parts = mobs.flatMap((mob, index) => {
    if (mob.kind === "creeper") {
      return creeperParts(index);
    }
    if (mob.kind === "skeleton") {
      return skeletonParts(index);
    }
    return zombieParts(index);
  });
  const material = new MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x202820,
    emissiveIntensity: 0.22,
    flatShading: true,
    metalness: 0,
    roughness: 1,
  });
  material.name = "Minecraft roaming mobs material";
  const mesh = new InstancedMesh(
    new BoxGeometry(1, 1, 1),
    material,
    parts.length,
  );
  mesh.name = "Minecraft roaming creepers, skeletons and zombies";
  mesh.castShadow = castShadows;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  for (let index = 0; index < parts.length; index += 1) {
    mesh.setColorAt(index, new Color(parts[index].color));
  }
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }

  const group = new Group();
  group.name = "Minecraft roaming mobs";
  group.visible = true;
  const creeperCount = mobs.filter(({ kind }) => kind === "creeper").length;
  const skeletonCount = mobs.filter(({ kind }) => kind === "skeleton").length;
  const zombieCount = mobs.filter(({ kind }) => kind === "zombie").length;
  group.userData.creeperCount = creeperCount;
  group.userData.detailProfile = detailProfile;
  group.userData.maxMobCount =
    budget.creeper + budget.skeleton + budget.zombie;
  group.userData.skeletonCount = skeletonCount;
  group.userData.zombieCount = zombieCount;
  group.add(mesh);
  const field = {
    creeperCount,
    groundAt: worldGroundSampler(payload),
    group,
    isWalkable,
    matrixHelper: new Object3D(),
    mesh,
    mobCosHeading: new Float64Array(mobs.length),
    mobGround: new Float64Array(mobs.length),
    mobs,
    mobSinHeading: new Float64Array(mobs.length),
    mobSinPhase: new Float64Array(mobs.length),
    parts,
    skeletonCount,
    zombieCount,
  };
  updateMinecraftMobs(field, 0);
  group.visible = false;
  return field;
}

export function setMinecraftMobsVisible(
  field: MinecraftMobField | null,
  visible: boolean,
): boolean {
  if (!field || field.group.visible === visible) {
    return false;
  }
  field.group.visible = visible;
  return true;
}

export function updateMinecraftMobs(
  field: MinecraftMobField,
  deltaSeconds: number,
): void {
  if (!field.group.visible) {
    return;
  }
  const elapsed = Math.min(Math.max(deltaSeconds, 0), 0.1);
  for (let index = 0; index < field.mobs.length; index += 1) {
    const mob = field.mobs[index];
    mob.turnClock -= elapsed;
    if (mob.turnClock <= 0) {
      mob.heading += (index % 2 === 0 ? 1 : -1) * (0.24 + (index % 3) * 0.08);
      mob.turnClock += 1.7 + (index % 4) * 0.43;
    }
    const nextX = mob.x + Math.sin(mob.heading) * mob.speedMps * elapsed;
    const nextZ = mob.z + Math.cos(mob.heading) * mob.speedMps * elapsed;
    if (field.isWalkable(nextX, nextZ)) {
      mob.x = nextX;
      mob.z = nextZ;
    } else {
      mob.heading += Math.PI * (0.58 + (index % 3) * 0.09);
      mob.turnClock = 0.8 + (index % 4) * 0.17;
    }
    mob.phase += elapsed * mob.speedMps * 7.2;
    field.mobSinPhase[index] = Math.sin(mob.phase);
    field.mobSinHeading[index] = Math.sin(mob.heading);
    field.mobCosHeading[index] = Math.cos(mob.heading);
    field.mobGround[index] = field.groundAt(mob.x, mob.z) ?? 4;
  }

  const dummy = field.matrixHelper;
  for (let index = 0; index < field.parts.length; index += 1) {
    const part = field.parts[index];
    const mob = field.mobs[part.mobIndex];
    const sine = field.mobSinPhase[part.mobIndex];
    const alternating = sine * part.swingDirection;
    const bob = Math.abs(sine) * 0.035;
    const [localX, localY, localZ] = part.localScaled;
    const sinHeading = field.mobSinHeading[part.mobIndex];
    const cosHeading = field.mobCosHeading[part.mobIndex];
    const ground = field.mobGround[part.mobIndex];
    dummy.position.set(
      mob.x + localX * cosHeading + localZ * sinHeading,
      ground +
        localY +
        bob +
        (part.legLift ? Math.max(0, alternating) * 0.035 : 0),
      mob.z - localX * sinHeading + localZ * cosHeading,
    );
    dummy.rotation.set(
      part.swingDirection === 0 ? 0 : alternating * 0.42,
      mob.heading,
      0,
    );
    dummy.scale.set(...part.sizeScaled);
    dummy.updateMatrix();
    field.mesh.setMatrixAt(index, dummy.matrix);
  }
  field.mesh.instanceMatrix.needsUpdate = true;
}
