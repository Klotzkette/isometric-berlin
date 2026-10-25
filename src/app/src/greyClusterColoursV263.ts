import manifest from "./data/greyClusterColoursV263.json";
import { houseDoorNavigationGuardV233 } from "./houseDoorsV233";
import { outerHousePaletteV262 } from "./outerHousePaletteV262";
import type { SurroundingCityChunk } from "./SurroundingCityGeometry";

type Record = {
  mesh: number; fingerprint: number; owners: string[];
  /** [original vertex, owner index, wall=0/roof=1, source low cm, high cm]. */
  rows: number[][];
};
type Plan = { origin: number[]; guard: number; records: Record[] };
export type GreyClusterColourSourceV263 = { schemaVersion: number; keys?: readonly string[]; packets: { [key: string]: Plan } };
const source = manifest as GreyClusterColourSourceV263;
const knownPackets = /* @__PURE__ */ (() => new Set(manifest.keys))();

/** Exact offline incident-face receipts resolve only formerly ambiguous generic
 * corners. Original packet, topology and navigation stay immutable. Call before
 * explicit v232/v254 material receipts, which retain their normal precedence.
 */
export function* applyGreyClusterColoursV263(
  chunk: SurroundingCityChunk, id: string, native: boolean, meshIndex: number,
  vertices: Uint16Array, vertexOffset: number, count: number,
  evidence: GreyClusterColourSourceV263 = source,
  sourcePalette = outerHousePaletteV262,
): Generator<void, number> {
  const part = chunk.meshes[meshIndex];
  if (!part || part.kind !== "city") return 0;
  const key = `${native ? "minecraft" : "drawn"}:${id}`;
  // Reject unrelated tiles using tiny eager metadata before touching the weak
  // receipt graph, including after that graph has been collected under pressure.
  if (evidence === source ? !knownPackets.has(key) : evidence.keys && !evidence.keys.includes(key)) return 0;
  if (!Object.prototype.hasOwnProperty.call(evidence.packets, key)) return 0;
  const plan = evidence.packets[key];
  if (evidence.schemaVersion !== 1 ||
      plan.origin.length !== 3 || chunk.origin.some((v, i) => v !== plan.origin[i]) ||
      houseDoorNavigationGuardV233(chunk.nav) !== plan.guard) return 0;
  const record = plan.records.find(r => r.mesh === meshIndex);
  if (!record) return 0;
  let hash = 2166136261;
  for (const text of [part.positions, part.colors, part.indices]) {
    for (let start = 0; start < text.length; start += 65_536) {
      for (let i = start; i < Math.min(start + 65_536, text.length); i++)
        hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
      yield;
    }
  }
  if (hash !== record.fingerprint) return 0;
  if (!Number.isSafeInteger(vertexOffset) || vertexOffset < 0 ||
      !Number.isSafeInteger(count) || count < 0 || (vertexOffset + count) * 6 > vertices.length ||
      record.rows.length > count || record.owners.some(v => typeof v !== "string" || !v.length))
    throw new Error("Invalid grey-cluster colour bounds");
  // Validate the complete recipe before changing even one destination value.
  let previous = -1;
  for (const row of record.rows) {
    const [vertex, owner, role, low, high] = row;
    if (row.length !== 5 || !row.every(Number.isSafeInteger) || vertex <= previous ||
        vertex >= count || owner < 0 || owner >= record.owners.length ||
        (role !== 0 && role !== 1) || !((low === -1 && high === -1) ||
          (low >= 0 && high >= low && high <= 65_535)))
      throw new Error("Invalid grey-cluster colour receipt");
    previous = vertex;
  }
  let changed = 0;
  for (const [vertex, owner, role, low, high] of record.rows) {
    const at = (vertexOffset + vertex) * 6;
    const palette = sourcePalette(record.owners[owner]);
    const tone = role ? palette.roof : palette.wall;
    const wash = !native && !role && low >= 0 && high > low
      ? .88 + .13 * Math.max(0, Math.min(1, (vertices[at + 1] - low) / (high - low))) : 1;
    for (let channel = 0; channel < 3; channel++)
      vertices[at + 3 + channel] = Math.min(255, Math.round(tone[channel] * wash)) * 257;
    if (++changed % 4096 === 0) yield;
  }
  return changed;
}
