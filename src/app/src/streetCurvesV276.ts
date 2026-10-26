import data from "./data/streetCurvesV276.json";
import type { SurroundingBuilding, SurroundingCityChunk, SurroundingNavigation, SurroundingPackedLines, SurroundingPackedMesh, SurroundingPolygon } from "./SurroundingCityGeometry";

export const STREET_CURVES_KIND_V276 = "street-curves-v276";
export const STREET_CURVES_MAX_ARCS_V276 = 96;
type Plan = {
  origin: number[]; guard: number;
  records: { mesh: number; kind: string; fingerprint: number }[];
  lineFingerprint: number; segments: number[];
  mesh: SurroundingPackedMesh; lines: SurroundingPackedLines; roads: SurroundingPolygon[];
};
export type StreetCurvesSourceV276 = { schemaVersion: number; keys: string[]; chunks: Record<string, Plan> };
type Prepared = SurroundingCityChunk & { streetCurvesV276?: Plan };
const source = data as StreetCurvesSourceV276;
const known = /* @__PURE__ */ (() => new Set(source.keys))();
const bytes = (s: string) => s.length / 4 * 3 - (s.endsWith("==") ? 2 : s.endsWith("=") ? 1 : 0);

function* fingerprint(parts: readonly string[]): Generator<void, number> {
  let hash = 2166136261;
  for (const text of parts) for (let start = 0; start < text.length; start += 65536) {
    for (let i = start; i < Math.min(text.length, start + 65536); i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
    yield;
  }
  return hash;
}

/** Complete source-ground, road and neighbour identity, without a full JSON copy. */
export function* streetCurvesNavigationGuardV276(nav: SurroundingNavigation): Generator<void, number> {
  let hash = 2166136261, points = 0;
  const feed = (text: string) => { for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0; };
  const numbers = (v: number[]) => feed(v.map(n => Math.floor(n * 1_000_000 + .5)).join(",") + ";");
  numbers([nav.groundY]);
  for (const name of ["ground", "water", "roads", "bridges", "buildings"] as const) {
    feed(name + ":");
    for (const p of nav[name] ?? []) {
      if (name === "buildings") {
        const building = p as SurroundingBuilding;
        feed(building.sourceId + ";"); numbers([building.minHeight, building.height, building.groundOffset ?? 0]);
      }
      for (const ring of [p.ring, ...p.holes]) {
        feed("[");
        for (const point of ring) { numbers(point); if (++points % 512 === 0) yield; }
        feed("]");
      }
    }
  }
  return hash;
}

function validPlan(plan: Plan, chunk: SurroundingCityChunk): boolean {
  const posBytes = bytes(plan.mesh.positions), indexBytes = bytes(plan.mesh.indices), lineBytes = bytes(plan.lines.positions);
  const oldLines = chunk.lines ? bytes(chunk.lines.positions) / 12 : 0;
  return plan.origin.length === 3 && chunk.origin.every((n, i) => n === plan.origin[i]) &&
    chunk.meshes.length < 16 && plan.records.length > 0 && plan.records.length <= chunk.meshes.length &&
    plan.records.every((r, i) => r.mesh === i) &&
    plan.mesh.kind === STREET_CURVES_KIND_V276 && plan.mesh.positionType === "u16cm" &&
    posBytes > 0 && posBytes % 6 === 0 && posBytes <= STREET_CURVES_MAX_ARCS_V276 * 12 * 6 &&
    indexBytes > 0 && indexBytes % 12 === 0 && bytes(plan.mesh.colors) === posBytes / 2 &&
    lineBytes > 0 && lineBytes % 12 === 0 && lineBytes <= STREET_CURVES_MAX_ARCS_V276 * 10 * 12 &&
    !!plan.lines.colors && bytes(plan.lines.colors) === lineBytes / 2 && !!chunk.lines?.colors &&
    plan.segments.length > 0 && plan.segments.length <= STREET_CURVES_MAX_ARCS_V276 &&
    new Set(plan.segments).size === plan.segments.length &&
    plan.segments.every(n => Number.isSafeInteger(n) && n >= 0 && n < oldLines) &&
    plan.roads.length === plan.segments.length && plan.roads.every(p => p.holes.length === 0 &&
      p.ring.length >= 4 && p.ring.length <= 12 && p.ring.every(v => v.length === 2 && v.every(n => Number.isFinite(n) && n >= 0 && n <= 655.35))) &&
    chunk.meshes.reduce((n, m) => n + bytes(m.positions) / 6, posBytes / 6) <= 400_000 &&
    chunk.meshes.reduce((n, m) => n + bytes(m.indices) / 4, indexBytes / 4) <= 2_400_000 &&
    oldLines * 2 + lineBytes / 6 <= 400_000 && (chunk.nav.roads?.length ?? 0) + plan.roads.length <= 20_000;
}

/** Last append-only preparation: all old packed geometry and ink remain byte-identical
 * for previous ownership guards. Only receipted circular crescents are added. Their
 * mapped source nodes, widths and old end points remain fixed. Native occupancy was
 * independently proved unchanged offline, so it needs no second smooth layer. */
export function* prepareStreetCurvesV276(
  chunk: SurroundingCityChunk, id: string, native = false, evidence: StreetCurvesSourceV276 = source,
): Generator<void, SurroundingCityChunk> {
  if (native || (evidence === source && !known.has(id))) return chunk;
  if (evidence.schemaVersion !== 1 || chunk.meshes.some(m => m.kind === STREET_CURVES_KIND_V276)) return chunk;
  const chunks = evidence.chunks;
  if (!Object.prototype.hasOwnProperty.call(chunks, id)) return chunk;
  const plan = chunks[id];
  if (!validPlan(plan, chunk) || (yield* streetCurvesNavigationGuardV276(chunk.nav)) !== plan.guard) return chunk;
  for (const record of plan.records) {
    const mesh = chunk.meshes[record.mesh];
    if (!mesh || mesh.kind !== record.kind || mesh.positionType !== "u16cm" ||
        (yield* fingerprint([mesh.positions, mesh.colors, mesh.indices])) !== record.fingerprint) return chunk;
  }
  if (!chunk.lines || (yield* fingerprint([chunk.lines.positions, chunk.lines.colors ?? ""])) !== plan.lineFingerprint) return chunk;
  const prepared: Prepared = { ...chunk, meshes: [...chunk.meshes, plan.mesh],
    nav: { ...chunk.nav, roads: [...(chunk.nav.roads ?? []), ...plan.roads] }, streetCurvesV276: plan };
  return prepared;
}

function active(chunk: SurroundingCityChunk): Plan | undefined {
  const plan = (chunk as Prepared).streetCurvesV276;
  return plan && chunk.meshes.includes(plan.mesh) ? plan : undefined;
}

/** Additional vertices of the existing ink buffer, not a new draw call or root. */
export function streetCurveExtraLineVerticesV276(chunk: SurroundingCityChunk): number {
  const plan = active(chunk);
  return plan ? bytes(plan.lines.positions) / 6 : 0;
}

/** Run after older line transfers: only exact obsolete chord segments are collapsed;
 * the replacement arcs are copied into the existing final buffer's reserved tail. */
export function* applyStreetCurveLinesV276(
  chunk: SurroundingCityChunk, values: Uint16Array, stride: number, sourceLineCount: number,
): Generator<void, number> {
  const plan = active(chunk);
  if (!plan) return 0;
  const count = streetCurveExtraLineVerticesV276(chunk);
  if (stride !== 6 || !chunk.lines || sourceLineCount !== bytes(chunk.lines.positions) / 6 ||
      values.length !== (sourceLineCount + count) * stride) throw new Error("Street curve ink destination differs from audited packet");
  const packed = atob(plan.lines.positions), colours = atob(plan.lines.colors!);
  for (let vertex = 0; vertex < count; vertex++) {
    const target = (sourceLineCount + vertex) * stride;
    for (let axis = 0; axis < 3; axis++) {
      const at = vertex * 6 + axis * 2;
      values[target + axis] = packed.charCodeAt(at) | packed.charCodeAt(at + 1) << 8;
      values[target + axis + 3] = colours.charCodeAt(vertex * 3 + axis) * 257;
    }
    if (vertex % 512 === 511) yield;
  }
  for (const segment of plan.segments) {
    const at = segment * 2 * stride;
    for (let axis = 0; axis < 3; axis++) values[at + stride + axis] = values[at + axis];
  }
  return plan.segments.length;
}
