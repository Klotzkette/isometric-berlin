import manifest from "./data/eurefTransfersV262.json";
import type { SurroundingCityChunk, SurroundingNavigation } from "./SurroundingCityGeometry";

type Record = { mesh: number; fingerprint: number; triangles: number[] };
type Receipt = {
  origin: number[]; records: Record[]; lineFingerprint: number | null; segments: number[];
  replacements: { mesh: number; fingerprint: number }[];
  navigationFingerprint: number; retiredOwners: string[]; buildings: (SurroundingNavigation["buildings"][number] & { partId: string })[];
};
export type EurefTransfersSourceV262 = { schema: number; packets: { [key: string]: Receipt } };
type PreparedChunk = SurroundingCityChunk & { eurefTransfersV262?: Receipt };
const source = manifest as EurefTransfersSourceV262;
const known = /* @__PURE__ */ (() => new Set(manifest.keys))();

function* fingerprint(parts: string[]): Generator<void, number> {
  let value = 2166136261;
  for (const text of parts) for (let start = 0; start < text.length; start += 65_536) {
    for (let i = start; i < Math.min(text.length, start + 65_536); i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619) >>> 0;
    yield;
  }
  return value;
}
const bytes = (s: string) => s.length / 4 * 3 - (s.endsWith("==") ? 2 : s.endsWith("=") ? 1 : 0);

/** Original part, line and navigation bytes remain intact for all prior
 * ownership/material/door receipts. Retire only after the complete measured
 * replacement is verified in this same bounded packet transaction. */
export function* prepareEurefTransfersV262(chunk: SurroundingCityChunk, id: string, native: boolean,
  evidence: EurefTransfersSourceV262 = source): Generator<void, SurroundingCityChunk> {
  const key = `${native ? "minecraft" : "drawn"}:${id}`;
  if (evidence === source && !known.has(key)) return chunk;
  const r = evidence.packets[key];
  if (!r || evidence.schema !== 1 || (chunk as PreparedChunk).eurefTransfersV262 === r) return chunk;
  if (r.origin.some((v, i) => v !== chunk.origin[i]) || !r.replacements.length) return chunk;
  for (const record of [...r.records, ...r.replacements]) {
    const part = chunk.meshes[record.mesh];
    if (!part || (yield* fingerprint([part.positions, part.colors, part.indices])) !== record.fingerprint) return chunk;
  }
  for (const record of r.records) {
    const part = chunk.meshes[record.mesh];
    if (part.kind !== "city" || record.triangles.some(t => !Number.isSafeInteger(t) || t < 0 || t >= bytes(part.indices) / 12)) return chunk;
  }
  if (r.replacements.some(record => chunk.meshes[record.mesh].kind !== "euref-historic-v262")) return chunk;
  if (r.segments.length && (!chunk.lines ||
    (yield* fingerprint([chunk.lines.positions, chunk.lines.colors ?? ""])) !== r.lineFingerprint ||
    r.segments.some(s => !Number.isSafeInteger(s) || s < 0 || s >= bytes(chunk.lines!.positions) / 12))) return chunk;
  if ((yield* fingerprint([JSON.stringify(chunk.nav)])) !== r.navigationFingerprint) return chunk;
  if (r.buildings.some(b => !r.retiredOwners.includes(b.sourceId) || !b.partId || !Number.isFinite(b.height))) return chunk;
  return { ...chunk, eurefTransfersV262: r } as PreparedChunk;
}

export function* applyEurefTransfersV262Triangles(chunk: SurroundingCityChunk, mesh: number,
  indices: Uint16Array | Uint32Array, offset: number): Generator<void, number> {
  const r = (chunk as PreparedChunk).eurefTransfersV262;
  if (!r) return 0;
  let count = 0;
  for (const record of r.records) if (record.mesh === mesh) for (const triangle of record.triangles) {
    const at = offset + triangle * 3;
    if (at + 2 >= indices.length) throw new Error("EUREF transfer exceeds decoded source part");
    indices[at + 1] = indices[at]; indices[at + 2] = indices[at];
    if (++count % 1024 === 0) yield;
  }
  return count;
}

export function* applyEurefTransfersV262Lines(chunk: SurroundingCityChunk, values: Uint16Array,
  stride: number): Generator<void, number> {
  const r = (chunk as PreparedChunk).eurefTransfersV262;
  if (!r) return 0;
  let count = 0;
  for (const segment of r.segments) {
    const at = segment * 2 * stride;
    if (at + stride + 2 >= values.length) throw new Error("EUREF transfer exceeds decoded source ink");
    values[at + stride] = values[at]; values[at + stride + 1] = values[at + 1]; values[at + stride + 2] = values[at + 2];
    if (++count % 1024 === 0) yield;
  }
  return count;
}

export function eurefNavigationV262(chunk: SurroundingCityChunk, nav: SurroundingNavigation): SurroundingNavigation {
  const r = (chunk as PreparedChunk).eurefTransfersV262;
  if (!r) return nav;
  return { ...nav, buildings: [...nav.buildings.filter(b => !r.retiredOwners.includes(b.sourceId)), ...r.buildings] };
}
