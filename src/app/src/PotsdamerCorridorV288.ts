import data from "./data/potsdamerCorridorV288.json";
import { houseDoorNavigationGuardV233 } from "./houseDoorsV233";
import type { SurroundingCityChunk, SurroundingPackedMesh } from "./SurroundingCityGeometry";

type Face = { owner: string; a: number[]; b: number[]; low: number; high: number; normal: number[]; omitted: number[] };
type Plan = { origin: number[]; guard: number; records: { mesh: number; kind: string; fingerprint: number }[]; faces: Face[] };
export type PotsdamerCorridorSourceV288 = { schemaVersion: number; chunks: Record<string, { drawn?: Plan; minecraft?: Plan }> };
const source = data as PotsdamerCorridorSourceV288;
export const POTSDAMER_CORRIDOR_KIND_V288 = "potsdamer-corridor-window-surrounds-v288";
const MAX_WINDOWS = 1024;
const bytes = (s: string): number => s.length / 4 * 3 - (s.endsWith("==") ? 2 : s.endsWith("=") ? 1 : 0);
const linear = (hex: number): number[] => [hex >>> 16, (hex >>> 8) & 255, hex & 255].map(v => Math.round((v <= 10.31475 ? v / 255 / 12.92 : ((v / 255 + .055) / 1.055) ** 2.4) * 255));
const FRAME = linear(0xc9c4b7), SILL = linear(0xb4b1a4), MULLION = linear(0xb8beb8);
function encoded(array: ArrayBufferView): string {
  const view = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
  let text = "";
  for (let at = 0; at < view.length; at += 8192) text += String.fromCharCode(...view.subarray(at, at + 8192));
  return btoa(text);
}

/** Fittings surround existing, fingerprinted v188 glass; they never add a second
 * pane or move a source wall. The independent native spans are real exterior
 * cardinal source walls, not rotated copies of the drawn street front. */
export function* preparePotsdamerCorridorV288(
  chunk: SurroundingCityChunk, id: string, native = false,
  evidence: PotsdamerCorridorSourceV288 = source,
): Generator<void, SurroundingCityChunk> {
  if (!Object.prototype.hasOwnProperty.call(evidence.chunks, id) || chunk.meshes.some(p => p.kind === POTSDAMER_CORRIDOR_KIND_V288)) return chunk;
  const plan = evidence.chunks[id][native ? "minecraft" : "drawn"];
  if (evidence.schemaVersion !== 1 || !plan || !plan.faces.length || plan.faces.length > 192 ||
      plan.origin.length !== 3 || chunk.origin.some((v, i) => v !== plan.origin[i]) ||
      chunk.meshes.length >= 16 || houseDoorNavigationGuardV233(chunk.nav) !== plan.guard ||
      !plan.records.length || plan.records.length > chunk.meshes.length || plan.records.some((r, i) => r.mesh !== i)) return chunk;
  let windows = 0;
  for (const face of plan.faces) {
    const numbers = [...face.a, ...face.b, face.low, face.high, ...face.normal];
    if (face.a.length !== 2 || face.b.length !== 2 || face.normal.length !== 2 || !numbers.every(Number.isFinite) ||
        face.high <= face.low + 2 || Math.abs(Math.hypot(...face.normal) - 1) > .000001 ||
        new Set(face.omitted).size !== face.omitted.length || (native && !(face.a[0] === face.b[0] || face.a[1] === face.b[1]))) return chunk;
    const width = Math.hypot(face.b[0] - face.a[0], face.b[1] - face.a[1]);
    const cols = Math.max(1, Math.trunc((width - 1.5) / (native ? 4 : 3.8)));
    if (width < 1 || face.omitted.some(v => !Number.isInteger(v) || v < 0 || v >= cols)) return chunk;
    windows += Math.max(1, Math.trunc((face.high - face.low - 1.5) / (native ? 4 : 3.6))) * (cols - face.omitted.length);
  }
  if (!windows || windows > MAX_WINDOWS) return chunk;
  const vertexCount = windows * 6 * 4, indexCount = windows * 6 * 6;
  if (chunk.meshes.reduce((n, m) => n + bytes(m.positions) / 6, vertexCount) > 400_000 ||
      chunk.meshes.reduce((n, m) => n + bytes(m.indices) / 4, indexCount) > 2_400_000) return chunk;
  // All earlier original/companion meshes must still match before allocation.
  // Later additive preparers may append further parts; those remain untouched.
  for (const receipt of plan.records) {
    const part = chunk.meshes[receipt.mesh];
    if (!part || part.kind !== receipt.kind || part.positionType !== "u16cm") return chunk;
    let hash = 2166136261;
    for (const text of [part.positions, part.colors, part.indices]) {
      for (let start = 0; start < text.length; start += 65_536) {
        for (let at = start; at < Math.min(start + 65_536, text.length); at++) hash = Math.imul(hash ^ text.charCodeAt(at), 16777619) >>> 0;
        yield;
      }
    }
    if (hash !== receipt.fingerprint) return chunk;
  }
  const positions = new Uint16Array(vertexCount * 3), colors = new Uint8Array(vertexCount * 3), indices = new Uint32Array(indexCount);
  let vertex = 0, index = 0, valid = true, done = 0;
  for (const face of plan.faces) {
    const width = Math.hypot(face.b[0] - face.a[0], face.b[1] - face.a[1]);
    const dx = (face.b[0] - face.a[0]) / width, dz = (face.b[1] - face.a[1]) / width, [nx, nz] = face.normal;
    const rows = Math.max(1, Math.trunc((face.high - face.low - 1.5) / (native ? 4 : 3.6)));
    const cols = Math.max(1, Math.trunc((width - 1.5) / (native ? 4 : 3.8)));
    const paneW = native ? 1.15 : 1.32, paneH = native ? 1.4 : 1.8;
    const emit = (x: number, y: number, z: number, w: number, h: number, depth: number, tint: number[]) => {
      const first = vertex;
      for (const [s, t] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const p = [x + dx * s * w / 2 + nx * depth, y + t * h / 2, z + dz * s * w / 2 + nz * depth];
        for (let axis = 0; axis < 3; axis++) {
          const value = Math.round(p[axis] * 100);
          if (value < 0 || value > 65535) valid = false;
          positions[vertex * 3 + axis] = value; colors[vertex * 3 + axis] = tint[axis];
        }
        vertex++;
      }
      const winding = dx * nz - dz * nx > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
      for (const offset of winding) indices[index++] = first + offset;
    };
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      if (face.omitted.includes(col)) continue;
      const u = (col + .5) * width / cols, x = face.a[0] + dx * u, z = face.a[1] + dz * u;
      const y = face.low + 1.5 + (row + .5) * (face.high - face.low - 2.4) / rows;
      for (const side of [-1, 1]) emit(x + dx * side * (paneW / 2 + .045), y, z + dz * side * (paneW / 2 + .045), .09, paneH + .20, .105, FRAME);
      emit(x, y - paneH / 2 - .075, z, paneW + .30, .15, .18, SILL);
      emit(x, y + paneH / 2 + .05, z, paneW + .20, .10, .11, FRAME);
      emit(x, y, z, .045, paneH, .13, MULLION);
      emit(x, y + paneH * .17, z, paneW, .045, .135, MULLION);
      if (++done % 32 === 0) yield;
    }
  }
  if (!valid || vertex !== vertexCount || index !== indexCount) return chunk;
  const part: SurroundingPackedMesh = { kind: POTSDAMER_CORRIDOR_KIND_V288, positionType: "u16cm", positions: encoded(positions), colors: encoded(colors), indices: encoded(indices) };
  return { ...chunk, meshes: [...chunk.meshes, part] };
}
