import { BufferAttribute, BufferGeometry, Group, InstancedBufferAttribute, type InstancedMesh, type Material, Mesh, type MeshBasicMaterial } from "three";
import boundaryData from "./data/drawnWaterBoundary.json";
import type { VoxelPayload } from "./MinecraftVoxelWorld";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export type DrawnWaterBoundaryData = {
  format: string; version: number; cell_m: number;
  grid: { min_x_idx: number; min_z_idx: number; cols: number; rows: number };
  source_sha256: string; ground_sha256: string;
  cells_u32: string; triangles_f32: string; edges_f32: string;
};
const RECORD_SIZE = 6;

function decode(value: string): ArrayBuffer {
  const text = atob(value), bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
  return bytes.buffer;
}

function matchesGround(ground: VoxelPayload, data: DrawnWaterBoundaryData): boolean {
  return data.format === "exact-drawn-water-boundary" && data.version === 1 &&
    ground.cell_m === data.cell_m && Object.keys(data.grid).every(key =>
      ground.grid[key as keyof typeof ground.grid] === data.grid[key as keyof typeof data.grid]);
}

/** The small lookup identifies whole affected cells, never a broad bank buffer. */
export function createDrawnWaterBoundaryCellTester(
  ground: VoxelPayload, data: DrawnWaterBoundaryData = boundaryData,
): (x: number, z: number) => boolean {
  if (!matchesGround(ground, data)) return () => false;
  const cells = new Uint32Array(decode(data.cells_u32)), keys = new Set<number>();
  for (let i = 0; i < cells.length; i += RECORD_SIZE) keys.add(cells[i + 1] * data.grid.cols + cells[i]);
  return (x, z) => {
    const col = Math.floor(x / data.cell_m) - data.grid.min_x_idx;
    const row = Math.floor(z / data.cell_m) - data.grid.min_z_idx;
    return col >= 0 && col < data.grid.cols && row >= 0 && row < data.grid.rows && keys.has(row * data.grid.cols + col);
  };
}

/**
 * Replace intersecting cells with their exact land complement, preserving the
 * pre-existing run's top/bottom, shade and every prior authored exclusion.
 * No terrain resampling, water triangulation or polygon clipping runs here.
 */
export function restoreDrawnWaterBoundary(
  slabs: InstancedMesh, ground: VoxelPayload, data: DrawnWaterBoundaryData = boundaryData,
): void {
  if (!matchesGround(ground, data) || !slabs.count) return;
  const cells = new Uint32Array(decode(data.cells_u32));
  const rows = new Map<number, number[]>();
  for (let i = 0; i < cells.length; i += RECORD_SIZE) {
    const row = rows.get(cells[i + 1]) ?? [];
    if (!rows.has(cells[i + 1])) rows.set(cells[i + 1], row);
    row.push(i);
  }
  for (const row of rows.values()) row.sort((a, b) => cells[a] - cells[b]);
  const originalMatrices = slabs.instanceMatrix.array as Float32Array;
  const originalColors = slabs.instanceColor?.array as Float32Array | undefined;
  const oldCount = slabs.count;
  const cell = ground.cell_m, { min_x_idx, min_z_idx } = ground.grid;
  const lowerBound = (row: number[], x: number): number => {
    let low = 0, high = row.length;
    while (low < high) { const mid = (low + high) >>> 1; if (cells[row[mid]] < x) low = mid + 1; else high = mid; }
    return low;
  };
  const visit = (instance: number, plain: (x: number, span: number) => void, cut: (record: number) => void): void => {
    const offset = instance * 16;
    const span = Math.round(originalMatrices[offset] / cell);
    const xStart = Math.round((originalMatrices[offset + 12] - originalMatrices[offset] / 2) / cell) - min_x_idx;
    const z = Math.round((originalMatrices[offset + 14] - originalMatrices[offset + 10] / 2) / cell) - min_z_idx;
    const row = rows.get(z);
    if (!row) { plain(xStart, span); return; }
    let from = xStart;
    for (let i = lowerBound(row, xStart); i < row.length; i++) {
      const record = row[i], x = cells[record];
      if (x >= xStart + span) break;
      if (x > from) plain(from, x - from);
      cut(record); from = x + 1;
    }
    if (from < xStart + span) plain(from, xStart + span - from);
  };
  let newCount = 0, affected = 0;
  for (let i = 0; i < oldCount; i++) visit(i, () => newCount++, () => affected++);
  if (!affected) return;
  const matrices = new Float32Array(newCount * 16), colors = originalColors ? new Float32Array(newCount * 3) : null;
  const tiles = new Map<string, Array<readonly [number, number]>>();
  let out = 0;
  for (let instance = 0; instance < oldCount; instance++) visit(instance, (x, span) => {
    matrices.set(originalMatrices.subarray(instance * 16, instance * 16 + 16), out * 16);
    matrices[out * 16] = span * cell;
    matrices[out * 16 + 12] = (min_x_idx + x + span / 2) * cell;
    if (colors && originalColors) colors.set(originalColors.subarray(instance * 3, instance * 3 + 3), out * 3);
    out++;
  }, record => {
    const x = (min_x_idx + cells[record]) * cell, z = (min_z_idx + cells[record + 1]) * cell;
    const tile = `${Math.floor(x / 256)}:${Math.floor(z / 256)}`;
    const entries = tiles.get(tile) ?? [];
    if (!tiles.has(tile)) tiles.set(tile, entries);
    entries.push([record, instance]);
  });
  slabs.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  if (colors) slabs.instanceColor = new InstancedBufferAttribute(colors, 3);
  slabs.count = newCount;
  slabs.boundingBox = null; slabs.boundingSphere = null;
  slabs.userData.exactWaterBoundaryCells = affected;
  const triangles = new Float32Array(decode(data.triangles_f32));
  const edges = new Float32Array(decode(data.edges_f32));
  const root = new Group(); root.name = "Exact land complements along drawn water";
  root.userData.sourceSha256 = data.source_sha256;
  root.userData.affectedCells = affected;
  const material = (original: Material): Material => {
    const result = original.clone() as MeshBasicMaterial;
    result.vertexColors = true;
    return result;
  };
  const day = material(slabs.userData.dayMaterial ?? slabs.material);
  const night = material(slabs.userData.nightMaterial ?? slabs.material);
  for (const [tile, entries] of tiles) {
    const vertices = entries.reduce((sum, [record]) => sum + cells[record + 3] * 2 + cells[record + 5] * 3, 0);
    if (!vertices) continue;
    const positions = new Float32Array(vertices * 3), normals = new Float32Array(vertices * 3), paints = new Float32Array(vertices * 3);
    let cursor = 0;
    for (const [record, instance] of entries) {
      const top = originalMatrices[instance * 16 + 13] + originalMatrices[instance * 16 + 5] / 2;
      const bottom = top - originalMatrices[instance * 16 + 5];
      const color = originalColors?.subarray(instance * 3, instance * 3 + 3) ?? [1, 1, 1];
      const vertex = (x: number, y: number, z: number, nx: number, ny: number, nz: number): void => {
        positions[cursor] = x; positions[cursor + 1] = y; positions[cursor + 2] = z;
        normals[cursor] = nx; normals[cursor + 1] = ny; normals[cursor + 2] = nz;
        paints[cursor] = color[0]; paints[cursor + 1] = color[1]; paints[cursor + 2] = color[2]; cursor += 3;
      };
      const start = cells[record + 2] * 2, end = start + cells[record + 3] * 2;
      for (let i = start; i < end; i += 6) {
        for (const j of [0, 4, 2]) vertex(triangles[i + j], top, triangles[i + j + 1], 0, 1, 0);
        for (const j of [0, 2, 4]) vertex(triangles[i + j], bottom, triangles[i + j + 1], 0, -1, 0);
      }
      const firstEdge = cells[record + 4] * 2, endEdge = firstEdge + cells[record + 5] * 2;
      for (let i = firstEdge; i < endEdge; i += 4) {
        const ax = edges[i], az = edges[i + 1], bx = edges[i + 2], bz = edges[i + 3];
        const length = Math.hypot(bx - ax, bz - az);
        const nx = length ? (bz - az) / length : 0, nz = length ? (ax - bx) / length : 0;
        vertex(ax, top, az, nx, 0, nz); vertex(bx, top, bz, nx, 0, nz); vertex(bx, bottom, bz, nx, 0, nz);
        vertex(ax, top, az, nx, 0, nz); vertex(bx, bottom, bz, nx, 0, nz); vertex(ax, bottom, az, nx, 0, nz);
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new BufferAttribute(normals, 3));
    geometry.setAttribute("color", new BufferAttribute(paints, 3));
    geometry.userData.exactIndexPending = true;
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const mesh = new Mesh(geometry, day); mesh.name = `Exact water-edge land ${tile}`;
    mesh.userData.dayMaterial = day; mesh.userData.nightMaterial = night;
    mesh.userData.sourceBound = true; mesh.userData.exactWaterBoundaryLand = true; root.add(mesh);
  }
  slabs.add(freezeStaticSceneTransforms(root));
}
