import {
  BoxGeometry,
  Color,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
} from "three";

import {
  nearestMinecraftWalkable,
  type MinecraftMobField,
} from "./MinecraftMobs";
import type { VoxelPayload } from "./MinecraftVoxelWorld";

export type MinecraftLootBoxDetailProfile = "full" | "mobile";

export const MINECRAFT_LOOT_BOX_BUDGETS = Object.freeze({
  full: Object.freeze({ boxCount: 4, particlesPerBox: 12 }),
  mobile: Object.freeze({ boxCount: 2, particlesPerBox: 7 }),
});

export const MINECRAFT_LOOT_BOX_EFFECT_SECONDS = 1.35;
export const MINECRAFT_LOOT_BOX_TOUCH_RADIUS_M = 2.7;

type LootBoxPart = {
  boxIndex: number;
  color: number;
  local: readonly [number, number, number];
  role: "base" | "lid";
  size: readonly [number, number, number];
};

type FireworkParticle = {
  angle: number;
  boxIndex: number;
  color: number;
  lift: number;
  speed: number;
};

export type MinecraftLootBoxState = {
  effectSeconds: number;
  groundY: number;
  triggered: boolean;
  x: number;
  z: number;
};

export type MinecraftLootBoxField = {
  boxMesh: InstancedMesh;
  boxes: MinecraftLootBoxState[];
  detailProfile: MinecraftLootBoxDetailProfile;
  fireworkMesh: InstancedMesh;
  group: Group;
  helper: Object3D;
  particles: FireworkParticle[];
  parts: LootBoxPart[];
};

export type MinecraftLootBoxOptions = {
  castShadows?: boolean;
  detailProfile?: MinecraftLootBoxDetailProfile;
};

const DESIRED_LOOT_BOXES = [
  [-520, 300],
  [420, 330],
  [-130, 520],
  [170, 210],
] as const;

const CHEST_TONES = [0xc98a32, 0xf2bb4f, 0x6d401f, 0xf7d96a] as const;
const FIREWORK_TONES = [
  0xff5d73, 0xffc857, 0x58d6ff, 0x88f26d, 0xd47cff,
] as const;

function lootBoxParts(boxCount: number): LootBoxPart[] {
  const parts: LootBoxPart[] = [];
  for (let boxIndex = 0; boxIndex < boxCount; boxIndex += 1) {
    parts.push(
      {
        boxIndex,
        color: CHEST_TONES[0],
        local: [0, 0.62, 0],
        role: "base",
        size: [2.3, 1.24, 1.9],
      },
      {
        boxIndex,
        color: CHEST_TONES[2],
        local: [0, 1.17, 0],
        role: "base",
        size: [2.38, 0.16, 1.98],
      },
      {
        boxIndex,
        color: CHEST_TONES[1],
        local: [0, 1.52, -0.03],
        role: "lid",
        size: [2.38, 0.58, 1.98],
      },
      {
        boxIndex,
        color: CHEST_TONES[3],
        local: [0, 1.38, 1.01],
        role: "lid",
        size: [0.4, 0.5, 0.18],
      },
    );
  }
  return parts;
}

function fireworkParticles(
  boxCount: number,
  particlesPerBox: number,
): FireworkParticle[] {
  const particles: FireworkParticle[] = [];
  for (let boxIndex = 0; boxIndex < boxCount; boxIndex += 1) {
    for (let index = 0; index < particlesPerBox; index += 1) {
      particles.push({
        angle:
          (index / particlesPerBox) * Math.PI * 2 + boxIndex * 0.713,
        boxIndex,
        color: FIREWORK_TONES[(index + boxIndex * 2) % FIREWORK_TONES.length],
        lift: 0.72 + ((index * 7 + boxIndex * 3) % 5) * 0.13,
        speed: 3.2 + ((index * 11 + boxIndex) % 4) * 0.55,
      });
    }
  }
  return particles;
}

function writeLootBoxMatrices(field: MinecraftLootBoxField): void {
  const helper = field.helper;
  field.parts.forEach((part, index) => {
    const box = field.boxes[part.boxIndex];
    const open = box.triggered ? Math.min(1, box.effectSeconds / 0.28) : 0;
    helper.position.set(
      box.x + part.local[0],
      box.groundY + part.local[1] + (part.role === "lid" ? open * 0.72 : 0),
      box.z + part.local[2] - (part.role === "lid" ? open * 0.16 : 0),
    );
    helper.rotation.set(part.role === "lid" ? -open * 0.42 : 0, 0, 0);
    helper.scale.set(...part.size);
    helper.updateMatrix();
    field.boxMesh.setMatrixAt(index, helper.matrix);
  });
  field.boxMesh.instanceMatrix.needsUpdate = true;

  field.particles.forEach((particle, index) => {
    const box = field.boxes[particle.boxIndex];
    const progress = Math.min(
      1,
      Math.max(
        0,
        (box.effectSeconds - 0.08) /
          (MINECRAFT_LOOT_BOX_EFFECT_SECONDS - 0.08),
      ),
    );
    const active = box.triggered && progress > 0 && progress < 1;
    if (!active) {
      helper.position.set(box.x, box.groundY + 1.8, box.z);
      helper.rotation.set(0, 0, 0);
      helper.scale.setScalar(0);
    } else {
      const radius = Math.sin(progress * Math.PI * 0.72) * particle.speed;
      helper.position.set(
        box.x + Math.cos(particle.angle) * radius,
        box.groundY +
          2.2 +
          progress * 6.5 +
          Math.sin(progress * Math.PI) * particle.lift * 2.2,
        box.z + Math.sin(particle.angle) * radius,
      );
      helper.rotation.set(progress * 2.1, particle.angle, 0);
      helper.scale.setScalar(Math.max(0.08, (1 - progress) * 0.46));
    }
    helper.updateMatrix();
    field.fireworkMesh.setMatrixAt(index, helper.matrix);
  });
  field.fireworkMesh.instanceMatrix.needsUpdate = true;
}

export function createMinecraftLootBoxes(
  payload: VoxelPayload,
  navigation: Pick<MinecraftMobField, "groundAt" | "isWalkable">,
  options: MinecraftLootBoxOptions = {},
): MinecraftLootBoxField {
  const detailProfile = options.detailProfile ?? "full";
  const budget = MINECRAFT_LOOT_BOX_BUDGETS[detailProfile];
  const boxes: MinecraftLootBoxState[] = [];
  for (const [targetX, targetZ] of DESIRED_LOOT_BOXES.slice(
    0,
    budget.boxCount,
  )) {
    const position = nearestMinecraftWalkable(
      payload,
      navigation.isWalkable,
      targetX,
      targetZ,
    );
    if (!position) continue;
    const [x, z] = position;
    if (boxes.some((box) => Math.hypot(box.x - x, box.z - z) < 20)) continue;
    boxes.push({
      effectSeconds: 0,
      groundY: navigation.groundAt(x, z) ?? 0,
      triggered: false,
      x,
      z,
    });
  }

  const parts = lootBoxParts(boxes.length);
  const particles = fireworkParticles(boxes.length, budget.particlesPerBox);
  const cubeGeometry = new BoxGeometry(1, 1, 1);
  const boxMesh = new InstancedMesh(
    cubeGeometry,
    new MeshStandardMaterial({
      color: 0xffffff,
      flatShading: true,
      metalness: 0,
      roughness: 0.82,
    }),
    parts.length,
  );
  boxMesh.name = "Minecraft rare loot boxes";
  boxMesh.castShadow = options.castShadows ?? false;
  boxMesh.receiveShadow = true;
  boxMesh.frustumCulled = false;
  boxMesh.instanceMatrix.setUsage(DynamicDrawUsage);
  parts.forEach((part, index) => boxMesh.setColorAt(index, new Color(part.color)));
  if (boxMesh.instanceColor) boxMesh.instanceColor.needsUpdate = true;

  const fireworkMesh = new InstancedMesh(
    cubeGeometry,
    new MeshBasicMaterial({ color: 0xffffff, depthWrite: false }),
    particles.length,
  );
  fireworkMesh.name = "Minecraft loot box fireworks";
  fireworkMesh.frustumCulled = false;
  fireworkMesh.instanceMatrix.setUsage(DynamicDrawUsage);
  particles.forEach((particle, index) =>
    fireworkMesh.setColorAt(index, new Color(particle.color)),
  );
  if (fireworkMesh.instanceColor) fireworkMesh.instanceColor.needsUpdate = true;

  const group = new Group();
  group.name = "Minecraft rare loot boxes and bounded fireworks";
  group.visible = false;
  group.userData.boxCount = boxes.length;
  group.userData.detailProfile = detailProfile;
  group.userData.maxFireworkParticles = particles.length;
  group.add(boxMesh, fireworkMesh);
  const field = {
    boxMesh,
    boxes,
    detailProfile,
    fireworkMesh,
    group,
    helper: new Object3D(),
    particles,
    parts,
  };
  writeLootBoxMatrices(field);
  return field;
}

export function setMinecraftLootBoxesVisible(
  field: MinecraftLootBoxField | null,
  visible: boolean,
): boolean {
  if (!field || field.group.visible === visible) return false;
  field.group.visible = visible;
  return true;
}

export function updateMinecraftLootBoxes(
  field: MinecraftLootBoxField,
  player: Readonly<{ x: number; y: number; z: number }> | null,
  deltaSeconds: number,
): boolean {
  if (!field.group.visible) return false;
  const elapsed = Math.min(Math.max(deltaSeconds, 0), 0.1);
  let changed = false;
  for (const box of field.boxes) {
    if (
      !box.triggered &&
      player !== null &&
      Math.hypot(player.x - box.x, player.z - box.z) <=
        MINECRAFT_LOOT_BOX_TOUCH_RADIUS_M &&
      Math.abs(player.y - (box.groundY + 1.8)) <= 3.2
    ) {
      box.triggered = true;
      box.effectSeconds = Number.EPSILON;
      changed = true;
    }
    if (
      box.triggered &&
      box.effectSeconds < MINECRAFT_LOOT_BOX_EFFECT_SECONDS
    ) {
      box.effectSeconds = Math.min(
        MINECRAFT_LOOT_BOX_EFFECT_SECONDS,
        box.effectSeconds + elapsed,
      );
      changed = true;
    }
  }
  if (changed) writeLootBoxMatrices(field);
  return changed;
}
