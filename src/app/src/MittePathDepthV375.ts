import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  type InstancedMesh,
  Mesh,
  MeshBasicMaterial,
} from "three";
import { gunzipSync } from "three/examples/jsm/libs/fflate.module.js";
import { decodeBase64Bytes } from "./decodeBase64Bytes";
import { restoreDrawnWaterBoundary } from "./drawnWaterBoundary";
import { registerMittePathPreviewsV375 } from "./mittePathArrivalV375";
import type { VoxelPayload } from "./terrainPayload";
import packet from "./data/mittePathDepthV375.json";

export const MITTE_PATH_GROUND_V375 = "Original grass outside proved Mitte path occlusions v375";
const offDiagonal = [1, 2, 3, 4, 6, 7, 8, 9, 11];
const wayColours = {
  "surface-sand": [0xd9c9a6, 0x241f19],
  "surface-earth": [0xbca780, 0x211b15],
  paving: [0xdcd8cc, 0x1b222b],
} as const;

function unpack(encoded: string): ArrayBuffer {
  const bytes = gunzipSync(decodeBase64Bytes(encoded));
  if (
    bytes.buffer instanceof ArrayBuffer &&
    bytes.byteOffset === 0 &&
    bytes.byteLength === bytes.buffer.byteLength
  ) {
    return bytes.buffer;
  }
  return bytes.slice().buffer;
}

/** Each complete proposed span must still belong to the original green slab
 * at the captured height. Independent earlier cutouts can split its surrounding run. */
function completeGrassHosts(
  slabs: InstancedMesh,
  ground: VoxelPayload,
  swatches: readonly number[],
  cells: Uint32Array,
  spans: Uint32Array,
  tops: Float32Array,
): boolean {
  const recordsByRow = new Map<number, number[]>();
  for (let record = 0; record < spans.length; record++) {
    const row = cells[6 * record + 1];
    const records = recordsByRow.get(row);
    if (records) records.push(record);
    else recordsByRow.set(row, [record]);
  }

  const cell = ground.cell_m;
  const matrices = slabs.instanceMatrix.array;
  const colours = slabs.instanceColor!.array;
  const grass = swatches.map((swatch) => new Color(swatch));
  const found = new Uint8Array(spans.length);
  let matches = 0;
  for (let instance = 0; instance < slabs.count && matches < spans.length; instance++) {
    const offset = 16 * instance;
    const z = matrices[offset + 14] - cell / 2;
    const records = recordsByRow.get(z / cell - ground.grid.min_z_idx);
    if (!records) continue;
    if (matrices[offset + 5] !== 3 || matrices[offset + 10] !== cell || matrices[offset + 15] !== 1)
      continue;
    if (offDiagonal.some((index) => matrices[offset + index] !== 0)) continue;

    const width = matrices[offset] / cell;
    const left = matrices[offset + 12] - matrices[offset] / 2;
    const column = left / cell - ground.grid.min_x_idx;
    if (!Number.isInteger(column) || !Number.isInteger(width)) continue;
    const rgb = 3 * instance;
    const isGrass = grass.some(
      (colour) =>
        Math.abs(colour.r - colours[rgb]) < 1e-6 &&
        Math.abs(colour.g - colours[rgb + 1]) < 1e-6 &&
        Math.abs(colour.b - colours[rgb + 2]) < 1e-6,
    );
    if (!isGrass) continue;
    const top = matrices[offset + 13] + 1.5;
    for (const record of records) {
      const start = cells[6 * record];
      if (found[record] || start < column || start + spans[record] > column + width) continue;
      if (Math.abs(top - tops[record]) > 0.00002) continue;
      found[record] = 1;
      matches++;
    }
  }
  return matches === spans.length;
}

function createPreview(batch: string, source: { xyz: string; indices: string }): Mesh {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(unpack(source.xyz)), 3));
  geometry.setIndex(new BufferAttribute(new Uint16Array(unpack(source.indices)), 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const colours = wayColours[batch === "surface-earth" || batch === "surface-sand" ? batch : "paving"];
  const day = new MeshBasicMaterial({ color: colours[0], side: DoubleSide });
  const night = new MeshBasicMaterial({ color: colours[1], side: DoubleSide });
  const mesh = new Mesh(geometry, day);
  mesh.name = "Original path pending " + batch;
  mesh.userData.dayMaterial = day;
  mesh.userData.nightMaterial = night;
  mesh.updateMatrix();
  mesh.matrixAutoUpdate = false;
  return mesh;
}

export function restoreMittePathGroundV375(
  slabs: InstancedMesh,
  ground: VoxelPayload,
  grass: readonly number[],
): boolean {
  if (slabs.name !== "Drawn ground slabs" || !slabs.instanceColor || slabs.userData.mittePathGroundV375)
    return false;
  if (slabs.userData.tiergartenPathsV345?.runs !== 433 || ground.cell_m !== 4) return false;
  if (
    Object.entries(packet.grid).some(
      ([key, value]) => ground.grid[key as keyof typeof ground.grid] !== value,
    )
  )
    return false;

  const cells = new Uint32Array(unpack(packet.cells));
  const spans = new Uint32Array(unpack(packet.spans));
  const tops = new Float32Array(unpack(packet.tops));
  if (!completeGrassHosts(slabs, ground, grass, cells, spans, tops)) return false;

  const previous = new Set(slabs.children);
  const oldWaterCount = slabs.userData.exactWaterBoundaryCells;
  restoreDrawnWaterBoundary(slabs, ground, {
    format: "exact-drawn-water-boundary",
    version: 1,
    cell_m: 4,
    depth_m: 3,
    grid: packet.grid,
    source_sha256: packet.surfaceSha256,
    ground_sha256: packet.groundSha256,
    cells_u32: cells.buffer,
    spans_u32: spans.buffer,
    tops_f32: tops.buffer,
    triangles_f32: unpack(packet.triangles),
    edges_f32: unpack(packet.edges),
  });
  if (oldWaterCount === undefined) delete slabs.userData.exactWaterBoundaryCells;
  else slabs.userData.exactWaterBoundaryCells = oldWaterCount;
  const outside = slabs.children.find((child) => !previous.has(child));
  if (!outside) return false;
  outside.name = MITTE_PATH_GROUND_V375;

  const previews = new Map<string, Mesh>();
  const group = new Group();
  group.name = "Original Mitte path fragments awaiting their source batches";
  for (const [batch, source] of Object.entries(packet.previews)) {
    const mesh = createPreview(batch, source);
    previews.set(batch, mesh);
    group.add(mesh);
  }
  slabs.add(group);
  slabs.userData.mittePathGroundV375 = packet.count;
  registerMittePathPreviewsV375(slabs, previews);
  return true;
}
