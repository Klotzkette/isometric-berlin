import {
  BoxGeometry,
  Color,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from "three";

import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import {
  type FacadeAxis,
  MINECRAFT_UNTER_DEN_LINDEN_GROUP_NAME,
  UNTER_DEN_LINDEN_DETAILS_PROFILE,
} from "./unterDenLindenProfiles";

type Point = [number, number, number];
type Instance = { color: number; matrix: number[] };

const IDENTITY = new Quaternion();
const STONE = 0xd0cdc1;
const STONE_LIGHT = 0xe5e1d7;
const GLASS = 0x51676c;
const GLASS_LIGHT = 0x769296;
const METAL = 0x42494a;
const BLUE = 0x244b84;
const RED = 0xb53a34;
const PURPLE = 0x765583;
const WHITE = 0xebe8df;

class BlockBuilder {
  readonly instances: Instance[] = [];
  private readonly matrix = new Matrix4();
  private readonly position = new Vector3();
  private readonly scale = new Vector3();

  box(position: Point, size: Point, color: number): void {
    this.matrix.compose(
      this.position.set(...position),
      IDENTITY,
      this.scale.set(...size),
    );
    this.instances.push({ color, matrix: this.matrix.toArray() });
  }
}

function axisLength(axis: FacadeAxis): number {
  return Math.hypot(
    axis.endWorldXZ[0] - axis.startWorldXZ[0],
    axis.endWorldXZ[1] - axis.startWorldXZ[1],
  );
}

function facadePoint(
  axis: FacadeAxis,
  u: number,
  y: number,
  outward: number,
): Point {
  const dx = axis.endWorldXZ[0] - axis.startWorldXZ[0];
  const dz = axis.endWorldXZ[1] - axis.startWorldXZ[1];
  const length = Math.hypot(dx, dz);
  const signedOutward = outward * axis.outwardSide;
  return [
    axis.startWorldXZ[0] + (dx * u + dz * signedOutward) / length,
    y,
    axis.startWorldXZ[1] + (dz * u - dx * signedOutward) / length,
  ];
}

function facadeBlock(
  builder: BlockBuilder,
  axis: FacadeAxis,
  u: number,
  y: number,
  outward: number,
  width: number,
  height: number,
  depth: number,
  color: number,
): void {
  const dx = axis.endWorldXZ[0] - axis.startWorldXZ[0];
  const dz = axis.endWorldXZ[1] - axis.startWorldXZ[1];
  const length = Math.hypot(dx, dz);
  const alongX = Math.abs(dx / length);
  const alongZ = Math.abs(dz / length);
  builder.box(
    facadePoint(axis, u, y, outward),
    [
      Math.max(0.55, alongX * width + alongZ * depth),
      height,
      Math.max(0.55, alongZ * width + alongX * depth),
    ],
    color,
  );
}

function voxelGrid(
  builder: BlockBuilder,
  axis: FacadeAxis,
  baseY: number,
  bays: number,
  floors: number,
  firstFloorY: number,
  floorPitch: number,
  accent?: (bay: number, floor: number) => number | null,
): void {
  const length = axisLength(axis);
  const pitch = length / bays;
  for (let bay = 0; bay < bays; bay += 1) {
    for (let floor = 0; floor < floors; floor += 1) {
      const color = accent?.(bay, floor) ??
        (floor % 2 === 0 ? GLASS : GLASS_LIGHT);
      facadeBlock(
        builder,
        axis,
        (bay + 0.5) * pitch,
        baseY + firstFloorY + floor * floorPitch,
        0.85,
        pitch * 0.7,
        2.25,
        0.72,
        color,
      );
    }
  }
  for (let boundary = 0; boundary <= bays; boundary += 1) {
    facadeBlock(
      builder,
      axis,
      boundary * pitch,
      baseY + firstFloorY + ((floors - 1) * floorPitch) / 2,
      0.94,
      0.58,
      (floors - 1) * floorPitch + 3.3,
      0.74,
      STONE_LIGHT,
    );
  }
}

function addBritishEmbassy(builder: BlockBuilder): void {
  const baseY =
    UNTER_DEN_LINDEN_DETAILS_PROFILE.buildings.britishEmbassy.anchorWorldM[1];
  const axis: FacadeAxis = {
    startWorldXZ: [598.18, 390.0],
    endWorldXZ: [598.18, 358.0],
    outwardSide: 1,
  };
  const length = axisLength(axis);
  const pitch = length / 8;
  for (let bay = 0; bay < 8; bay += 1) {
    const centralVoid = bay === 3 || bay === 4;
    for (let floor = 0; floor < 4; floor += 1) {
      if (centralVoid && floor < 3) continue;
      facadeBlock(
        builder,
        axis,
        (bay + 0.5) * pitch,
        baseY + 6.0 + floor * 4.15,
        0.85 + (floor % 2 === 0 ? 0.18 : 0),
        pitch * 0.58,
        2.45,
        0.72,
        floor % 2 === 0 ? GLASS : STONE,
      );
    }
  }
  facadeBlock(builder, axis, length / 2, baseY + 10.7, 1.1, 11.5, 12.8, 0.8, METAL);
  facadeBlock(builder, axis, length * 0.39, baseY + 14.8, 2.4, 5.8, 5.2, 3.2, PURPLE);
  facadeBlock(builder, axis, length * 0.64, baseY + 10.3, 2.5, 6.5, 6.2, 3.8, 0x5aa8bd);
  facadeBlock(builder, axis, length / 2, baseY + 1.45, 1.25, length, 2.9, 0.9, STONE);
}

function addRussianEmbassy(builder: BlockBuilder): void {
  const profile = UNTER_DEN_LINDEN_DETAILS_PROFILE.buildings.russianEmbassy;
  const axis = profile.streetFacade;
  const baseY = profile.anchorWorldM[1];
  const length = axisLength(axis);
  voxelGrid(builder, axis, baseY, 14, 5, 6.4, 3.35);
  const porticoU = 5.1;
  for (let column = 0; column < 5; column += 1) {
    facadeBlock(
      builder,
      axis,
      porticoU - 3.6 + column * 1.8,
      baseY + 11.45,
      2.35,
      0.8,
      12.6,
      0.8,
      STONE_LIGHT,
    );
  }
  facadeBlock(builder, axis, porticoU, baseY + 18.2, 2.3, 10.5, 1.4, 1.0, STONE);
  const [towerX, towerZ] = profile.towerWorldXZ;
  builder.box([towerX, baseY + 26.2, towerZ], [5.5, 7.2, 8.0], STONE_LIGHT);
  builder.box([towerX, baseY + 30.05, towerZ], [6.2, 0.65, 8.7], STONE);
  builder.box([towerX, baseY + 34.0, towerZ], [0.35, 7.4, 0.35], METAL);
  for (const [y, color] of [
    [baseY + 36.4, WHITE],
    [baseY + 36.0, BLUE],
    [baseY + 35.6, RED],
  ] as const) {
    builder.box([towerX + 1.1, y, towerZ], [2.2, 0.38, 0.35], color);
  }
  facadeBlock(builder, axis, length / 2, baseY + 2.15, 0.75, length, 4.3, 0.8, STONE);
}

function addAeroflot(builder: BlockBuilder): void {
  const profile = UNTER_DEN_LINDEN_DETAILS_PROFILE.buildings.aeroflot;
  const axis = profile.streetFacade;
  const baseY = profile.anchorWorldM[1];
  const length = axisLength(axis);
  voxelGrid(builder, axis, baseY, 8, 4, 6.25, 3.28);
  facadeBlock(builder, axis, length / 2, baseY + 2.3, 0.85, length - 1, 4.2, 0.72, GLASS);
  facadeBlock(builder, axis, length / 2, baseY + 20.3, 0.82, 24.5, 2.2, 0.7, BLUE);
  for (let mark = 0; mark < 8; mark += 1) {
    facadeBlock(builder, axis, length * 0.22 + mark * 2.2, baseY + 20.3, 1.2, 1.4, 0.55, 0.55, WHITE);
  }
}

function addEinstein(builder: BlockBuilder): void {
  const profile = UNTER_DEN_LINDEN_DETAILS_PROFILE.buildings.einstein;
  const axis = profile.streetFacade;
  const baseY = profile.anchorWorldM[1];
  const length = axisLength(axis);
  voxelGrid(builder, axis, baseY, 4, 6, 6.35, 3.35);
  facadeBlock(builder, axis, length / 2, baseY + 2.3, 0.9, length - 0.7, 4.2, 0.75, METAL);
  facadeBlock(builder, axis, length / 2, baseY + 4.55, 1.1, length - 1.2, 0.65, 0.72, WHITE);
}

function addDussmann(builder: BlockBuilder): void {
  const profile = UNTER_DEN_LINDEN_DETAILS_PROFILE.buildings.dussmann;
  const baseY = profile.anchorWorldM[1];
  for (const [axis, bays] of [
    [profile.eastFacade, 9],
    [profile.southFacade, 7],
  ] as const) {
    const length = axisLength(axis);
    voxelGrid(
      builder,
      axis,
      baseY,
      bays,
      6,
      7.1,
      3.65,
      (bay, floor) => (bay % 3 === 1 && floor % 2 === 1 ? RED : null),
    );
    facadeBlock(builder, axis, length / 2, baseY + 2.65, 0.9, length, 4.8, 0.75, GLASS);
  }
  const east = profile.eastFacade;
  const eastLength = axisLength(east);
  facadeBlock(builder, east, eastLength - 4.2, baseY + 16.5, 1.3, 2.4, 18, 0.8, RED);
  facadeBlock(builder, east, eastLength * 0.45, baseY + 4.35, 1.25, 13.5, 0.8, 0.7, WHITE);
}

function finishBlocks(builder: BlockBuilder, root: Group): void {
  const geometry = new BoxGeometry(1, 1, 1);
  geometry.deleteAttribute("uv");
  const dayMaterial = new MeshBasicMaterial({ color: 0xffffff });
  const nightMaterial = new MeshStandardMaterial({
    color: 0xffffff,
    flatShading: true,
    metalness: 0,
    roughness: 0.86,
  });
  const mesh = new InstancedMesh(geometry, dayMaterial, 0);
  const matrices = new Float32Array(builder.instances.length * 16);
  const colors = new Float32Array(builder.instances.length * 3);
  const color = new Color();
  builder.instances.forEach((instance, index) => {
    matrices.set(instance.matrix, index * 16);
    color.setHex(instance.color).toArray(colors, index * 3);
  });
  mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
  mesh.count = builder.instances.length;
  mesh.name = "Unter den Linden native facade blocks box";
  mesh.userData.dayMaterial = dayMaterial;
  mesh.userData.nightMaterial = nightMaterial;
  mesh.userData.textureFree = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  root.add(mesh);
}

export function createMinecraftUnterDenLindenDetails(): Group {
  const group = new Group();
  group.name = MINECRAFT_UNTER_DEN_LINDEN_GROUP_NAME;
  group.userData = {
    ...UNTER_DEN_LINDEN_DETAILS_PROFILE,
    blockNative: true,
    keepInMinecraft: true,
    facadeOnly: true,
  };
  const builder = new BlockBuilder();
  addBritishEmbassy(builder);
  addRussianEmbassy(builder);
  addAeroflot(builder);
  addEinstein(builder);
  addDussmann(builder);
  finishBlocks(builder, group);
  return freezeStaticSceneTransforms(group);
}
