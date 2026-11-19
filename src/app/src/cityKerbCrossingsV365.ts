import { houseCurbGroundGuardV233 } from "./houseCurbsV233";
import type { SurroundingCityChunk, SurroundingPackedMesh } from "./SurroundingCityGeometry";

export type CrossingKerbPlan = {
  origin: readonly number[];
  roadsGuard: number;
  mesh: SurroundingPackedMesh;
};
export type CrossingKerbPackets = Readonly<Record<string, CrossingKerbPlan>>;

/** Admit a precalculated drawn or block-native packet on its measured street
 * margin. Flat stone caps affect neither collision nor walking height. */
export function crossingKerbPart(
  chunk: SurroundingCityChunk, plan: CrossingKerbPlan | undefined,
): SurroundingPackedMesh | undefined {
  if (!plan || chunk.nav.groundY !== 3 || !chunk.nav.roads?.length ||
      !chunk.origin.every((value, i) => value === plan.origin[i]) ||
      houseCurbGroundGuardV233(chunk.nav.roads) !== plan.roadsGuard) return undefined;
  return plan.mesh;
}
