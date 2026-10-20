import data from "./data/citywestStreetsV235.json";
import { houseCurbGroundGuardV233 } from "./houseCurbsV233";
import type { SurroundingCityChunk, SurroundingPackedMesh } from "./SurroundingCityGeometry";

export type CitywestStreetSourceV235 = { schemaVersion: number; sourceSha256: string; ids: string[];
  packets: Record<string, { origin: number[]; guard: number; groundY: number; mesh: SurroundingPackedMesh }> };
const source = data as CitywestStreetSourceV235;
const knownPackets = /* @__PURE__ */ (() => new Set(source.ids))();

/** Source-supported paint above the retained Tauentzien asphalt. Existing
 * packet lifetime, serial decoding and cancellation also own these few faces. */
export function* prepareCitywestStreetsV235(
  chunk: SurroundingCityChunk, id: string, native = false, evidence: CitywestStreetSourceV235 = source,
): Generator<void, SurroundingCityChunk> {
  const key = `${native ? "minecraft" : "drawn"}:${id}`;
  if (evidence === source && !knownPackets.has(key)) return chunk;
  if (chunk.meshes.some(p => p.kind === "citywest-streets-v235")) return chunk;
  if (!Object.prototype.hasOwnProperty.call(evidence.packets, key)) return chunk;
  const plan = evidence.packets[key];
  if (chunk.origin.some((v, i) => v !== plan.origin[i]) || chunk.nav.groundY !== plan.groundY ||
      houseCurbGroundGuardV233(chunk.nav.ground) !== plan.guard) return chunk;
  yield;
  return { ...chunk, meshes: [...chunk.meshes, plan.mesh] };
}
