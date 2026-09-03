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
  Vector2,
  Vector3,
} from "three";
import {
  BODE_DOMES,
  BODE_MAIN,
  BODE_SOURCE,
  GRILL_SOURCE,
  MINECRAFT_SPREE_RECOGNITION_GROUP_NAME,
  SPREE_RECOGNITION_PROFILE,
  sourcePartBounds,
  sourcePartContains,
  type SourcePart,
} from "./spreeRecognitionProfile";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type Point = [number, number, number];
type PlanPoint = [number, number];
type Instance = { color: number; matrix: number[] };

const STONE = 0xc7c2b5;
const GLASS = 0x56696d;
const METAL = 0x535b59;
const RED = 0xa43c32;
const IDENTITY = new Quaternion();

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

function finishBlocks(builder: BlockBuilder, root: Group): void {
  const geometry = new BoxGeometry(1, 1, 1);
  geometry.deleteAttribute("uv");
  const dayMaterial = new MeshBasicMaterial({ color: 0xffffff });
  const nightMaterial = new MeshStandardMaterial({
    color: 0xffffff,
    flatShading: true,
    metalness: 0,
    roughness: 0.84,
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
  mesh.name = "Spree native architectural blocks box";
  mesh.userData.dayMaterial = dayMaterial;
  mesh.userData.nightMaterial = nightMaterial;
  mesh.userData.textureFree = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  root.add(mesh);
}

function facadePoint(
  start: PlanPoint,
  end: PlanPoint,
  u: number,
  y: number,
  offset: number,
): Point {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const length = Math.hypot(dx, dz);
  return [
    start[0] + (dx * u + dz * offset) / length,
    y,
    start[1] + (dz * u - dx * offset) / length,
  ];
}

function domeCentre(part: SourcePart): PlanPoint {
  const [minX, minZ, maxX, maxZ] = sourcePartBounds(part);
  return [(minX + maxX) / 2, (minZ + maxZ) / 2];
}

function domeProfile(part: SourcePart): Vector2[] {
  const [minX, , maxX] = sourcePartBounds(part);
  const radius = (maxX - minX) / 2;
  const base = BODE_MAIN.top_y_m;
  const height = part.top_y_m - base;
  return [
    [radius * 0.91, 0],
    [radius * 0.91, 0.21],
    [radius, 0.23],
    [radius * 0.985, 0.32],
    [radius * 0.93, 0.44],
    [radius * 0.84, 0.59],
    [radius * 0.69, 0.73],
    [radius * 0.48, 0.84],
    [radius * 0.31, 0.9],
    [radius * 0.31, 0.94],
    [0, 0.94],
  ].map(([x, y]) => new Vector2(x, base + y * height));
}

function voxelEnvelope(
  part: SourcePart,
  builder: BlockBuilder,
  tone: number,
): void {
  const [minX, minZ, maxX, maxZ] = sourcePartBounds(part);
  const cell = 2.5;
  const courses = Math.ceil(part.height_m / 4.2);
  const pitch = part.height_m / courses;
  for (let x = minX + cell / 2; x < maxX; x += cell) {
    for (let z = minZ + cell / 2; z < maxZ; z += cell) {
      if (!sourcePartContains(part, x, z)) continue;
      const boundary = ![
        [cell, 0],
        [-cell, 0],
        [0, cell],
        [0, -cell],
      ].every(([dx, dz]) => sourcePartContains(part, x + dx, z + dz));
      for (let y = 0; y < courses; y += 1) {
        if (!boundary && y !== courses - 1) continue;
        const color =
          y === courses - 1
            ? 0x83897c
            : boundary && y > 0 && y % 2 === 1
              ? GLASS
              : tone;
        builder.box(
          [x, part.ground_y_m + (y + 0.5) * pitch, z],
          [cell, pitch, cell],
          color,
        );
      }
    }
  }
}

function voxelDome(part: SourcePart, builder: BlockBuilder): void {
  const [cx, cz] = domeCentre(part);
  const profile = domeProfile(part);
  const cell = 2.3;
  const bottom = profile[0].y;
  const top = profile[profile.length - 1].y;
  const levels = Math.ceil((top - bottom) / 1.7);
  const pitch = (top - bottom) / levels;
  const radiusAt = (y: number): number => {
    for (let index = 1; index < profile.length; index += 1) {
      if (y > profile[index].y) continue;
      const a = profile[index - 1];
      const b = profile[index];
      return (
        a.x +
        ((b.x - a.x) * (y - a.y)) / Math.max(0.01, b.y - a.y)
      );
    }
    return 0;
  };
  for (let level = 0; level < levels; level += 1) {
    const y = bottom + (level + 0.5) * pitch;
    const radius = radiusAt(y);
    const inner = Math.max(
      0,
      Math.min(radius - cell * 1.2, radiusAt(y + pitch)),
    );
    for (let x = -radius + cell / 2; x < radius; x += cell) {
      for (let z = -radius + cell / 2; z < radius; z += cell) {
        const distance = Math.hypot(x, z);
        if (distance > radius || distance < inner) continue;
        builder.box(
          [cx + x, y, cz + z],
          [cell, pitch, cell],
          level < 3 ? STONE : METAL,
        );
      }
    }
  }
  builder.box(
    [cx, (top + part.top_y_m) / 2, cz],
    [2.1, part.top_y_m - top, 2.1],
    0x83907a,
  );
}

export function createMinecraftSpreeMuseumDetails(): Group {
  const group = new Group();
  group.name = MINECRAFT_SPREE_RECOGNITION_GROUP_NAME;
  group.userData = {
    ...SPREE_RECOGNITION_PROFILE,
    blockNative: true,
    keepInMinecraft: true,
    courtyardCount: 5,
  };
  const builder = new BlockBuilder();
  for (const part of BODE_SOURCE.parts.filter((part) => part.surfaces)) {
    voxelEnvelope(part, builder, STONE);
  }
  for (const dome of BODE_DOMES) voxelDome(dome, builder);
  for (const part of GRILL_SOURCE.parts) {
    voxelEnvelope(part, builder, 0xc6c5b9);
  }
  const start: PlanPoint = [1195.375, -389.722];
  const end: PlanPoint = [1145.489, -385.561];
  for (let bay = 0; bay < 10; bay += 1) {
    const u = (bay + 0.5) * 5;
    builder.box(facadePoint(start, end, u, 32.1, 0.9), [2.5, 2.1, 0.7], RED);
    if (bay > 1 && bay < 8) {
      builder.box(
        facadePoint(start, end, u, 7.6, 1.3),
        [4.3, 0.55, 2.5],
        METAL,
      );
    }
  }
  finishBlocks(builder, group);
  return freezeStaticSceneTransforms(group);
}
