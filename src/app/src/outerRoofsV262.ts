import manifest from "./data/outerRoofsV262.json";
import type { SurroundingCityChunk, SurroundingPackedMesh } from "./SurroundingCityGeometry";

type Transfer = { mesh: number; fingerprint: number; triangles: number[] };
type Receipt = {
  origin: number[];
  records: Transfer[];
  lineFingerprint: number | null;
  segments: number[];
  replacement: SurroundingPackedMesh;
};
export type OuterRoofsSourceV262 = { schema: number; packets: Record<string, Receipt> };
type PreparedChunk = SurroundingCityChunk & { outerRoofsV262?: Receipt };
const source = manifest as OuterRoofsSourceV262;
const knownPackets = /* @__PURE__ */ (() => new Set(manifest.keys))();

/** Identical encoded source identity to the existing audited packet transfers. */
function* fingerprint(parts: readonly string[]): Generator<void, number> {
  let value = 2166136261;
  for (const text of parts) for (let start = 0; start < text.length; start += 65_536) {
    for (let i = start; i < Math.min(text.length, start + 65_536); i++)
      value = Math.imul(value ^ text.charCodeAt(i), 16777619) >>> 0;
    yield;
  }
  return value;
}

/** Prepare an atomic complete-house replacement in its existing chunk. The old
 * encoded part identity must stay intact for all preceding material/ownership
 * receipts. Retirement happens only in the final decoded index/line buffers,
 * after the complete replacement has joined this same transaction.
 */
export function* prepareOuterRoofsV262(
  chunk: SurroundingCityChunk, id: string, native: boolean,
  evidence: OuterRoofsSourceV262 = source,
): Generator<void, SurroundingCityChunk> {
  const key = `${native ? "minecraft" : "drawn"}:${id}`;
  if (evidence === source && !knownPackets.has(key)) return chunk;
  if (!Object.prototype.hasOwnProperty.call(evidence.packets, key) ||
      chunk.meshes.some(part => part.kind === "outer-roofs-v262")) return chunk;
  const receipt = evidence.packets[key];
  if (evidence.schema !== 1 || !receipt.replacement ||
      receipt.replacement.kind !== "outer-roofs-v262" ||
      receipt.origin.some((v, i) => v !== chunk.origin[i])) return chunk;
  // Check the complete transaction before appending or retiring any geometry.
  for (const record of receipt.records) {
    const part = chunk.meshes[record.mesh];
    if (!part || part.kind !== "city" ||
        (yield* fingerprint([part.positions, part.colors, part.indices])) !== record.fingerprint) return chunk;
    const triangleCount = (part.indices.length / 4 * 3 -
      (part.indices.endsWith("==") ? 2 : part.indices.endsWith("=") ? 1 : 0)) / 12;
    if (record.triangles.some(t => !Number.isSafeInteger(t) || t < 0 || t >= triangleCount)) return chunk;
  }
  if (receipt.segments.length) {
    if (!chunk.lines || (yield* fingerprint([chunk.lines.positions, chunk.lines.colors ?? ""])) !== receipt.lineFingerprint) return chunk;
    const lineCount = (chunk.lines.positions.length / 4 * 3 -
      (chunk.lines.positions.endsWith("==") ? 2 : chunk.lines.positions.endsWith("=") ? 1 : 0)) / 12;
    if (receipt.segments.some(s => !Number.isSafeInteger(s) || s < 0 || s >= lineCount)) return chunk;
  }
  const prepared: PreparedChunk = { ...chunk, meshes: [...chunk.meshes, receipt.replacement], outerRoofsV262: receipt };
  return prepared;
}

/** Only a successfully prepared full replacement can retire its obsolete cap. */
export function* applyOuterRoofsV262Triangles(
  chunk: SurroundingCityChunk, meshIndex: number,
  indices: Uint16Array | Uint32Array, offset: number,
): Generator<void, number> {
  const receipt = (chunk as PreparedChunk).outerRoofsV262;
  if (!receipt || !chunk.meshes.includes(receipt.replacement)) return 0;
  let changed = 0;
  for (const record of receipt.records) {
    if (record.mesh !== meshIndex) continue;
    for (const triangle of record.triangles) {
      const at = offset + triangle * 3;
      if (at + 2 >= indices.length) throw new Error("Outer-roof transfer exceeds decoded packet");
      indices[at + 1] = indices[at]; indices[at + 2] = indices[at];
      if (++changed % 1024 === 0) yield;
    }
  }
  return changed;
}

/** Preserve all old line bytes; collapse only receipted flat-cap ghost lines. */
export function* applyOuterRoofsV262Lines(
  chunk: SurroundingCityChunk, values: Uint16Array, stride: number,
): Generator<void, number> {
  const receipt = (chunk as PreparedChunk).outerRoofsV262;
  if (!receipt || !chunk.meshes.includes(receipt.replacement)) return 0;
  let changed = 0;
  for (const segment of receipt.segments) {
    const at = segment * 2 * stride;
    if (at + stride + 2 >= values.length) throw new Error("Outer-roof line exceeds decoded packet");
    values[at + stride] = values[at];
    values[at + stride + 1] = values[at + 1];
    values[at + stride + 2] = values[at + 2];
    if (++changed % 1024 === 0) yield;
  }
  return changed;
}
