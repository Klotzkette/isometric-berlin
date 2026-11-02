import source from "./data/mauerparkTerrainV298.json";
import type { SurroundingCityChunk, SurroundingPackedLines, SurroundingPackedMesh } from "./SurroundingCityGeometry";
import { streetCurveExtraLineVerticesV276, streetCurvesNavigationGuardV276 } from "./streetCurvesV276";

type SourceRecord = { mesh: number; kind: string; fingerprint: number };
type Part = SourceRecord & { remove: number[]; append: SurroundingPackedMesh; appendFingerprint: number };
type Ink = {
  sourceVertices: number; sourceFingerprint: number; curveVertices: number;
  curveFingerprint: number | null; records: number[][];
  append: SurroundingPackedLines; appendFingerprint: number;
};
type Plan = { origin: number[]; navGuard: number; navOffsets: number[]; records: SourceRecord[]; parts: Part[]; lines: Ink | null };
export type MauerparkTerrainEvidenceV298 = { schemaVersion: number; packets: Record<string, Partial<Record<"drawn" | "minecraft", Plan>>> };
const data = source as unknown as MauerparkTerrainEvidenceV298;
const admission = Symbol("Private complete Mauerpark terrain v298 admission");
const admitted = new WeakMap<object, { plan: Plan; original: SurroundingCityChunk }>();
const bytes = (s: string) => s.length / 4 * 3 - (s.endsWith("==") ? 2 : s.endsWith("=") ? 1 : 0);
const own = (value: object, key: string): string | null => {
  const d = Object.getOwnPropertyDescriptor(value, key);
  return d && "value" in d && typeof d.value === "string" && d.value.length % 4 === 0 && d.value.length <= 16 * 1024 * 1024 && !/[^A-Za-z0-9+/=]/.test(d.value) && (d.value.indexOf("=") < 0 || d.value.indexOf("=") >= d.value.length - 2) ? d.value : null;
};
const strings = (part: SurroundingPackedMesh): string[] | null => {
  if (!part || typeof part !== "object") return null;
  const p = own(part, "positions"), c = own(part, "colors"), i = own(part, "indices");
  return p !== null && c !== null && i !== null ? [p, c, i] : null;
};
const inkStrings = (ink: SurroundingPackedLines): string[] | null => {
  if (!ink || typeof ink !== "object") return null;
  const p = own(ink, "positions"), c = Object.hasOwn(ink, "colors") ? own(ink, "colors") : "";
  return p !== null && c !== null ? [p, c] : null;
};
function* fingerprint(parts: readonly string[]): Generator<void, number> {
  let hash = 2166136261;
  for (const s of parts) for (let a = 0; a < s.length; a += 65536) {
    for (let i = a; i < Math.min(s.length, a + 65536); i++) hash = Math.imul(hash ^ s.charCodeAt(i), 16777619) >>> 0;
    yield;
  }
  return hash;
}
const prior = (chunk: SurroundingCityChunk) => {
  const d = Object.getOwnPropertyDescriptor(chunk, admission);
  return d && "value" in d && d.value && typeof d.value === "object" ? admitted.get(d.value) : undefined;
};

/** Append complete new surfaces only after every original geometry/navigation
 * guard succeeds. All old fields and indices remain untouched for earlier
 * transfers. Private admission survives ordinary shallow packet copies. */
export function* prepareMauerparkTerrainV298(
  chunk: SurroundingCityChunk, id: string, native = false, ownersReady = false,
  evidence: MauerparkTerrainEvidenceV298 = data,
): Generator<void, SurroundingCityChunk> {
  const earlier = prior(chunk);
  if (!ownersReady) return earlier?.original ?? chunk;
  if (earlier) return chunk;
  // Reject unrelated tiles before touching the weak, compressed packet field.
  if (id !== "3_-6" && id !== "3_-5" && id !== "4_-6" && id !== "4_-5") return chunk;
  if (evidence.schemaVersion !== 1 || !Object.hasOwn(evidence.packets, id)) return chunk;
  const plan = evidence.packets[id]?.[native ? "minecraft" : "drawn"];
  if (!plan || plan.origin.length !== 3 || plan.origin.some((v, i) => !Number.isFinite(v) || v !== chunk.origin[i]) ||
    plan.navOffsets.length !== chunk.nav.buildings.length || plan.navOffsets.some(v => !Number.isFinite(v) || Math.abs(v) > 50) ||
    !plan.records.length || plan.records.length !== chunk.meshes.length || !plan.parts.length ||
    chunk.meshes.length + plan.parts.length > 16 || (yield* streetCurvesNavigationGuardV276(chunk.nav)) !== plan.navGuard) return chunk;
  let vertices = 0, indices = 0;
  for (let i = 0; i < plan.records.length; i++) {
    const r = plan.records[i], old = chunk.meshes[i], fields = strings(old);
    if (!fields || r.mesh !== i || r.kind !== old.kind || old.positionType !== "u16cm" ||
      bytes(fields[0]) % 6 || bytes(fields[1]) !== bytes(fields[0]) / 2 || bytes(fields[2]) % 12 ||
      (yield* fingerprint(fields)) !== r.fingerprint) return chunk;
    vertices += bytes(fields[0]) / 6; indices += bytes(fields[2]) / 4;
  }
  let lastMesh = -1;
  for (const p of plan.parts) {
    const old = chunk.meshes[p.mesh], extra = p.append, fields = strings(extra);
    if (!old || !Number.isSafeInteger(p.mesh) || p.mesh <= lastMesh || old.kind !== p.kind ||
      p.fingerprint !== plan.records[p.mesh]?.fingerprint || !p.remove.length ||
      p.remove.some((v, i) => !Number.isSafeInteger(v) || v < 0 || v >= bytes(old.indices) / 12 || i > 0 && v <= p.remove[i - 1]) ||
      !fields || extra.kind !== "city" || extra.positionType !== "u16cm" || !bytes(fields[0]) || bytes(fields[0]) % 6 ||
      bytes(fields[1]) !== bytes(fields[0]) / 2 || !bytes(fields[2]) || bytes(fields[2]) % 12 ||
      (yield* fingerprint(fields)) !== p.appendFingerprint) return chunk;
    vertices += bytes(fields[0]) / 6; indices += bytes(fields[2]) / 4; lastMesh = p.mesh;
    if (vertices > 400000 || indices > 2400000) return chunk;
    const decoded = atob(fields[2]), count = bytes(fields[0]) / 6;
    for (let i = 0; i < decoded.length; i += 4) {
      const index = (decoded.charCodeAt(i) | decoded.charCodeAt(i + 1) << 8 | decoded.charCodeAt(i + 2) << 16 | decoded.charCodeAt(i + 3) << 24) >>> 0;
      if (index >= count) return chunk;
      if (i % 65536 === 65532) yield;
    }
  }
  if (vertices > 400000 || indices > 2400000) return chunk;
  const ink = plan.lines;
  if (native && ink !== null) return chunk;
  if (!native && chunk.lines) {
    const original = inkStrings(chunk.lines), append = ink && inkStrings(ink.append);
    const curves = (chunk as SurroundingCityChunk & { streetCurvesV276?: { lines?: SurroundingPackedLines } }).streetCurvesV276?.lines;
    const curveFields = curves && inkStrings(curves);
    if (!ink || !original || !append || bytes(original[0]) % 12 ||
      ink.sourceVertices !== bytes(original[0]) / 6 || ink.curveVertices !== streetCurveExtraLineVerticesV276(chunk) ||
      (yield* fingerprint(original)) !== ink.sourceFingerprint ||
      (ink.curveVertices ? !curveFields || (yield* fingerprint(curveFields)) !== ink.curveFingerprint : ink.curveFingerprint !== null) ||
      bytes(append[0]) % 12 || Object.hasOwn(ink.append, "colors") !== Object.hasOwn(chunk.lines, "colors") || (append[1] && bytes(append[1]) !== bytes(append[0]) / 2) ||
      (yield* fingerprint(append)) !== ink.appendFingerprint || ink.sourceVertices + ink.curveVertices + bytes(append[0]) / 6 > 400000) return chunk;
    let cursor = 0, lastSource = -1;
    for (const r of ink.records) {
      if (r.length !== 3 || !r.every(Number.isSafeInteger) || r[0] <= lastSource || r[0] < 0 || r[0] >= (ink.sourceVertices + ink.curveVertices) / 2 ||
        r[1] !== cursor || r[2] <= 0 || (cursor + r[2]) * 2 > bytes(append[0]) / 6) return chunk;
      cursor += r[2]; lastSource = r[0];
    }
    if (cursor * 2 !== bytes(append[0]) / 6) return chunk;
  } else if (ink !== null) return chunk;
  const token = {}, result = { ...chunk, meshes: [...chunk.meshes, ...plan.parts.map(p => p.append)],
    nav: { ...chunk.nav, buildings: chunk.nav.buildings.map((b, i) => plan.navOffsets[i] ? { ...b, groundOffset: (b.groundOffset ?? 0) + plan.navOffsets[i] } : b) }, [admission]: token };
  admitted.set(token, { plan, original: chunk }); return result;
}
export const mauerparkTerrainAdmittedV298 = (chunk: SurroundingCityChunk): boolean => !!prior(chunk);
export function* applyMauerparkTerrainTrianglesV298(chunk: SurroundingCityChunk, meshIndex: number, indices: Uint16Array | Uint32Array, indexOffset: number): Generator<void, number> {
  const part = prior(chunk)?.plan.parts.find(p => p.mesh === meshIndex); if (!part) return 0;
  for (let i = 0; i < part.remove.length; i++) {
    const at = indexOffset + part.remove[i] * 3;
    if (at < 0 || at + 2 >= indices.length) throw Error("Mauerpark terrain index destination differs from its receipt");
    indices[at + 1] = indices[at]; indices[at + 2] = indices[at]; if (i % 512 === 511) yield;
  }
  return part.remove.length;
}
/** Finite extra vertices in the existing ink buffer; no new renderable. */
export function mauerparkTerrainExtraLineVerticesV298(chunk: SurroundingCityChunk): number {
  const ink = prior(chunk)?.plan.lines; return ink ? bytes(ink.append.positions) / 6 : 0;
}
/** Last line operation. Previous source indices stay stable. If an earlier
 * helper retired a source segment, its whole raised complement also retires. */
export function* applyMauerparkTerrainLinesV298(chunk: SurroundingCityChunk, values: Uint16Array, stride: number, appendStart: number): Generator<void, number> {
  const ink = prior(chunk)?.plan.lines; if (!ink) return 0;
  const count = bytes(ink.append.positions) / 6;
  if (![3, 6].includes(stride) || !Number.isSafeInteger(appendStart) || appendStart !== ink.sourceVertices + ink.curveVertices ||
    values.length !== (appendStart + count) * stride || Object.hasOwn(ink.append, "colors") !== (stride === 6)) throw Error("Mauerpark ink destination differs from its source receipt");
  const positions = atob(ink.append.positions), colours = ink.append.colors ? atob(ink.append.colors) : null;
  for (let vertex = 0; vertex < count; vertex++) {
    const at = (appendStart + vertex) * stride;
    for (let axis = 0; axis < 3; axis++) {
      const p = vertex * 6 + axis * 2; values[at + axis] = positions.charCodeAt(p) | positions.charCodeAt(p + 1) << 8;
      if (colours) values[at + 3 + axis] = colours.charCodeAt(vertex * 3 + axis) * 257;
    }
    if (vertex % 512 === 511) yield;
  }
  for (let i = 0; i < ink.records.length; i++) {
    const [source, first, length] = ink.records[i], at = source * 2 * stride;
    const retired = [0, 1, 2].every(axis => values[at + axis] === values[at + stride + axis]);
    if (retired) for (let segment = first; segment < first + length; segment++) {
      const start = (appendStart + segment * 2) * stride;
      for (let axis = 0; axis < 3; axis++) values[start + stride + axis] = values[start + axis];
    }
    for (let axis = 0; axis < 3; axis++) values[at + stride + axis] = values[at + axis];
    if (i % 512 === 511) yield;
  }
  return ink.records.length;
}
