import {
  BufferAttribute, BufferGeometry, Color, InstancedMesh, Mesh, MeshBasicMaterial,
  type MeshStandardMaterial,
} from "three";
import source from "./data/mittePlazaEdgesV367.json";
import streets from "./data/mitteSquareStreetsV367.json";
import { markGroundFinishV348 } from "./GroundFinishV348";
import type { VoxelPayload } from "./terrainPayload";

const applied = new WeakSet<InstancedMesh>();
export const MITTE_PLAZA_EDGES_V367 = "Mapped paving and planted edges in Mitte v367";

/** Paint only the portion of a surviving horizontal slab where a mapped
 * pedestrian area or planted island disagrees with its 4m centre sample.
 * Every triangle uses the existing host's literal top and depth testing. */
export function* attachMittePlazaEdgesV367(
  slabs: InstancedMesh, ground: VoxelPayload, shades: Record<string, readonly number[]>,
): Generator<void, number> {
  const {cellM, grid, classIds} = source;
  if (applied.has(slabs) || slabs.name !== "Drawn ground slabs" || !slabs.instanceColor ||
      ground.cell_m !== cellM || ground.grid.min_x_idx !== grid.min_x_idx ||
      ground.grid.min_z_idx !== grid.min_z_idx || ground.grid.cols !== grid.cols ||
      ground.grid.rows !== grid.rows || ground.classes[classIds.grass] !== "grass" ||
      ground.classes[classIds.plazaBrick] !== "plazaBrick") return 0;

  const raw = atob(source.words);
  const words = new Uint16Array(raw.length / 2);
  for (let i = 0; i < words.length; i++) words[i] = raw.charCodeAt(2*i) | raw.charCodeAt(2*i+1) << 8;
  const rows: number[][] = [];
  for (let at = 0; at < words.length; at += 4 + 6 * words[at + 3]) {
    (rows[words[at]] ??= []).push(at);
  }
  const palettes = new Map([
    [classIds.grass, shades.grass.map(hex => new Color(hex))],
    [classIds.plazaBrick, shades.plazaBrick.map(hex => new Color(hex))],
  ]);
  const positions = new Float32Array(source.maxVertices * 3);
  // The half-ULP quantisation error is below the ground-finish selector's
  // 0.000008 tolerance, including the sage and stone source swatches.
  const colours = new Uint16Array(source.maxVertices * 3);
  const indices = source.maxVertices <= 65535
    ? new Uint16Array(source.triangles * 3) : new Uint32Array(source.triangles * 3);
  let vertexCount = 0, indexCount = 0;
  const localKeys: number[] = [];
  const matrices = slabs.instanceMatrix.array;
  const hostColour = new Color();
  let admitted = 0;
  for (let i = 0; i < slabs.count; i++) {
    if (i && i % 16384 === 0) yield;
    const m = i * 16;
    const row = (matrices[m + 14] - cellM / 2) / cellM - grid.min_z_idx;
    const records = rows[row];
    // Previously clipped fragments, elevated decks, water and author-owned
    // replacements have no complete cardinal host and retain their original finish.
    if (!records || matrices[m + 10] !== cellM || matrices[m + 5] !== 3 ||
        matrices[m + 15] !== 1 || matrices[m+1] || matrices[m+2] || matrices[m+3] ||
        matrices[m+4] || matrices[m+6] || matrices[m+7] || matrices[m+8] ||
        matrices[m+9] || matrices[m+11]) continue;
    const start = (matrices[m+12] - matrices[m] / 2) / cellM - grid.min_x_idx;
    const end = start + matrices[m] / cellM;
    if (!Number.isInteger(start) || !Number.isInteger(end)) continue;
    let lo = 0, hi = records.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (words[records[mid]+1] < start) lo = mid + 1;
      else hi = mid;
    }
    if (lo === records.length || words[records[lo]+1] >= end) continue;
    slabs.getColorAt(i, hostColour);
    const y = matrices[m+13] + matrices[m+5]/2;
    for (; lo < records.length; lo++) {
      const record = records[lo], col = words[record + 1], kind = words[record + 2];
      if (col >= end) break;
      if (!palettes.get(kind)?.some(c => Math.abs(c.r-hostColour.r) < 1e-6 &&
          Math.abs(c.g-hostColour.g) < 1e-6 && Math.abs(c.b-hostColour.b) < 1e-6)) continue;
      const sourceRun = ground.ground_rows[row].find(([s,n]) => col >= s && col < s+n);
      if (sourceRun?.[2] !== kind) continue;
      const paint = palettes.get(kind === classIds.grass ? classIds.plazaBrick : classIds.grass)![0];
      const x = (col + grid.min_x_idx) * cellM, z = (row + grid.min_z_idx) * cellM;
      localKeys.length = 0;
      const base = vertexCount;
      const stop = record+4+6*words[record+3];
      for (let at = record+4; at < stop; at += 2) {
        const u = words[at], v = words[at+1], key = u * (cellM * source.subunits + 1) + v;
        let index = localKeys.indexOf(key);
        if (index === -1) {
          index = localKeys.length;
          localKeys.push(key);
          const offset = vertexCount++ * 3;
          positions[offset] = x + u / source.subunits;
          positions[offset + 1] = y;
          positions[offset + 2] = z + v / source.subunits;
          colours[offset] = Math.round(paint.r * 65535);
          colours[offset + 1] = Math.round(paint.g * 65535);
          colours[offset + 2] = Math.round(paint.b * 65535);
        }
        indices[indexCount++] = base + index;
      }
      admitted++;
    }
  }
  if (!admitted) return 0;
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions.subarray(0, vertexCount * 3), 3));
  geometry.setAttribute("color", new BufferAttribute(colours.subarray(0, vertexCount * 3), 3, true));
  const normals = new Int8Array(vertexCount * 3);
  for (let i = 1; i < normals.length; i += 3) normals[i] = 127;
  geometry.setAttribute("normal", new BufferAttribute(normals, 3, true));
  geometry.setIndex(new BufferAttribute(indices.subarray(0, indexCount), 1));
  const day = new MeshBasicMaterial({color: 0xffffff, vertexColors: true});
  const night = (slabs.userData.nightMaterial as MeshStandardMaterial).clone();
  night.vertexColors = true;
  for (const material of [day, night]) {
    // Resolve only coplanar fragments against the original top. Higher plates,
    // joints, paving details and kerbs still win the usual depth test.
    material.polygonOffset = true;
    material.polygonOffsetFactor = 0;
    material.polygonOffsetUnits = -1;
  }
  const mesh = new Mesh(geometry, day);
  mesh.name = MITTE_PLAZA_EDGES_V367;
  mesh.userData.dayMaterial = day;
  mesh.userData.nightMaterial = night;
  mesh.userData.correctedMitteCells = admitted;
  markGroundFinishV348(mesh, "core-drawn");
  slabs.add(mesh);
  applied.add(slabs);
  return admitted;
}

/** Continuous public survey polygons also bridge the old raster asphalt gaps.
 * The build only admits equal-height terrain samples and retains recorded
 * access openings, planted holes, wells and the tram's reserved surface. */
export function attachMitteSquareStreetsV367(slabs: InstancedMesh, ground: VoxelPayload): void {
  if (slabs.name !== "Drawn ground slabs" || !slabs.instanceColor ||
      slabs.userData.mitteSquareStreetsV367 || ground.cell_m !== source.cellM ||
      ground.grid.min_x_idx !== source.grid.min_x_idx || ground.grid.min_z_idx !== source.grid.min_z_idx ||
      ground.grid.cols !== source.grid.cols || ground.grid.rows !== source.grid.rows) return;
  let hash = 2166136261;
  for (const dm of ground.ground_height.y_dm) hash = Math.imul(hash ^ dm, 16777619) >>> 0;
  if (hash !== streets.heightGuard) return;
  const tones: Record<string, Color> = {
    road: new Color(0xc3c8c3), paving: new Color(0xc8c6bd),
    cycle: new Color(0xd4a79f), joint: new Color(0xb9b7ad), nozzle: new Color(0x777b77),
    fountainStone: new Color(0xd4d2c8), setts: new Color(0xb9b8af), grass: new Color(0xb9d9aa), gravel: new Color(0xc9bfa9),
  };
  const nVertices = streets.groups.reduce((n, part) => n + atob(part.xz).length / 8, 0);
  const nIndices = streets.groups.reduce((n, part) => n + atob(part.index).length / 2, 0);
  const positions = new Float32Array(nVertices * 3), colors = new Uint16Array(nVertices * 3);
  const normals = new Int8Array(nVertices * 3);
  const indices = nVertices <= 65535 ? new Uint16Array(nIndices) : new Uint32Array(nIndices);
  let vertex = 0, index = 0;
  for (const part of streets.groups) {
    const bytes = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0)).buffer;
    const xz = new Int32Array(bytes(part.xz)), local = new Uint16Array(bytes(part.index));
    const base = vertex, colour = tones[part.role];
    // Above the initial 4m ground and below the authored paths, kerbs, road
    // markings and street furniture. Every admitted plateau is truly level.
    const height = part.dm / 10 + (part.role === "cycle" ? .155 : .085);
    for (let j = 0; j < xz.length; j+=2) {
      const off = vertex++ * 3;
      positions[off] = xz[j] / 100; positions[off+1] = height; positions[off+2] = xz[j+1] / 100;
      colors[off] = Math.round(colour.r * 65535); colors[off+1] = Math.round(colour.g * 65535); colors[off+2] = Math.round(colour.b * 65535);
      normals[off+1] = 127;
    }
    for (const k of local) indices[index++] = base+k;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3, true));
  geometry.setAttribute("normal", new BufferAttribute(normals, 3, true));
  geometry.setIndex(new BufferAttribute(indices, 1));
  const day = new MeshBasicMaterial({color: 0xffffff, vertexColors:true});
  const night = (slabs.userData.nightMaterial as MeshStandardMaterial).clone();
  night.vertexColors = true;
  const mesh = new Mesh(geometry, day);
  mesh.name = "Measured Mitte sidewalks, verges and roads at squares v367";
  mesh.userData.dayMaterial = day; mesh.userData.nightMaterial = night;
  markGroundFinishV348(mesh, "core-drawn");
  slabs.add(mesh);
  slabs.userData.mitteSquareStreetsV367 = true;
}
