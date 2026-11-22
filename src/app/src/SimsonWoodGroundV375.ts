import { BufferAttribute, BufferGeometry, Color, InstancedMesh, Mesh, type Material } from "three";
import { gunzipSync } from "three/examples/jsm/libs/fflate.module.js";
import { decodeBase64Bytes } from "./decodeBase64Bytes";
import { markGroundFinishV348 } from "./GroundFinishV348";
import { admitsSimsonGroundV375 } from "./simsonGroundGuardV375";
import type { VoxelPayload } from "./terrainPayload";
import cuts from "./data/simsonWoodRasterV375.json";

const applied = new WeakSet<InstancedMesh>();
const recess = 0.7;
type Host = {row: number; first: number; count: number; instance: number};

function words(data: string): ArrayBuffer {
  const raw = gunzipSync(decodeBase64Bytes(data));
  return raw.byteOffset === 0 && raw.byteLength === raw.buffer.byteLength
    ? raw.buffer as ArrayBuffer : raw.slice().buffer;
}

/** Recess the upper face of each measured host without moving its basement
 * or replacing the city's shared instance buffers. Earlier cuts keep priority. */
export function cutSimsonWoodGroundV375(slabs: InstancedMesh, ground: VoxelPayload): void {
  if (applied.has(slabs) || slabs.name !== "Drawn ground slabs" || !slabs.instanceColor ||
      !slabs.userData.roadGroundCellsV343 || !admitsSimsonGroundV375(ground)) return;

  const hosts = new Float32Array(words(cuts.hosts)), fragments = new Int32Array(words(cuts.fragments));
  if (hosts.length % 7 || fragments.length % 6) return;
  const byZ = new Map<number, Map<number, Host[]>>(), candidates: Host[] = [];
  let first = 0;
  for (let row = 0; row < hosts.length; row += 7) {
    const count = hosts[row + 6];
    if (!Number.isSafeInteger(count) || count < 0) return;
    const z = (hosts[row + 1] + hosts[row + 3]) / 2, x = (hosts[row] + hosts[row + 2]) / 2;
    let line = byZ.get(z);
    if (!line) byZ.set(z, line = new Map());
    let group = line.get(x);
    if (!group) line.set(x, group = []);
    if (group.some(h => hosts[h.row] === hosts[row] && hosts[h.row + 1] === hosts[row + 1] &&
        hosts[h.row + 4] === hosts[row + 4] && hosts[h.row + 5] === hosts[row + 5])) return;
    const h = {row, first, count, instance: -1};
    candidates.push(h);
    group.push(h);
    first += count * 6;
  }
  if (first !== fragments.length) return;

  const matrix = slabs.instanceMatrix.array;
  for (let i = 0; i < slabs.count; i++) {
    const m = i * 16;
    const sameCentre = byZ.get(matrix[m + 14])?.get(matrix[m + 12]);
    if (!sameCentre || matrix[m + 1] || matrix[m + 2] || matrix[m + 3] || matrix[m + 4] ||
        matrix[m + 6] || matrix[m + 7] || matrix[m + 8] || matrix[m + 9] || matrix[m + 11] ||
        matrix[m + 15] !== 1) continue;
    for (const h of sameCentre) {
      const at = h.row;
      if (matrix[m] !== hosts[at + 2] - hosts[at] || matrix[m + 10] !== hosts[at + 3] - hosts[at + 1] ||
          matrix[m + 5] !== hosts[at + 5] || !(matrix[m + 5] > recess) ||
          Math.fround(matrix[m + 13] + matrix[m + 5] / 2) !== hosts[at + 4]) continue;
      // An identical second candidate cannot be assigned to either owner.
      h.instance = h.instance === -1 ? i : -2;
    }
  }

  const pos: number[] = [], paint: number[] = [];
  const colour = new Color();
  const vertex = (x: number, y: number, z: number) => { pos.push(x, y, z); paint.push(colour.r, colour.g, colour.b); };
  const matched = candidates.filter(h => h.instance >= 0);
  if (!matched.length) return;
  for (const h of matched) {
    const at = h.row, m = h.instance * 16;
    const top = matrix[m + 13] + matrix[m + 5] / 2, bottom = top - recess;
    const west = Math.round(hosts[at] * 100), north = Math.round(hosts[at + 1] * 100);
    const east = Math.round(hosts[at + 2] * 100), south = Math.round(hosts[at + 3] * 100);
    slabs.getColorAt(h.instance, colour);
    for (let f = h.first; f < h.first + h.count * 6; f += 6) {
      for (let j = 0; j < 6; j += 2) vertex(fragments[f + j] / 100, top, fragments[f + j + 1] / 100);
      // Restore the original outer wall only below a surviving top edge. The
      // internal triangulation and the surveyed woodland acquire no new wall.
      for (let j = 0; j < 6; j += 2) {
        const ax = fragments[f + j], az = fragments[f + j + 1];
        const bx = fragments[f + (j + 2) % 6], bz = fragments[f + (j + 2) % 6 + 1];
        if (!((ax === bx && (ax === west || ax === east)) || (az === bz && (az === north || az === south)))) continue;
        vertex(ax / 100, top, az / 100); vertex(ax / 100, bottom, az / 100); vertex(bx / 100, bottom, bz / 100);
        vertex(ax / 100, top, az / 100); vertex(bx / 100, bottom, bz / 100); vertex(bx / 100, top, bz / 100);
      }
    }
  }
  if (pos.length) {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
    geometry.setAttribute("color", new BufferAttribute(new Float32Array(paint), 3));
    geometry.computeVertexNormals();
    const base = Array.isArray(slabs.material) ? slabs.material[0] : slabs.material;
    const day: Material = (slabs.userData.dayMaterial ?? base).clone();
    const night: Material = (slabs.userData.nightMaterial ?? base).clone();
    day.vertexColors = night.vertexColors = true;
    const mesh = new Mesh(geometry, slabs.material === slabs.userData.nightMaterial ? night : day);
    mesh.name = "Original ground outside the surveyed Simson woodland v375";
    mesh.renderOrder = slabs.renderOrder;
    mesh.castShadow = slabs.castShadow;
    mesh.receiveShadow = slabs.receiveShadow;
    mesh.userData.dayMaterial = day;
    mesh.userData.nightMaterial = night;
    markGroundFinishV348(mesh, "core-drawn");
    slabs.add(mesh);
  }
  const attr = slabs.instanceMatrix;
  const allowPartialUpload = attr.version === 0 || attr.updateRanges.length > 0;
  for (const h of matched) {
    const m = h.instance * 16;
    matrix[m + 5] -= recess;
    matrix[m + 13] -= recess / 2;
    if (allowPartialUpload) attr.addUpdateRange(m + 5, 9);
  }
  attr.needsUpdate = true;
  // Retained or shrunken boxes remain within the existing conservative bounds.
  applied.add(slabs);
}
