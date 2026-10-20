import data from "./data/mainStreetEdgesV254.json";
import { houseCurbGroundGuardV233 } from "./houseCurbsV233";
import type { SurroundingCityChunk, SurroundingPackedMesh } from "./SurroundingCityGeometry";

export type MainStreetEdgesSourceV254 = {
  schemaVersion: number;
  ids: string[];
  packets: Record<string, { origin: number[]; guard: number; mesh: SurroundingPackedMesh }>;
};
const source = data as MainStreetEdgesSourceV254;
const known = new Set(source.ids);

/** Retained asphalt edges share their original packet's serial decode/disposal. */
export function* prepareMainStreetEdgesV254(
  chunk: SurroundingCityChunk, id: string, native = false,
  evidence: MainStreetEdgesSourceV254 = source,
): Generator<void, SurroundingCityChunk> {
  const key = `${native ? "minecraft" : "drawn"}:${id}`;
  if ((evidence === source && !known.has(key)) ||
      chunk.meshes.some(p => p.kind === "main-street-edges-v254")) return chunk;
  const plan = evidence.packets[key];
  if (!plan || chunk.nav.groundY !== 3 || chunk.origin.some((v, i) => v !== plan.origin[i]) ||
      houseCurbGroundGuardV233(chunk.nav.ground) !== plan.guard) return chunk;
  yield;
  return { ...chunk, meshes: [...chunk.meshes, plan.mesh] };
}
