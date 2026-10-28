import receiptData from './data/tierparkAnimalTransferV282.json';
import sourceData from './data/tierparkV276.json';
import type { SurroundingCityChunk, SurroundingPackedMesh } from './SurroundingCityGeometry';
import type { RetainedZooAnimalV282 } from './ZooAnimalsV282';

type AnimalReceipt = {
  id: string; sourceId: string; species: string; anchor: number[]; triangleRange: number[];
};
type FamilyReceipt = {
  origin: number[]; groundY: number; meshGuard: number; encodedLengths: number[];
  vertexCount: number; indexCount: number; animalTriangleCount: number; animals: AnimalReceipt[];
};
const receipt = receiptData as {
  schemaVersion: number; packetId: string; families: Record<'drawn' | 'minecraft', FamilyReceipt>;
};
const source = sourceData as {
  packets: Record<string, { origin: number[]; mesh: SurroundingPackedMesh }>;
};
const keys = ['kind', 'positionType', 'positions', 'colors', 'indices'] as const;

function guard(mesh: SurroundingPackedMesh): number {
  let hash = 2166136261;
  for (const key of keys) {
    const value = mesh[key] + '|';
    for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619) >>> 0;
  }
  return hash;
}
function decode(text: string): Uint8Array {
  const binary = atob(text), bytes = new Uint8Array(binary.length);
  for (let i = 0; i < bytes.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
function encode(bytes: Uint8Array): string {
  let binary = '';
  for (let start = 0; start < bytes.length; start += 4096) {
    binary += String.fromCharCode(...bytes.subarray(start, start + 4096));
  }
  return btoa(binary);
}

/** Transfer only the 47 evidence-owned v276 figures. Exact source equality is
 * checked before decoding; all architecture, vertex bytes and colours stay put.
 * A different packet/version/family or a second transfer is a complete no-op. */
export function transferTierparkAnimalsV282(
  chunk: SurroundingCityChunk, id: string, native: boolean,
): { chunk: SurroundingCityChunk; animals: RetainedZooAnimalV282[] } {
  const unchanged = { chunk, animals: [] as RetainedZooAnimalV282[] };
  if (receipt.schemaVersion !== 1 || id !== receipt.packetId || chunk.schemaVersion !== 1) return unchanged;
  const family = native ? 'minecraft' : 'drawn', plan = receipt.families[family];
  const canonical = source.packets[family + ':' + id];
  if (!canonical || plan.origin.length !== 3 || chunk.origin.length !== 3 ||
      chunk.origin.some((v, i) => v !== plan.origin[i] || v !== canonical.origin[i]) ||
      chunk.nav.groundY !== plan.groundY || plan.animals.length !== 47) return unchanged;
  const matches = chunk.meshes.filter(mesh => mesh.kind === 'tierpark-v276');
  if (matches.length !== 1) return unchanged;
  const mesh = matches[0];
  if (keys.some(key => mesh[key] !== canonical.mesh[key]) || mesh.positionType !== 'u16cm' ||
      [mesh.positions.length, mesh.colors.length, mesh.indices.length].some((n, i) => n !== plan.encodedLengths[i]) ||
      guard(mesh) !== plan.meshGuard) return unchanged;

  // Bound this decoder to the small immutable companion, never an entire tile.
  if (!Number.isInteger(plan.vertexCount) || plan.vertexCount < 1 || plan.vertexCount > 10_000 ||
      !Number.isInteger(plan.indexCount) || plan.indexCount < 3 || plan.indexCount > 150_000 ||
      plan.indexCount % 3 !== 0) return unchanged;
  let positions: Uint8Array, colors: Uint8Array, indices: Uint8Array;
  try { positions = decode(mesh.positions); colors = decode(mesh.colors); indices = decode(mesh.indices); }
  catch { return unchanged; }
  if (positions.length !== plan.vertexCount * 6 || colors.length !== plan.vertexCount * 3 ||
      indices.length !== plan.indexCount * 4) return unchanged;
  const positionView = new DataView(positions.buffer), indexView = new DataView(indices.buffer);
  const triangleCount = plan.indexCount / 3, owned = new Uint8Array(triangleCount), ids = new Set<string>();
  let removed = 0;
  for (const animal of plan.animals) {
    const [start, end] = animal.triangleRange;
    if (!animal.id || ids.has(animal.id) || animal.anchor.length !== 3 || !animal.anchor.every(Number.isFinite) ||
        animal.triangleRange.length !== 2 || !Number.isInteger(start) || !Number.isInteger(end) ||
        start < 0 || start >= end || end > triangleCount) return unchanged;
    ids.add(animal.id);
    for (let triangle = start; triangle < end; triangle++) {
      if (owned[triangle]) return unchanged;
      owned[triangle] = 1; removed++;
    }
  }
  if (removed !== plan.animalTriangleCount || removed < 1 || removed >= triangleCount) return unchanged;
  const animals: RetainedZooAnimalV282[] = [], speciesOrdinals = new Map<string, number>();
  for (const animal of plan.animals) {
    const ordinal = speciesOrdinals.get(animal.species) ?? 0;
    speciesOrdinals.set(animal.species, ordinal + 1);
    const surfaces = new Map<number, number[][][]>();
    for (let triangle = animal.triangleRange[0]; triangle < animal.triangleRange[1]; triangle++) {
      const points: number[][] = [];
      let triangleColor = -1;
      for (let corner = 0; corner < 3; corner++) {
        const vertex = indexView.getUint32((triangle * 3 + corner) * 4, true);
        if (vertex >= plan.vertexCount) return unchanged;
        const c = colors[vertex * 3] * 65536 + colors[vertex * 3 + 1] * 256 + colors[vertex * 3 + 2];
        // v276 uses a single colour per face; refuse any unsupported gradient.
        if (corner && c !== triangleColor) return unchanged;
        triangleColor = c;
        points.push([0, 1, 2].map(axis => chunk.origin[axis] + positionView.getUint16((vertex * 3 + axis) * 2, true) * .01));
      }
      let list = surfaces.get(triangleColor);
      if (!list) { list = []; surfaces.set(triangleColor, list); }
      list.push(points);
    }
    animals.push({ id: animal.id, anchor: [...animal.anchor] as [number, number, number], boxes: [],
      // v276 authored each species' successive poses with (-z, x) turns.
      heading: -(ordinal % 4) * Math.PI / 2,
      // Existing packed RGB bytes are linear vertex inputs, not sRGB hex colours.
      linearColors: true, surfaces: [...surfaces].map(([color, triangles]) => ({ color, triangles })) });
  }
  const remaining = new Uint8Array((triangleCount - removed) * 12);
  let target = 0;
  for (let triangle = 0; triangle < triangleCount; triangle++) if (!owned[triangle]) {
    remaining.set(indices.subarray(triangle * 12, triangle * 12 + 12), target); target += 12;
  }
  const transferred = { ...mesh, indices: encode(remaining) };
  return { chunk: { ...chunk, meshes: chunk.meshes.map(member => member === mesh ? transferred : member) }, animals };
}
