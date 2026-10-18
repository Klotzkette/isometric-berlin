import source from "./data/southElevatedV238Replacement.json";
import type { Group } from "three";
import { buildSurroundingCityChunk, type SurroundingCityChunk } from "./SurroundingCityGeometry";

/** The three corrected Gleisdreieck owners belong to the required scene
 * transaction. Never retire their core proxies in anticipation of a later tile. */
export function* addRequiredElevatedStationsV238(root: Group, native = false): Generator<void> {
  const packet = source.core[native ? "minecraft" : "drawn"] as unknown as SurroundingCityChunk;
  const result = yield* buildSurroundingCityChunk(packet, "required-elevated-core-v238", native);
  result.root.name = "Gleisdreieck complete open station and bridge v238";
  root.add(result.root);
  yield;
}
