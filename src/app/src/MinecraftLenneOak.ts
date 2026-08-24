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

import { LENNE_OAK_PROFILE } from "./LenneOak";

export type MinecraftLenneOakProfile = "full" | "mobile";

type VoxelBlock = {
  color: number;
  position: readonly [number, number, number];
  scale: readonly [number, number, number];
};

type Point3 = readonly [number, number, number];

const BARK_TONES = [0x644a32, 0x73563a, 0x503d2d] as const;
const LEAF_TONES = [0x568238, 0x669342, 0x466f31, 0x789f4b] as const;

const BRANCH_COURSES: readonly (readonly Point3[])[] = [
  [
    [0, 10.5, 0],
    [-0.5, 14, 0.5],
    [-1.5, 18, 0.5],
    [-2.5, 22.5, 1],
  ],
  [
    [0, 10.5, 0],
    [1, 14, -0.5],
    [1.5, 18, -1],
    [3, 21.5, -1.5],
  ],
  [
    [0, 11.5, 0],
    [3, 13, 0],
    [6, 13.5, 0.5],
    [8, 14, 1],
  ],
  [
    [0, 11.5, 0],
    [-3, 13, -0.5],
    [-6, 13.5, -1.5],
    [-8, 14.5, -2],
  ],
  [
    [-0.5, 15, 0.5],
    [-3, 17, 1.5],
    [-6.5, 19, 3],
  ],
  [
    [1, 15, -0.5],
    [3.5, 16.5, -2.5],
    [6.5, 18, -4.5],
  ],
  [
    [0.5, 14, 0],
    [1.5, 16, 3],
    [2.5, 17, 6],
  ],
  [
    [-0.5, 14, 0],
    [-1.5, 16, -3],
    [-3, 17.5, -6],
  ],
] as const;

const LEAF_BLOCKS: readonly Point3[] = [
  [-8, 15.5, -1.5],
  [-7, 17, 0],
  [-6.5, 16.5, -2.5],
  [-6, 18, 2.5],
  [-5, 19.5, -1],
  [-4.5, 17, -4],
  [-4, 20.5, 3],
  [-3, 19, -6],
  [-3, 21.5, 1],
  [-2, 16, 3.5],
  [-1.5, 18, -4],
  [-1, 20, 4],
  [-0.5, 22, 0],
  [0, 16, -3],
  [0.5, 18, 2.5],
  [1, 21.5, -1.5],
  [2, 17, 5],
  [2.5, 20, -3.5],
  [3, 18, 6],
  [3.5, 21, 0.5],
  [4.5, 19.5, 1],
  [5, 17, -3.5],
  [5.5, 16, 3],
  [6.5, 18, 0],
  [6.5, 16.5, 2],
  [8, 15.5, 1],
] as const;

export function isLenneOakVoxelTree(
  xIndex: number,
  zIndex: number,
  y0dm: number,
  heightDm: number,
  cellM: number,
): boolean {
  const worldX = (xIndex + 0.5) * cellM;
  const worldZ = (zIndex + 0.5) * cellM;
  return (
    Math.hypot(
      worldX - LENNE_OAK_PROFILE.position[0],
      worldZ - LENNE_OAK_PROFILE.position[2],
    ) <=
      cellM * 0.55 &&
    Math.abs(y0dm / 10 - LENNE_OAK_PROFILE.position[1]) <= 0.35 &&
    Math.abs(heightDm / 10 - LENNE_OAK_PROFILE.heightM) <= 1.5
  );
}

function addSteppedCourse(
  blocks: Map<string, VoxelBlock>,
  course: readonly Point3[],
  colorOffset: number,
): void {
  for (let span = 0; span < course.length - 1; span += 1) {
    const from = new Vector3(...course[span]);
    const to = new Vector3(...course[span + 1]);
    const steps = Math.max(1, Math.ceil(from.distanceTo(to) / 0.85));
    for (let step = 0; step <= steps; step += 1) {
      const amount = step / steps;
      const position = from.clone().lerp(to, amount);
      const x = Math.round(position.x * 2) / 2;
      const y = Math.round(position.y * 2) / 2;
      const z = Math.round(position.z * 2) / 2;
      const key = `${x}:${y}:${z}`;
      blocks.set(key, {
        color: BARK_TONES[(span + step + colorOffset) % BARK_TONES.length],
        position: [x, y, z],
        scale: [0.92, 0.92, 0.92],
      });
    }
  }
}

export function createMinecraftLenneOak(
  groundY: number,
  detailProfile: MinecraftLenneOakProfile = "full",
): Group {
  const blocks = new Map<string, VoxelBlock>();
  const add = (block: VoxelBlock): void => {
    blocks.set(block.position.join(":"), block);
  };

  for (let level = 0; level < 12; level += 1) {
    add({
      color: BARK_TONES[level % BARK_TONES.length],
      position: [level > 6 ? 0.5 : 0, level + 0.5, 0],
      scale: [level < 3 ? 1.25 : 1, 1, level < 3 ? 1.25 : 1],
    });
  }
  for (const [x, z] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ] as const) {
    add({
      color: 0x503d2d,
      position: [x * 0.72, 0.24, z * 0.72],
      scale: [1.25, 0.48, 1.25],
    });
  }

  const branchCount = detailProfile === "full" ? BRANCH_COURSES.length : 4;
  for (let index = 0; index < branchCount; index += 1) {
    addSteppedCourse(blocks, BRANCH_COURSES[index], index);
  }

  const leafPositions =
    detailProfile === "full"
      ? LEAF_BLOCKS
      : LEAF_BLOCKS.filter((_, index) => index % 2 === 0 || index === 25);
  leafPositions.forEach(([x, y, z], index) => {
    add({
      color: LEAF_TONES[index % LEAF_TONES.length],
      position: [x, y, z],
      scale: [index % 3 === 0 ? 2.4 : 2, index % 4 === 0 ? 1.6 : 1.3, 2],
    });
  });
  add({
    color: 0xe8eadb,
    position: [0, 2.75, 0.66],
    scale: [0.5, 0.5, 0.22],
  });

  const instances = [...blocks.values()];
  const mesh = new InstancedMesh(
    new BoxGeometry(1, 1, 1),
    new MeshStandardMaterial({
      color: 0xffffff,
      flatShading: true,
      roughness: 1,
      vertexColors: true,
    }),
    instances.length,
  );
  mesh.name = "Minecraft Lenné-Eiche block-native trunk, limbs and crown";
  const matrix = new Matrix4();
  const rotation = new Quaternion();
  instances.forEach((block, index) => {
    matrix.compose(
      new Vector3(
        block.position[0],
        block.position[1],
        block.position[2],
      ),
      rotation,
      new Vector3(block.scale[0], block.scale[1], block.scale[2]),
    );
    mesh.setMatrixAt(index, matrix);
    mesh.setColorAt(index, new Color(block.color));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  mesh.frustumCulled = false;

  const group = new Group();
  group.name = "Minecraft Lenné-Eiche block-native veteran oak";
  group.position.set(
    LENNE_OAK_PROFILE.position[0],
    groundY,
    LENNE_OAK_PROFILE.position[2],
  );
  group.userData = {
    commonName: LENNE_OAK_PROFILE.commonName,
    detailProfile,
    displayName: LENNE_OAK_PROFILE.displayName,
    geometryStatus:
      "block-native reading of the same official tree fingerprint; no smooth-tree double",
    instanceCount: instances.length,
    scientificName: LENNE_OAK_PROFILE.scientificName,
    sourcePosition: [...LENNE_OAK_PROFILE.position],
  };
  group.add(mesh);
  return group;
}
