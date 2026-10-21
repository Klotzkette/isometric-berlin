import north from "./data/northElevatedV238Replacement.json";
import south from "./data/southElevatedV238Replacement.json";
import venues from "./data/venuesV238Replacement.json";
import { columbiaFacadeV257 } from "./columbiaFacadeV257";
import type { SurroundingCityChunk, SurroundingNavigation, SurroundingPackedMesh } from "./SurroundingCityGeometry";

type Solid = { ring: number[][]; holes: number[][][]; minY: number; maxY: number };
type Receipt = {
  origin: number[];
  records: { mesh: number; fingerprint: number; triangles: number[] }[];
  lineFingerprint: number | null; segments: number[];
  replacement: SurroundingPackedMesh;
  navigationRecords: { owner: string; original: SurroundingNavigation["buildings"][number]; groundY: number }[];
  navigationSolids: Solid[];
};
export type NamedSiteSourceV238 = { schema: number; keys?: readonly string[]; packets: Record<string, Receipt> };
type PreparedChunk = SurroundingCityChunk & { namedSiteV238?: Receipt };
// Keep only tiny eager keys and their lazy source accessors. Spreading .packets
// here would hydrate both geometry families at startup and retain them forever.
const packetSources = new Map<string, NamedSiteSourceV238>();
for (const data of [north, south, venues]) {
  const source = data as unknown as NamedSiteSourceV238;
  if (!Array.isArray(source.keys)) throw new Error("Missing named-site packet key index");
  for (const key of source.keys) {
    if (packetSources.has(key)) throw new Error("Duplicate named-site packet key");
    packetSources.set(key, source);
  }
}

function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => equal(v, b[i]));
  const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
  return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(k => Object.hasOwn(y, k) && equal(x[k], y[k]));
}
function* fingerprint(parts: string[]): Generator<void, number> {
  let value = 2166136261;
  for (const text of parts) for (let start = 0; start < text.length; start += 65_536) {
    for (let i = start; i < Math.min(text.length, start + 65_536); i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619) >>> 0;
    yield;
  }
  return value;
}
const bytes = (s: string) => s.length / 4 * 3 - (s.endsWith("==") ? 2 : s.endsWith("=") ? 1 : 0);

/** A complete station/venue is appended to its original tile before any proxy
 * indices, ink or collision can yield. A changed source retains its old body. */
export function* prepareNamedSiteV238(chunk: SurroundingCityChunk, id: string, native: boolean,
  evidence?: NamedSiteSourceV238): Generator<void, SurroundingCityChunk> {
  const key = `${native ? "minecraft" : "drawn"}:${id}`;
  if ((chunk as PreparedChunk).namedSiteV238) return chunk;
  const source = evidence ?? packetSources.get(key);
  if (!source || source.schema !== 1) return chunk;
  const packets = source.packets;
  if (!Object.hasOwn(packets, key)) return chunk;
  let receipt = packets[key];
  if (!receipt.replacement || !equal(receipt.origin, chunk.origin)) return chunk;
  for (const record of receipt.records) {
    const part = chunk.meshes[record.mesh];
    if (!part || (yield* fingerprint([part.positions, part.colors, part.indices])) !== record.fingerprint) return chunk;
    if (record.triangles.some(t => !Number.isSafeInteger(t) || t < 0 || t >= bytes(part.indices) / 12)) return chunk;
  }
  if (receipt.segments.length) {
    if (!chunk.lines || (yield* fingerprint([chunk.lines.positions, chunk.lines.colors ?? ""])) !== receipt.lineFingerprint) return chunk;
    if (receipt.segments.some(s => !Number.isSafeInteger(s) || s < 0 || s >= bytes(chunk.lines!.positions) / 12)) return chunk;
  }
  for (const record of receipt.navigationRecords)
    if (chunk.nav.groundY !== record.groundY || !chunk.nav.buildings.some(b => b.sourceId === record.owner && equal(b, record.original))) return chunk;
  if (!evidence && id === "2_7") receipt = { ...receipt, replacement: yield* columbiaFacadeV257(receipt.replacement, native) };
  return { ...chunk, meshes: [...chunk.meshes, receipt.replacement], namedSiteV238: receipt } as PreparedChunk;
}

export function* applyNamedSiteTrianglesV238(chunk: SurroundingCityChunk, mesh: number,
  indices: Uint16Array | Uint32Array, offset: number): Generator<void, number> {
  const r = (chunk as PreparedChunk).namedSiteV238;
  if (!r || !chunk.meshes.includes(r.replacement)) return 0;
  let n = 0;
  for (const record of r.records) if (record.mesh === mesh) for (const triangle of record.triangles) {
    const i = offset + triangle * 3;
    if (i + 2 >= indices.length) throw new Error("Named-site transfer exceeds its decoded packet");
    indices[i + 1] = indices[i]; indices[i + 2] = indices[i];
    if (++n % 1024 === 0) yield;
  }
  return n;
}
export function* applyNamedSiteLinesV238(chunk: SurroundingCityChunk, values: Uint16Array,
  stride: number): Generator<void, number> {
  const r = (chunk as PreparedChunk).namedSiteV238;
  if (!r || !chunk.meshes.includes(r.replacement)) return 0;
  let n = 0;
  for (const segment of r.segments) {
    const i = segment * 2 * stride;
    if (i + stride + 2 >= values.length) throw new Error("Named-site line exceeds its decoded packet");
    values[i + stride] = values[i]; values[i + stride + 1] = values[i + 1]; values[i + stride + 2] = values[i + 2];
    if (++n % 1024 === 0) yield;
  }
  return n;
}

export function namedSiteNavigationV238(chunk: SurroundingCityChunk, nav: SurroundingNavigation): SurroundingNavigation {
  const r = (chunk as PreparedChunk).namedSiteV238;
  if (!r || !chunk.meshes.includes(r.replacement)) return nav;
  const buildings = nav.buildings.filter(b => !r.navigationRecords.some(n => n.groundY === nav.groundY && n.owner === b.sourceId && equal(n.original, b)));
  return { ...nav, buildings: [...buildings, ...r.navigationSolids.map((s, i) => ({
    ring: s.ring, holes: s.holes, minHeight: s.minY - nav.groundY, height: s.maxY - nav.groundY,
    sourceId: `required-v238-${chunk.origin[0]}-${chunk.origin[2]}-${i}`,
  }))] };
}
