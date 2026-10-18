import data from "./data/houseCurbsV233.json";
import type { SurroundingCityChunk, SurroundingPackedMesh, SurroundingPolygon } from "./SurroundingCityGeometry";

export type HouseCurbSourceV233 = { schemaVersion: number; sourceSha256: string; ids: string[];
  packets: Record<string, { origin: number[]; guard: number; mesh: SurroundingPackedMesh }> };
const source = data as HouseCurbSourceV233;
const knownPackets = new Set(source.ids);

export function houseCurbGroundGuardV233(ground: SurroundingPolygon[]): number {
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

/** Bounded, texture-free source curb sidecar; the existing chunk builder owns
 * decoding, parking, cancellation and GPU retirement. No new resident root.
 * Drawn detail is identical on touch; native retains independent square pixels. */
export function* prepareHouseCurbsV233(
  chunk: SurroundingCityChunk, id: string, native = false, evidence: HouseCurbSourceV233 = source,
): Generator<void, SurroundingCityChunk> {
  const key = `${native ? "minecraft" : "drawn"}:${id}`;
  if (evidence === source && !knownPackets.has(key)) return chunk;
  if (chunk.meshes.some(p => p.kind === "house-curbs-v233")) return chunk;
  if (!Object.prototype.hasOwnProperty.call(evidence.packets, key)) return chunk;
  const plan = evidence.packets[key];
  if (chunk.origin.some((v, i) => v !== plan.origin[i]) || chunk.nav.groundY !== 3 ||
    houseCurbGroundGuardV233(chunk.nav.ground) !== plan.guard) return chunk;
  yield;
  return { ...chunk, meshes: [...chunk.meshes, plan.mesh] };
}
