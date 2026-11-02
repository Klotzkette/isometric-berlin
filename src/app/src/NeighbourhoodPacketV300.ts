import { surroundingPacketFingerprint } from "./surroundingPacketFingerprint";
import type { SurroundingCityChunk, SurroundingPackedMesh } from "./SurroundingCityGeometry";

export type NeighbourhoodPlanV300 = {
  origin: number[];
  navGuard: number;
  preparedNavGuard?: number;
  preparedLineGuard?: number | null;
  records: { mesh: number; kind: string; fingerprint: number }[];
  lineGuard: number | null;
  append: SurroundingPackedMesh;
  appendFingerprint: number;
  retire: { mesh: number; triangles: number[] }[];
  owners: string[];
};
export type NeighbourhoodSourceV300 = {
  schemaVersion: number;
  keys: string[];
  packets: Record<string, NeighbourhoodPlanV300>;
};
type Transfer = { original: SurroundingPackedMesh[]; append: SurroundingPackedMesh; retire: NeighbourhoodPlanV300["retire"]; origin: number[]; navText: string; lines?: { positions: string; colors?: string } };
export type NeighbourhoodTicketV300 = (prepared: SurroundingCityChunk) => Generator<void, SurroundingCityChunk>;
const known = new WeakMap<object, ReadonlySet<string>>();
const marker = Symbol("Private complete neighbourhood facade v300 transfer");
const admitted = new WeakMap<object, readonly Transfer[]>();
const bytes = (s: string) => s.length / 4 * 3 - (s.endsWith("==") ? 2 : s.endsWith("=") ? 1 : 0);
const encoded = (s: unknown): s is string => typeof s === "string" && s.length <= 16 * 1024 * 1024 && s.length % 4 === 0 && !/[^A-Za-z0-9+/=]/.test(s) && (s.indexOf("=") < 0 || (s.indexOf("=") >= s.length - 2 && /^={1,2}$/.test(s.slice(s.indexOf("=")))));
const validPart = (p: SurroundingPackedMesh) => p && p.positionType === "u16cm" && typeof p.kind === "string" && encoded(p.positions) && encoded(p.colors) && encoded(p.indices) && bytes(p.positions) % 6 === 0 && bytes(p.colors) === bytes(p.positions) / 2 && bytes(p.indices) % 12 === 0;
const samePart = (a: SurroundingPackedMesh, b: SurroundingPackedMesh) => a.kind === b.kind && a.positionType === b.positionType && a.positions === b.positions && a.colors === b.colors && a.indices === b.indices;
const originalRemains = (original: readonly SurroundingPackedMesh[], chunk: SurroundingCityChunk) => original.every((part, index) => chunk.meshes[index] && samePart(part, chunk.meshes[index]));
function previous(chunk: SurroundingCityChunk): readonly Transfer[] {
  const d = Object.getOwnPropertyDescriptor(chunk, marker);
  return d && "value" in d && d.value && typeof d.value === "object" ? admitted.get(d.value) ?? [] : [];
}
function complete(t: Transfer, chunk: SurroundingCityChunk): boolean {
  return originalRemains(t.original, chunk) && chunk.meshes.includes(t.append) &&
    chunk.origin.length === 3 && chunk.origin.every((v,i)=>v===t.origin[i]) && JSON.stringify(chunk.nav) === t.navText &&
    (t.lines ? !!chunk.lines && chunk.lines.positions === t.lines.positions && chunk.lines.colors === t.lines.colors : !chunk.lines);
}
function* fingerprint(texts: readonly string[]): Generator<void, number> {
  let hash = 2166136261;
  for (const text of texts) for (let start = 0; start < text.length; start += 65536) {
    for (let at = start; at < Math.min(start + 65536, text.length); at++) hash = Math.imul(hash ^ text.charCodeAt(at), 16777619) >>> 0;
    yield;
  }
  return hash;
}

/** Read only the eager finite index. Unknown tiles cannot inflate any recipe. */
export function neighbourhoodPacketCandidateV300(source: NeighbourhoodSourceV300, id: string, native = false): boolean {
  let keys = known.get(source);
  if (!keys) {
    if (source.schemaVersion !== 1 || !Array.isArray(source.keys) || source.keys.length > 512 || source.keys.some(k => typeof k !== "string")) return false;
    keys = new Set(source.keys); known.set(source, keys);
  }
  return keys.has(`${native ? "minecraft" : "drawn"}:${id}`);
}

/** Capture before every older preparer. Their original packet contracts remain
 * intact; the ticket owns one exact source/recipe only during its serial decode. */
export function* captureNeighbourhoodPacketV300(
  original: SurroundingCityChunk, id: string, native: boolean, enabled: boolean,
  source: NeighbourhoodSourceV300, kind: string,
): Generator<void, NeighbourhoodTicketV300 | undefined> {
  if (!enabled || !neighbourhoodPacketCandidateV300(source, id, native)) return undefined;
  const key = `${native ? "minecraft" : "drawn"}:${id}`;
  if (!Object.hasOwn(source.packets, key)) return undefined;
  const plan = source.packets[key];
  if (!plan || original.schemaVersion !== 1 || !Array.isArray(plan.origin) || plan.origin.length !== 3 ||
    original.origin.some((v, i) => !Number.isFinite(v) || v !== plan.origin[i]) ||
    !Array.isArray(plan.records) || plan.records.length !== original.meshes.length || original.meshes.length > 16 ||
    !Array.isArray(plan.owners) || !plan.owners.length || plan.owners.length > 512 || plan.owners.some(o => typeof o !== "string" || !o) ||
    !validPart(plan.append) || plan.append.kind !== kind || !bytes(plan.append.indices) ||
    !Array.isArray(plan.retire) || plan.retire.length > original.meshes.length) return undefined;
  let vertices = bytes(plan.append.positions) / 6, indices = bytes(plan.append.indices) / 4;
  for (let i = 0; i < original.meshes.length; i++) {
    const part = original.meshes[i], record = plan.records[i];
    if (!validPart(part) || !record || record.mesh !== i || record.kind !== part.kind) return undefined;
    vertices += bytes(part.positions) / 6; indices += bytes(part.indices) / 4;
  }
  if (vertices > 400000 || indices > 2400000 ||
    (yield* fingerprint([JSON.stringify(original.nav)])) !== plan.navGuard) return undefined;
  for (const record of plan.records) if ((yield* surroundingPacketFingerprint(original.meshes[record.mesh])) !== record.fingerprint) return undefined;
  if (plan.lineGuard === null ? !!original.lines : !original.lines || !encoded(original.lines.positions) ||
    !encoded(original.lines.colors ?? "") || (yield* fingerprint([original.lines.positions, original.lines.colors ?? ""])) !== plan.lineGuard) return undefined;
  if ((yield* surroundingPacketFingerprint(plan.append)) !== plan.appendFingerprint) return undefined;
  let priorMesh = -1;
  const retire: NeighbourhoodPlanV300["retire"] = [];
  for (const record of plan.retire) {
    if (!record || !Number.isSafeInteger(record.mesh) || record.mesh <= priorMesh || !original.meshes[record.mesh] || !Array.isArray(record.triangles) || !record.triangles.length) return undefined;
    const limit = bytes(original.meshes[record.mesh].indices) / 12;
    let last = -1;
    for (let i = 0; i < record.triangles.length; i++) {
      const t = record.triangles[i];
      if (!Number.isSafeInteger(t) || t <= last || t >= limit) return undefined;
      last = t; if (i % 1024 === 1023) yield;
    }
    retire.push({ mesh: record.mesh, triangles: record.triangles.slice() }); priorMesh = record.mesh;
  }
  // Validate complete authored indices before the source-fitting retirement can
  // be admitted. The final ordinary decoder retains its independent guards.
  const count = bytes(plan.append.positions) / 6;
  for (let start = 0; start < plan.append.indices.length; start += 65536) {
    const raw = atob(plan.append.indices.slice(start, start + 65536));
    for (let at = 0; at < raw.length; at += 4) {
      const n = (raw.charCodeAt(at) | raw.charCodeAt(at + 1) << 8 | raw.charCodeAt(at + 2) << 16 | raw.charCodeAt(at + 3) << 24) >>> 0;
      if (n >= count) return undefined;
    }
    yield;
  }
  const append = Object.freeze({ ...plan.append });
  const originals = original.meshes.map(part => ({ ...part }));
  const origin = original.origin.slice();
  const navGuard = plan.navGuard, lines = original.lines ? { ...original.lines } : undefined;
  const preparedNavGuard = plan.preparedNavGuard ?? navGuard, preparedLineGuard = plan.preparedLineGuard === undefined ? plan.lineGuard : plan.preparedLineGuard;
  return function* (prepared: SurroundingCityChunk): Generator<void, SurroundingCityChunk> {
    if (prepared.origin.some((v, i) => v !== origin[i]) || !originalRemains(originals, prepared) || prepared.meshes.some(p => p.kind === kind)) return prepared;
    if ((yield* fingerprint([JSON.stringify(original.nav)])) !== navGuard ||
      (lines ? !original.lines || original.lines.positions !== lines.positions || original.lines.colors !== lines.colors : !!original.lines)) return prepared;
    const navText = JSON.stringify(prepared.nav);
    if ((yield* fingerprint([navText])) !== preparedNavGuard ||
      (preparedLineGuard === null ? !!prepared.lines : !prepared.lines ||
        (yield* fingerprint([prepared.lines.positions, prepared.lines.colors ?? ""])) !== preparedLineGuard)) return prepared;
    const v = prepared.meshes.reduce((n, p) => n + bytes(p.positions) / 6, bytes(append.positions) / 6);
    const i = prepared.meshes.reduce((n, p) => n + bytes(p.indices) / 4, bytes(append.indices) / 4);
    if (prepared.meshes.length >= 16 || v > 400000 || i > 2400000) return prepared;
    const token = {}, result = { ...prepared, meshes: [...prepared.meshes, append], [marker]: token };
    admitted.set(token, [...previous(prepared), { original: originals, append, retire, origin, navText, lines: prepared.lines ? { ...prepared.lines } : undefined }]);
    return result;
  };
}

/** Append in the existing unpublished packet; no navigation, body or roof edit. */
export function* prepareNeighbourhoodPacketV300(prepared: SurroundingCityChunk, ticket?: NeighbourhoodTicketV300): Generator<void, SurroundingCityChunk> {
  return ticket ? yield* ticket(prepared) : prepared;
}

/** Complete authored fronts precede retirement of only their exact old fitting
 * triangles. Earlier retirements stay collapsed; no index is resurrected. */
export function* applyNeighbourhoodTrianglesV300(chunk: SurroundingCityChunk, mesh: number, indices: Uint16Array | Uint32Array, offset: number): Generator<void, number> {
  let count = 0;
  for (const transfer of previous(chunk)) {
    if (!complete(transfer, chunk)) continue;
    for (const record of transfer.retire) if (record.mesh === mesh) for (const triangle of record.triangles) {
      const at = offset + triangle * 3;
      if (at + 2 >= indices.length) throw Error("Neighbourhood fitting receipt escaped its exact packet");
      indices[at + 1] = indices[at]; indices[at + 2] = indices[at];
      if (++count % 1024 === 0) yield;
    }
  }
  return count;
}

export function neighbourhoodPacketAdmittedV300(chunk: SurroundingCityChunk): boolean {
  const transfers = previous(chunk);
  return !!transfers.length && transfers.every(t => complete(t, chunk));
}
