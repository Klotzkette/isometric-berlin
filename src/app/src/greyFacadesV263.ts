import data from "./data/greyFacadesV263.json";
import { prepareOuterFacadesV262, type OuterFacadeSourceV262 } from "./outerFacadesV262";
import type { SurroundingCityChunk } from "./SurroundingCityGeometry";

export type GreyFacadeSourceV263 = OuterFacadeSourceV262;
const source = data as GreyFacadeSourceV263;

/** New exact-owner recipes share the already bounded v262 fittings transaction.
 * No v262 tile/owner is reused; previous source and authored parts stay intact. */
export function* prepareGreyFacadesV263(
  chunk: SurroundingCityChunk, id: string, native = false,
  evidence: GreyFacadeSourceV263 = source,
): Generator<void, SurroundingCityChunk> {
  if (chunk.meshes.some(part => part.kind === "grey-facades-v263")) return chunk;
  const made = yield* prepareOuterFacadesV262(chunk, id, native, evidence);
  if (made === chunk) return chunk;
  return { ...made, meshes: [...chunk.meshes,
    { ...made.meshes[made.meshes.length - 1], kind: "grey-facades-v263" }] };
}
