import source from "./data/staatsoperV240.json";
import type { Group } from "three";
import { buildSurroundingCityChunk, type SurroundingCityChunk } from "./SurroundingCityGeometry";

/** Required source-bound recognition plus exact native shell restoration.
 * Source bodies/navigation remain in v169. Both modes retain full mobile detail.
 * The construction transaction owns cancellation and publication of this root.
 */
export function* addStaatsoperV240(root: Group, native = false): Generator<void> {
  const packet = source[native ? "minecraft" : "drawn"] as unknown as SurroundingCityChunk & { id: string };
  const result = yield* buildSurroundingCityChunk(packet, packet.id, native);
  result.root.name = "Staatsoper Unter den Linden: source-bound portico and facades v240";
  result.root.userData.fullMobileIdentical = true;
  result.root.userData.sourceEnvelopeResident = true;
  root.add(result.root);
  yield;
}
