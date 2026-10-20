import data from "./data/cityStreetsV249.json";
import { houseCurbGroundGuardV233 } from "./houseCurbsV233";
import type { SurroundingCityChunk, SurroundingPackedMesh } from "./SurroundingCityGeometry";

export type CityStreetSourceV249 = {
  schemaVersion: number;
  sourceSha256: string;
  ids: string[];
  packets: Record<string, { origin: number[]; guard: number; mesh: SurroundingPackedMesh }>;
};
const source = data as CityStreetSourceV249;
const known = /* @__PURE__ */ (() => new Set(source.ids))();

/** Exact, offline-clipped public-space complements share the existing packet's
 * serial decode, cancellation, packed buffer and disposal. No global scene root. */
export function* prepareCityStreetsV249(
  chunk: SurroundingCityChunk, id: string, native = false, evidence: CityStreetSourceV249 = source,
): Generator<void, SurroundingCityChunk> {
  const key = `${native ? "minecraft" : "drawn"}:${id}`;
  if ((evidence === source && !known.has(key)) || chunk.meshes.some(p => p.kind === "city-streets-v249")) return chunk;
  // Read the weak constructor field once; no retained module-level packet map.
  const plan = evidence.packets[key];
  if (!plan || chunk.nav.groundY !== 3 || chunk.origin.some((v, i) => v !== plan.origin[i]) ||
      houseCurbGroundGuardV233(chunk.nav.ground) !== plan.guard) return chunk;
  yield;
  return { ...chunk, meshes: [...chunk.meshes, plan.mesh] };
}
