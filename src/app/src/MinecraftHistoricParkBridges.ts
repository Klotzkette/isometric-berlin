import {
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Vector3,
} from "three";

export type MinecraftParkBridgeProfile = {
  axis: readonly [number, number];
  centreWorldM: readonly [number, number];
  name: string;
  sourceWayId: string;
};

export const MINECRAFT_ADLER_BRIDGE_PROFILE: MinecraftParkBridgeProfile = {
  axis: [0.7280038840981696, 0.6855730046741768],
  centreWorldM: [-1197.926, 931.565],
  name: "Adlerbruecke",
  sourceWayId: "28872983",
};

export const MINECRAFT_LOEWEN_BRIDGE_PROFILE: MinecraftParkBridgeProfile = {
  axis: [0.894279, 0.447511],
  centreWorldM: [-1766.908, 680.6395],
  name: "Löwenbrücke",
  sourceWayId: "1411957328",
};

type Block = {
  color: number;
  position: readonly [number, number, number];
  size: readonly [number, number, number];
};

function worldPoint(
  profile: MinecraftParkBridgeProfile,
  localU: number,
  localV: number,
): readonly [number, number] {
  const [axisX, axisZ] = profile.axis;
  return [
    profile.centreWorldM[0] + localU * axisX - localV * axisZ,
    profile.centreWorldM[1] + localU * axisZ + localV * axisX,
  ];
}

function pushLocalBlock(
  blocks: Block[],
  profile: MinecraftParkBridgeProfile,
  localU: number,
  localV: number,
  y: number,
  size: readonly [number, number, number],
  color: number,
): void {
  const [x, z] = worldPoint(profile, localU, localV);
  blocks.push({ color, position: [x, y, z], size });
}

function addAdlerBridge(blocks: Block[], groundY: number): void {
  const profile = MINECRAFT_ADLER_BRIDGE_PROFILE;
  const unit = 0.82;
  for (let step = -4; step <= 4; step += 1) {
    const u = step * unit;
    for (const v of [-1.2, -0.4, 0.4, 1.2]) {
      pushLocalBlock(blocks, profile, u, v, groundY + 0.18, [0.76, 0.3, 0.76], 0x777570);
    }
    for (const side of [-1, 1]) {
      // The stepped top follows the same central rise as the iron original.
      const height = 0.96 + 0.31 * (1 - Math.min(1, Math.abs(u) / 3.65) ** 1.65);
      pushLocalBlock(
        blocks,
        profile,
        u,
        side * 1.68,
        groundY + height / 2 + 0.35,
        [0.28, height, 0.28],
        0x464a4a,
      );
      pushLocalBlock(
        blocks,
        profile,
        u,
        side * 1.68,
        groundY + height + 0.38,
        [0.72, 0.18, 0.22],
        0x626766,
      );
    }
  }
  for (const end of [-1, 1]) {
    for (const side of [-1, 1]) {
      pushLocalBlock(
        blocks,
        profile,
        end * 3.45,
        side * 1.9,
        groundY + 0.65,
        [0.72, 1.05, 0.72],
        0xc7a870,
      );
    }
  }
  for (const side of [-1, 1]) {
    // Two large central eagles, never four anonymous end ornaments.
    pushLocalBlock(blocks, profile, 0, side * 1.88, groundY + 1.42, [0.52, 0.72, 0.24], 0x4a4b49);
    for (const wing of [-1, 1]) {
      pushLocalBlock(
        blocks,
        profile,
        wing * 0.48,
        side * 1.88,
        groundY + 1.55,
        [0.42, 0.22, 0.2],
        0x626361,
      );
    }
  }
}

function addLoewenBridge(blocks: Block[], groundY: number): void {
  const profile = MINECRAFT_LOEWEN_BRIDGE_PROFILE;
  const unit = 0.88;
  for (let step = -10; step <= 10; step += 1) {
    const u = step * unit;
    for (const v of [-0.44, 0.44]) {
      pushLocalBlock(
        blocks,
        profile,
        u,
        v,
        groundY + 0.12,
        [0.78, 0.24, 0.78],
        step % 3 === 0 ? 0xc5b99f : 0xb4a68d,
      );
    }
    for (const side of [-1, 1]) {
      const cableHeight = 1.02 + 0.42 * (Math.abs(u) / 8.8) ** 2;
      pushLocalBlock(
        blocks,
        profile,
        u,
        side * 0.98,
        groundY + cableHeight,
        [0.24, 0.24, 0.24],
        0xdcca9b,
      );
      pushLocalBlock(blocks, profile, u, side * 0.98, groundY + 1.13, [0.38, 0.16, 0.2], 0xaaa087);
    }
  }
  for (let bay = -4; bay <= 4; bay += 1) {
    const u = bay * 2.03;
    for (const side of [-1, 1]) {
      pushLocalBlock(blocks, profile, u, side * 0.98, groundY + 0.58, [0.25, 0.82, 0.25], 0xead99f);
    }
  }
  for (const end of [-1, 1]) {
    for (const side of [-1, 1]) {
      const u = end * 9.7;
      const v = side * 1.34;
      pushLocalBlock(blocks, profile, u, v, groundY + 0.34, [1.25, 0.6, 1], 0xeee3ca);
      pushLocalBlock(
        blocks,
        profile,
        u - end * 0.08,
        v,
        groundY + 0.92,
        [0.78, 0.62, 0.62],
        0xd4a95a,
      );
      pushLocalBlock(
        blocks,
        profile,
        u - end * 0.4,
        v - side * 0.12,
        groundY + 1.38,
        [0.5, 0.5, 0.48],
        0xa77b3f,
      );
    }
  }
}

/**
 * The smooth recognition bridges live inside the Day city and disappear when
 * the true voxel world replaces it. This one additional instanced draw keeps
 * the two historic bridges recognisable in Minecraft without importing any
 * curved mesh or weakening the block language.
 */
export function createMinecraftHistoricParkBridges(
  groundAt: (x: number, z: number) => number | null,
): Group {
  const blocks: Block[] = [];
  addAdlerBridge(
    blocks,
    groundAt(...MINECRAFT_ADLER_BRIDGE_PROFILE.centreWorldM) ?? 5.2,
  );
  addLoewenBridge(
    blocks,
    groundAt(...MINECRAFT_LOEWEN_BRIDGE_PROFILE.centreWorldM) ?? 5.2,
  );

  const material = new MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x31342f,
    emissiveIntensity: 0.34,
    flatShading: true,
    metalness: 0,
    roughness: 1,
  });
  const mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), material, blocks.length);
  mesh.name = "Voxel Adlerbruecke and Löwenbrücke recognition blocks";
  const matrix = new Matrix4();
  const color = new Color();
  blocks.forEach((block, index) => {
    matrix.makeScale(...block.size);
    matrix.setPosition(new Vector3(...block.position));
    mesh.setMatrixAt(index, matrix);
    mesh.setColorAt(index, color.setHex(block.color));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.userData = {
    adlerBridgeOsmWayId: MINECRAFT_ADLER_BRIDGE_PROFILE.sourceWayId,
    blockCount: blocks.length,
    loewenBridgeOsmWayId: MINECRAFT_LOEWEN_BRIDGE_PROFILE.sourceWayId,
    sourceRole: "block-native recognition over the OSM bridge deck classes",
  };

  const group = new Group();
  group.name = "Minecraft historic Tiergarten bridge recognitions";
  group.add(mesh);
  return group;
}
