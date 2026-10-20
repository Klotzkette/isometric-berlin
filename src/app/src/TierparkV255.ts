import data from "./data/tierparkV255.json";
import type { SurroundingBuilding, SurroundingCityChunk, SurroundingPackedMesh, SurroundingPolygon } from "./SurroundingCityGeometry";

export type TierparkSourceV255 = {
  schemaVersion: number;
  ids: string[];
  packets: Record<string, {
    origin: number[]; guard: number; mesh: SurroundingPackedMesh;
    solids: SurroundingBuilding[];
  }>;
};
const source = data as TierparkSourceV255;
// Navigation imports only polygon helpers from SurroundingCityGeometry.
// Keep this constructor-only index removable with the unused preparation path,
// so that branch does not retain the complete Tierpark source in the worker.
const known = /* @__PURE__ */ (() => new Set(source.ids))();
const KIND = "tierpark-v255";

/** Identical receipt hash, local to this stream-only owner. Importing the
 * shared decoder's helper would change its exported bindings and invalidate
 * otherwise unchanged large model chunks in already-open viewer sessions. */
export function tierparkGroundGuardV255(ground: SurroundingPolygon[]): number {
  let value = 2166136261;
  const feed = (text: string) => { for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619) >>> 0; };
  for (const polygon of ground) for (const ring of [polygon.ring, ...polygon.holes]) {
    feed("[");
    for (let i = 0; i < ring.length; i++) {
      if (i) feed(";");
      feed(ring[i].map(v => Math.floor(v * 1000 + .5)).join(","));
    }
    feed("]");
  }
  return value;
}

/** Source-bound gardens, retained-window frames and mapped play equipment.
 * Normal packet decoding owns cancellation, upload, parking and disposal.
 * The two independently prepared families keep full detail on every device. */
export function* prepareTierparkV255(
  chunk: SurroundingCityChunk, id: string, native = false,
  evidence: TierparkSourceV255 = source,
): Generator<void, SurroundingCityChunk> {
  const key = `${native ? "minecraft" : "drawn"}:${id}`;
  if ((evidence === source && !known.has(key)) ||
      chunk.meshes.some(p => p.kind === KIND)) return chunk;
  if (!Object.prototype.hasOwnProperty.call(evidence.packets, key)) return chunk;
  const plan = evidence.packets[key];
  if (evidence.schemaVersion !== 1 || plan.mesh.kind !== KIND ||
      plan.origin.length !== 3 || chunk.origin.some((v, i) => v !== plan.origin[i]) ||
      chunk.nav.groundY !== 3 || tierparkGroundGuardV255(chunk.nav.ground) !== plan.guard ||
      plan.solids.length > 100) return chunk;
  yield;
  return { ...chunk, meshes: [...chunk.meshes, plan.mesh],
    nav: plan.solids.length ? { ...chunk.nav, buildings: [...chunk.nav.buildings, ...plan.solids] } : chunk.nav };
}
