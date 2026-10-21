import {
  BoxGeometry, BufferGeometry, Color, Float32BufferAttribute, Group,
  InstancedMesh, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  Object3D, ShapeUtils, Vector2,
} from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import paving from "./data/sintiRomaPavingV256.json";

/** Foundation dimensions and previous scene grounding remain unchanged. */
export const SINTI_ROMA_V256 = Object.freeze({
  groundY: 4.48,
  clearingSurfaceY: 0.46,
  world: [307.700225593755, 186.2301389835775] as const,
  poolDiameterM: 12,
  namedStoneCount: 69,
  unlabelledStoneCount: 168,
  nativeCellM: 0.24,
  maxNativeBlocks: 900,
  maxDrawnRenderableCount: 16,
  maxDrawnStoredVertices: 9000,
});

export const SINTI_ROMA_PAVING_V256 = paving;
const CLEARING = SINTI_ROMA_V256.clearingSurfaceY;
type Block = { x: number; y: number; z: number; w: number; h: number; d: number; color: number };

function insideRing(x: number, z: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[i], [bx, bz] = ring[j];
    if ((az > z) !== (bz > z) && x < ((bx - ax) * (z - az)) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}

/** Two merged fields retain all 168 plain / 69 named slabs and real grass gaps. */
export function addSintiRomaPavingV256(group: Group): void {
  for (const named of [false, true]) {
    const vertices: number[] = [];
    const colors: number[] = [];
    const selected = paving.shards.filter((shard) => shard.named === named);
    selected.forEach((shard, index) => {
      const top = CLEARING + (named ? 0.1075 : 0.0925);
      const bottom = top - 0.055;
      const color = new Color(named ? 0xaaa99f : 0xb6b6ab).multiplyScalar(0.91 + (index % 7) * 0.022);
      const vertex = (point: number[], y: number): void => {
        vertices.push(point[0], y, point[1]);
        colors.push(color.r, color.g, color.b);
      };
      const points = shard.ring.map(([x, z]) => new Vector2(x, z));
      for (const [a, b, c] of ShapeUtils.triangulateShape(points, [])) {
        // Shape triangulation is +Z; XZ planes need reversed winding for +Y.
        vertex(shard.ring[c], top); vertex(shard.ring[b], top); vertex(shard.ring[a], top);
      }
      for (let a = 0; a < shard.ring.length; a++) {
        const b = (a + 1) % shard.ring.length;
        vertex(shard.ring[a], bottom); vertex(shard.ring[b], top); vertex(shard.ring[a], top);
        vertex(shard.ring[a], bottom); vertex(shard.ring[b], bottom); vertex(shard.ring[b], top);
      }
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const indexed = mergeVertices(geometry);
    geometry.dispose();
    indexed.computeBoundingBox();
    indexed.computeBoundingSphere();
    const mesh = new Mesh(indexed, new MeshStandardMaterial({
      vertexColors: true, roughness: 0.95, polygonOffset: true,
      polygonOffsetFactor: -1.2, polygonOffsetUnits: -1.2,
    }));
    mesh.name = named
      ? "Sinti and Roma memorial 69 camp name stones"
      : "Sinti and Roma memorial fragmented granite apron";
    mesh.userData.placeCount = named ? 69 : 0;
    mesh.userData.slabCount = selected.length;
    mesh.userData.geometryStatus = paving.status;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // Small non-legible incision cues preserve the existing count without text.
  const grooves = new InstancedMesh(
    new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: 0x51514b, roughness: 0.88 }), 69,
  );
  grooves.name = "Sinti and Roma memorial engraved place-name grooves";
  const dummy = new Object3D();
  paving.shards.filter((shard) => shard.named).forEach((shard, index) => {
    dummy.position.set(shard.center[0], CLEARING + 0.114, shard.center[1]);
    dummy.rotation.set(0, Math.atan2(shard.center[0], shard.center[1]) + 0.2, 0);
    dummy.scale.set(0.22 + (index % 4) * 0.025, 0.012, 0.025);
    dummy.updateMatrix();
    grooves.setMatrixAt(index, dummy.matrix);
  });
  grooves.computeBoundingBox();
  grooves.computeBoundingSphere();
  group.add(grooves);
}

function blockBatch(name: string, blocks: Block[], glass = false): InstancedMesh {
  const mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial({
    vertexColors: false,
    transparent: glass,
    opacity: glass ? 0.62 : 1,
    depthWrite: !glass,
  }), blocks.length);
  mesh.name = name;
  const dummy = new Object3D();
  const color = new Color();
  blocks.forEach((block, index) => {
    dummy.position.set(block.x, block.y, block.z);
    dummy.scale.set(block.w, block.h, block.d);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    mesh.setColorAt(index, color.setHex(block.color));
  });
  mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  mesh.userData.blockCount = blocks.length;
  return mesh;
}

/** Independent horizontal/vertical blocks; never a voxelised smooth mesh. */
export function createSintiRomaNativeV256(): Group {
  const group = new Group();
  group.name = "Sinti and Roma memorial independent native blocks";
  group.userData.sintiRomaNativeV256 = true;
  group.visible = false;
  const blocks: Block[] = [];
  const glass: Block[] = [];
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, color: number): void => {
    blocks.push({ x, y, z, w, h, d, color });
  };
  const cell = SINTI_ROMA_V256.nativeCellM;
  const disk = (radius: number, y: number, h: number, color: number): void => {
    for (let row = Math.ceil(-radius / cell); row < Math.floor(radius / cell); row++) {
      const z = (row + 0.5) * cell;
      const half = Math.floor(Math.sqrt(radius * radius - (Math.abs(z) + cell / 2) ** 2) / cell) * cell;
      if (half > 0) box(0, y, z, half * 2, h, cell, color);
    }
  };
  disk(6.2, CLEARING + 0.12, 0.24, 0x11191b);
  disk(6, CLEARING + 0.3, 0.045, 0x070d0d);
  // Orthogonal stepped triangle matches the retained centre's plan orientation.
  const triangle = Array.from({ length: 3 }, (_, i) => {
    const a = i * Math.PI * 2 / 3 + Math.PI / 6;
    return [Math.sin(a) * 1.62, Math.cos(a) * 1.62];
  });
  const raster = (ring: number[][], y: number, h: number, color: number): void => {
    const minX = Math.floor(Math.min(...ring.map((p) => p[0])) / cell);
    const maxX = Math.ceil(Math.max(...ring.map((p) => p[0])) / cell);
    const minZ = Math.floor(Math.min(...ring.map((p) => p[1])) / cell);
    const maxZ = Math.ceil(Math.max(...ring.map((p) => p[1])) / cell);
    for (let iz = minZ; iz < maxZ; iz++) {
      let start: number | null = null;
      for (let ix = minX; ix <= maxX; ix++) {
        const x = (ix + 0.5) * cell, z = (iz + 0.5) * cell;
        const fits = ix < maxX && [-0.49, 0.49].every((dx) =>
          [-0.49, 0.49].every((dz) => insideRing(x + dx * cell, z + dz * cell, ring)),
        );
        if (fits && start === null) start = ix;
        if (!fits && start !== null) {
          box((start + ix) * cell / 2, y, z, (ix - start) * cell, h, cell, color);
          start = null;
        }
      }
    }
  };
  raster(triangle, CLEARING + 0.41, 0.14, 0x414547);
  const slabBlockCounts: number[] = [];
  paving.shards.forEach((shard, index) => {
    const before = blocks.length;
    raster(shard.ring, CLEARING + 0.065, 0.055, index % 3 ? 0xb6b6ab : 0xaaa99f);
    if (blocks.length === before) {
      // Narrow inner/outer fragments must survive the orthogonal grid too.
      for (const width of [0.18, 0.12, 0.06]) {
        if ([-0.5, 0.5].every((dx) => [-0.5, 0.5].every((dz) =>
          insideRing(shard.center[0] + dx * width, shard.center[1] + dz * width, shard.ring),
        ))) {
          box(shard.center[0], CLEARING + 0.065, shard.center[1], width, 0.055, width, 0xb6b6ab);
          break;
        }
      }
    }
    slabBlockCounts.push(blocks.length - before);
    if (shard.named) box(shard.center[0], CLEARING + 0.099, shard.center[1], 0.16, 0.012, 0.035, 0x51514b);
  });
  box(0, CLEARING + 0.53, 0, 0.34, 0.07, 0.15, 0xd95b32);
  box(0, CLEARING + 0.53, 0, 0.15, 0.07, 0.34, 0xd95b32);
  box(0, CLEARING + 0.57, 0, 0.09, 0.025, 0.09, 0x64341f);
  box(0.15, CLEARING + 0.5, 0.18, 0.035, 0.035, 0.32, 0x5c6d43);
  // The same retained one-doorway chronology, nine biographies and three seats.
  for (let slot = 0, panel = 0; slot < 22; slot++) {
    const x = (slot - 10.5) * 1.78;
    if (slot === 15) continue;
    glass.push({ x, y: 1.22, z: -22, w: 1.66, h: 2.36, d: 0.1, color: 0x91a7a5 });
    for (let row = 0; row < 4; row++) box(x - 0.14, 0.62 + row * 0.32, -21.93, 0.6, 0.025, 0.018, 0x394544);
    if (panel % 2 === 0 && panel < 18) box(x, 1.66, -21.925, 0.46, 0.58, 0.018, 0xb8bbb6);
    panel++;
  }
  for (let i = 0; i < 23; i++) box(-19.58 + i * 1.78, 1.22, -22, 0.055, 2.48, 0.15, 0x5d4035);
  box(8.01, 2.42, -22, 1.9, 0.12, 0.2, 0x5d4035);
  for (const x of [-6.2, 0, 6.2]) box(x, 0.34, -18.3, 3.2, 0.48, 0.82, 0x282c2d);
  for (let i = 0; i < 84; i++) {
    const a = (i + 0.5) / 84 * Math.PI * 2;
    box(Math.cos(a) * 6.1, CLEARING + 0.335, Math.sin(a) * 6.1, 0.07, 0.018, 0.035, 0x858989);
  }
  group.add(blockBatch("Sinti and Roma memorial native stone water and details", blocks));
  group.add(blockBatch("Sinti and Roma memorial native chronology glazing", glass, true));
  group.userData.blockCount = blocks.length + glass.length;
  group.userData.slabBlockCounts = slabBlockCounts;
  group.userData.placeCount = 69;
  group.userData.referenceImagesBundled = false;
  return group;
}

/** Shared by mode switches and late scene construction. */
export function setSintiRomaMemorialPresentation(root: Object3D, native: boolean): void {
  root.traverse((object) => {
    if (object.userData.sintiRomaSmoothV256) object.visible = !native;
    if (object.userData.sintiRomaNativeV256) object.visible = native;
  });
}
